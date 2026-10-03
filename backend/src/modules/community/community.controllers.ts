import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Module, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  type AuthUser,
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  ReqMeta,
  type RequestMeta,
  RequirePermissions,
} from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { PaginationQueryDto } from '../../common/pagination.js';
import { ProductRules } from '../seller/product-rules.js';
import { CreateCommentDto, CreatePostDto, CreateReportDto, EditPostDto, FeedQueryDto, ModerateDto, ModerationQueueQueryDto } from './community.dto.js';
import { CommunityService } from './community.service.js';
import { ReportsService } from './reports.service.js';
import { SocialService } from './social.service.js';

@ApiTags('Community')
@Controller()
export class CommunityController {
  constructor(
    private readonly community: CommunityService,
    private readonly social: SocialService,
  ) {}

  @OptionalAuth()
  @Get('feed')
  @ApiOperation({ summary: 'Latest posts, or posts from people you follow (scope=following, sign-in required)' })
  feed(@Query() q: FeedQueryDto, @MaybeUser() user?: AuthUser) {
    return this.community.feed(q, user?.id);
  }

  @ApiBearerAuth()
  @Post('posts')
  create(@Body() dto: CreatePostDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.community.create(user.id, dto, meta);
  }

  @OptionalAuth()
  @Get('posts/:id')
  post(@Param('id') id: string, @MaybeUser() user?: AuthUser) {
    return this.community.post(id, user?.id);
  }

  @ApiBearerAuth()
  @Patch('posts/:id')
  edit(@Param('id') id: string, @Body() dto: EditPostDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.community.edit(id, user.id, dto, meta);
  }

  @ApiBearerAuth()
  @Delete('posts/:id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.community.remove(id, user.id, meta);
  }

  @ApiBearerAuth()
  @Put('posts/:id/like')
  @HttpCode(HttpStatus.OK)
  like(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.community.setLike(id, user.id, true);
  }

  @ApiBearerAuth()
  @Delete('posts/:id/like')
  unlike(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.community.setLike(id, user.id, false);
  }

  @OptionalAuth()
  @Post('posts/:id/share')
  @HttpCode(HttpStatus.OK)
  share(@Param('id') id: string, @MaybeUser() user?: AuthUser) {
    return this.community.share(id, user?.id);
  }

  @OptionalAuth()
  @Get('posts/:id/comments')
  comments(@Param('id') id: string, @Query() q: PaginationQueryDto, @MaybeUser() user?: AuthUser) {
    return this.community.comments(id, q, user?.id);
  }

  @ApiBearerAuth()
  @Post('posts/:id/comments')
  comment(@Param('id') id: string, @Body() dto: CreateCommentDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.community.comment(id, user.id, dto, meta);
  }

  @ApiBearerAuth()
  @Delete('comments/:id')
  deleteComment(@Param('id') id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.community.deleteComment(id, user.id, meta);
  }

  // Profiles and connections
  @OptionalAuth()
  @Get('community/users/:id')
  profile(@Param('id') id: string, @MaybeUser() user?: AuthUser) {
    return this.social.profile(id, user?.id);
  }

  @OptionalAuth()
  @Get('community/users/:id/posts')
  userPosts(@Param('id') id: string, @Query() q: PaginationQueryDto, @MaybeUser() user?: AuthUser) {
    return this.community.userPosts(id, q, user?.id);
  }

  @OptionalAuth()
  @Get('community/users/:id/followers')
  followers(@Param('id') id: string, @Query() q: PaginationQueryDto, @MaybeUser() user?: AuthUser) {
    return this.social.connections(id, 'followers', q, user?.id);
  }

  @OptionalAuth()
  @Get('community/users/:id/following')
  following(@Param('id') id: string, @Query() q: PaginationQueryDto, @MaybeUser() user?: AuthUser) {
    return this.social.connections(id, 'following', q, user?.id);
  }

  @ApiBearerAuth()
  @Put('community/users/:id/follow')
  @HttpCode(HttpStatus.OK)
  follow(@Param('id') id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.social.setFollow(id, user.id, true, meta);
  }

  @ApiBearerAuth()
  @Delete('community/users/:id/follow')
  unfollow(@Param('id') id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.social.setFollow(id, user.id, false, meta);
  }

  @ApiBearerAuth()
  @Put('community/users/:id/block')
  @HttpCode(HttpStatus.OK)
  block(@Param('id') id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.social.setBlock(id, user.id, true, meta);
  }

  @ApiBearerAuth()
  @Delete('community/users/:id/block')
  unblock(@Param('id') id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.social.setBlock(id, user.id, false, meta);
  }

  @ApiBearerAuth()
  @Get('community/blocks')
  blocks(@CurrentUser() user: AuthUser) {
    return this.social.blocks(user.id);
  }
}

@ApiTags('Reports')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @ApiBearerAuth()
  @Post('reports')
  @ApiOperation({ summary: 'Report a post, comment, user, product, shop, match or order' })
  create(@Body() dto: CreateReportDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.reports.create(user.id, dto, meta);
  }

  @ApiBearerAuth()
  @Get('admin/moderation')
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS)
  @ApiOperation({ summary: 'Reports grouped by target, most-reported first' })
  queue(@Query() q: ModerationQueueQueryDto) {
    return this.reports.queue(q);
  }

  @ApiBearerAuth()
  @Post('admin/moderation/:targetType/:targetId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(PERMISSIONS.ADMIN_ACCESS)
  @ApiOperation({ summary: 'Dismiss reports, or hide / remove / restore a post or comment' })
  moderate(@Param('targetType') type: string, @Param('targetId') id: string, @Body() dto: ModerateDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.reports.moderate(type, id, dto, user, meta);
  }
}

@Module({
  controllers: [CommunityController, ReportsController],
  providers: [CommunityService, SocialService, ReportsService, ProductRules],
})
export class CommunityModule {}
