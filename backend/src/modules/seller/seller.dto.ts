import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus, ProductStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination.js';
import { PK_PHONE_RULE } from '../auth/dto/auth.dto.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const compact = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value);

export const PAYOUT_METHODS = ['bank', 'jazzcash', 'easypaisa'] as const;
export const DOCUMENT_TYPES = ['cnic_front', 'cnic_back', 'business_registration', 'other'] as const;

export class ApplicationDocumentDto {
  @ApiProperty({ enum: DOCUMENT_TYPES })
  @IsIn(DOCUMENT_TYPES)
  type: (typeof DOCUMENT_TYPES)[number];

  @ApiProperty({ description: 'Id from POST /uploads?purpose=seller_document' })
  @IsString()
  uploadId: string;
}

/** Seller registration. Sent again (with changes) after a rejection. */
export class SellerApplicationDto {
  @ApiProperty({ example: 'Basant Kite House' })
  @Transform(trim)
  @IsString()
  @Length(3, 60, { message: 'Shop name must be 3–60 characters' })
  shopName: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(20, 1000, { message: 'Describe your shop in 20–1000 characters' })
  description: string;

  @ApiProperty({ example: '03001234567' })
  @Transform(compact)
  @Matches(PK_PHONE_RULE, { message: 'Use the format 03XX XXXXXXX' })
  phone: string;

  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address' })
  email: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  city: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(5, 200, { message: 'Enter the shop address' })
  address: string;

  @ApiProperty({ example: '35202-1234567-1', description: 'National identity card number of the owner' })
  @Transform(compact)
  @Matches(/^\d{13}$/, { message: 'Enter the 13-digit CNIC number' })
  cnicNumber: string;

  @ApiProperty({ enum: PAYOUT_METHODS })
  @IsIn(PAYOUT_METHODS, { message: 'Choose how you want to be paid' })
  payoutMethod: (typeof PAYOUT_METHODS)[number];

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(3, 80, { message: 'Enter the account title' })
  payoutAccountTitle: string;

  @ApiProperty({ description: 'IBAN for bank, mobile number for wallets' })
  @Transform(compact)
  @IsString()
  @Matches(/^(PK\d{2}[A-Z]{4}\d{16}|03\d{9})$/i, { message: 'Enter a valid IBAN (PK…) or wallet number (03XX…)' })
  payoutAccountNumber: string;

  @ApiPropertyOptional({ description: 'Upload id (purpose shop_logo)' })
  @IsOptional()
  @IsString()
  logoUploadId?: string;

  @ApiProperty({ type: [ApplicationDocumentDto] })
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => ApplicationDocumentDto)
  documents: ApplicationDocumentDto[];
}

export class UpdateShopDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(20, 1000, { message: 'Describe your shop in 20–1000 characters' })
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(compact)
  @Matches(PK_PHONE_RULE, { message: 'Use the format 03XX XXXXXXX' })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address' })
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(5, 200)
  address?: string;

  @ApiPropertyOptional({ description: 'Upload id (shop_logo), or null to remove' })
  @IsOptional()
  @IsString()
  logoUploadId?: string | null;

  @ApiPropertyOptional({ description: 'Upload id (shop_banner), or null to remove' })
  @IsOptional()
  @IsString()
  bannerUploadId?: string | null;

  @ApiPropertyOptional({ description: 'Whether customers can send custom kite design requests' })
  @IsOptional()
  @IsBoolean()
  acceptsCustomOrders?: boolean;

  @ApiPropertyOptional({ description: 'Up to 8 product ids to feature first on the shop page' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  featuredProductIds?: string[];
}

export class SpecDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 40)
  label: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  value: string;
}

export class VariantInputDto {
  @ApiPropertyOptional({ description: 'Existing variant id when editing' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ example: 'Large · Red' })
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  sku?: string;

  @ApiPropertyOptional({ description: 'Overrides the product price' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  price?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock: number;
}

export class ProductInputDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(3, 120, { message: 'Title must be 3–120 characters' })
  title: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(20, 5000, { message: 'Description must be 20–5000 characters' })
  description: string;

  @ApiProperty()
  @IsString({ message: 'Choose a category' })
  categoryId: string;

  @ApiProperty({ description: 'Price in rupees' })
  @Type(() => Number)
  @IsInt({ message: 'Price must be a whole number of rupees' })
  @Min(1, { message: 'Price must be at least Rs 1' })
  @Max(10_000_000)
  price: number;

  @ApiPropertyOptional({ description: 'Original price, shown crossed out when higher than price' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000_000)
  compareAtPrice?: number | null;

  @ApiPropertyOptional({ description: 'Stock when the product has no variants' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(40)
  sku?: string;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  lowStockAt?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  shippingInfo?: string;

  @ApiPropertyOptional({ description: 'Link to a video (YouTube, etc.)' })
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'Use a full https:// link' })
  videoUrl?: string | null;

  @ApiProperty({ description: 'Upload ids (purpose product_image), first one is the cover', type: [String] })
  @IsArray()
  @ArrayMaxSize(8, { message: 'Add at most 8 photos' })
  @IsString({ each: true })
  imageUploadIds: string[];

  @ApiProperty({ type: [SpecDto] })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SpecDto)
  specifications: SpecDto[];

  @ApiProperty({ type: [VariantInputDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants: VariantInputDto[];

  @ApiProperty({ description: 'false saves a draft; true publishes (or sends for approval)' })
  @IsBoolean()
  publish: boolean;
}

export class StockUpdateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  stock?: number;

  @ApiPropertyOptional({ description: '{ variantId: stock }' })
  @IsOptional()
  variants?: Record<string, number>;
}

export class SellerProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ProductStatus })
  @IsOptional()
  @IsIn(Object.values(ProductStatus))
  status?: ProductStatus;

  @ApiPropertyOptional({ description: 'Only products at or below their low-stock level' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  lowStock?: boolean;
}

export class SellerOrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsIn(Object.values(OrderStatus))
  status?: OrderStatus;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsIn(Object.values(OrderStatus))
  status: OrderStatus;

  @ApiPropertyOptional({ description: 'Shown to the customer on the order timeline' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  courierName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  trackingNumber?: string;

  @ApiPropertyOptional({ description: 'For returns: put the items back into stock' })
  @IsOptional()
  @IsBoolean()
  restock?: boolean;
}

export class InsightsQueryDto {
  @ApiPropertyOptional({ enum: [7, 30, 90], default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 90])
  days: number = 30;
}
