import { randomBytes, randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { Coupon, CouponType, OrderStatus, Prisma } from '@prisma/client';

import type { RequestMeta } from '../../common/auth/decorators.js';
import { Errors } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { PaymentsService } from '../payments/payment-providers.js';
import { SettingsService } from '../settings/settings.service.js';
import { AddressesService } from '../shopping/shopping.controllers.js';
import { type CartLine, CartService } from '../shopping/cart.service.js';
import { PlaceOrderDto, QuoteDto } from './orders.dto.js';

export interface ShopQuote {
  shop: CartLine['shop'];
  items: CartLine[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
}

/** Builds numbers like KP-261002-7F3K9Q (orders) or CO-261002-… (custom requests). */
export function newOrderNumber(prefix = 'KP') {
  const d = new Date();
  const ymd = `${d.getUTCFullYear() % 100}`.padStart(2, '0') + `${d.getUTCMonth() + 1}`.padStart(2, '0') + `${d.getUTCDate()}`.padStart(2, '0');
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = [...randomBytes(6)].map((b) => alphabet[b % alphabet.length]).join('');
  return `${prefix}-${ymd}-${rand}`;
}

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly addresses: AddressesService,
    private readonly payments: PaymentsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async options() {
    const [deliveryMethods, paymentMethods] = await Promise.all([
      this.settings.get('checkout.delivery_methods'),
      this.payments.available(),
    ]);
    return { deliveryMethods, paymentMethods };
  }

  /** Prices the current cart. Totals are always computed here, never trusted from the client. */
  async quote(userId: string, dto: QuoteDto) {
    const lines = (await this.cart.lines(userId)).filter((l) => !l.savedForLater);
    if (!lines.length) throw Errors.cartEmpty();
    const blocked = lines.find((l) => l.issue);
    if (blocked) {
      throw blocked.issue === 'No longer available' ? Errors.productUnavailable(blocked.title) : Errors.outOfStock(blocked.title, blocked.available);
    }

    const methods = await this.settings.get('checkout.delivery_methods');
    const method = methods.find((m) => m.key === dto.deliveryMethod);
    if (!method) throw Errors.deliveryMethodInvalid();

    const byShop = new Map<string, ShopQuote>();
    for (const line of lines) {
      const q = byShop.get(line.shop.id) ?? { shop: line.shop, items: [], subtotal: 0, shippingFee: 0, discount: 0, total: 0 };
      q.items.push(line);
      q.subtotal += line.lineTotal;
      byShop.set(line.shop.id, q);
    }
    const shops = [...byShop.values()];
    for (const q of shops) q.shippingFee = method.freeAbove !== null && q.subtotal >= method.freeAbove ? 0 : method.fee;

    const subtotal = shops.reduce((n, q) => n + q.subtotal, 0);
    let coupon: Coupon | null = null;
    if (dto.couponCode) {
      coupon = await this.validateCoupon(dto.couponCode, subtotal);
      const discount = couponDiscount(coupon, subtotal);
      // Split the discount across shop orders in proportion to their subtotals; the last absorbs rounding.
      let remaining = discount;
      shops.forEach((q, i) => {
        q.discount = i === shops.length - 1 ? remaining : Math.floor((discount * q.subtotal) / subtotal);
        remaining -= q.discount;
      });
    }
    for (const q of shops) q.total = q.subtotal + q.shippingFee - q.discount;

    return {
      deliveryMethod: method,
      couponCode: coupon?.code ?? null,
      shops,
      subtotal,
      shippingFee: shops.reduce((n, q) => n + q.shippingFee, 0),
      discount: shops.reduce((n, q) => n + q.discount, 0),
      total: shops.reduce((n, q) => n + q.total, 0),
    };
  }

  /**
   * Places one order per shop. Stock is reserved with conditional updates inside one transaction,
   * so two shoppers can never buy the last unit twice. Sending the same `checkoutId` again
   * returns the orders already created instead of charging twice.
   */
  async place(userId: string, dto: PlaceOrderDto, meta: RequestMeta) {
    const checkoutId = dto.checkoutId ?? randomUUID();
    const already = await this.prisma.order.findMany({ where: { checkoutId, userId }, select: { orderNumber: true } });
    if (already.length) return this.result(checkoutId, userId);

    const provider = await this.payments.get(dto.paymentMethod);
    if (!provider) throw Errors.paymentMethodUnavailable();
    const address = await this.addresses.ensureOwned(userId, dto.addressId);
    const quote = await this.quote(userId, dto);
    const addressSnapshot = {
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
    };

    const orderNumbers = await this.prisma.$transaction(async (tx) => {
      for (const line of quote.shops.flatMap((s) => s.items)) {
        const reserved = line.variantId
          ? await tx.productVariant.updateMany({ where: { id: line.variantId, stock: { gte: line.quantity } }, data: { stock: { decrement: line.quantity } } })
          : await tx.product.updateMany({ where: { id: line.productId, stock: { gte: line.quantity } }, data: { stock: { decrement: line.quantity } } });
        if (reserved.count === 0) throw Errors.outOfStock(line.title, 0);
        await tx.product.update({ where: { id: line.productId }, data: { salesCount: { increment: line.quantity } } });
      }

      if (quote.couponCode) {
        const used = await tx.coupon.updateMany({
          where: { code: quote.couponCode, OR: [{ usageLimit: null }, { usageLimit: { gt: tx.coupon.fields.usedCount } }] },
          data: { usedCount: { increment: 1 } },
        });
        if (used.count === 0) throw Errors.couponInvalid('This coupon has reached its usage limit.');
      }

      const numbers: string[] = [];
      for (const q of quote.shops) {
        const orderNumber = newOrderNumber();
        numbers.push(orderNumber);
        await tx.order.create({
          data: {
            orderNumber,
            checkoutId,
            userId,
            shopId: q.shop.id,
            subtotal: q.subtotal,
            shippingFee: q.shippingFee,
            discount: q.discount,
            total: q.total,
            couponCode: quote.couponCode,
            deliveryMethod: quote.deliveryMethod.key,
            paymentMethod: provider.key,
            shippingAddress: addressSnapshot,
            contactPhone: address.phone,
            notes: dto.notes || null,
            items: {
              create: q.items.map((l) => ({
                productId: l.productId,
                variantId: l.variantId,
                title: l.title,
                variantName: l.variantName,
                imageUrl: l.image?.url ?? null,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                lineTotal: l.lineTotal,
              })),
            },
            events: { create: { status: OrderStatus.PENDING, note: 'Order placed', actorId: userId } },
          },
        });
      }

      await tx.cartItem.deleteMany({ where: { userId, savedForLater: false } });
      return numbers;
    });

    const initiation = await provider.initiate({ orderNumbers, amount: quote.total });
    const orders = await this.prisma.order.findMany({ where: { checkoutId }, select: { id: true, total: true, orderNumber: true, shop: { select: { ownerId: true } } } });
    await this.prisma.payment.createMany({
      data: orders.map((o) => ({
        orderId: o.id,
        provider: provider.key,
        amount: o.total,
        status: initiation.status,
        metadata: { instructions: initiation.instructions } satisfies Prisma.InputJsonValue,
      })),
    });
    await this.audit.log({ actorId: userId, action: 'order.place', entityType: 'checkout', entityId: checkoutId, metadata: { orderNumbers }, meta });
    this.notifications.send({
      userIds: userId,
      category: 'orders',
      type: 'order.placed',
      title: orderNumbers.length > 1 ? `${orderNumbers.length} orders placed` : `Order ${orderNumbers[0]} placed`,
      body: `Thank you! ${initiation.instructions}`,
      link: orderNumbers.length > 1 ? '/account/orders' : `/account/orders/${orderNumbers[0]}`,
    });
    for (const o of orders) {
      this.notifications.send({
        userIds: o.shop.ownerId,
        category: 'shop',
        type: 'order.new',
        title: `New order ${o.orderNumber}`,
        body: `Rs ${o.total.toLocaleString('en-PK')}, paid by ${provider.label.toLowerCase()}. Confirm it from your dashboard.`,
        link: `/seller/orders/${o.orderNumber}`,
      });
    }
    return this.result(checkoutId, userId);
  }

  /** Summary of the orders created by one checkout (confirmation page). */
  async result(checkoutId: string, userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { checkoutId, userId },
      select: { orderNumber: true, total: true, paymentMethod: true, shop: { select: { name: true } }, payments: { select: { metadata: true }, take: 1 } },
      orderBy: { createdAt: 'asc' },
    });
    if (!orders.length) throw Errors.notFound('Checkout');
    const instructions = (orders[0]?.payments[0]?.metadata as { instructions?: string } | null)?.instructions ?? null;
    return {
      checkoutId,
      paymentMethod: orders[0]?.paymentMethod,
      paymentInstructions: instructions,
      total: orders.reduce((n, o) => n + o.total, 0),
      orders: orders.map((o) => ({ orderNumber: o.orderNumber, shopName: o.shop.name, total: o.total })),
    };
  }

  private async validateCoupon(code: string, subtotal: number): Promise<Coupon> {
    const coupon = await this.prisma.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
    const now = new Date();
    if (!coupon || !coupon.isActive) throw Errors.couponInvalid('This coupon code is not valid.');
    if ((coupon.startsAt && coupon.startsAt > now) || (coupon.endsAt && coupon.endsAt < now)) {
      throw Errors.couponInvalid('This coupon is not active right now.');
    }
    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      throw Errors.couponInvalid('This coupon has reached its usage limit.');
    }
    if (subtotal < coupon.minSubtotal) {
      throw Errors.couponInvalid(`Spend at least Rs ${coupon.minSubtotal.toLocaleString('en-PK')} to use this coupon.`);
    }
    return coupon;
  }
}

export function couponDiscount(coupon: Pick<Coupon, 'type' | 'value' | 'maxDiscount'>, subtotal: number): number {
  const raw = coupon.type === CouponType.PERCENT ? Math.floor((subtotal * coupon.value) / 100) : coupon.value;
  return Math.min(subtotal, coupon.maxDiscount ?? Infinity, raw);
}
