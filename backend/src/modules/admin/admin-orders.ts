import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { textContains } from '../../common/db.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { restockOrder } from '../orders/order-effects.js';
import { canTransition } from '../orders/order-status.js';
import { PaymentsService } from '../payments/payment-providers.js';
import { closeOrderPayments } from '../payments/payment-review.js';

export class AdminOrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus }) @IsOptional() @IsIn(Object.values(OrderStatus)) status?: OrderStatus;
  @ApiPropertyOptional({ enum: PaymentStatus }) @IsOptional() @IsIn(Object.values(PaymentStatus)) paymentStatus?: PaymentStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() shopId?: string;
}

export class AdminCancelDto {
  @ApiProperty({ description: 'Shown to the customer and the shop' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(5, 300, { message: 'Give a reason (5–300 characters)' })
  reason: string;
}

@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(q: AdminOrderQueryDto) {
    const where: Prisma.OrderWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.paymentStatus && { paymentStatus: q.paymentStatus }),
      ...(q.shopId && { shopId: q.shopId }),
      ...(q.q && { OR: [{ orderNumber: textContains(q.q) }, { user: { email: textContains(q.q) } }, { user: { fullName: textContains(q.q) } }, { contactPhone: { contains: q.q } }] }),
    };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: q.order },
        skip: q.skip,
        take: q.pageSize,
        select: {
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          total: true,
          createdAt: true,
          user: { select: { id: true, fullName: true, email: true } },
          shop: { select: { id: true, name: true, slug: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const page = new Paginated(
      rows.map(({ _count, ...o }) => ({ ...o, paymentLabel: this.payments.label(o.paymentMethod), itemCount: _count.items })),
      total,
      q,
    );
    Object.assign(page.meta, { statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) });
    return page;
  }

  async detail(orderNumber: string) {
    const o = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true } },
        shop: { select: { id: true, name: true, slug: true, phone: true, email: true, ownerId: true } },
        items: { select: { id: true, title: true, variantName: true, unitPrice: true, quantity: true, lineTotal: true } },
        events: { orderBy: { createdAt: 'asc' }, select: { status: true, note: true, createdAt: true, actorId: true } },
        payments: { orderBy: { createdAt: 'desc' }, select: { id: true, provider: true, amount: true, status: true, reference: true, proofUploadId: true, submittedAt: true, reviewNote: true } },
        refunds: { orderBy: { createdAt: 'desc' }, select: { id: true, amount: true, status: true, reason: true, reference: true, createdAt: true } },
        customRequest: { select: { id: true, number: true } },
      },
    });
    if (!o) throw Errors.notFound('Order');
    const { ownerId: _owner, ...shop } = o.shop;
    return {
      ...o,
      shop,
      paymentLabel: this.payments.label(o.paymentMethod),
      canCancel: canTransition(o.status, OrderStatus.CANCELLED),
    };
  }

  /** Staff cancellation, e.g. after a dispute or a shop that stopped responding. */
  async cancel(actor: AuthUser, orderNumber: string, dto: AdminCancelDto, meta: RequestMeta) {
    const order = await this.prisma.order.findUnique({ where: { orderNumber }, include: { items: true, shop: { select: { ownerId: true } } } });
    if (!order) throw Errors.notFound('Order');
    if (!canTransition(order.status, OrderStatus.CANCELLED)) {
      throw new AppException('STATUS_NOT_ALLOWED', 'This order has already shipped or closed. Handle it as a return instead.', HttpStatus.CONFLICT);
    }
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({ where: { id: order.id, status: order.status }, data: { status: OrderStatus.CANCELLED } });
      if (!moved.count) throw new AppException('STATUS_CONFLICT', 'This order was just updated. Refresh and try again.', HttpStatus.CONFLICT);
      await restockOrder(tx, order.items);
      await closeOrderPayments(tx, order, `Cancelled by Kite Platform: ${dto.reason}`);
      await tx.orderStatusEvent.create({ data: { orderId: order.id, status: OrderStatus.CANCELLED, note: `Cancelled by Kite Platform: ${dto.reason}`, actorId: actor.id } });
    });
    await this.audit.log({ actorId: actor.id, action: 'order.admin_cancel', entityType: 'order', entityId: order.id, metadata: { from: order.status, reason: dto.reason }, meta });
    const body = `Kite Platform cancelled order ${orderNumber}: ${dto.reason}`;
    this.notifications.send({ userIds: order.userId, category: 'orders', type: 'order.admin_cancelled', title: `Order ${orderNumber} was cancelled`, body: `${body}${order.paymentStatus === PaymentStatus.PAID ? ' Your refund is being processed.' : ''}`, link: `/account/orders/${orderNumber}` });
    this.notifications.send({ userIds: order.shop.ownerId, category: 'shop', type: 'order.admin_cancelled', title: `Order ${orderNumber} was cancelled`, body, link: `/seller/orders/${orderNumber}` });
    return this.detail(orderNumber);
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.ORDERS_MANAGE)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(private readonly orders: AdminOrdersService) {}

  @Get()
  list(@Query() q: AdminOrderQueryDto) {
    return this.orders.list(q);
  }

  @Get(':orderNumber')
  detail(@Param('orderNumber') orderNumber: string) {
    return this.orders.detail(orderNumber);
  }

  @Post(':orderNumber/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an order as platform staff (restocks, closes or refunds the payment)' })
  cancel(@CurrentUser() actor: AuthUser, @Param('orderNumber') orderNumber: string, @Body() dto: AdminCancelDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.cancel(actor, orderNumber, dto, meta);
  }
}
