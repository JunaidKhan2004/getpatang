import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Module, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus, Prisma, RefundStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { textContains } from '../../common/db.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { canTransition } from '../orders/order-status.js';
import { UploadsService } from '../storage/uploads.js';
import { isManualTransfer, MANUAL_TRANSFER_METHODS, PaymentsService } from './payment-providers.js';

type Tx = Prisma.TransactionClient;
const OPEN_PAYMENT: PaymentStatus[] = [PaymentStatus.PENDING, PaymentStatus.VERIFYING];
const formatPKR = (n: number) => `Rs ${n.toLocaleString('en-PK')}`;

/**
 * Settles payments when an order is cancelled or returned: unpaid ones are closed, and money already
 * received becomes a pending refund that payments staff complete (see AdminPaymentsController).
 */
export async function closeOrderPayments(tx: Tx, order: { id: string; paymentStatus: PaymentStatus }, reason: string) {
  await tx.payment.updateMany({ where: { orderId: order.id, status: { in: OPEN_PAYMENT } }, data: { status: PaymentStatus.FAILED } });
  if (OPEN_PAYMENT.includes(order.paymentStatus)) {
    await tx.order.update({ where: { id: order.id }, data: { paymentStatus: PaymentStatus.FAILED } });
  }
  const paid = await tx.payment.findMany({ where: { orderId: order.id, status: PaymentStatus.PAID } });
  for (const p of paid) {
    const exists = await tx.refund.findFirst({ where: { paymentId: p.id } });
    if (!exists) await tx.refund.create({ data: { orderId: order.id, paymentId: p.id, amount: p.amount, reason } });
  }
}

// ─── DTOs ───────────────────────────────────────────────────────────────────

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class PaymentProofDto {
  @ApiProperty({ description: 'Transaction id or reference from the bank / wallet' })
  @Transform(trim)
  @IsString()
  @Length(4, 64, { message: 'Enter the transaction ID or reference (4–64 characters)' })
  reference: string;

  @ApiPropertyOptional({ description: 'Upload id (purpose payment_proof): receipt screenshot or PDF' })
  @IsOptional()
  @IsString()
  proofUploadId?: string;
}

export class PaymentQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: PaymentStatus }) @IsOptional() @IsIn(Object.values(PaymentStatus)) status?: PaymentStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() provider?: string;
}

export class ReviewPaymentDto {
  @ApiProperty({ enum: ['approve', 'reject'] }) @IsIn(['approve', 'reject']) decision: 'approve' | 'reject';
  @ApiPropertyOptional({ description: 'Required when rejecting; shown to the customer' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RefundQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: RefundStatus }) @IsOptional() @IsIn(Object.values(RefundStatus)) status?: RefundStatus;
}

export class CompleteRefundDto {
  @ApiProperty({ description: 'Bank / wallet reference of the money sent back' })
  @Transform(trim)
  @IsString()
  @Length(4, 64, { message: 'Enter the refund transaction reference' })
  reference: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class PaymentReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly payments: PaymentsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /**
   * The customer reports a bank or wallet transfer. One transfer can cover every order from the same checkout,
   * so the details apply to all of that checkout's unpaid orders paid by transfer.
   */
  async submitProof(userId: string, orderNumber: string, dto: PaymentProofDto, meta: RequestMeta) {
    const order = await this.prisma.order.findFirst({ where: { orderNumber, userId } });
    if (!order) throw Errors.notFound('Order');
    const siblings = await this.prisma.order.findMany({
      where: { checkoutId: order.checkoutId, userId, paymentMethod: { in: MANUAL_TRANSFER_METHODS }, status: { notIn: [OrderStatus.CANCELLED] } },
      include: { payments: { where: { status: { in: OPEN_PAYMENT } } } },
    });
    const payable = siblings.filter((o) => o.payments.length > 0);
    if (!payable.length) throw new AppException('PAYMENT_NOT_OPEN', 'There is no payment waiting for details on this order.', HttpStatus.CONFLICT);
    const [proof] = await this.uploads.ownedUploads(userId, dto.proofUploadId ? [dto.proofUploadId] : [], 'payment_proof');

    await this.prisma.$transaction(async (tx) => {
      for (const o of payable) {
        await tx.payment.updateMany({
          where: { orderId: o.id, status: { in: OPEN_PAYMENT } },
          data: { status: PaymentStatus.VERIFYING, reference: dto.reference, proofUploadId: proof?.id ?? null, submittedAt: new Date(), reviewNote: null },
        });
        await tx.order.update({ where: { id: o.id }, data: { paymentStatus: PaymentStatus.VERIFYING } });
      }
    });
    await this.audit.log({ actorId: userId, action: 'payment.proof_submitted', entityType: 'order', entityId: order.id, metadata: { orders: payable.map((o) => o.orderNumber) }, meta });
    this.notifications.send({
      userIds: await this.notifications.staffWith(PERMISSIONS.PAYMENTS_MANAGE),
      exclude: userId,
      category: 'account',
      type: 'payment.to_verify',
      title: 'Payment to verify',
      body: `${payable.map((o) => o.orderNumber).join(', ')}: reference ${dto.reference}.`,
      link: '/admin/payments?status=VERIFYING',
    });
    return { orders: payable.map((o) => o.orderNumber), status: PaymentStatus.VERIFYING, message: 'Thanks. We will confirm your payment after checking it.' };
  }

  async list(q: PaymentQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.provider && { provider: q.provider }),
      ...(q.q && { OR: [{ order: { orderNumber: textContains(q.q) } }, { reference: textContains(q.q) }] }),
    };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        skip: q.skip,
        take: q.pageSize,
        include: {
          order: { select: { orderNumber: true, status: true, total: true, user: { select: { fullName: true, email: true } }, shop: { select: { name: true } } } },
          reviewedBy: { select: { fullName: true } },
        },
      }),
      this.prisma.payment.count({ where }),
      this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const page = new Paginated(
      rows.map((p) => ({
        id: p.id,
        provider: p.provider,
        providerLabel: this.payments.label(p.provider),
        amount: p.amount,
        status: p.status,
        reference: p.reference,
        proofUploadId: p.proofUploadId,
        submittedAt: p.submittedAt,
        reviewedAt: p.reviewedAt,
        reviewedBy: p.reviewedBy?.fullName ?? null,
        reviewNote: p.reviewNote,
        createdAt: p.createdAt,
        order: { orderNumber: p.order.orderNumber, status: p.order.status, total: p.order.total, shop: p.order.shop.name, customer: p.order.user.fullName, email: p.order.user.email },
      })),
      total,
      q,
    );
    Object.assign(page.meta, { statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) });
    return page;
  }

  async review(actorId: string, id: string, dto: ReviewPaymentDto, meta: RequestMeta) {
    if (dto.decision === 'reject' && !dto.note) {
      throw new AppException('NOTE_REQUIRED', 'Tell the customer what is wrong with the payment.', 400, [{ field: 'note', message: 'A reason is required' }]);
    }
    const payment = await this.prisma.payment.findUnique({ where: { id }, include: { order: true } });
    if (!payment) throw Errors.notFound('Payment');
    if (payment.status !== PaymentStatus.VERIFYING && !(dto.decision === 'approve' && payment.status === PaymentStatus.PENDING && isManualTransfer(payment.provider))) {
      throw new AppException('PAYMENT_STATE', 'Only payments waiting for verification can be reviewed.', HttpStatus.CONFLICT);
    }
    if (payment.order.status === OrderStatus.CANCELLED) throw new AppException('PAYMENT_STATE', 'This order was cancelled.', HttpStatus.CONFLICT);
    const approve = dto.decision === 'approve';

    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.payment.updateMany({
        where: { id, status: payment.status },
        data: { status: approve ? PaymentStatus.PAID : PaymentStatus.PENDING, reviewedAt: new Date(), reviewedById: actorId, reviewNote: dto.note || null },
      });
      if (!moved.count) throw new AppException('PAYMENT_STATE', 'This payment was just reviewed. Refresh and try again.', HttpStatus.CONFLICT);
      await tx.order.update({ where: { id: payment.orderId }, data: { paymentStatus: approve ? PaymentStatus.PAID : PaymentStatus.PENDING } });
      await tx.orderStatusEvent.create({
        data: { orderId: payment.orderId, status: payment.order.status, note: approve ? 'Payment received and verified.' : `Payment could not be verified: ${dto.note}`, actorId },
      });
    });
    await this.audit.log({ actorId, action: approve ? 'payment.verify' : 'payment.reject', entityType: 'payment', entityId: id, metadata: { orderNumber: payment.order.orderNumber }, meta });

    const shopOwner = (await this.prisma.shop.findUnique({ where: { id: payment.order.shopId }, select: { ownerId: true } }))?.ownerId;
    this.notifications.send({
      userIds: payment.order.userId,
      category: 'payments',
      type: approve ? 'payment.verified' : 'payment.rejected',
      title: approve ? `Payment received for ${payment.order.orderNumber}` : `Please check your payment for ${payment.order.orderNumber}`,
      body: approve ? `We verified your payment of ${formatPKR(payment.amount)}. The shop will now prepare your order.` : `We could not verify your transfer: ${dto.note} Please send the correct details from your order page.`,
      link: `/account/orders/${payment.order.orderNumber}`,
    });
    if (approve) {
      this.notifications.send({
        userIds: shopOwner,
        category: 'shop',
        type: 'payment.verified_seller',
        title: `Order ${payment.order.orderNumber} is paid`,
        body: 'The payment was verified. You can prepare and ship the order.',
        link: `/seller/orders/${payment.order.orderNumber}`,
      });
    }
    return { id, status: approve ? PaymentStatus.PAID : PaymentStatus.PENDING };
  }

  async refunds(q: RefundQueryDto) {
    const where: Prisma.RefundWhereInput = { ...(q.status && { status: q.status }), ...(q.q && { order: { orderNumber: textContains(q.q) } }) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        include: {
          order: { select: { orderNumber: true, status: true, paymentMethod: true, contactPhone: true, user: { select: { fullName: true, email: true } } } },
          processedBy: { select: { fullName: true } },
        },
      }),
      this.prisma.refund.count({ where }),
    ]);
    return new Paginated(
      rows.map((r) => ({
        id: r.id,
        amount: r.amount,
        reason: r.reason,
        status: r.status,
        reference: r.reference,
        createdAt: r.createdAt,
        processedAt: r.processedAt,
        processedBy: r.processedBy?.fullName ?? null,
        order: { orderNumber: r.order.orderNumber, status: r.order.status, method: this.payments.label(r.order.paymentMethod), customer: r.order.user.fullName, email: r.order.user.email, phone: r.order.contactPhone },
      })),
      total,
      q,
    );
  }

  /** Staff record that the money went back to the customer. */
  async completeRefund(actorId: string, id: string, dto: CompleteRefundDto, meta: RequestMeta) {
    const refund = await this.prisma.refund.findUnique({ where: { id }, include: { order: true } });
    if (!refund) throw Errors.notFound('Refund');
    await this.prisma.$transaction(async (tx) => {
      const moved = await tx.refund.updateMany({
        where: { id, status: RefundStatus.PENDING },
        data: { status: RefundStatus.COMPLETED, reference: dto.reference, processedById: actorId, processedAt: new Date() },
      });
      if (!moved.count) throw new AppException('REFUND_STATE', 'This refund is already completed.', HttpStatus.CONFLICT);
      if (refund.paymentId) await tx.payment.update({ where: { id: refund.paymentId }, data: { status: PaymentStatus.REFUNDED } });
      const open = await tx.refund.count({ where: { orderId: refund.orderId, status: RefundStatus.PENDING } });
      if (!open) {
        const toRefunded = canTransition(refund.order.status, OrderStatus.REFUNDED);
        await tx.order.update({
          where: { id: refund.orderId },
          data: { paymentStatus: PaymentStatus.REFUNDED, ...(toRefunded && { status: OrderStatus.REFUNDED }) },
        });
        await tx.orderStatusEvent.create({
          data: { orderId: refund.orderId, status: toRefunded ? OrderStatus.REFUNDED : refund.order.status, note: `Refund of ${formatPKR(refund.amount)} sent (reference ${dto.reference}).`, actorId },
        });
      }
    });
    await this.audit.log({ actorId, action: 'refund.complete', entityType: 'refund', entityId: id, metadata: { orderNumber: refund.order.orderNumber, amount: refund.amount }, meta });
    this.notifications.send({
      userIds: refund.order.userId,
      category: 'payments',
      type: 'refund.completed',
      title: `Refund sent for ${refund.order.orderNumber}`,
      body: `We sent ${formatPKR(refund.amount)} back to you (reference ${dto.reference}). It can take a few working days to show in your account.`,
      link: `/account/orders/${refund.order.orderNumber}`,
    });
    return { id, status: RefundStatus.COMPLETED };
  }
}

// ─── Controllers ────────────────────────────────────────────────────────────

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderPaymentController {
  constructor(private readonly review: PaymentReviewService) {}

  @Post(':orderNumber/payment-proof')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send bank or wallet transfer details for verification' })
  submit(@CurrentUser() user: AuthUser, @Param('orderNumber') orderNumber: string, @Body() dto: PaymentProofDto, @ReqMeta() meta: RequestMeta) {
    return this.review.submitProof(user.id, orderNumber, dto, meta);
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.PAYMENTS_MANAGE)
@Controller('admin')
export class AdminPaymentsController {
  constructor(private readonly review: PaymentReviewService) {}

  @Get('payments')
  list(@Query() q: PaymentQueryDto) {
    return this.review.list(q);
  }

  @Post('payments/:id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a bank or wallet transfer' })
  reviewPayment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ReviewPaymentDto, @ReqMeta() meta: RequestMeta) {
    return this.review.review(user.id, id, dto, meta);
  }

  @Get('refunds')
  refunds(@Query() q: RefundQueryDto) {
    return this.review.refunds(q);
  }

  @Post('refunds/:id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record that a refund was sent' })
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CompleteRefundDto, @ReqMeta() meta: RequestMeta) {
    return this.review.completeRefund(user.id, id, dto, meta);
  }
}

@Module({
  controllers: [OrderPaymentController, AdminPaymentsController],
  providers: [PaymentReviewService],
})
export class PaymentReviewModule {}
