import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma, ProductStatus, ShopStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { Role } from '../../common/auth/roles.js';
import { textContains } from '../../common/db.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class AdminShopQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ShopStatus })
  @IsOptional()
  @IsIn(Object.values(ShopStatus))
  status?: ShopStatus;
}

export const SHOP_DECISIONS = ['start_review', 'approve', 'reject', 'suspend', 'reinstate'] as const;

export class ShopDecisionDto {
  @ApiProperty({ enum: SHOP_DECISIONS })
  @IsIn(SHOP_DECISIONS)
  decision: (typeof SHOP_DECISIONS)[number];

  @ApiPropertyOptional({ description: 'Required when rejecting or suspending; shown to the seller' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class VerifyShopDto {
  @ApiProperty()
  @IsBoolean()
  isVerified: boolean;
}

export class AdminProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.PENDING_APPROVAL })
  @IsOptional()
  @IsIn(Object.values(ProductStatus))
  status: ProductStatus = ProductStatus.PENDING_APPROVAL;
}

export const PRODUCT_DECISIONS = ['approve', 'reject', 'hide', 'remove'] as const;

export class ProductDecisionDto {
  @ApiProperty({ enum: PRODUCT_DECISIONS })
  @IsIn(PRODUCT_DECISIONS)
  decision: (typeof PRODUCT_DECISIONS)[number];

  @ApiPropertyOptional({ description: 'Required when rejecting, hiding or removing; shown to the seller' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

/** Which shop statuses each decision may start from, and where it leads. */
const SHOP_FLOW: Record<ShopDecisionDto['decision'], { from: ShopStatus[]; to: ShopStatus; needsNote: boolean }> = {
  start_review: { from: [ShopStatus.PENDING], to: ShopStatus.UNDER_REVIEW, needsNote: false },
  approve: { from: [ShopStatus.PENDING, ShopStatus.UNDER_REVIEW], to: ShopStatus.APPROVED, needsNote: false },
  reject: { from: [ShopStatus.PENDING, ShopStatus.UNDER_REVIEW], to: ShopStatus.REJECTED, needsNote: true },
  suspend: { from: [ShopStatus.APPROVED], to: ShopStatus.SUSPENDED, needsNote: true },
  reinstate: { from: [ShopStatus.SUSPENDED], to: ShopStatus.APPROVED, needsNote: false },
};

const PRODUCT_FLOW: Record<ProductDecisionDto['decision'], { from: ProductStatus[]; to: ProductStatus; needsNote: boolean }> = {
  approve: { from: [ProductStatus.PENDING_APPROVAL, ProductStatus.REJECTED, ProductStatus.HIDDEN], to: ProductStatus.ACTIVE, needsNote: false },
  reject: { from: [ProductStatus.PENDING_APPROVAL], to: ProductStatus.REJECTED, needsNote: true },
  hide: { from: [ProductStatus.ACTIVE], to: ProductStatus.HIDDEN, needsNote: true },
  remove: { from: [ProductStatus.PENDING_APPROVAL, ProductStatus.ACTIVE, ProductStatus.HIDDEN, ProductStatus.REJECTED, ProductStatus.DRAFT], to: ProductStatus.REMOVED, needsNote: true },
};

const noteRequired = () => new AppException('NOTE_REQUIRED', 'Add a reason. The seller will see it.', 400, [{ field: 'note', message: 'A reason is required' }]);

@Injectable()
export class AdminMarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async shops(query: AdminShopQueryDto) {
    const where: Prisma.ShopWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && { OR: [{ name: textContains(query.q) }, { city: textContains(query.q) }, { owner: { email: textContains(query.q) } }] }),
    };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.shop.findMany({
        where,
        // Oldest applications first, so the queue is handled in order.
        orderBy: query.status === ShopStatus.PENDING || query.status === ShopStatus.UNDER_REVIEW ? { submittedAt: 'asc' } : { createdAt: query.order },
        skip: query.skip,
        take: query.pageSize,
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          status: true,
          isVerified: true,
          submittedAt: true,
          createdAt: true,
          owner: { select: { fullName: true, email: true } },
          _count: { select: { products: true, orders: true } },
        },
      }),
      this.prisma.shop.count({ where }),
      this.prisma.shop.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const page = new Paginated(rows, total, query);
    Object.assign(page.meta, { statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) });
    return page;
  }

  async shop(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true, createdAt: true, isVerified: true } },
        documents: { include: { upload: { select: { id: true, originalName: true, mimeType: true, size: true } } } },
        _count: { select: { products: true, orders: true, followers: true } },
      },
    });
    if (!shop) throw Errors.notFound('Shop');
    const history = await this.prisma.auditLog.findMany({
      where: { entityType: 'shop', entityId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { action: true, metadata: true, createdAt: true, actor: { select: { fullName: true } } },
    });
    return { ...shop, documents: shop.documents.map((d) => ({ type: d.type, ...d.upload })), history };
  }

  async decideShop(id: string, dto: ShopDecisionDto, actor: AuthUser, meta: RequestMeta) {
    const shop = await this.prisma.shop.findUnique({ where: { id } });
    if (!shop) throw Errors.notFound('Shop');
    const flow = SHOP_FLOW[dto.decision];
    if (!flow.from.includes(shop.status)) {
      throw new AppException('STATUS_CONFLICT', `A ${shop.status.toLowerCase().replace('_', ' ')} shop cannot be ${dto.decision.replace('_', ' ')}d.`, HttpStatus.CONFLICT);
    }
    if (flow.needsNote && !dto.note) throw noteRequired();

    await this.prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id },
        data: { status: flow.to, reviewedAt: new Date(), reviewedById: actor.id, reviewNote: dto.note ?? null },
      });
      if (flow.to === ShopStatus.APPROVED) {
        const role = await tx.role.findUniqueOrThrow({ where: { key: Role.SELLER } });
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: shop.ownerId, roleId: role.id } },
          create: { userId: shop.ownerId, roleId: role.id, assignedById: actor.id },
          update: {},
        });
      }
    });
    await this.audit.log({
      actorId: actor.id,
      action: `seller.${dto.decision}`,
      entityType: 'shop',
      entityId: id,
      metadata: { from: shop.status, to: flow.to, note: dto.note ?? null },
      meta,
    });
    const messages: Record<string, { title: string; body: string }> = {
      APPROVED: { title: 'Your shop is approved', body: `${shop.name} is live. Add products and start selling.` },
      REJECTED: { title: 'Your seller application needs changes', body: `Reason: ${dto.note}. Update your application and send it again.` },
      SUSPENDED: { title: 'Your shop is suspended', body: `Reason: ${dto.note}. Contact support if you have questions.` },
    };
    const m = messages[flow.to];
    if (m) this.notifications.send({ userIds: shop.ownerId, category: 'shop', type: `shop.${flow.to.toLowerCase()}`, ...m, link: '/seller' });
    return this.shop(id);
  }

  async verifyShop(id: string, dto: VerifyShopDto, actor: AuthUser, meta: RequestMeta) {
    const shop = await this.prisma.shop.findUnique({ where: { id }, select: { status: true } });
    if (!shop) throw Errors.notFound('Shop');
    if (dto.isVerified && shop.status !== ShopStatus.APPROVED) {
      throw new AppException('STATUS_CONFLICT', 'Only approved shops can get the verified badge.', HttpStatus.CONFLICT);
    }
    await this.prisma.shop.update({ where: { id }, data: { isVerified: dto.isVerified } });
    await this.audit.log({ actorId: actor.id, action: dto.isVerified ? 'seller.verify' : 'seller.unverify', entityType: 'shop', entityId: id, meta });
    return this.shop(id);
  }

  async products(query: AdminProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      status: query.status,
      ...(query.q && { OR: [{ title: textContains(query.q) }, { shop: { name: textContains(query.q) } }] }),
    };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: query.status === ProductStatus.PENDING_APPROVAL ? 'asc' : query.order },
        skip: query.skip,
        take: query.pageSize,
        include: {
          images: { orderBy: { sortOrder: 'asc' }, select: { url: true } },
          variants: { where: { isActive: true }, select: { name: true, price: true, stock: true } },
          category: { select: { name: true } },
          shop: { select: { id: true, name: true, slug: true, status: true } },
        },
      }),
      this.prisma.product.count({ where }),
      this.prisma.product.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const page = new Paginated(rows, total, query);
    Object.assign(page.meta, { statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) });
    return page;
  }

  async decideProduct(id: string, dto: ProductDecisionDto, actor: AuthUser, meta: RequestMeta) {
    const product = await this.prisma.product.findUnique({ where: { id }, select: { status: true, title: true, shop: { select: { ownerId: true } } } });
    if (!product) throw Errors.notFound('Product');
    const flow = PRODUCT_FLOW[dto.decision];
    if (!flow.from.includes(product.status)) {
      throw new AppException('STATUS_CONFLICT', `This product is ${product.status.toLowerCase().replace('_', ' ')} and cannot be ${dto.decision}d.`, HttpStatus.CONFLICT);
    }
    if (flow.needsNote && !dto.note) throw noteRequired();
    const { count } = await this.prisma.product.updateMany({
      where: { id, status: product.status },
      data: { status: flow.to, reviewNote: dto.note ?? null, ...(flow.to === ProductStatus.REMOVED && { isFeatured: false }) },
    });
    if (count === 0) throw new AppException('STATUS_CONFLICT', 'This product was just changed. Refresh and try again.', HttpStatus.CONFLICT);
    await this.audit.log({ actorId: actor.id, action: `product.${dto.decision}`, entityType: 'product', entityId: id, metadata: { from: product.status, to: flow.to, note: dto.note ?? null }, meta });
    this.notifications.send({
      userIds: product.shop.ownerId,
      category: 'shop',
      type: `product.${dto.decision}`,
      title: `“${product.title}” was ${flow.to === ProductStatus.ACTIVE ? 'approved' : dto.decision === 'reject' ? 'not approved' : flow.to.toLowerCase().replace('_', ' ')}`,
      body: dto.note ? `Note from the review team: ${dto.note}` : flow.to === ProductStatus.ACTIVE ? 'It is now visible in the marketplace.' : 'Open your products to see details.',
      link: `/seller/products/${id}`,
    });
    return { id, status: flow.to };
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminMarketplaceController {
  constructor(private readonly service: AdminMarketplaceService) {}

  @Get('shops')
  @RequirePermissions(PERMISSIONS.SELLERS_REVIEW)
  @ApiOperation({ summary: 'Seller applications and shops, filterable by status' })
  shops(@Query() query: AdminShopQueryDto) {
    return this.service.shops(query);
  }

  @Get('shops/:id')
  @RequirePermissions(PERMISSIONS.SELLERS_REVIEW)
  shop(@Param('id') id: string) {
    return this.service.shop(id);
  }

  @Post('shops/:id/decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.SELLERS_REVIEW)
  @ApiOperation({ summary: 'Start review, approve, reject, suspend or reinstate a seller' })
  decideShop(@Param('id') id: string, @Body() dto: ShopDecisionDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.service.decideShop(id, dto, user, meta);
  }

  @Patch('shops/:id/verification')
  @RequirePermissions(PERMISSIONS.SELLERS_REVIEW)
  verifyShop(@Param('id') id: string, @Body() dto: VerifyShopDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.service.verifyShop(id, dto, user, meta);
  }

  @Get('products')
  @RequirePermissions(PERMISSIONS.PRODUCTS_MODERATE)
  @ApiOperation({ summary: 'Product moderation queue (pending approval by default)' })
  products(@Query() query: AdminProductQueryDto) {
    return this.service.products(query);
  }

  @Post('products/:id/decision')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.PRODUCTS_MODERATE)
  decideProduct(@Param('id') id: string, @Body() dto: ProductDecisionDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.service.decideProduct(id, dto, user, meta);
  }
}
