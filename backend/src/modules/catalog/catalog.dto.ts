import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const PRODUCT_SORTS = ['newest', 'popular', 'rating', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export class ProductQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Category slug (includes its sub-categories)' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Shop slug' })
  @IsOptional()
  @IsString()
  shop?: string;

  @ApiPropertyOptional({ description: 'Shop city' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Only products that can be ordered now' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ enum: PRODUCT_SORTS, default: 'newest' })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort: ProductSort = 'newest';
}

export const SHOP_SORTS = ['popular', 'rating', 'newest'] as const;

export class ShopQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional({ enum: SHOP_SORTS, default: 'popular' })
  @IsOptional()
  @IsIn(SHOP_SORTS)
  sort: (typeof SHOP_SORTS)[number] = 'popular';
}

export class SearchQueryDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Type at least 2 characters to search' })
  q: string;
}

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Choose a rating from 1 to 5 stars' })
  @Max(5, { message: 'Choose a rating from 1 to 5 stars' })
  rating: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000, { message: 'Reviews can be at most 1000 characters' })
  comment?: string;
}

export class UpsertCategoryDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  name: string;

  @ApiProperty({ example: 'cotton-string' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'Use lowercase letters, numbers and dashes' })
  slug: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
