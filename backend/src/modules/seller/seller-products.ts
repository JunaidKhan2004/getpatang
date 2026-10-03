import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma, ProductStatus } from '@prisma/client';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { textContains } from '../../common/db.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated } from '../../common/pagination.js';
import { uniqueSlug } from '../../common/slug.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { availableStock } from '../catalog/catalog.mapper.js';
import { SettingsService } from '../settings/settings.service.js';
import { UploadsService } from '../storage/uploads.js';
import { ProductRules } from './product-rules.js';
import { ProductInputDto, SellerProductQueryDto, StockUpdateDto } from './seller.dto.js';
import { SellerContext } from './seller-shop.js';

const sellerProductInclude = {
  images: { orderBy: { sortOrder: 'asc' }, select: { url: true, alt: true } },
  variants: { where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, sku: true, price: true, stock: true } },
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductInclude;

type SellerProductRow = Prisma.ProductGetPayload<{ include: typeof sellerProductInclude }>;

function toSellerProduct(p: SellerProductRow) {
  const stock = availableStock(p);
  const isLowStock = p.variants.length ? p.variants.some((v) => v.stock <= p.lowStockAt) : stock <= p.lowStockAt;
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    status: p.status,
    reviewNote: p.reviewNote,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock,
    lowStockAt: p.lowStockAt,
    isLowStock,
    sku: p.sku,
    shippingInfo: p.shippingInfo,
    videoUrl: p.videoUrl,
    specifications: (p.specifications as { label: string; value: string }[] | null) ?? [],
    images: p.images,
    variants: p.variants,
    category: p.category,
    isFeatured: p.isFeatured,
    salesCount: p.salesCount,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

@Injectable()
export class SellerProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ctx: SellerContext,
    private readonly uploads: UploadsService,
    private readonly settings: SettingsService,
    private readonly rules: ProductRules,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string, query: SellerProductQueryDto) {
    const shop = await this.ctx.approvedShop(userId);
    const and: Prisma.ProductWhereInput[] = [{ shopId: shop.id, status: query.status ?? { not: ProductStatus.REMOVED } }];
    if (query.q) and.push({ OR: [{ title: textContains(query.q) }, { sku: textContains(query.q) }] });
    if (query.lowStock) {
      and.push({
        OR: [
          { variants: { none: { isActive: true } }, stock: { lte: this.prisma.product.fields.lowStockAt } },
          // A relation filter cannot compare against the parent's lowStockAt, so options use the default level of 5.
          { variants: { some: { isActive: true, stock: { lte: 5 } } } },
        ],
      });
    }
    const where = { AND: and };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, include: sellerProductInclude, orderBy: { updatedAt: query.order }, skip: query.skip, take: query.pageSize }),
      this.prisma.product.count({ where }),
      this.prisma.product.groupBy({ by: ['status'], where: { shopId: shop.id }, _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const page = new Paginated(rows.map(toSellerProduct), total, query);
    Object.assign(page.meta, { statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) });
    return page;
  }

  async get(userId: string, id: string) {
    const shop = await this.ctx.approvedShop(userId);
    const p = await this.prisma.product.findFirst({ where: { id, shopId: shop.id, status: { not: ProductStatus.REMOVED } }, include: sellerProductInclude });
    if (!p) throw Errors.notFound('Product');
    // The edit form re-sends photos by upload id, so map each image URL back to its upload.
    const uploads = await this.prisma.upload.findMany({
      where: { ownerId: userId, purpose: 'product_image', url: { in: p.images.map((i) => i.url) } },
      select: { id: true, url: true },
    });
    const product = toSellerProduct(p);
    return { ...product, images: product.images.map((img) => ({ ...img, uploadId: uploads.find((u) => u.url === img.url)?.id ?? null })) };
  }

  private async validate(userId: string, dto: ProductInputDto) {
    await this.rules.assertAllowed(dto.title, dto.description, ...dto.variants.map((v) => v.name), ...dto.specifications.map((s) => s.value));
    const category = await this.prisma.category.findFirst({ where: { id: dto.categoryId, isActive: true }, select: { id: true } });
    if (!category) throw new AppException('CATEGORY_INVALID', 'Choose a valid category.', 400, [{ field: 'categoryId', message: 'Choose a category' }]);
    if (dto.compareAtPrice && dto.compareAtPrice <= dto.price) {
      throw new AppException('PRICE_INVALID', 'The original price must be higher than the selling price.', 400, [
        { field: 'compareAtPrice', message: 'Must be higher than the price' },
      ]);
    }
    if (dto.publish && dto.imageUploadIds.length === 0) {
      throw new AppException('IMAGES_REQUIRED', 'Add at least one photo before publishing.', 400, [{ field: 'imageUploadIds', message: 'Add at least one photo' }]);
    }
    const names = dto.variants.map((v) => v.name.toLowerCase());
    if (new Set(names).size !== names.length) {
      throw new AppException('VARIANT_DUPLICATE', 'Each option needs a different name.', 400, [{ field: 'variants', message: 'Option names must be unique' }]);
    }
    return this.uploads.ownedUploads(userId, dto.imageUploadIds, 'product_image');
  }

  private async publishStatus(publish: boolean) {
    if (!publish) return ProductStatus.DRAFT;
    return (await this.settings.get('products.require_approval')) ? ProductStatus.PENDING_APPROVAL : ProductStatus.ACTIVE;
  }

  async create(userId: string, dto: ProductInputDto, meta: RequestMeta) {
    const shop = await this.ctx.approvedShop(userId);
    const images = await this.validate(userId, dto);
    const status = await this.publishStatus(dto.publish);
    const slug = await uniqueSlug(dto.title, async (s) => Boolean(await this.prisma.product.findUnique({ where: { slug: s }, select: { id: true } })));

    const product = await this.prisma.product.create({
      data: {
        shopId: shop.id,
        categoryId: dto.categoryId,
        title: dto.title,
        slug,
        description: dto.description,
        specifications: dto.specifications.map((s) => ({ label: s.label, value: s.value })),
        shippingInfo: dto.shippingInfo || null,
        videoUrl: dto.videoUrl || null,
        price: dto.price,
        compareAtPrice: dto.compareAtPrice ?? null,
        stock: dto.variants.length ? 0 : (dto.stock ?? 0),
        sku: dto.sku || null,
        lowStockAt: dto.lowStockAt ?? 5,
        status,
        images: { create: images.map((img, i) => ({ url: img.url!, alt: dto.title, sortOrder: i })) },
        variants: { create: dto.variants.map((v) => ({ name: v.name, sku: v.sku || null, price: v.price ?? null, stock: v.stock })) },
      },
    });
    await this.audit.log({ actorId: userId, action: 'product.create', entityType: 'product', entityId: product.id, metadata: { status }, meta });
    return this.get(userId, product.id);
  }

  /**
   * Price, stock and variant changes go live immediately. Changes to what the product *is*
   * (title, description, photos, category, specs) need approval again when approval is required.
   */
  async update(userId: string, id: string, dto: ProductInputDto, meta: RequestMeta) {
    const shop = await this.ctx.approvedShop(userId);
    const current = await this.prisma.product.findFirst({
      where: { id, shopId: shop.id, status: { not: ProductStatus.REMOVED } },
      include: { images: { orderBy: { sortOrder: 'asc' } }, variants: { where: { isActive: true } } },
    });
    if (!current) throw Errors.notFound('Product');
    const images = await this.validate(userId, dto);

    const newUrls = images.map((i) => i.url);
    const contentChanged =
      current.title !== dto.title ||
      current.description !== dto.description ||
      current.categoryId !== dto.categoryId ||
      (current.videoUrl ?? null) !== (dto.videoUrl || null) ||
      JSON.stringify(current.specifications ?? []) !== JSON.stringify(dto.specifications.map((s) => ({ label: s.label, value: s.value }))) ||
      JSON.stringify(current.images.map((i) => i.url)) !== JSON.stringify(newUrls);

    let status = current.status;
    if (!dto.publish) status = current.status === ProductStatus.ACTIVE ? ProductStatus.HIDDEN : ProductStatus.DRAFT;
    else if (current.status === ProductStatus.ACTIVE) status = contentChanged ? await this.publishStatus(true) : ProductStatus.ACTIVE;
    else status = await this.publishStatus(true);

    const keepIds = dto.variants.filter((v) => v.id).map((v) => v.id!);
    if (keepIds.some((vid) => !current.variants.find((v) => v.id === vid))) throw Errors.notFound('Product option');

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          categoryId: dto.categoryId,
          title: dto.title,
          description: dto.description,
          specifications: dto.specifications.map((s) => ({ label: s.label, value: s.value })),
          shippingInfo: dto.shippingInfo || null,
          videoUrl: dto.videoUrl || null,
          price: dto.price,
          compareAtPrice: dto.compareAtPrice ?? null,
          stock: dto.variants.length ? 0 : (dto.stock ?? current.stock),
          sku: dto.sku || null,
          lowStockAt: dto.lowStockAt ?? current.lowStockAt,
          status,
          ...(status !== current.status && { reviewNote: null }),
        },
      });
      // Removed options are deactivated rather than deleted, so past orders keep their link.
      await tx.productVariant.updateMany({ where: { productId: id, id: { notIn: keepIds } }, data: { isActive: false } });
      for (const v of dto.variants) {
        const data = { name: v.name, sku: v.sku || null, price: v.price ?? null, stock: v.stock, isActive: true };
        if (v.id) await tx.productVariant.update({ where: { id: v.id }, data });
        else await tx.productVariant.create({ data: { ...data, productId: id } });
      }
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({ data: images.map((img, i) => ({ productId: id, url: img.url!, alt: dto.title, sortOrder: i })) });
    });
    await this.audit.log({ actorId: userId, action: 'product.update', entityType: 'product', entityId: id, metadata: { status, contentChanged }, meta });
    return this.get(userId, id);
  }

  async updateStock(userId: string, id: string, dto: StockUpdateDto, meta: RequestMeta) {
    const product = await this.get(userId, id);
    await this.prisma.$transaction(async (tx) => {
      if (dto.stock !== undefined && product.variants.length === 0) await tx.product.update({ where: { id }, data: { stock: dto.stock } });
      for (const [variantId, stock] of Object.entries(dto.variants ?? {})) {
        if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
          throw new AppException('STOCK_INVALID', 'Stock must be a whole number of 0 or more.');
        }
        const { count } = await tx.productVariant.updateMany({ where: { id: variantId, productId: id, isActive: true }, data: { stock } });
        if (count === 0) throw Errors.notFound('Product option');
      }
    });
    await this.audit.log({ actorId: userId, action: 'product.stock_update', entityType: 'product', entityId: id, meta });
    return this.get(userId, id);
  }

  /** Sellers can pause a live product (HIDDEN) and put it back (ACTIVE) without re-approval. */
  async setVisible(userId: string, id: string, visible: boolean, meta: RequestMeta) {
    const product = await this.get(userId, id);
    const from = visible ? ProductStatus.HIDDEN : ProductStatus.ACTIVE;
    if (product.status !== from) {
      throw new AppException('STATUS_CONFLICT', visible ? 'Only paused products can be shown again.' : 'Only live products can be paused.', HttpStatus.CONFLICT);
    }
    await this.prisma.product.update({ where: { id }, data: { status: visible ? ProductStatus.ACTIVE : ProductStatus.HIDDEN } });
    await this.audit.log({ actorId: userId, action: visible ? 'product.show' : 'product.hide', entityType: 'product', entityId: id, meta });
    return this.get(userId, id);
  }

  /** Products that were ever ordered are kept (status REMOVED) so order history stays intact. */
  async remove(userId: string, id: string, meta: RequestMeta) {
    await this.get(userId, id);
    const ordered = await this.prisma.orderItem.count({ where: { productId: id } });
    if (ordered) await this.prisma.product.update({ where: { id }, data: { status: ProductStatus.REMOVED, isFeatured: false } });
    else await this.prisma.product.delete({ where: { id } });
    await this.audit.log({ actorId: userId, action: 'product.delete', entityType: 'product', entityId: id, meta });
    return { deleted: true };
  }
}

@ApiTags('Seller')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.SHOP_MANAGE_OWN)
@Controller('seller/products')
export class SellerProductsController {
  constructor(private readonly products: SellerProductsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: SellerProductQueryDto) {
    return this.products.list(user.id, query);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.products.get(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a product (draft, or published / sent for approval)' })
  create(@CurrentUser() user: AuthUser, @Body() dto: ProductInputDto, @ReqMeta() meta: RequestMeta) {
    return this.products.create(user.id, dto, meta);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: ProductInputDto, @ReqMeta() meta: RequestMeta) {
    return this.products.update(user.id, id, dto, meta);
  }

  @Patch(':id/stock')
  @ApiOperation({ summary: 'Quick inventory update' })
  stock(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: StockUpdateDto, @ReqMeta() meta: RequestMeta) {
    return this.products.updateStock(user.id, id, dto, meta);
  }

  @Post(':id/hide')
  @HttpCode(HttpStatus.OK)
  hide(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.products.setVisible(user.id, id, false, meta);
  }

  @Post(':id/show')
  @HttpCode(HttpStatus.OK)
  show(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.products.setVisible(user.id, id, true, meta);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string, @ReqMeta() meta: RequestMeta) {
    return this.products.remove(user.id, id, meta);
  }
}
