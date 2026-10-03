import { Prisma, ProductStatus, ShopStatus } from '@prisma/client';

/** A product is visible to customers only when it is active AND its shop is approved. */
export const publicProductWhere = {
  status: ProductStatus.ACTIVE,
  shop: { status: ShopStatus.APPROVED },
} satisfies Prisma.ProductWhereInput;

export const inStockWhere = {
  OR: [{ stock: { gt: 0 }, variants: { none: { isActive: true } } }, { variants: { some: { isActive: true, stock: { gt: 0 } } } }],
} satisfies Prisma.ProductWhereInput;

export const shopCardSelect = {
  id: true,
  name: true,
  slug: true,
  city: true,
  logoUrl: true,
  bannerUrl: true,
  isVerified: true,
  ratingAvg: true,
  ratingCount: true,
  followerCount: true,
} satisfies Prisma.ShopSelect;

export type ShopCard = Prisma.ShopGetPayload<{ select: typeof shopCardSelect }>;

export const productCardSelect = {
  id: true,
  slug: true,
  title: true,
  price: true,
  compareAtPrice: true,
  stock: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  images: { select: { url: true, alt: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
  variants: { where: { isActive: true }, select: { price: true, stock: true } },
  shop: { select: { name: true, slug: true, city: true, isVerified: true } },
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

/** Total sellable units: the variants' stock if the product has variants, otherwise the product's own stock. */
export function availableStock(p: { stock: number; variants: { stock: number }[] }): number {
  return p.variants.length ? p.variants.reduce((n, v) => n + v.stock, 0) : p.stock;
}

/** Lowest price a shopper can pay (variants may override the base price). */
export function fromPrice(p: { price: number; variants: { price: number | null }[] }): number {
  return p.variants.length ? Math.min(...p.variants.map((v) => v.price ?? p.price)) : p.price;
}

export function toProductCard(p: ProductCardRow) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    price: fromPrice(p),
    compareAtPrice: p.compareAtPrice,
    hasVariants: p.variants.length > 0,
    image: p.images[0] ?? null,
    ratingAvg: Math.round(p.ratingAvg * 10) / 10,
    ratingCount: p.ratingCount,
    inStock: availableStock(p) > 0,
    shop: p.shop,
    category: p.category,
  };
}

export type ProductCard = ReturnType<typeof toProductCard>;
