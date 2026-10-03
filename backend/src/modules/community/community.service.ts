import { HttpStatus, Injectable } from '@nestjs/common';
import { ContentStatus, Prisma, UserStatus } from '@prisma/client';

import type { RequestMeta } from '../../common/auth/decorators.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { ProductRules } from '../seller/product-rules.js';
import { isVideoMime, UploadsService } from '../storage/uploads.js';
import { CreateCommentDto, CreatePostDto, EditPostDto, FeedQueryDto } from './community.dto.js';

export const authorSelect = {
  id: true,
  fullName: true,
  profile: { select: { displayName: true, city: true, avatarUrl: true } },
} satisfies Prisma.UserSelect;

type AuthorRow = Prisma.UserGetPayload<{ select: typeof authorSelect }>;
export const toAuthor = (u: AuthorRow) => ({
  id: u.id,
  name: u.profile?.displayName ?? u.fullName,
  city: u.profile?.city ?? null,
  avatarUrl: u.profile?.avatarUrl ?? null,
});

const postInclude = {
  author: { select: authorSelect },
  media: { orderBy: { sortOrder: 'asc' }, select: { kind: true, url: true, mimeType: true } },
} satisfies Prisma.PostInclude;

type PostRow = Prisma.PostGetPayload<{ include: typeof postInclude }>;

/** Who the viewer must not see (and who must not see them): people they blocked and people who blocked them. */
export async function hiddenUserIds(prisma: PrismaService, viewerId?: string): Promise<string[]> {
  if (!viewerId) return [];
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
    select: { blockerId: true, blockedId: true },
  });
  return blocks.map((b) => (b.blockerId === viewerId ? b.blockedId : b.blockerId));
}

const cErrors = {
  blocked: () => new AppException('BLOCKED', 'You cannot interact with this person.', HttpStatus.FORBIDDEN),
  mixedMedia: () =>
    new AppException('MEDIA_INVALID', 'Add up to 4 photos, or one video on its own.', HttpStatus.BAD_REQUEST, [
      { field: 'mediaUploadIds', message: 'Up to 4 photos or 1 video' },
    ]),
  replyDepth: () => new AppException('REPLY_INVALID', 'You can only reply to a top-level comment.', HttpStatus.BAD_REQUEST),
};

@Injectable()
export class CommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly rules: ProductRules,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private async nameOf(userId: string) {
    const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { fullName: true, profile: { select: { displayName: true } } } });
    return u?.profile?.displayName ?? u?.fullName ?? 'Someone';
  }

  private async toPosts(rows: PostRow[], viewerId?: string) {
    const liked = viewerId
      ? new Set((await this.prisma.postLike.findMany({ where: { userId: viewerId, postId: { in: rows.map((r) => r.id) } }, select: { postId: true } })).map((l) => l.postId))
      : new Set<string>();
    return rows.map((p) => ({
      id: p.id,
      body: p.body,
      createdAt: p.createdAt,
      editedAt: p.editedAt,
      author: toAuthor(p.author),
      media: p.media,
      likeCount: p.likeCount,
      commentCount: p.commentCount,
      shareCount: p.shareCount,
      likedByMe: liked.has(p.id),
      isMine: p.authorId === viewerId,
    }));
  }

  /** The base filter for anything a viewer may see. */
  private async visibleWhere(viewerId?: string): Promise<Prisma.PostWhereInput> {
    const hidden = await hiddenUserIds(this.prisma, viewerId);
    return {
      status: ContentStatus.VISIBLE,
      author: { status: UserStatus.ACTIVE },
      ...(hidden.length && { authorId: { notIn: hidden } }),
    };
  }

  async feed(query: FeedQueryDto, viewerId?: string) {
    const and: Prisma.PostWhereInput[] = [await this.visibleWhere(viewerId)];
    if (query.scope === 'following') {
      if (!viewerId) throw Errors.unauthenticated();
      const following = await this.prisma.userFollow.findMany({ where: { followerId: viewerId }, select: { followingId: true } });
      and.push({ authorId: { in: [viewerId, ...following.map((f) => f.followingId)] } });
    }
    const where = { AND: and };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({ where, include: postInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: query.skip, take: query.pageSize }),
      this.prisma.post.count({ where }),
    ]);
    return new Paginated(await this.toPosts(rows, viewerId), total, query);
  }

  async userPosts(userId: string, query: PaginationQueryDto, viewerId?: string) {
    const where = { AND: [await this.visibleWhere(viewerId), { authorId: userId }] };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({ where, include: postInclude, orderBy: { createdAt: 'desc' }, skip: query.skip, take: query.pageSize }),
      this.prisma.post.count({ where }),
    ]);
    return new Paginated(await this.toPosts(rows, viewerId), total, query);
  }

  async post(id: string, viewerId?: string) {
    const row = await this.prisma.post.findFirst({ where: { AND: [{ id }, await this.visibleWhere(viewerId)] }, include: postInclude });
    if (!row) throw Errors.notFound('Post');
    return (await this.toPosts([row], viewerId))[0];
  }

  async create(authorId: string, dto: CreatePostDto, meta: RequestMeta) {
    await this.rules.assertAllowedIn('body', dto.body);
    const uploads = await this.uploads.ownedUploads(authorId, dto.mediaUploadIds ?? [], 'post_media');
    const videos = uploads.filter((u) => isVideoMime(u.mimeType));
    if (videos.length > 1 || (videos.length === 1 && uploads.length > 1)) throw cErrors.mixedMedia();
    const inUse = await this.prisma.postMedia.count({ where: { uploadId: { in: uploads.map((u) => u.id) } } });
    if (inUse) throw new AppException('UPLOAD_IN_USE', 'A file is already attached to another post. Upload it again.', HttpStatus.CONFLICT);

    const post = await this.prisma.post.create({
      data: {
        authorId,
        body: dto.body,
        media: {
          create: uploads.map((u, i) => ({ uploadId: u.id, url: u.url!, mimeType: u.mimeType, kind: isVideoMime(u.mimeType) ? 'video' : 'image', sortOrder: i })),
        },
      },
    });
    await this.audit.log({ actorId: authorId, action: 'post.create', entityType: 'post', entityId: post.id, meta });
    return this.post(post.id, authorId);
  }

  private async ownPost(id: string, userId: string) {
    const post = await this.prisma.post.findFirst({ where: { id, authorId: userId, status: { not: ContentStatus.REMOVED } } });
    if (!post) throw Errors.notFound('Post');
    return post;
  }

  async edit(id: string, userId: string, dto: EditPostDto, meta: RequestMeta) {
    const post = await this.ownPost(id, userId);
    if (post.status === ContentStatus.HIDDEN) {
      throw new AppException('UNDER_REVIEW', 'This post is under review by our moderators and cannot be edited right now.', HttpStatus.CONFLICT);
    }
    await this.rules.assertAllowedIn('body', dto.body);
    await this.prisma.post.update({ where: { id }, data: { body: dto.body, editedAt: new Date() } });
    await this.audit.log({ actorId: userId, action: 'post.edit', entityType: 'post', entityId: id, meta });
    return this.post(id, userId);
  }

  async remove(id: string, userId: string, meta: RequestMeta) {
    await this.ownPost(id, userId);
    await this.prisma.post.update({ where: { id }, data: { status: ContentStatus.REMOVED, moderationNote: 'Deleted by the author' } });
    await this.audit.log({ actorId: userId, action: 'post.delete', entityType: 'post', entityId: id, meta });
    return { deleted: true };
  }

  async setLike(id: string, userId: string, like: boolean) {
    const post = await this.post(id, userId);
    const result = await this.prisma.$transaction(async (tx) => {
      const key = { postId_userId: { postId: id, userId } };
      const existing = await tx.postLike.findUnique({ where: key });
      let added = false;
      if (like && !existing) {
        await tx.postLike.create({ data: { postId: id, userId } });
        await tx.post.update({ where: { id }, data: { likeCount: { increment: 1 } } });
        added = true;
      } else if (!like && existing) {
        await tx.postLike.delete({ where: key });
        await tx.post.update({ where: { id }, data: { likeCount: { decrement: 1 } } });
      }
      const { likeCount, authorId } = await tx.post.findUniqueOrThrow({ where: { id: post.id }, select: { likeCount: true, authorId: true } });
      return { liked: like, likeCount, added, authorId };
    });
    if (result.added) {
      this.notifications.send({
        userIds: result.authorId,
        exclude: userId,
        category: 'community',
        type: 'post.like',
        title: `${await this.nameOf(userId)} liked your post`,
        body: 'See who else is enjoying it.',
        link: `/community/posts/${id}`,
      });
    }
    return { liked: result.liked, likeCount: result.likeCount };
  }

  /** Counts a share; the client shares the returned link with the system share sheet. */
  async share(id: string, viewerId?: string) {
    await this.post(id, viewerId);
    const { shareCount } = await this.prisma.post.update({ where: { id }, data: { shareCount: { increment: 1 } }, select: { shareCount: true } });
    return { path: `/community/posts/${id}`, shareCount };
  }

  async comments(postId: string, query: PaginationQueryDto, viewerId?: string) {
    await this.post(postId, viewerId);
    const hidden = await hiddenUserIds(this.prisma, viewerId);
    const visible: Prisma.CommentWhereInput = {
      status: ContentStatus.VISIBLE,
      author: { status: UserStatus.ACTIVE },
      ...(hidden.length && { authorId: { notIn: hidden } }),
    };
    const where = { ...visible, postId, parentId: null };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: query.skip,
        take: query.pageSize,
        include: {
          author: { select: authorSelect },
          replies: { where: visible, orderBy: { createdAt: 'asc' }, take: 50, include: { author: { select: authorSelect } } },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);
    const shape = (c: { id: string; body: string; createdAt: Date; authorId: string; author: AuthorRow }) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      author: toAuthor(c.author),
      isMine: c.authorId === viewerId,
    });
    return new Paginated(rows.map((c) => ({ ...shape(c), replies: c.replies.map(shape) })), total, query);
  }

  async comment(postId: string, userId: string, dto: CreateCommentDto, meta: RequestMeta) {
    const post = await this.prisma.post.findFirst({ where: { AND: [{ id: postId }, await this.visibleWhere(userId)] }, select: { id: true, authorId: true } });
    if (!post) throw Errors.notFound('Post');
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({ where: { id: dto.parentId, postId, status: ContentStatus.VISIBLE } });
      if (!parent) throw Errors.notFound('Comment');
      if (parent.parentId) throw cErrors.replyDepth();
    }
    await this.rules.assertAllowedIn('body', dto.body);
    const c = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({ data: { postId, authorId: userId, body: dto.body, parentId: dto.parentId ?? null } });
      await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
      return created;
    });
    await this.audit.log({ actorId: userId, action: 'comment.create', entityType: 'comment', entityId: c.id, meta });
    const name = await this.nameOf(userId);
    const preview = dto.body.length > 120 ? `${dto.body.slice(0, 117)}…` : dto.body;
    const parentAuthor = dto.parentId ? (await this.prisma.comment.findUnique({ where: { id: dto.parentId }, select: { authorId: true } }))?.authorId : null;
    if (parentAuthor) {
      this.notifications.send({ userIds: parentAuthor, exclude: userId, category: 'community', type: 'comment.reply', title: `${name} replied to your comment`, body: preview, link: `/community/posts/${postId}` });
    }
    if (post.authorId !== parentAuthor) {
      this.notifications.send({ userIds: post.authorId, exclude: userId, category: 'community', type: 'post.comment', title: `${name} commented on your post`, body: preview, link: `/community/posts/${postId}` });
    }
    return { id: c.id };
  }

  /** The comment's author, or the author of the post it is on, can delete it. */
  async deleteComment(id: string, userId: string, meta: RequestMeta) {
    const c = await this.prisma.comment.findFirst({ where: { id, status: { not: ContentStatus.REMOVED } }, include: { post: { select: { authorId: true } } } });
    if (!c || (c.authorId !== userId && c.post.authorId !== userId)) throw Errors.notFound('Comment');
    // Replies disappear with their parent, so they leave the count too.
    const replies = c.parentId ? 0 : await this.prisma.comment.count({ where: { parentId: id, status: ContentStatus.VISIBLE } });
    await this.prisma.$transaction([
      this.prisma.comment.update({ where: { id }, data: { status: ContentStatus.REMOVED } }),
      this.prisma.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 + replies } } }),
    ]);
    await this.audit.log({ actorId: userId, action: 'comment.delete', entityType: 'comment', entityId: id, meta });
    return { deleted: true };
  }

}
