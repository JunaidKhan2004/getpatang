import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Standard list query: `?page=1&pageSize=20&order=desc&q=term` */
export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Keyword search' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  get skip() {
    return (this.page - 1) * this.pageSize;
  }
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** Return from a controller to get `{ data, meta }` in the response. */
export class Paginated<T> {
  readonly meta: PageMeta;

  constructor(
    readonly items: T[],
    total: number,
    query: Pick<PaginationQueryDto, 'page' | 'pageSize'>,
  ) {
    this.meta = { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) };
  }
}
