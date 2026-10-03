import { HttpStatus, Injectable } from '@nestjs/common';
import { ContentStatus, UserStatus } from '@prisma/client';

import type { RequestMeta } from '../../common/auth/decorators.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { authorSelect, hiddenUserIds, toAuthor } from './community.service.js';

@Injectable()
export class SocialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async activeUser(id: string) {
    const user = await this.prisma.user.findFirst({ where: { id, status: UserStatus.ACTIVE }, select: { ...authorSelect, createdAt: true, profile: { select: { displayName: true, city: true, avatarUrl: true, bio: true } } } });
    if (!user) throw Errors.notFound('Profile');
    return user;
  }

  async profile(userId: string, viewerId?: string) {
    if (viewerId && viewerId !== userId && (await hiddenUserIds(this.prisma, viewerId)).includes(userId)) {
      // The viewer blocked this person (or was blocked): show only that, so the block can be undone.
      const iBlocked = await this.prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: viewerId, blockedId: userId } } });
      if (!iBlocked) throw Errors.notFound('Profile');
      const u = await this.activeUser(userId);
      return { ...toAuthor(u), bio: null, followers: 0, following: 0, posts: 0, isFollowing: false, isBlocked: true, isMe: false, memberSince: u.createdAt };
    }
    const u = await this.activeUser(userId);
    const [followers, following, posts, isFollowing] = await Promise.all([
      this.prisma.userFollow.count({ where: { followingId: userId, follower: { status: UserStatus.ACTIVE } } }),
      this.prisma.userFollow.count({ where: { followerId: userId, following: { status: UserStatus.ACTIVE } } }),
      this.prisma.post.count({ where: { authorId: userId, status: ContentStatus.VISIBLE } }),
      viewerId ? this.prisma.userFollow.findUnique({ where: { followerId_followingId: { followerId: viewerId, followingId: userId } } }).then(Boolean) : false,
    ]);
    return { ...toAuthor(u), bio: u.profile?.bio ?? null, followers, following, posts, isFollowing, isBlocked: false, isMe: viewerId === userId, memberSince: u.createdAt };
  }

  async setFollow(userId: string, viewerId: string, follow: boolean, meta: RequestMeta) {
    if (userId === viewerId) throw new AppException('SELF', 'You cannot follow yourself.', HttpStatus.BAD_REQUEST);
    await this.activeUser(userId);
    if (follow && (await hiddenUserIds(this.prisma, viewerId)).includes(userId)) {
      throw new AppException('BLOCKED', 'You cannot follow this person.', HttpStatus.FORBIDDEN);
    }
    const key = { followerId_followingId: { followerId: viewerId, followingId: userId } };
    const already = Boolean(await this.prisma.userFollow.findUnique({ where: key }));
    if (follow) await this.prisma.userFollow.upsert({ where: key, create: { followerId: viewerId, followingId: userId }, update: {} });
    else await this.prisma.userFollow.deleteMany({ where: { followerId: viewerId, followingId: userId } });
    if (follow && !already) {
      const me = await this.prisma.user.findUnique({ where: { id: viewerId }, select: { fullName: true, profile: { select: { displayName: true } } } });
      this.notifications.send({
        userIds: userId,
        category: 'community',
        type: 'user.follow',
        title: `${me?.profile?.displayName ?? me?.fullName ?? 'Someone'} started following you`,
        body: 'Their posts can now appear in your following feed if you follow them back.',
        link: `/community/u/${viewerId}`,
      });
    }
    await this.audit.log({ actorId: viewerId, action: follow ? 'user.follow' : 'user.unfollow', entityType: 'user', entityId: userId, meta });
    return this.profile(userId, viewerId);
  }

  /** Blocking also removes any follow in both directions. */
  async setBlock(userId: string, viewerId: string, block: boolean, meta: RequestMeta) {
    if (userId === viewerId) throw new AppException('SELF', 'You cannot block yourself.', HttpStatus.BAD_REQUEST);
    await this.activeUser(userId);
    if (block) {
      await this.prisma.$transaction([
        this.prisma.userBlock.upsert({
          where: { blockerId_blockedId: { blockerId: viewerId, blockedId: userId } },
          create: { blockerId: viewerId, blockedId: userId },
          update: {},
        }),
        this.prisma.userFollow.deleteMany({
          where: { OR: [{ followerId: viewerId, followingId: userId }, { followerId: userId, followingId: viewerId }] },
        }),
      ]);
    } else {
      await this.prisma.userBlock.deleteMany({ where: { blockerId: viewerId, blockedId: userId } });
    }
    await this.audit.log({ actorId: viewerId, action: block ? 'user.block' : 'user.unblock', entityType: 'user', entityId: userId, meta });
    return { blocked: block };
  }

  async blocks(viewerId: string) {
    const rows = await this.prisma.userBlock.findMany({ where: { blockerId: viewerId }, orderBy: { createdAt: 'desc' }, include: { blocked: { select: authorSelect } } });
    return rows.map((r) => ({ ...toAuthor(r.blocked), blockedAt: r.createdAt }));
  }

  async connections(userId: string, kind: 'followers' | 'following', query: PaginationQueryDto, viewerId?: string) {
    await this.activeUser(userId);
    const hidden = await hiddenUserIds(this.prisma, viewerId);
    const where =
      kind === 'followers'
        ? { followingId: userId, follower: { status: UserStatus.ACTIVE }, ...(hidden.length && { followerId: { notIn: hidden } }) }
        : { followerId: userId, following: { status: UserStatus.ACTIVE }, ...(hidden.length && { followingId: { notIn: hidden } }) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.userFollow.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.pageSize,
        include: { follower: { select: authorSelect }, following: { select: authorSelect } },
      }),
      this.prisma.userFollow.count({ where }),
    ]);
    return new Paginated(rows.map((r) => toAuthor(kind === 'followers' ? r.follower : r.following)), total, query);
  }
}
