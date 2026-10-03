import { Body, Controller, Get, Injectable, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { type AuthUser, CurrentUser, Public, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { isUniqueViolation } from '../../common/db.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { publicProductWhere } from './catalog.mapper.js';
import { UpsertCategoryDto } from './catalog.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Active categories as a two-level tree, with the number of visible products in each. */
  async tree() {
    const rows = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        parentId: true,
        _count: { select: { products: { where: publicProductWhere } } },
      },
    });
    const toNode = (c: (typeof rows)[number]) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.imageUrl,
      productCount: c._count.products,
    });
    return rows
      .filter((c) => !c.parentId)
      .map((root) => ({ ...toNode(root), children: rows.filter((c) => c.parentId === root.id).map(toNode) }));
  }

  /** IDs of a category and its direct children, for "browse this category" filters. */
  async idsForSlug(slug: string): Promise<string[]> {
    const cat = await this.prisma.category.findUnique({ where: { slug }, select: { id: true, children: { select: { id: true } } } });
    return cat ? [cat.id, ...cat.children.map((c) => c.id)] : [];
  }

  async create(dto: UpsertCategoryDto, actorId: string, meta: RequestMeta) {
    try {
      const cat = await this.prisma.category.create({ data: dto });
      await this.audit.log({ actorId, action: 'category.create', entityType: 'category', entityId: cat.id, meta });
      return cat;
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppException('SLUG_TAKEN', 'Another category already uses this slug.', 409, [{ field: 'slug', message: 'Already in use' }]);
      throw e;
    }
  }

  async update(id: string, dto: UpsertCategoryDto, actorId: string, meta: RequestMeta) {
    if (dto.parentId === id) throw new AppException('INVALID_PARENT', 'A category cannot be its own parent.');
    const exists = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw Errors.notFound('Category');
    try {
      const cat = await this.prisma.category.update({ where: { id }, data: dto });
      await this.audit.log({ actorId, action: 'category.update', entityType: 'category', entityId: id, metadata: { name: dto.name, slug: dto.slug, isActive: dto.isActive ?? null }, meta });
      return cat;
    } catch (e) {
      if (isUniqueViolation(e)) throw new AppException('SLUG_TAKEN', 'Another category already uses this slug.', 409, [{ field: 'slug', message: 'Already in use' }]);
      throw e;
    }
  }
}

@ApiTags('Catalog')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Active categories as a tree' })
  tree() {
    return this.categories.tree();
  }

  @ApiBearerAuth()
  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCTS_MODERATE)
  create(@Body() dto: UpsertCategoryDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.categories.create(dto, user.id, meta);
  }

  @ApiBearerAuth()
  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MODERATE)
  update(@Param('id') id: string, @Body() dto: UpsertCategoryDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.categories.update(id, dto, user.id, meta);
  }
}
