import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderStatus, Prisma, ProductStatus } from '@prisma/client';

import { type AuthUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { InsightsQueryDto } from './seller.dto.js';
import { SellerContext } from './seller-shop.js';

/** Orders that count as sales: everything except cancelled, refunded and returned. */
const COUNTED: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];
const IN_PROGRESS: OrderStatus[] = [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.SHIPPED, OrderStatus.OUT_FOR_DELIVERY];

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class SellerInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: SellerContext,
    private readonly settings: SettingsService,
  ) {}

  async dashboard(userId: string, { days }: InsightsQueryDto) {
    const shop = await this.ctx.approvedShop(userId);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));
    const counted = { shopId: shop.id, status: { in: COUNTED } };

    const [periodOrders, allTime, pending, liveProducts, customers, topRaw, lowStock, recent] = await Promise.all([
      this.prisma.order.findMany({ where: { ...counted, createdAt: { gte: since } }, select: { createdAt: true, total: true, userId: true } }),
      this.prisma.order.aggregate({ where: { shopId: shop.id, status: OrderStatus.DELIVERED }, _sum: { total: true }, _count: true }),
      this.prisma.order.count({ where: { shopId: shop.id, status: OrderStatus.PENDING } }),
      this.prisma.product.count({ where: { shopId: shop.id, status: ProductStatus.ACTIVE } }),
      this.prisma.order.groupBy({ by: ['userId'], where: counted, orderBy: { userId: 'asc' } }),
      this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { ...counted, createdAt: { gte: since } }, productId: { not: null } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { lineTotal: 'desc' } },
        take: 5,
      }),
      this.prisma.product.findMany({
        where: {
          shopId: shop.id,
          status: { in: [ProductStatus.ACTIVE, ProductStatus.HIDDEN] },
          OR: [
            { variants: { none: { isActive: true } }, stock: { lte: this.prisma.product.fields.lowStockAt } },
            { variants: { some: { isActive: true, stock: { lte: 5 } } } },
          ],
        },
        select: { id: true, title: true, stock: true, lowStockAt: true, variants: { where: { isActive: true }, select: { name: true, stock: true } } },
        take: 8,
      }),
      this.prisma.order.findMany({
        where: { shopId: shop.id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { orderNumber: true, status: true, total: true, createdAt: true, user: { select: { fullName: true } } },
      }),
    ]);

    // Daily series with zero-filled gaps, oldest first.
    const series = Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      return { date: dayKey(d), orders: 0, revenue: 0 };
    });
    const byDay = new Map(series.map((s) => [s.date, s]));
    for (const o of periodOrders) {
      const s = byDay.get(dayKey(o.createdAt));
      if (s) {
        s.orders += 1;
        s.revenue += o.total;
      }
    }

    const titles = await this.prisma.product.findMany({
      where: { id: { in: topRaw.map((t) => t.productId!) } },
      select: { id: true, title: true, slug: true },
    });
    const periodRevenue = periodOrders.reduce((n, o) => n + o.total, 0);

    return {
      days,
      totals: {
        periodRevenue,
        periodOrders: periodOrders.length,
        averageOrderValue: periodOrders.length ? Math.round(periodRevenue / periodOrders.length) : 0,
        periodCustomers: new Set(periodOrders.map((o) => o.userId)).size,
        deliveredRevenue: allTime._sum.total ?? 0,
        deliveredOrders: allTime._count,
        pendingOrders: pending,
        liveProducts,
        customers: customers.length,
      },
      series,
      topProducts: topRaw.map((t) => ({
        ...titles.find((p) => p.id === t.productId),
        unitsSold: t._sum.quantity ?? 0,
        revenue: t._sum.lineTotal ?? 0,
      })),
      lowStock: lowStock.map((p) => ({
        id: p.id,
        title: p.title,
        stock: p.variants.length ? p.variants.reduce((n, v) => n + v.stock, 0) : p.stock,
        lowOptions: p.variants.filter((v) => v.stock <= p.lowStockAt).map((v) => `${v.name} (${v.stock})`),
      })),
      recentOrders: recent.map(({ user, ...o }) => ({ ...o, customerName: user.fullName })),
    };
  }

  /**
   * Earnings from delivered orders minus the platform commission (a setting, 0% by default).
   * This is a statement of what the shop earned; payouts arrive with the payments phase.
   */
  async earnings(userId: string, query: PaginationQueryDto) {
    const shop = await this.ctx.approvedShop(userId);
    const commissionPercent = await this.settings.get('marketplace.commission_percent');
    const commissionOf = (o: { subtotal: number; discount: number }) => Math.round(((o.subtotal - o.discount) * commissionPercent) / 100);

    const delivered: Prisma.OrderWhereInput = { shopId: shop.id, status: OrderStatus.DELIVERED };
    const [all, inProgress, rows, total] = await Promise.all([
      this.prisma.order.findMany({ where: delivered, select: { subtotal: true, discount: true, total: true } }),
      this.prisma.order.aggregate({ where: { shopId: shop.id, status: { in: IN_PROGRESS } }, _sum: { total: true }, _count: true }),
      this.prisma.order.findMany({
        where: delivered,
        orderBy: { updatedAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: { orderNumber: true, subtotal: true, discount: true, shippingFee: true, total: true, paymentMethod: true, paymentStatus: true, updatedAt: true },
      }),
      this.prisma.order.count({ where: delivered }),
    ]);

    const gross = all.reduce((n, o) => n + o.total, 0);
    const commission = all.reduce((n, o) => n + commissionOf(o), 0);
    const page = new Paginated(
      rows.map((o) => ({ ...o, deliveredAt: o.updatedAt, commission: commissionOf(o), net: o.total - commissionOf(o) })),
      total,
      query,
    );
    Object.assign(page.meta, {
      summary: {
        commissionPercent,
        grossSales: gross,
        commission,
        netEarnings: gross - commission,
        deliveredOrders: all.length,
        inProgressAmount: inProgress._sum.total ?? 0,
        inProgressOrders: inProgress._count,
      },
    });
    return page;
  }

  async customers(userId: string, query: PaginationQueryDto) {
    const shop = await this.ctx.approvedShop(userId);
    const where = { shopId: shop.id, status: { in: COUNTED } };
    const [groups, all] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['userId'],
        where,
        _count: { _all: true },
        _sum: { total: true },
        _max: { createdAt: true },
        orderBy: { _sum: { total: 'desc' } },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.order.groupBy({ by: ['userId'], where, orderBy: { userId: 'asc' } }),
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: groups.map((g) => g.userId) } },
      select: { id: true, fullName: true, profile: { select: { city: true } } },
    });
    return new Paginated(
      groups.map((g) => {
        const u = users.find((x) => x.id === g.userId);
        return { name: u?.fullName ?? 'Customer', city: u?.profile?.city ?? null, orders: g._count._all, spent: g._sum.total ?? 0, lastOrderAt: g._max.createdAt };
      }),
      all.length,
      query,
    );
  }

  async reviews(userId: string, query: PaginationQueryDto) {
    const shop = await this.ctx.approvedShop(userId);
    const where = { product: { shopId: shop.id } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id: true,
          rating: true,
          comment: true,
          isHidden: true,
          createdAt: true,
          product: { select: { title: true, slug: true } },
          user: { select: { fullName: true } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    const page = new Paginated(
      rows.map(({ user, ...r }) => ({ ...r, author: user.fullName })),
      total,
      query,
    );
    Object.assign(page.meta, { ratingAvg: shop.ratingAvg, ratingCount: shop.ratingCount });
    return page;
  }
}

@ApiTags('Seller')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.SHOP_MANAGE_OWN)
@Controller('seller')
export class SellerInsightsController {
  constructor(private readonly insights: SellerInsightsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Sales, orders, revenue and product analytics for the last 7, 30 or 90 days' })
  dashboard(@CurrentUser() user: AuthUser, @Query() query: InsightsQueryDto) {
    return this.insights.dashboard(user.id, query);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.insights.earnings(user.id, query);
  }

  @Get('customers')
  customers(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.insights.customers(user.id, query);
  }

  @Get('reviews')
  reviews(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.insights.reviews(user.id, query);
  }
}
