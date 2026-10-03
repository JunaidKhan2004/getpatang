import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProductStatus, ShopStatus } from '@prisma/client';

import { type AuthUser, CurrentUser } from '../../common/auth/decorators.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { productCardSelect, toProductCard } from '../catalog/catalog.mapper.js';
import { CartService } from './cart.service.js';
import { AddCartItemDto, AddressDto, UpdateCartItemDto } from './shopping.dto.js';

@ApiTags('Cart')
@ApiBearerAuth()
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Cart grouped by shop, with saved-for-later items and any stock problems' })
  view(@CurrentUser() user: AuthUser) {
    return this.cart.view(user.id);
  }

  @Get('count')
  count(@CurrentUser() user: AuthUser) {
    return this.cart.count(user.id);
  }

  @Post('items')
  add(@CurrentUser() user: AuthUser, @Body() dto: AddCartItemDto) {
    return this.cart.add(user.id, dto);
  }

  @Patch('items/:id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: UpdateCartItemDto) {
    return this.cart.update(user.id, id, dto);
  }

  @Delete('items/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.cart.remove(user.id, id);
  }
}

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: PaginationQueryDto) {
    const where = { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.wishlistItem.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        select: { createdAt: true, product: { select: { ...productCardSelect, status: true, shop: { select: { ...productCardSelect.shop.select, status: true } } } } },
      }),
      this.prisma.wishlistItem.count({ where }),
    ]);
    return new Paginated(
      rows.map(({ product: { status, shop: { status: shopStatus, ...shop }, ...p } }) => ({
        ...toProductCard({ ...p, shop }),
        isAvailable: status === ProductStatus.ACTIVE && shopStatus === ShopStatus.APPROVED,
      })),
      total,
      query,
    );
  }

  async set(userId: string, productId: string, saved: boolean) {
    if (saved) {
      const exists = await this.prisma.product.findFirst({
        where: { id: productId, status: ProductStatus.ACTIVE, shop: { status: ShopStatus.APPROVED } },
        select: { id: true },
      });
      if (!exists) throw Errors.productUnavailable();
      await this.prisma.wishlistItem.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId },
        update: {},
      });
    } else {
      await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    }
    return { productId, isWishlisted: saved };
  }
}

@ApiTags('Wishlist')
@ApiBearerAuth()
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.wishlist.list(user.id, query);
  }

  @Put(':productId')
  @HttpCode(HttpStatus.OK)
  add(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.wishlist.set(user.id, productId, true);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.wishlist.set(user.id, productId, false);
  }
}

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  }

  async create(userId: string, dto: AddressDto) {
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= 10) throw new AppException('ADDRESS_LIMIT', 'You can save up to 10 addresses. Delete one to add another.');
    const isDefault = dto.isDefault || count === 0;
    return this.prisma.$transaction(async (tx) => {
      if (isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.create({
        data: {
          userId,
          isDefault,
          label: dto.label,
          fullName: dto.fullName,
          phone: dto.phone,
          line1: dto.line1,
          line2: dto.line2,
          city: dto.city,
          province: dto.province,
          postalCode: dto.postalCode,
        },
      });
    });
  }

  async update(userId: string, id: string, dto: AddressDto) {
    await this.ensureOwned(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  async remove(userId: string, id: string) {
    const address = await this.ensureOwned(userId, id);
    await this.prisma.address.delete({ where: { id } });
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (next) await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
    return { deleted: true };
  }

  async ensureOwned(userId: string, id: string) {
    const address = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!address) throw Errors.notFound('Address');
    return address;
  }
}

@ApiTags('Addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.addresses.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: AddressDto) {
    return this.addresses.create(user.id, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: AddressDto) {
    return this.addresses.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.addresses.remove(user.id, id);
  }
}
