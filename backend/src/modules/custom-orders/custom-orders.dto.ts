import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomOrderStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const HEX = /^#[0-9a-fA-F]{6}$/;
const hexMsg = { message: 'Use a colour like #420000' };

// Keep in sync with web/src/components/designer/kite-preview.tsx and mobile/lib/features/designer.
export const KITE_SHAPES = ['diamond', 'patang', 'delta', 'hexagon'] as const;
export const KITE_SIZES = ['small', 'medium', 'large'] as const;
export const KITE_PATTERNS = ['none', 'stripes', 'checks', 'halves', 'quarters', 'border', 'stars'] as const;
export const KITE_FONTS = ['sans', 'display', 'serif'] as const;

/** The design itself. Rendered identically by the web and mobile previews. */
export class KiteDesignDto {
  @ApiProperty({ enum: KITE_SHAPES }) @IsIn(KITE_SHAPES) shape: (typeof KITE_SHAPES)[number];
  @ApiProperty({ enum: KITE_SIZES }) @IsIn(KITE_SIZES) size: (typeof KITE_SIZES)[number];
  @ApiProperty({ example: '#420000' }) @Matches(HEX, hexMsg) background: string;
  @ApiProperty({ enum: KITE_PATTERNS }) @IsIn(KITE_PATTERNS) pattern: (typeof KITE_PATTERNS)[number];
  @ApiProperty({ example: '#F6F6F6' }) @Matches(HEX, hexMsg) patternColor: string;
  @ApiPropertyOptional({ maxLength: 24 }) @IsOptional() @Transform(trim) @IsString() @MaxLength(24, { message: 'Text can be up to 24 characters' }) text?: string;
  @ApiProperty() @Matches(HEX, hexMsg) textColor: string;
  @ApiProperty({ enum: KITE_FONTS }) @IsIn(KITE_FONTS) font: (typeof KITE_FONTS)[number];
  @ApiPropertyOptional({ description: 'Upload id (design_asset): a photo or logo placed in the centre' }) @IsOptional() @IsString() imageUploadId?: string | null;
  @ApiProperty() @IsBoolean() tail: boolean;
  @ApiProperty() @Matches(HEX, hexMsg) tailColor: string;
}

export class SaveDesignDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 60, { message: 'Name your design (2–60 characters)' }) name: string;
  @ApiProperty({ type: KiteDesignDto }) @ValidateNested() @Type(() => KiteDesignDto) design: KiteDesignDto;
}

export class CreateCustomOrderDto {
  @ApiProperty() @IsString() designId: string;
  @ApiProperty() @IsString({ message: 'Choose a shop' }) shopId: string;
  @ApiProperty({ minimum: 1, maximum: 1000 }) @Type(() => Number) @IsInt() @Min(1) @Max(1000) quantity: number;
  @ApiProperty() @Transform(trim) @IsString() @Length(10, 2000, { message: 'Describe what you need (at least 10 characters)' }) requirements: string;
  @ApiPropertyOptional({ description: 'Rupees' }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000) budget?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() deadline?: string;
}

export class MessageDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(1, 2000) body: string;
}

export class QuoteDto {
  @ApiProperty({ description: 'Total price for all pieces, rupees' }) @Type(() => Number) @IsInt() @Min(1) @Max(10_000_000) price: number;
  @ApiProperty({ description: 'Days to make and dispatch' }) @Type(() => Number) @IsInt() @Min(1) @Max(180) deliveryDays: number;
  @ApiProperty({ description: 'How long the quote stays valid, in days' }) @Type(() => Number) @IsInt() @Min(1) @Max(60) validDays: number;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(1000) note?: string;
}

export class ReasonDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(5, 1000, { message: 'Add a short reason' }) reason: string;
}

export class AcceptQuoteDto {
  @ApiProperty() @IsString({ message: 'Choose a delivery address' }) addressId: string;
  @ApiProperty({ example: 'standard' }) @IsString() deliveryMethod: string;
  @ApiProperty({ example: 'cod' }) @IsString({ message: 'Choose a payment method' }) paymentMethod: string;
}

export class CustomOrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CustomOrderStatus })
  @IsOptional()
  @IsIn(Object.values(CustomOrderStatus))
  status?: CustomOrderStatus;
}
