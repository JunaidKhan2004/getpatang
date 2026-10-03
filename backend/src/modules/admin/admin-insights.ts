import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { EventStatus, MatchStatus, OrderStatus, PaymentStatus, Prisma, ProductStatus, RefundStatus, ReportStatus, ShopStatus, TournamentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

import { type AuthUser, CurrentUser, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { textContains } from '../../common/db.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const DAY = 24 * 3600 * 1000;
/** Pakistan time: days in charts start at midnight PKT. */
const PKT_OFFSET = 5 * 3600 * 1000;
const dayKey = (d: Date) => new Date(d.getTime() + PKT_OFFSET).toISOString().slice(0, 10);

export class AuditQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Action prefix, e.g. "order." or "user.suspended"' }) @IsOptional() @IsString() action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() actorId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

export class RangeQueryDto {
  @ApiPropertyOptional({ enum: [7, 30, 90], default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  days: number = 30;
}

@Injectable()
export class AdminInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  async audit(q: AuditQueryDto) {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.action && { action: { startsWith: q.action } }),
      ...(q.entityType && { entityType: q.entityType }),
      ...(q.entityId && { entityId: q.entityId }),
      ...(q.actorId && { actorId: q.actorId }),
      ...((q.from || q.to) && { createdAt: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) } }),
      ...(q.q && { OR: [{ actor: { fullName: textContains(q.q) } }, { actor: { email: textContains(q.q) } }, { entityId: q.q }] }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          actor: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return new Paginated(rows, total, q);
  }

  /** Work waiting for staff, filtered to what this person can act on. */
  async queues(user: AuthUser) {
    const can = (p: string) => user.permissions.has(p);
    const count = async (allowed: boolean, fn: () => Promise<number>) => (allowed ? fn() : null);
    const [sellerApplications, productsPending, paymentsToVerify, refundsToSend, openReports, disputes, activeTournaments] = await Promise.all([
      count(can(PERMISSIONS.SELLERS_REVIEW), () => this.prisma.shop.count({ where: { status: { in: [ShopStatus.PENDING, ShopStatus.UNDER_REVIEW] } } })),
      count(can(PERMISSIONS.PRODUCTS_MODERATE), () => this.prisma.product.count({ where: { status: ProductStatus.PENDING_APPROVAL } })),
      count(can(PERMISSIONS.PAYMENTS_MANAGE), () => this.prisma.payment.count({ where: { status: PaymentStatus.VERIFYING } })),
      count(can(PERMISSIONS.PAYMENTS_MANAGE), () => this.prisma.refund.count({ where: { status: RefundStatus.PENDING } })),
      count(can(PERMISSIONS.REPORTS_HANDLE) || can(PERMISSIONS.COMMUNITY_MODERATE), async () =>
        (await this.prisma.report.groupBy({ by: ['targetType', 'targetId'], where: { status: { in: [ReportStatus.OPEN, ReportStatus.IN_REVIEW] } }, orderBy: { targetId: 'asc' } })).length,
      ),
      count(can(PERMISSIONS.TOURNAMENTS_MANAGE), () => this.prisma.match.count({ where: { status: MatchStatus.DISPUTED } })),
      count(can(PERMISSIONS.TOURNAMENTS_MANAGE), () => this.prisma.tournament.count({ where: { status: TournamentStatus.IN_PROGRESS } })),
    ]);
    return { sellerApplications, productsPending, paymentsToVerify, refundsToSend, openReports, disputes, activeTournaments };
  }

  /** Platform numbers for the dashboard and analytics page. Only real, stored data. */
  async analytics(q: RangeQueryDto) {
    const since = new Date(Date.now() - q.days * DAY);
    const placed = { createdAt: { gte: since }, status: { not: OrderStatus.CANCELLED } };
    const [users, newUsers, orders, gross, delivered, ordersByStatus, shops, liveProducts, posts, upcomingEvents, signupDates, orderRows, topShops] = await Promise.all([
      this.prisma.user.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.order.count({ where: placed }),
      this.prisma.order.aggregate({ where: placed, _sum: { total: true } }),
      this.prisma.order.aggregate({ where: { status: OrderStatus.DELIVERED, updatedAt: { gte: since } }, _sum: { total: true }, _count: true }),
      this.prisma.order.groupBy({ by: ['status'], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { status: 'asc' } }),
      this.prisma.shop.count({ where: { status: ShopStatus.APPROVED } }),
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.post.count({ where: { createdAt: { gte: since } } }),
      this.prisma.event.count({ where: { status: EventStatus.PUBLISHED, startsAt: { gte: new Date() } } }),
      this.prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.order.findMany({ where: placed, select: { createdAt: true, total: true } }),
      this.prisma.order.groupBy({
        by: ['shopId'],
        where: placed,
        _sum: { total: true },
        _count: { _all: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
    ]);
    const shopNames = await this.prisma.shop.findMany({ where: { id: { in: topShops.map((s) => s.shopId) } }, select: { id: true, name: true, slug: true } });

    const days = Array.from({ length: q.days }, (_, i) => dayKey(new Date(Date.now() - (q.days - 1 - i) * DAY)));
    const daily = days.map((date) => ({ date, signups: 0, orders: 0, revenue: 0 }));
    const byDate = new Map(daily.map((d) => [d.date, d]));
    for (const u of signupDates) {
      const d = byDate.get(dayKey(u.createdAt));
      if (d) d.signups++;
    }
    for (const o of orderRows) {
      const d = byDate.get(dayKey(o.createdAt));
      if (d) {
        d.orders++;
        d.revenue += o.total;
      }
    }

    return {
      days: q.days,
      totals: {
        users,
        newUsers,
        orders,
        grossOrderValue: gross._sum.total ?? 0,
        deliveredOrders: delivered._count,
        deliveredValue: delivered._sum.total ?? 0,
        shops,
        liveProducts,
        posts,
        upcomingEvents,
      },
      ordersByStatus: Object.fromEntries(ordersByStatus.map((s) => [s.status, (s._count as { _all: number })._all])),
      topShops: topShops.map((s) => ({ ...shopNames.find((n) => n.id === s.shopId), orders: (s._count as { _all: number })._all, value: s._sum?.total ?? 0 })),
      daily,
    };
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminInsightsController {
  constructor(private readonly insights: AdminInsightsService) {}

  @Get('audit-logs')
  @RequirePermissions(PERMISSIONS.AUDIT_READ)
  audit(@Query() q: AuditQueryDto) {
    return this.insights.audit(q);
  }

  @Get('queues')
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS)
  @ApiOperation({ summary: 'Counts of work waiting for staff, limited to what the caller may act on' })
  queues(@CurrentUser() user: AuthUser) {
    return this.insights.queues(user);
  }

  @Get('analytics')
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS, PERMISSIONS.ORDERS_MANAGE)
  analytics(@Query() q: RangeQueryDto) {
    return this.insights.analytics(q);
  }
}
