import { Injectable } from '@nestjs/common';
import { ProductStatus, ShopStatus } from '@prisma/client';

import { Errors } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AddCartItemDto, MAX_QUANTITY, UpdateCartItemDto } from './shopping.dto.js';

const lineInclude = {
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      status: true,
      images: { select: { url: true, alt: true }, orderBy: { sortOrder: 'asc' as const }, take: 1 },
      variants: { where: { isActive: true }, select: { id: true } },
      shop: { select: { id: true, name: true, slug: true, city: true, status: true } },
    },
  },
  variant: { select: { id: true, name: true, price: true, stock: true, isActive: true } },
};

/** A cart line priced from current product data, with any problem that blocks checkout. */
export interface CartLine {
  id: string;
  productId: string;
  variantId: string | null;
  slug: string;
  title: string;
  variantName: string | null;
  image: { url: string; alt: string | null } | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  available: number;
  savedForLater: boolean;
  shop: { id: string; name: string; slug: string; city: string };
  /** Why this line cannot be checked out right now, or null. */
  issue: string | null;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async lines(userId: string): Promise<CartLine[]> {
    const rows = await this.prisma.cartItem.findMany({ where: { userId }, include: lineInclude, orderBy: { createdAt: 'asc' } });
    return rows.map((r) => {
      const p = r.product;
      const sellable = p.status === ProductStatus.ACTIVE && p.shop.status === ShopStatus.APPROVED;
      const variantOk = r.variant ? r.variant.isActive : p.variants.length === 0;
      const available = r.variant ? r.variant.stock : p.stock;
      const unitPrice = r.variant?.price ?? p.price;

      let issue: string | null = null;
      if (!sellable || !variantOk) issue = 'No longer available';
      else if (available <= 0) issue = 'Out of stock';
      else if (r.quantity > available) issue = `Only ${available} left`;

      return {
        id: r.id,
        productId: p.id,
        variantId: r.variantId,
        slug: p.slug,
        title: p.title,
        variantName: r.variant?.name ?? null,
        image: p.images[0] ?? null,
        unitPrice,
        quantity: r.quantity,
        lineTotal: unitPrice * r.quantity,
        available: Math.max(0, available),
        savedForLater: r.savedForLater,
        shop: { id: p.shop.id, name: p.shop.name, slug: p.shop.slug, city: p.shop.city },
        issue,
      };
    });
  }

  /** Cart grouped by shop (each shop becomes its own order at checkout). */
  async view(userId: string) {
    const all = await this.lines(userId);
    const active = all.filter((l) => !l.savedForLater);
    const groups = new Map<string, { shop: CartLine['shop']; items: CartLine[]; subtotal: number }>();
    for (const line of active) {
      const g = groups.get(line.shop.id) ?? { shop: line.shop, items: [], subtotal: 0 };
      g.items.push(line);
      if (!line.issue) g.subtotal += line.lineTotal;
      groups.set(line.shop.id, g);
    }
    return {
      shops: [...groups.values()],
      savedForLater: all.filter((l) => l.savedForLater),
      itemCount: active.reduce((n, l) => n + l.quantity, 0),
      subtotal: active.filter((l) => !l.issue).reduce((n, l) => n + l.lineTotal, 0),
      canCheckout: active.length > 0 && active.every((l) => !l.issue),
    };
  }

  async add(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, status: ProductStatus.ACTIVE, shop: { status: ShopStatus.APPROVED } },
      select: { title: true, stock: true, variants: { where: { isActive: true }, select: { id: true, stock: true } } },
    });
    if (!product) throw Errors.productUnavailable();

    let available = product.stock;
    if (product.variants.length) {
      if (!dto.variantId) throw Errors.variantRequired();
      const variant = product.variants.find((v) => v.id === dto.variantId);
      if (!variant) throw Errors.productUnavailable(product.title);
      available = variant.stock;
    } else if (dto.variantId) {
      throw Errors.productUnavailable(product.title);
    }

    const existing = await this.prisma.cartItem.findFirst({
      where: { userId, productId: dto.productId, variantId: dto.variantId ?? null },
    });
    const quantity = Math.min(MAX_QUANTITY, (existing && !existing.savedForLater ? existing.quantity : 0) + dto.quantity);
    if (quantity > available) throw Errors.outOfStock(product.title, available);

    if (existing) {
      await this.prisma.cartItem.update({ where: { id: existing.id }, data: { quantity, savedForLater: false } });
    } else {
      await this.prisma.cartItem.create({ data: { userId, productId: dto.productId, variantId: dto.variantId ?? null, quantity } });
    }
    return this.view(userId);
  }

  async update(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, userId } });
    if (!item) throw Errors.notFound('Cart item');
    if (dto.quantity !== undefined) {
      const line = (await this.lines(userId)).find((l) => l.id === itemId)!;
      if (dto.quantity > line.available) throw Errors.outOfStock(line.title, line.available);
    }
    await this.prisma.cartItem.update({ where: { id: itemId }, data: dto });
    return this.view(userId);
  }

  async remove(userId: string, itemId: string) {
    await this.prisma.cartItem.deleteMany({ where: { id: itemId, userId } });
    return this.view(userId);
  }

  async count(userId: string) {
    const agg = await this.prisma.cartItem.aggregate({ where: { userId, savedForLater: false }, _sum: { quantity: true } });
    return { itemCount: agg._sum.quantity ?? 0 };
  }
}
