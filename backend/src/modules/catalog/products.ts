import { Body, Controller, Get, Injectable, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrderStatus, Prisma } from '@prisma/client';

import {
  type AuthUser,
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  Public,
  ReqMeta,
  type RequestMeta,
} from '../../common/auth/decorators.js';
import { textContains } from '../../common/db.js';
import { Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  availableStock,
  inStockWhere,
  productCardSelect,
  publicProductWhere,
  shopCardSelect,
  toProductCard,
} from './catalog.mapper.js';
import { CreateReviewDto, ProductQueryDto, type ProductSort } from './catalog.dto.js';
import { CategoriesService } from './categories.js';

const SORTS: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  popular: [{ salesCount: 'desc' }, { ratingCount: 'desc' }],
  rating: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
  price_asc: [{ price: 'asc' }],
  price_desc: [{ price: 'desc' }],
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ProductQueryDto) {
    const and: Prisma.ProductWhereInput[] = [publicProductWhere];
    if (query.q) and.push({ OR: [{ title: textContains(query.q) }, { description: textContains(query.q) }] });
    if (query.category) and.push({ categoryId: { in: await this.categories.idsForSlug(query.category) } });
    if (query.shop) and.push({ shop: { slug: query.shop } });
    if (query.city) and.push({ shop: { city: query.city } });
    if (query.minPrice !== undefined) and.push({ price: { gte: query.minPrice } });
    if (query.maxPrice !== undefined) and.push({ price: { lte: query.maxPrice } });
    if (query.minRating) and.push({ ratingAvg: { gte: query.minRating } });
    if (query.inStock) and.push(inStockWhere);

    const where: Prisma.ProductWhereInput = { AND: and };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: productCardSelect,
        // On a shop page the seller's featured products come first.
        orderBy: [...(query.shop ? [{ isFeatured: 'desc' as const }] : []), ...SORTS[query.sort], { id: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return new Paginated(rows.map(toProductCard), total, query);
  }

  async detail(slug: string, userId?: string) {
    const p = await this.prisma.product.findFirst({
      where: { slug, ...publicProductWhere },
      include: {
        images: { orderBy: { sortOrder: 'asc' }, select: { url: true, alt: true } },
        variants: { where: { isActive: true }, select: { id: true, name: true, price: true, stock: true }, orderBy: { name: 'asc' } },
        shop: { select: { ...shopCardSelect, phone: true, description: true } },
        category: { select: { name: true, slug: true } },
      },
    });
    if (!p) throw Errors.notFound('Product');

    const [isWishlisted, related] = await Promise.all([
      userId
        ? this.prisma.wishlistItem.findUnique({ where: { userId_productId: { userId, productId: p.id } } }).then(Boolean)
        : Promise.resolve(false),
      this.prisma.product.findMany({
        where: { ...publicProductWhere, categoryId: p.categoryId, id: { not: p.id } },
        select: productCardSelect,
        orderBy: { salesCount: 'desc' },
        take: 8,
      }),
    ]);

    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      specifications: (p.specifications as { label: string; value: string }[] | null) ?? [],
      shippingInfo: p.shippingInfo,
      videoUrl: p.videoUrl,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      stock: availableStock(p),
      images: p.images,
      variants: p.variants.map((v) => ({ id: v.id, name: v.name, price: v.price ?? p.price, stock: v.stock })),
      ratingAvg: Math.round(p.ratingAvg * 10) / 10,
      ratingCount: p.ratingCount,
      shop: p.shop,
      category: p.category,
      isWishlisted,
      related: related.map(toProductCard),
    };
  }

  async reviews(slug: string, query: PaginationQueryDto) {
    const product = await this.prisma.product.findFirst({ where: { slug, ...publicProductWhere }, select: { id: true } });
    if (!product) throw Errors.notFound('Product');
    const where: Prisma.ReviewWhereInput = { productId: product.id, isHidden: false };
    const [rows, total, distribution] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: { createdAt: query.order },
        skip: query.skip,
        take: query.pageSize,
        select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { fullName: true, profile: { select: { displayName: true, city: true } } } } },
      }),
      this.prisma.review.count({ where }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: { _all: true }, orderBy: { rating: 'desc' } }),
    ]);
    const page = new Paginated(
      rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        author: { name: r.user.profile?.displayName ?? r.user.fullName, city: r.user.profile?.city ?? null },
      })),
      total,
      query,
    );
    Object.assign(page.meta, {
      distribution: Object.fromEntries([5, 4, 3, 2, 1].map((s) => [s, distribution.find((d) => d.rating === s)?._count?._all ?? 0])),
    });
    return page;
  }

  /** Only a customer whose order containing this product was delivered may review it, once. */
  async createReview(slug: string, userId: string, dto: CreateReviewDto, meta: RequestMeta) {
    const product = await this.prisma.product.findFirst({ where: { slug, ...publicProductWhere }, select: { id: true, shopId: true } });
    if (!product) throw Errors.notFound('Product');

    const orderItem = await this.prisma.orderItem.findFirst({
      where: { productId: product.id, order: { userId, status: OrderStatus.DELIVERED } },
      select: { id: true },
    });
    if (!orderItem) throw Errors.reviewNotAllowed();
    if (await this.prisma.review.findUnique({ where: { productId_userId: { productId: product.id, userId } } })) {
      throw Errors.alreadyReviewed();
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: { productId: product.id, userId, orderItemId: orderItem.id, rating: dto.rating, comment: dto.comment || null },
      });
      const p = await tx.review.aggregate({ where: { productId: product.id, isHidden: false }, _avg: { rating: true }, _count: true });
      await tx.product.update({ where: { id: product.id }, data: { ratingAvg: p._avg.rating ?? 0, ratingCount: p._count } });
      const s = await tx.review.aggregate({ where: { product: { shopId: product.shopId }, isHidden: false }, _avg: { rating: true }, _count: true });
      await tx.shop.update({ where: { id: product.shopId }, data: { ratingAvg: s._avg.rating ?? 0, ratingCount: s._count } });
      return created;
    });
    await this.audit.log({ actorId: userId, action: 'review.create', entityType: 'product', entityId: product.id, meta });
    return review;
  }
}

@ApiTags('Catalog')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse and filter products' })
  list(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  @OptionalAuth()
  @Get(':slug')
  @ApiOperation({ summary: 'Product details (adds isWishlisted when signed in)' })
  detail(@Param('slug') slug: string, @MaybeUser() user?: AuthUser) {
    return this.products.detail(slug, user?.id);
  }

  @Public()
  @Get(':slug/reviews')
  reviews(@Param('slug') slug: string, @Query() query: PaginationQueryDto) {
    return this.products.reviews(slug, query);
  }

  @ApiBearerAuth()
  @Post(':slug/reviews')
  @ApiOperation({ summary: 'Review a product you received' })
  createReview(@Param('slug') slug: string, @Body() dto: CreateReviewDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.products.createReview(slug, user.id, dto, meta);
  }
}
