import { HttpStatus, Injectable } from '@nestjs/common';
import { ContentStatus, ReportStatus } from '@prisma/client';

import type { AuthUser, RequestMeta } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { SettingsService } from '../settings/settings.service.js';
import { CreateReportDto, ModerateDto, ModerationQueueQueryDto } from './community.dto.js';

const OPEN: ReportStatus[] = [ReportStatus.OPEN, ReportStatus.IN_REVIEW];
const CONTENT = ['post', 'comment'] as const;
const isContent = (t: string): t is (typeof CONTENT)[number] => (CONTENT as readonly string[]).includes(t);

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Owner of the reported thing, used to stop people reporting themselves. Null when it does not exist. */
  private async ownerOf(type: string, id: string): Promise<string | null | undefined> {
    switch (type) {
      case 'post':
        return (await this.prisma.post.findFirst({ where: { id, status: { not: ContentStatus.REMOVED } }, select: { authorId: true } }))?.authorId;
      case 'comment':
        return (await this.prisma.comment.findFirst({ where: { id, status: { not: ContentStatus.REMOVED } }, select: { authorId: true } }))?.authorId;
      case 'user':
        return (await this.prisma.user.findUnique({ where: { id }, select: { id: true } }))?.id;
      case 'product':
        return (await this.prisma.product.findUnique({ where: { id }, select: { shop: { select: { ownerId: true } } } }))?.shop.ownerId;
      case 'shop':
        return (await this.prisma.shop.findUnique({ where: { id }, select: { ownerId: true } }))?.ownerId;
      case 'match':
        return (await this.prisma.match.findUnique({ where: { id }, select: { id: true } })) ? null : undefined;
      case 'order':
        return (await this.prisma.order.findUnique({ where: { id }, select: { id: true } })) ? null : undefined;
      default:
        return undefined;
    }
  }

  async create(reporterId: string, dto: CreateReportDto, meta: RequestMeta) {
    const owner = await this.ownerOf(dto.targetType, dto.targetId);
    if (owner === undefined) throw Errors.notFound('The reported item');
    if (owner === reporterId) throw new AppException('SELF_REPORT', 'You cannot report your own content.', HttpStatus.BAD_REQUEST);
    const existing = await this.prisma.report.findFirst({
      where: { reporterId, targetType: dto.targetType, targetId: dto.targetId, status: { in: OPEN } },
    });
    if (existing) throw new AppException('ALREADY_REPORTED', 'You have already reported this. Our team will review it.', HttpStatus.CONFLICT);

    await this.prisma.report.create({ data: { reporterId, targetType: dto.targetType, targetId: dto.targetId, reason: dto.reason, details: dto.details || null } });

    // Enough independent reports hide content until a moderator looks at it.
    if (isContent(dto.targetType)) {
      const threshold = await this.settings.get('community.auto_hide_reports');
      const reporters = await this.prisma.report.groupBy({
        by: ['reporterId'],
        where: { targetType: dto.targetType, targetId: dto.targetId, status: { in: OPEN } },
        orderBy: { reporterId: 'asc' },
      });
      if (reporters.length >= threshold) {
        const note = `Hidden automatically after ${reporters.length} reports, pending review`;
        if (dto.targetType === 'post') {
          await this.prisma.post.updateMany({ where: { id: dto.targetId, status: ContentStatus.VISIBLE }, data: { status: ContentStatus.HIDDEN, moderationNote: note } });
        } else {
          await this.prisma.comment.updateMany({ where: { id: dto.targetId, status: ContentStatus.VISIBLE }, data: { status: ContentStatus.HIDDEN } });
        }
      }
    }
    await this.audit.log({ actorId: reporterId, action: 'report.create', entityType: dto.targetType, entityId: dto.targetId, metadata: { reason: dto.reason }, meta });
    return { reported: true, message: 'Thanks for reporting. Our moderators will review it.' };
  }

  /** Reports grouped by the thing reported, most-reported first. */
  async queue(query: ModerationQueueQueryDto) {
    const status = query.state === 'open' ? { in: OPEN } : { notIn: OPEN };
    const where = { status, ...(query.targetType && { targetType: query.targetType }) };
    const [groups, all] = await Promise.all([
      this.prisma.report.groupBy({
        by: ['targetType', 'targetId'],
        where,
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: [{ _count: { targetId: 'desc' } }, { _max: { createdAt: 'desc' } }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.report.groupBy({ by: ['targetType', 'targetId'], where, orderBy: { targetId: 'asc' } }),
    ]);
    const items = await Promise.all(
      groups.map(async (g) => {
        const reports = await this.prisma.report.findMany({
          where: { targetType: g.targetType, targetId: g.targetId, status },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, reason: true, details: true, status: true, action: true, resolution: true, createdAt: true, reporter: { select: { id: true, fullName: true } } },
        });
        return {
          targetType: g.targetType,
          targetId: g.targetId,
          reportCount: g._count._all,
          latestAt: g._max.createdAt,
          reasons: reports.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.reason]: (acc[r.reason] ?? 0) + 1 }), {}),
          reports,
          preview: await this.preview(g.targetType, g.targetId),
        };
      }),
    );
    return new Paginated(items, all.length, query);
  }

  private async preview(type: string, id: string) {
    switch (type) {
      case 'post': {
        const p = await this.prisma.post.findUnique({ where: { id }, select: { body: true, status: true, moderationNote: true, author: { select: { id: true, fullName: true } }, media: { select: { kind: true, url: true } } } });
        return p && { text: p.body, status: p.status, note: p.moderationNote, author: p.author, media: p.media, link: `/community/posts/${id}` };
      }
      case 'comment': {
        const c = await this.prisma.comment.findUnique({ where: { id }, select: { body: true, status: true, postId: true, author: { select: { id: true, fullName: true } } } });
        return c && { text: c.body, status: c.status, author: c.author, link: `/community/posts/${c.postId}` };
      }
      case 'user': {
        const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true, fullName: true, email: true, status: true } });
        return u && { text: `${u.fullName} (${u.email})`, status: u.status, author: { id: u.id, fullName: u.fullName }, link: `/community/u/${id}`, adminLink: `/admin/users/${id}` };
      }
      case 'product': {
        const p = await this.prisma.product.findUnique({ where: { id }, select: { title: true, slug: true, status: true } });
        return p && { text: p.title, status: p.status, link: `/products/${p.slug}`, adminLink: `/admin/products?q=${encodeURIComponent(p.title)}` };
      }
      case 'shop': {
        const s = await this.prisma.shop.findUnique({ where: { id }, select: { name: true, slug: true, status: true } });
        return s && { text: s.name, status: s.status, link: `/shops/${s.slug}`, adminLink: `/admin/sellers/${id}` };
      }
      case 'order': {
        const o = await this.prisma.order.findUnique({ where: { id }, select: { orderNumber: true, status: true, shop: { select: { name: true } } } });
        return o && { text: `Order ${o.orderNumber} from ${o.shop.name}`, status: o.status, link: null, adminLink: `/admin/orders/${o.orderNumber}` };
      }
      case 'match': {
        const m = await this.prisma.match.findUnique({ where: { id }, select: { round: true, matchNumber: true, status: true, tournament: { select: { id: true, name: true } } } });
        return m && { text: `${m.tournament.name}: round ${m.round}, match ${m.matchNumber}`, status: m.status, link: null, adminLink: `/admin/tournaments/${m.tournament.id}?tab=matches` };
      }
      default:
        return { text: `${type} ${id}`, status: null, link: null };
    }
  }

  /**
   * Applies a moderation decision to the reported thing and closes its open reports.
   * Posts and comments need community.moderate; other targets are only noted here
   * (their own tools — seller, product, user management — make the actual change).
   */
  async moderate(targetType: string, targetId: string, dto: ModerateDto, actor: AuthUser, meta: RequestMeta) {
    const canCommunity = actor.permissions.has(PERMISSIONS.COMMUNITY_MODERATE);
    const canReports = actor.permissions.has(PERMISSIONS.REPORTS_HANDLE);
    if (isContent(targetType) ? !canCommunity : !(canReports || canCommunity)) throw Errors.forbidden();
    if (!isContent(targetType) && !['dismiss', 'resolve'].includes(dto.action)) {
      throw new AppException('ACTION_INVALID', 'For this kind of report, use dismiss or resolve and act from its own admin page.', HttpStatus.BAD_REQUEST);
    }
    if ((dto.action === 'hide' || dto.action === 'remove') && !dto.note) {
      throw new AppException('NOTE_REQUIRED', 'Add a reason. The author will see it.', 400, [{ field: 'note', message: 'A reason is required' }]);
    }

    if (isContent(targetType)) {
      const next: Record<string, ContentStatus | null> = {
        dismiss: ContentStatus.VISIBLE, // reports were wrong: undo any automatic hiding
        restore: ContentStatus.VISIBLE,
        hide: ContentStatus.HIDDEN,
        remove: ContentStatus.REMOVED,
        resolve: null,
      };
      const status = next[dto.action];
      if (targetType === 'post') {
        const p = await this.prisma.post.findUnique({ where: { id: targetId } });
        if (!p) throw Errors.notFound('Post');
        if (status && !(p.status === ContentStatus.REMOVED && p.moderationNote === 'Deleted by the author')) {
          await this.prisma.post.update({ where: { id: targetId }, data: { status, moderationNote: status === ContentStatus.VISIBLE ? null : dto.note } });
        }
      } else {
        const c = await this.prisma.comment.findUnique({ where: { id: targetId } });
        if (!c) throw Errors.notFound('Comment');
        if (status && status !== c.status) {
          await this.prisma.$transaction([
            this.prisma.comment.update({ where: { id: targetId }, data: { status } }),
            // Keep the post's comment count in step with what readers can see.
            this.prisma.post.update({
              where: { id: c.postId },
              data: { commentCount: { increment: status === ContentStatus.VISIBLE ? 1 : c.status === ContentStatus.VISIBLE ? -1 : 0 } },
            }),
          ]);
        }
      }
    }

    const closed = await this.prisma.report.updateMany({
      where: { targetType, targetId, status: { in: OPEN } },
      data: {
        status: dto.action === 'dismiss' ? ReportStatus.DISMISSED : ReportStatus.RESOLVED,
        action: { dismiss: 'dismissed', hide: 'hidden', remove: 'removed', restore: 'restored', resolve: 'resolved' }[dto.action],
        resolution: dto.note ?? null,
        resolvedById: actor.id,
        resolvedAt: new Date(),
      },
    });
    await this.audit.log({ actorId: actor.id, action: `moderation.${dto.action}`, entityType: targetType, entityId: targetId, metadata: { note: dto.note ?? null, reportsClosed: closed.count }, meta });
    if (closed.count) {
      const reporters = await this.prisma.report.findMany({ where: { targetType, targetId, resolvedById: actor.id, resolvedAt: { gte: new Date(Date.now() - 60_000) } }, select: { reporterId: true } });
      this.notifications.send({
        userIds: reporters.map((r) => r.reporterId),
        category: 'account',
        type: 'report.reviewed',
        title: 'Your report was reviewed',
        body: dto.action === 'dismiss' ? 'Our moderators looked at it and found it within the rules. Thank you for helping keep the community safe.' : 'Our moderators took action. Thank you for helping keep the community safe.',
      });
    }
    return { targetType, targetId, action: dto.action, reportsClosed: closed.count, preview: await this.preview(targetType, targetId) };
  }
}
