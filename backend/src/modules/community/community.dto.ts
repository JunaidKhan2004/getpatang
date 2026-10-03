import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class FeedQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['latest', 'following'], default: 'latest' })
  @IsOptional()
  @IsIn(['latest', 'following'])
  scope: 'latest' | 'following' = 'latest';
}

export class CreatePostDto {
  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @Length(1, 2000, { message: 'Posts can be up to 2000 characters' })
  body: string;

  @ApiPropertyOptional({ description: 'Upload ids (purpose post_media), up to 4 photos or 1 video', type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4, { message: 'Add at most 4 photos' })
  @IsString({ each: true })
  mediaUploadIds?: string[];
}

export class EditPostDto {
  @ApiProperty({ maxLength: 2000 })
  @Transform(trim)
  @IsString()
  @Length(1, 2000, { message: 'Posts can be up to 2000 characters' })
  body: string;
}

export class CreateCommentDto {
  @ApiProperty({ maxLength: 1000 })
  @Transform(trim)
  @IsString()
  @Length(1, 1000, { message: 'Comments can be up to 1000 characters' })
  body: string;

  @ApiPropertyOptional({ description: 'Reply to this comment' })
  @IsOptional()
  @IsString()
  parentId?: string;
}

export const REPORT_TARGETS = ['post', 'comment', 'user', 'product', 'shop', 'match', 'order'] as const;
export const REPORT_REASONS = ['spam', 'harassment', 'dangerous', 'inappropriate', 'misinformation', 'other'] as const;

export class CreateReportDto {
  @ApiProperty({ enum: REPORT_TARGETS })
  @IsIn(REPORT_TARGETS)
  targetType: (typeof REPORT_TARGETS)[number];

  @ApiProperty()
  @IsString()
  targetId: string;

  @ApiProperty({ enum: REPORT_REASONS, description: 'dangerous = unsafe or illegal kite-fighting materials or practices' })
  @IsIn(REPORT_REASONS, { message: 'Choose a reason' })
  reason: (typeof REPORT_REASONS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  details?: string;
}

export class ModerationQueueQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: REPORT_TARGETS })
  @IsOptional()
  @IsIn(REPORT_TARGETS)
  targetType?: (typeof REPORT_TARGETS)[number];

  @ApiPropertyOptional({ enum: ['open', 'closed'], default: 'open' })
  @IsOptional()
  @IsIn(['open', 'closed'])
  state: 'open' | 'closed' = 'open';
}

export const MODERATION_ACTIONS = ['dismiss', 'hide', 'remove', 'restore', 'resolve'] as const;

export class ModerateDto {
  @ApiProperty({ enum: MODERATION_ACTIONS, description: 'dismiss = reports were wrong; resolve = handled outside this tool (users, products…)' })
  @IsIn(MODERATION_ACTIONS)
  action: (typeof MODERATION_ACTIONS)[number];

  @ApiPropertyOptional({ description: 'Required for hide and remove; shown to the author' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}
