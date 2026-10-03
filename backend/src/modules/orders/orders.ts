import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '@prisma/client';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta } from '../../common/auth/decorators.js';
import { Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { PaymentsService } from '../payments/payment-providers.js';
import { closeOrderPayments } from '../payments/payment-review.js';
import { ShoppingModule } from '../shopping/shopping.module.js';
import { CheckoutService } from './checkout.service.js';
import { restockOrder } from './order-effects.js';
import { CUSTOMER_CANCELLABLE, ORDER_PROGRESS } from './order-status.js';
import { CancelOrderDto, PlaceOrderDto, QuoteDto } from './orders.dto.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async listMine(userId: string, query: PaginationQueryDto) {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: {
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          shop: { select: { name: true, slug: true } },
          items: { select: { title: true, imageUrl: true, quantity: true }, take: 3 },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return new Paginated(
      rows.map(({ _count, ...o }) => ({ ...o, itemCount: _count.items })),
      total,
      query,
    );
  }

  async detail(userId: string, orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      include: {
        shop: { select: { name: true, slug: true, phone: true, email: true, city: true } },
        items: { include: { product: { select: { slug: true } }, review: { select: { id: true } } } },
        events: { orderBy: { createdAt: 'asc' }, select: { status: true, note: true, createdAt: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          select: { provider: true, amount: true, status: true, metadata: true, reference: true, submittedAt: true, reviewNote: true },
        },
        refunds: { orderBy: { createdAt: 'desc' }, select: { amount: true, status: true, reference: true, createdAt: true, processedAt: true } },
      },
    });
    if (!order) throw Errors.notFound('Order');
    const payment = order.payments[0];
    return {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      discount: order.discount,
      total: order.total,
      couponCode: order.couponCode,
      deliveryMethod: order.deliveryMethod,
      shippingAddress: order.shippingAddress,
      contactPhone: order.contactPhone,
      notes: order.notes,
      shop: order.shop,
      items: order.items.map((i) => ({
        id: i.id,
        title: i.title,
        variantName: i.variantName,
        imageUrl: i.imageUrl,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        productSlug: i.product?.slug ?? null,
        canReview: order.status === OrderStatus.DELIVERED && Boolean(i.product) && !i.review,
      })),
      timeline: order.events,
      progress: ORDER_PROGRESS,
      payment: payment
        ? {
            method: payment.provider,
            label: this.payments.label(payment.provider),
            status: payment.status,
            instructions: (payment.metadata as { instructions?: string } | null)?.instructions ?? null,
            reference: payment.reference,
            submittedAt: payment.submittedAt,
            reviewNote: payment.reviewNote,
            canSubmitProof:
              payment.provider === 'bank_transfer' &&
              (payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.VERIFYING) &&
              order.status !== OrderStatus.CANCELLED,
          }
        : null,
      refunds: order.refunds,
      canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
    };
  }

  /** Customer cancellation: returns reserved stock and records the reason on the timeline. */
  async cancel(userId: string, orderNumber: string, dto: CancelOrderDto, meta: RequestMeta) {
    const order = await this.prisma.order.findFirst({ where: { orderNumber, userId }, include: { items: true } });
    if (!order) throw Errors.notFound('Order');

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: order.id, status: { in: CUSTOMER_CANCELLABLE } },
        data: { status: OrderStatus.CANCELLED },
      });
      if (moved.count === 0) throw Errors.orderNotCancellable();

      await restockOrder(tx, order.items);
      await closeOrderPayments(tx, order, 'Cancelled by the customer');
      await tx.orderStatusEvent.create({
        data: { orderId: order.id, status: OrderStatus.CANCELLED, note: dto.reason ? `Cancelled by customer: ${dto.reason}` : 'Cancelled by customer', actorId: userId },
      });
    });
    await this.audit.log({ actorId: userId, action: 'order.cancel', entityType: 'order', entityId: order.id, meta });
    const shop = await this.prisma.shop.findUnique({ where: { id: order.shopId }, select: { ownerId: true } });
    this.notifications.send({
      userIds: shop?.ownerId,
      category: 'shop',
      type: 'order.cancelled_by_customer',
      title: `Order ${orderNumber} was cancelled`,
      body: dto.reason ? `The customer cancelled it: ${dto.reason}` : 'The customer cancelled this order. The items are back in stock.',
      link: `/seller/orders/${orderNumber}`,
    });
    return this.detail(userId, orderNumber);
  }
}

@ApiTags('Checkout')
@ApiBearerAuth()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Get('options')
  @ApiOperation({ summary: 'Delivery and payment methods currently offered' })
  options() {
    return this.checkout.options();
  }

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Price the cart: per-shop subtotals, shipping, discount and total' })
  quote(@CurrentUser() user: AuthUser, @Body() dto: QuoteDto) {
    return this.checkout.quote(user.id, dto);
  }

  @Get(':checkoutId')
  @ApiOperation({ summary: 'Orders created by a checkout (for the confirmation screen)' })
  result(@CurrentUser() user: AuthUser, @Param('checkoutId') checkoutId: string) {
    return this.checkout.result(checkoutId, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Place the order (one order per shop)' })
  place(@CurrentUser() user: AuthUser, @Body() dto: PlaceOrderDto, @ReqMeta() meta: RequestMeta) {
    return this.checkout.place(user.id, dto, meta);
  }
}

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.orders.listMine(user.id, query);
  }

  @Get(':orderNumber')
  detail(@CurrentUser() user: AuthUser, @Param('orderNumber') orderNumber: string) {
    return this.orders.detail(user.id, orderNumber);
  }

  @Post(':orderNumber/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser, @Param('orderNumber') orderNumber: string, @Body() dto: CancelOrderDto, @ReqMeta() meta: RequestMeta) {
    return this.orders.cancel(user.id, orderNumber, dto, meta);
  }
}

@Module({
  imports: [ShoppingModule],
  controllers: [CheckoutController, OrdersController],
  providers: [CheckoutService, OrdersService],
})
export class OrdersModule {}
