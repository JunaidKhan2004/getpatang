import { Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Param, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma, ShopStatus } from '@prisma/client';

import { type AuthUser, CurrentUser, MaybeUser, OptionalAuth, Public } from '../../common/auth/decorators.js';
import { textContains } from '../../common/db.js';
import { Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { publicProductWhere, shopCardSelect } from './catalog.mapper.js';
import { ShopQueryDto } from './catalog.dto.js';

const SORTS: Record<ShopQueryDto['sort'], Prisma.ShopOrderByWithRelationInput[]> = {
  popular: [{ followerCount: 'desc' }, { ratingCount: 'desc' }],
  rating: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
  newest: [{ createdAt: 'desc' }],
};

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ShopQueryDto) {
    const where: Prisma.ShopWhereInput = {
      status: ShopStatus.APPROVED,
      ...(query.city && { city: query.city }),
      ...(query.q && { OR: [{ name: textContains(query.q) }, { description: textContains(query.q) }] }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.shop.findMany({
        where,
        select: { ...shopCardSelect, _count: { select: { products: { where: publicProductWhere } } } },
        orderBy: [...SORTS[query.sort], { id: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.shop.count({ where }),
    ]);
    return new Paginated(
      rows.map(({ _count, ...s }) => ({ ...s, productCount: _count.products })),
      total,
      query,
    );
  }

  async detail(slug: string, userId?: string) {
    const shop = await this.prisma.shop.findFirst({
      where: { slug, status: ShopStatus.APPROVED },
      select: {
        ...shopCardSelect,
        description: true,
        address: true,
        phone: true,
        email: true,
        createdAt: true,
        _count: { select: { products: { where: publicProductWhere } } },
      },
    });
    if (!shop) throw Errors.notFound('Shop');
    const isFollowing = userId
      ? Boolean(await this.prisma.shopFollower.findUnique({ where: { userId_shopId: { userId, shopId: shop.id } } }))
      : false;
    const { _count, ...rest } = shop;
    return { ...rest, productCount: _count.products, isFollowing };
  }

  /** Reviews left on any of the shop's products. */
  async reviews(slug: string, query: PaginationQueryDto) {
    const shop = await this.prisma.shop.findFirst({ where: { slug, status: ShopStatus.APPROVED }, select: { id: true } });
    if (!shop) throw Errors.notFound('Shop');
    const where: Prisma.ReviewWhereInput = { isHidden: false, product: { shopId: shop.id } };
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
          createdAt: true,
          product: { select: { title: true, slug: true } },
          user: { select: { fullName: true, profile: { select: { displayName: true } } } },
        },
      }),
      this.prisma.review.count({ where }),
    ]);
    return new Paginated(
      rows.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        product: r.product,
        author: { name: r.user.profile?.displayName ?? r.user.fullName },
      })),
      total,
      query,
    );
  }

  async setFollow(slug: string, userId: string, follow: boolean) {
    const shop = await this.prisma.shop.findFirst({ where: { slug, status: ShopStatus.APPROVED }, select: { id: true } });
    if (!shop) throw Errors.notFound('Shop');
    const key = { userId_shopId: { userId, shopId: shop.id } };

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.shopFollower.findUnique({ where: key });
      if (follow && !existing) {
        await tx.shopFollower.create({ data: { userId, shopId: shop.id } });
        await tx.shop.update({ where: { id: shop.id }, data: { followerCount: { increment: 1 } } });
      } else if (!follow && existing) {
        await tx.shopFollower.delete({ where: key });
        await tx.shop.update({ where: { id: shop.id }, data: { followerCount: { decrement: 1 } } });
      }
      const { followerCount } = await tx.shop.findUniqueOrThrow({ where: { id: shop.id }, select: { followerCount: true } });
      return { isFollowing: follow, followerCount };
    });
  }
}

@ApiTags('Catalog')
@Controller('shops')
export class ShopsController {
  constructor(private readonly shops: ShopsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse approved shops' })
  list(@Query() query: ShopQueryDto) {
    return this.shops.list(query);
  }

  @OptionalAuth()
  @Get(':slug')
  detail(@Param('slug') slug: string, @MaybeUser() user?: AuthUser) {
    return this.shops.detail(slug, user?.id);
  }

  @Public()
  @Get(':slug/reviews')
  reviews(@Param('slug') slug: string, @Query() query: PaginationQueryDto) {
    return this.shops.reviews(slug, query);
  }

  @ApiBearerAuth()
  @Put(':slug/follow')
  @HttpCode(HttpStatus.OK)
  follow(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    return this.shops.setFollow(slug, user.id, true);
  }

  @ApiBearerAuth()
  @Delete(':slug/follow')
  unfollow(@Param('slug') slug: string, @CurrentUser() user: AuthUser) {
    return this.shops.setFollow(slug, user.id, false);
  }
}
