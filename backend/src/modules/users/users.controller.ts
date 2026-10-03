import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

import { type AuthUser, CurrentUser, ReqMeta, type RequestMeta, RequirePermissions } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { LANGS } from '../../common/i18n/i18n.js';
import { PaginationQueryDto } from '../../common/pagination.js';
import { UsersService } from './users.service.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpsertProfileDto {
  @ApiProperty({ example: 'Ali R.' })
  @Transform(trim)
  @IsString()
  @Length(2, 40, { message: 'Display name must be 2–40 characters' })
  displayName: string;

  @ApiPropertyOptional({ example: 'Lahore' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(160, { message: 'Bio can be at most 160 characters' })
  bio?: string;
}

export class LocaleDto {
  @ApiProperty({ enum: LANGS })
  @IsIn(LANGS)
  locale: 'en' | 'ur';
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Put('me/profile')
  @ApiOperation({ summary: 'Create or update the signed-in user’s public profile' })
  upsertProfile(@CurrentUser() user: AuthUser, @Body() dto: UpsertProfileDto, @ReqMeta() meta: RequestMeta) {
    return this.users.upsertProfile(user.id, dto, meta);
  }

  @Put('me/locale')
  @ApiOperation({ summary: 'Language for emails and notifications (en or ur)' })
  setLocale(@CurrentUser() user: AuthUser, @Body() dto: LocaleDto) {
    return this.users.setLocale(user.id, dto.locale);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  @ApiOperation({ summary: 'List users (staff only). Search by name, email or phone with ?q=' })
  list(@Query() query: PaginationQueryDto) {
    return this.users.list(query);
  }
}
