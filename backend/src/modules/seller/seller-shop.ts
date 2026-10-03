import { Body, Controller, Get, HttpStatus, Injectable, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, PickType } from '@nestjs/swagger';
import { Prisma, ShopStatus } from '@prisma/client';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { AppException } from '../../common/errors/app.exception.js';
import { uniqueSlug } from '../../common/slug.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { UploadsService } from '../storage/uploads.js';
import { SellerApplicationDto, UpdateShopDto } from './seller.dto.js';

export const sellerErrors = {
  noShop: () => new AppException('NO_SHOP', 'You have not applied to sell yet.', HttpStatus.NOT_FOUND),
  notApproved: (status: ShopStatus) =>
    new AppException(
      'SHOP_NOT_APPROVED',
      status === ShopStatus.SUSPENDED
        ? 'Your shop is suspended. Please contact support.'
        : 'Your shop is not approved yet. You can manage products once it is approved.',
      HttpStatus.FORBIDDEN,
    ),
  applicationLocked: () =>
    new AppException('APPLICATION_LOCKED', 'Your application is being reviewed and cannot be changed right now.', HttpStatus.CONFLICT),
  documentsMissing: () =>
    new AppException('DOCUMENTS_MISSING', 'Upload both sides of your CNIC.', HttpStatus.BAD_REQUEST, [
      { field: 'documents', message: 'Upload both sides of your CNIC' },
    ]),
};

/** Resolves the caller's shop for seller endpoints. */
@Injectable()
export class SellerContext {
  constructor(private readonly prisma: PrismaService) {}

  async approvedShop(userId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    if (!shop) throw sellerErrors.noShop();
    if (shop.status !== ShopStatus.APPROVED) throw sellerErrors.notApproved(shop.status);
    return shop;
  }
}

export class PayoutDto extends PickType(SellerApplicationDto, ['payoutMethod', 'payoutAccountTitle', 'payoutAccountNumber'] as const) {}

const applicationSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  logoUrl: true,
  bannerUrl: true,
  city: true,
  address: true,
  phone: true,
  email: true,
  status: true,
  isVerified: true,
  cnicNumber: true,
  payoutMethod: true,
  payoutAccountTitle: true,
  payoutAccountNumber: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  acceptsCustomOrders: true,
  createdAt: true,
  documents: { select: { type: true, upload: { select: { id: true, originalName: true, mimeType: true, size: true } } } },
} satisfies Prisma.ShopSelect;

@Injectable()
export class SellerShopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
    private readonly ctx: SellerContext,
    private readonly settings: SettingsService,
  ) {}

  /** The caller's application/shop in any status, or null if they never applied. */
  async application(userId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { ownerId: userId }, select: applicationSelect });
    return shop ? { ...shop, documents: shop.documents.map((d) => ({ type: d.type, ...d.upload })) } : null;
  }

  async submit(userId: string, dto: SellerApplicationDto, meta: RequestMeta) {
    const existing = await this.prisma.shop.findUnique({ where: { ownerId: userId } });
    const editable: ShopStatus[] = [ShopStatus.PENDING, ShopStatus.REJECTED];
    if (existing && !editable.includes(existing.status)) throw sellerErrors.applicationLocked();

    const types = new Set(dto.documents.map((d) => d.type));
    if (!types.has('cnic_front') || !types.has('cnic_back')) throw sellerErrors.documentsMissing();
    const docs = await this.uploads.ownedUploads(userId, dto.documents.map((d) => d.uploadId), 'seller_document');
    const [logo] = await this.uploads.ownedUploads(userId, dto.logoUploadId ? [dto.logoUploadId] : [], 'shop_logo');

    const fields = {
      name: dto.shopName,
      description: dto.description,
      phone: dto.phone,
      email: dto.email,
      city: dto.city,
      address: dto.address,
      cnicNumber: dto.cnicNumber,
      payoutMethod: dto.payoutMethod,
      payoutAccountTitle: dto.payoutAccountTitle,
      payoutAccountNumber: dto.payoutAccountNumber.toUpperCase(),
      ...(logo && { logoUrl: logo.url }),
      status: ShopStatus.PENDING,
      submittedAt: new Date(),
      reviewNote: null,
    };

    const shop = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.shop.update({ where: { id: existing.id }, data: fields })
        : await tx.shop.create({
            data: {
              ...fields,
              ownerId: userId,
              slug: await uniqueSlug(dto.shopName, async (s) => Boolean(await tx.shop.findUnique({ where: { slug: s }, select: { id: true } }))),
            },
          });
      await tx.shopDocument.deleteMany({ where: { shopId: saved.id } });
      await tx.shopDocument.createMany({
        data: dto.documents.map((d, i) => ({ shopId: saved.id, type: d.type, uploadId: docs[i].id })),
      });
      return saved;
    });

    await this.audit.log({ actorId: userId, action: existing ? 'seller.application_resubmit' : 'seller.application_submit', entityType: 'shop', entityId: shop.id, meta });
    return this.application(userId);
  }

  async shop(userId: string) {
    const shop = await this.ctx.approvedShop(userId);
    const featured = await this.prisma.product.findMany({ where: { shopId: shop.id, isFeatured: true }, select: { id: true } });
    const app = await this.application(userId);
    const requireApproval = await this.settings.get('products.require_approval');
    return { ...app, featuredProductIds: featured.map((f) => f.id), requireApproval };
  }

  /** Name, city and web address stay fixed after approval; changing them needs support (admin restriction). */
  async updateShop(userId: string, dto: UpdateShopDto, meta: RequestMeta) {
    const shop = await this.ctx.approvedShop(userId);
    const [logo] = await this.uploads.ownedUploads(userId, dto.logoUploadId ? [dto.logoUploadId] : [], 'shop_logo');
    const [banner] = await this.uploads.ownedUploads(userId, dto.bannerUploadId ? [dto.bannerUploadId] : [], 'shop_banner');

    if (dto.featuredProductIds) {
      const owned = await this.prisma.product.count({ where: { id: { in: dto.featuredProductIds }, shopId: shop.id } });
      if (owned !== new Set(dto.featuredProductIds).size) throw new AppException('PRODUCT_NOT_FOUND', 'Featured products must be from your shop.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: shop.id },
        data: {
          description: dto.description,
          phone: dto.phone,
          email: dto.email,
          address: dto.address,
          acceptsCustomOrders: dto.acceptsCustomOrders,
          ...(dto.logoUploadId !== undefined && { logoUrl: logo?.url ?? null }),
          ...(dto.bannerUploadId !== undefined && { bannerUrl: banner?.url ?? null }),
        },
      });
      if (dto.featuredProductIds) {
        await tx.product.updateMany({ where: { shopId: shop.id }, data: { isFeatured: false } });
        await tx.product.updateMany({ where: { shopId: shop.id, id: { in: dto.featuredProductIds } }, data: { isFeatured: true } });
      }
    });
    await this.audit.log({ actorId: userId, action: 'seller.shop_update', entityType: 'shop', entityId: shop.id, meta });
    return this.shop(userId);
  }

  async updatePayout(userId: string, dto: PayoutDto, meta: RequestMeta) {
    const shop = await this.ctx.approvedShop(userId);
    await this.prisma.shop.update({
      where: { id: shop.id },
      data: { payoutMethod: dto.payoutMethod, payoutAccountTitle: dto.payoutAccountTitle, payoutAccountNumber: dto.payoutAccountNumber.toUpperCase() },
    });
    // Payout changes are security-sensitive, so they are always audited.
    await this.audit.log({ actorId: userId, action: 'seller.payout_update', entityType: 'shop', entityId: shop.id, metadata: { payoutMethod: dto.payoutMethod }, meta });
    return this.shop(userId);
  }
}

@ApiTags('Seller')
@ApiBearerAuth()
@Controller('seller')
export class SellerShopController {
  constructor(private readonly service: SellerShopService) {}

  @Get('application')
  @ApiOperation({ summary: 'My seller application and its status (null if I never applied)' })
  application(@CurrentUser() user: AuthUser) {
    return this.service.application(user.id);
  }

  @Put('application')
  @ApiOperation({ summary: 'Apply to sell, or resubmit after a rejection' })
  submit(@CurrentUser() user: AuthUser, @Body() dto: SellerApplicationDto, @ReqMeta() meta: RequestMeta) {
    return this.service.submit(user.id, dto, meta);
  }

  @Get('shop')
  @RequirePermissions(PERMISSIONS.SHOP_MANAGE_OWN)
  shop(@CurrentUser() user: AuthUser) {
    return this.service.shop(user.id);
  }

  @Patch('shop')
  @RequirePermissions(PERMISSIONS.SHOP_MANAGE_OWN)
  updateShop(@CurrentUser() user: AuthUser, @Body() dto: UpdateShopDto, @ReqMeta() meta: RequestMeta) {
    return this.service.updateShop(user.id, dto, meta);
  }

  @Put('payout')
  @RequirePermissions(PERMISSIONS.SHOP_MANAGE_OWN)
  updatePayout(@CurrentUser() user: AuthUser, @Body() dto: PayoutDto, @ReqMeta() meta: RequestMeta) {
    return this.service.updatePayout(user.id, dto, meta);
  }
}
