import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { textContains } from '../../common/db.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { restockOrder } from '../orders/order-effects.js';
import { ORDER_TRANSITIONS } from '../orders/order-status.js';
import { NotificationsService } from '../notifications/notifications.js';
import { PaymentsService } from '../payments/payment-providers.js';
import { closeOrderPayments } from '../payments/payment-review.js';
import { SellerOrderQueryDto, UpdateOrderStatusDto } from './seller.dto.js';
import { SellerContext } from './seller-shop.js';

/** Refunds involve money leaving the platform, so only staff can record them (Phase 7/8). */
const SELLER_FORBIDDEN: OrderStatus[] = [OrderStatus.REFUNDED];

export const sellerNextStatuses = (from: OrderStatus) => ORDER_TRANSITIONS[from].filter((s) => !SELLER_FORBIDDEN.includes(s));

@Injectable()
export class SellerOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: SellerContext,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(userId: string, query: SellerOrderQueryDto) {
    const shop = await this.ctx.approvedShop(userId);
    const where: Prisma.OrderWhereInput = {
      shopId: shop.id,
      ...(query.status && { status: query.status }),
      ...(query.q && { OR: [{ orderNumber: textContains(query.q) }, { user: { fullName: textContains(query.q) } }] }),
    };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: query.order },
        skip: query.skip,
        take: query.pageSize,
        select: {
          orderNumber: true,
          status: true,
          total: true,
          paymentMethod: true,
          paymentStatus: true,
          createdAt: true,
          user: { select: { fullName: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], where: { shopId: shop.id }, _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const page = new Paginated(
      rows.map(({ _count, user, ...o }) => ({ ...o, customerName: user.fullName, itemCount: _count.items })),
      total,
      query,
    );
    Object.assign(page.meta, { statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) });
    return page;
  }

  async detail(userId: string, orderNumber: string) {
    const shop = await this.ctx.approvedShop(userId);
    const o = await this.prisma.order.findFirst({
      where: { orderNumber, shopId: shop.id },
      include: {
        user: { select: { fullName: true, email: true } },
        items: { include: { product: { select: { slug: true } } } },
        events: { orderBy: { createdAt: 'asc' }, select: { status: true, note: true, createdAt: true } },
        payments: { orderBy: { createdAt: 'desc' }, take: 1, select: { provider: true, status: true } },
      },
    });
    if (!o) throw Errors.notFound('Order');
    return {
      orderNumber: o.orderNumber,
      status: o.status,
      createdAt: o.createdAt,
      customer: { name: o.user.fullName, email: o.user.email, phone: o.contactPhone },
      shippingAddress: o.shippingAddress,
      notes: o.notes,
      deliveryMethod: o.deliveryMethod,
      courierName: o.courierName,
      trackingNumber: o.trackingNumber,
      subtotal: o.subtotal,
      shippingFee: o.shippingFee,
      discount: o.discount,
      total: o.total,
      payment: { method: o.paymentMethod, label: this.payments.label(o.paymentMethod), status: o.paymentStatus },
      items: o.items.map((i) => ({
        title: i.title,
        variantName: i.variantName,
        imageUrl: i.imageUrl,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        productSlug: i.product?.slug ?? null,
      })),
      timeline: o.events,
      nextStatuses: sellerNextStatuses(o.status),
    };
  }

  async updateStatus(userId: string, orderNumber: string, dto: UpdateOrderStatusDto, meta: RequestMeta) {
    const shop = await this.ctx.approvedShop(userId);
    const order = await this.prisma.order.findFirst({ where: { orderNumber, shopId: shop.id }, include: { items: true } });
    if (!order) throw Errors.notFound('Order');

    if (!sellerNextStatuses(order.status).includes(dto.status)) {
      throw new AppException('STATUS_NOT_ALLOWED', `An order that is ${order.status.toLowerCase().replace(/_/g, ' ')} cannot be marked ${dto.status.toLowerCase().replace(/_/g, ' ')}.`, HttpStatus.CONFLICT);
    }
    // Bank transfers must be verified before the shop spends anything on the order.
    const needsPayment: OrderStatus[] = [OrderStatus.PREPARING, OrderStatus.SHIPPED];
    if (order.paymentMethod === 'bank_transfer' && order.paymentStatus !== PaymentStatus.PAID && needsPayment.includes(dto.status)) {
      throw new AppException('PAYMENT_NOT_VERIFIED', 'Wait until the bank transfer is verified before preparing this order.', HttpStatus.CONFLICT);
    }
    if (dto.status === OrderStatus.CANCELLED && !dto.note) {
      throw new AppException('NOTE_REQUIRED', 'Tell the customer why the order is cancelled.', 400, [{ field: 'note', message: 'A reason is required' }]);
    }

    await this.prisma.$transaction(async (tx) => {
      // Conditional update: if someone else changed the order meanwhile, nothing happens.
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: order.status },
        data: {
          status: dto.status,
          ...(dto.status === OrderStatus.SHIPPED && { courierName: dto.courierName || null, trackingNumber: dto.trackingNumber || null }),
          // Cash collected by the rider on delivery.
          ...(dto.status === OrderStatus.DELIVERED && order.paymentMethod === 'cod' && { paymentStatus: PaymentStatus.PAID }),
        },
      });
      if (moved.count === 0) throw new AppException('STATUS_CONFLICT', 'This order was just updated. Refresh and try again.', HttpStatus.CONFLICT);

      if (dto.status === OrderStatus.CANCELLED) {
        await restockOrder(tx, order.items);
        await closeOrderPayments(tx, order, `Cancelled by the shop: ${dto.note}`);
      }
      if (dto.status === OrderStatus.RETURNED) {
        if (dto.restock) await restockOrder(tx, order.items);
        await closeOrderPayments(tx, order, dto.note ? `Returned: ${dto.note}` : 'Returned to the shop');
      }
      if (dto.status === OrderStatus.DELIVERED && order.paymentMethod === 'cod') {
        await tx.payment.updateMany({ where: { orderId: order.id, status: PaymentStatus.PENDING }, data: { status: PaymentStatus.PAID } });
      }

      const shipping = dto.status === OrderStatus.SHIPPED && (dto.courierName || dto.trackingNumber)
        ? `Shipped with ${[dto.courierName, dto.trackingNumber && `tracking ${dto.trackingNumber}`].filter(Boolean).join(', ')}`
        : null;
      await tx.orderStatusEvent.create({
        data: { orderId: order.id, status: dto.status, note: [shipping, dto.note].filter(Boolean).join('. ') || null, actorId: userId },
      });
    });

    await this.audit.log({ actorId: userId, action: 'order.status_update', entityType: 'order', entityId: order.id, metadata: { from: order.status, to: dto.status }, meta });
    const text: Partial<Record<OrderStatus, string>> = {
      CONFIRMED: `${shop.name} confirmed your order.`,
      PREPARING: `${shop.name} is preparing your order.`,
      SHIPPED: `Your order is on its way${dto.courierName ? ` with ${dto.courierName}` : ''}${dto.trackingNumber ? ` (tracking ${dto.trackingNumber})` : ''}.`,
      OUT_FOR_DELIVERY: 'Your order is out for delivery today.',
      DELIVERED: 'Your order was delivered. Enjoy flying! You can now review the items.',
      CANCELLED: `${shop.name} cancelled your order: ${dto.note}`,
      RETURNED: 'Your return was received by the shop.',
    };
    if (text[dto.status]) {
      this.notifications.send({
        userIds: order.userId,
        category: 'orders',
        type: 'order.status',
        title: `Order ${orderNumber}: ${dto.status.toLowerCase().replace(/_/g, ' ')}`,
        body: text[dto.status]!,
        link: `/account/orders/${orderNumber}`,
      });
    }
    return this.detail(userId, orderNumber);
  }
}

@ApiTags('Seller')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.SHOP_MANAGE_OWN)
@Controller('seller/orders')
export class SellerOrdersController {
  constructor(private readonly orders: SellerOrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: SellerOrderQueryDto) {
    return this.orders.list(user.id, query);
  }

  @Get(':orderNumber')
  detail(@CurrentUser() user: AuthUser, @Param('orderNumber') orderNumber: string) {
    return this.orders.detail(user.id, orderNumber);
  }

  @Post(':orderNumber/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move an order to its next status (confirm, prepare, ship, deliver, cancel, return)' })
  updateStatus(@CurrentUser() user: AuthUser, @Param('orderNumber') orderNumber: string, @Body() dto: UpdateOrderStatusDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.updateStatus(user.id, orderNumber, dto, meta);
  }
}
