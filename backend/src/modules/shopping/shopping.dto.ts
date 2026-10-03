import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

import { PK_PHONE_RULE } from '../auth/dto/auth.dto.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const MAX_QUANTITY = 99;

export class AddCartItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ minimum: 1, maximum: MAX_QUANTITY, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity: number = 1;
}

export class UpdateCartItemDto {
  @ApiPropertyOptional({ minimum: 1, maximum: MAX_QUANTITY })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY)
  quantity?: number;

  @ApiPropertyOptional({ description: 'Move between the cart and "saved for later"' })
  @IsOptional()
  @IsBoolean()
  savedForLater?: boolean;
}

export class AddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  label?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Enter the recipient’s full name' })
  fullName: string;

  @ApiProperty({ example: '03001234567' })
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value))
  @Matches(PK_PHONE_RULE, { message: 'Use the format 03XX XXXXXXX' })
  phone: string;

  @ApiProperty({ example: 'House 12, Street 4, Gulberg III' })
  @Transform(trim)
  @IsString()
  @Length(5, 200, { message: 'Enter the street address' })
  line1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  line2?: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 60, { message: 'Enter the city' })
  city: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{5}$/, { message: 'Postal codes have 5 digits' })
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
