import { Controller, Get, Injectable, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ShopStatus } from '@prisma/client';

import { Public } from '../../common/auth/decorators.js';
import { textContains } from '../../common/db.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { productCardSelect, publicProductWhere, shopCardSelect, toProductCard } from './catalog.mapper.js';
import { SearchQueryDto } from './catalog.dto.js';

/** Global search. Tournaments, events and players join the results in their phases. */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string) {
    const [products, shops, categories] = await Promise.all([
      this.prisma.product.findMany({
        where: { ...publicProductWhere, OR: [{ title: textContains(q) }, { description: textContains(q) }] },
        select: productCardSelect,
        orderBy: { salesCount: 'desc' },
        take: 12,
      }),
      this.prisma.shop.findMany({
        where: { status: ShopStatus.APPROVED, OR: [{ name: textContains(q) }, { city: textContains(q) }] },
        select: shopCardSelect,
        orderBy: { followerCount: 'desc' },
        take: 6,
      }),
      this.prisma.category.findMany({
        where: { isActive: true, name: textContains(q) },
        select: { name: true, slug: true },
        take: 5,
      }),
    ]);
    return { query: q, products: products.map(toProductCard), shops, categories };
  }
}

@ApiTags('Catalog')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search products, shops and categories' })
  search(@Query() { q }: SearchQueryDto) {
    return this.searchService.search(q);
  }
}
