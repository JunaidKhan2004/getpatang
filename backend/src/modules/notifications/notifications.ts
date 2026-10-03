import { Body, Controller, Delete, Get, Global, HttpCode, HttpStatus, Injectable, Logger, Module, Param, Post, Put, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, Length } from 'class-validator';

import { type AuthUser, CurrentUser } from '../../common/auth/decorators.js';
import type { Permission } from '../../common/auth/permissions.js';
import { Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { MailModule, MailService } from './mail.js';

// ─── Categories and defaults ────────────────────────────────────────────────

export const NOTIFICATION_CATEGORIES = {
  orders: { label: 'Orders', description: 'Order placed, status changes and delivery', email: true },
  payments: { label: 'Payments and refunds', description: 'Payment checks and refunds', email: true },
  shop: { label: 'My shop', description: 'New orders, application and product reviews (sellers)', email: true },
  custom_orders: { label: 'Custom kites', description: 'Quotes and messages about custom designs', email: true },
  tournaments: { label: 'Tournaments', description: 'Registration, matches, results and disputes', email: true },
  events: { label: 'Events', description: 'Waiting-list updates and cancellations', email: true },
  community: { label: 'Community', description: 'Likes, comments, replies and new followers', email: false },
} as const;
export type NotificationCategory = keyof typeof NOTIFICATION_CATEGORIES | 'account';

type Channels = { inApp: boolean; email: boolean; push: boolean };
type Prefs = Partial<Record<keyof typeof NOTIFICATION_CATEGORIES, Partial<Channels>>>;

const defaults = (c: keyof typeof NOTIFICATION_CATEGORIES): Channels => ({ inApp: true, email: NOTIFICATION_CATEGORIES[c].email, push: true });

export interface NotifyInput {
  userIds: string | null | undefined | (string | null | undefined)[];
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  /** Web path such as /account/orders/KP-…; emails turn it into a full link. */
  link?: string;
  /** Usually the person who caused it; never notified about their own action. */
  exclude?: string | null;
}

/**
 * Push delivery. Disabled until a Firebase project is configured; device tokens are still stored
 * so that turning it on later reaches existing installs. Nothing is reported as sent when it is off.
 */
@Injectable()
export class PushService {
  readonly enabled = false;
  async send(_tokens: string[], _title: string, _body: string, _link?: string): Promise<void> {}
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');
  private readonly webOrigin: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly push: PushService,
    config: ConfigService,
  ) {
    this.webOrigin = config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
  }

  /**
   * Records an in-app notification and sends email/push as each person prefers.
   * Delivery problems are logged and never fail the action that caused the notification.
   */
  async notify(input: NotifyInput): Promise<void> {
    const ids = [...new Set((Array.isArray(input.userIds) ? input.userIds : [input.userIds]).filter((x): x is string => Boolean(x)))].filter(
      (id) => id !== input.exclude,
    );
    if (!ids.length) return;
    try {
      const users = await this.prisma.user.findMany({
        // Account notices (e.g. a suspension) must reach people who can no longer sign in.
        where: { id: { in: ids }, status: input.category === 'account' ? { not: 'DELETED' } : 'ACTIVE' },
        select: { id: true, email: true, fullName: true, notificationSettings: { select: { prefs: true } }, devices: { select: { token: true } } },
      });
      const channel = (u: (typeof users)[number]): Channels => {
        if (input.category === 'account') return { inApp: true, email: true, push: true };
        const saved = ((u.notificationSettings?.prefs ?? {}) as Prefs)[input.category] ?? {};
        return { ...defaults(input.category), ...saved };
      };
      const plan = users.map((u) => ({ u, c: channel(u) }));

      const inApp = plan.filter((p) => p.c.inApp);
      if (inApp.length) {
        await this.prisma.notification.createMany({
          data: inApp.map(({ u }) => ({ userId: u.id, category: input.category, type: input.type, title: input.title, body: input.body, link: input.link ?? null })),
        });
      }
      const sends: Promise<unknown>[] = [];
      for (const { u, c } of plan) {
        if (c.email) {
          sends.push(
            this.mail.send({
              to: u.email,
              subject: input.title,
              text: `Hi ${u.fullName},\n\n${input.body}`,
              action: input.link ? { label: 'Open Kite Platform', url: this.webOrigin + input.link } : undefined,
            }),
          );
        }
        if (c.push && this.push.enabled && u.devices.length) sends.push(this.push.send(u.devices.map((d) => d.token), input.title, input.body, input.link));
      }
      const results = await Promise.allSettled(sends);
      for (const r of results) if (r.status === 'rejected') this.logger.error(`Delivery failed for ${input.type}: ${String(r.reason)}`);
    } catch (e) {
      this.logger.error(`Could not record ${input.type}: ${String(e)}`);
    }
  }

  /** Fire-and-forget form for use after a request has finished its own work. */
  send(input: NotifyInput): void {
    void this.notify(input);
  }

  /** Active users whose roles grant a permission (e.g. payments staff). */
  async staffWith(permission: Permission): Promise<string[]> {
    const rows = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', roles: { some: { role: { permissions: { some: { permission: { key: permission } } } } } } },
      select: { id: true },
      take: 50,
    });
    return rows.map((r) => r.id);
  }

  // ─── Inbox ──────────────────────────────────────────────────────────────

  async list(userId: string, q: NotificationQueryDto) {
    const where: Prisma.NotificationWhereInput = { userId, ...(q.unread && { readAt: null }) };
    const [rows, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        select: { id: true, category: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    const page = new Paginated(rows, total, q);
    Object.assign(page.meta, { unread });
    return page;
  }

  async unreadCount(userId: string) {
    return { count: await this.prisma.notification.count({ where: { userId, readAt: null } }) };
  }

  async markRead(userId: string, id: string) {
    const { count } = await this.prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
    if (!count) throw Errors.notFound('Notification');
    return this.unreadCount(userId);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
    return { count: 0 };
  }

  async preferences(userId: string) {
    const saved = ((await this.prisma.notificationSetting.findUnique({ where: { userId } }))?.prefs ?? {}) as Prefs;
    return {
      channels: { inApp: true, email: true, push: this.push.enabled },
      categories: Object.entries(NOTIFICATION_CATEGORIES).map(([key, c]) => ({
        key,
        label: c.label,
        description: c.description,
        ...defaults(key as keyof typeof NOTIFICATION_CATEGORIES),
        ...saved[key as keyof typeof NOTIFICATION_CATEGORIES],
      })),
    };
  }

  async savePreferences(userId: string, dto: PreferencesDto) {
    const clean: Prefs = {};
    for (const [key, value] of Object.entries(dto.prefs)) {
      if (!(key in NOTIFICATION_CATEGORIES) || typeof value !== 'object' || value === null) continue;
      const v = value as Record<string, unknown>;
      clean[key as keyof typeof NOTIFICATION_CATEGORIES] = Object.fromEntries(
        (['inApp', 'email', 'push'] as const).filter((ch) => typeof v[ch] === 'boolean').map((ch) => [ch, v[ch]]),
      );
    }
    await this.prisma.notificationSetting.upsert({ where: { userId }, update: { prefs: clean }, create: { userId, prefs: clean } });
    return this.preferences(userId);
  }

  async registerDevice(userId: string, dto: DeviceDto) {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      update: { userId, platform: dto.platform, lastSeenAt: new Date() },
      create: { userId, token: dto.token, platform: dto.platform },
    });
    return { registered: true, pushEnabled: this.push.enabled };
  }

  async removeDevice(userId: string, token: string) {
    await this.prisma.deviceToken.deleteMany({ where: { token, userId } });
    return { removed: true };
  }
}

// ─── DTOs & controller ──────────────────────────────────────────────────────

export class NotificationQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unread?: boolean;
}

export class PreferencesDto {
  @ApiPropertyOptional({ example: { community: { email: false, push: true } } })
  @IsObject()
  prefs: Record<string, unknown>;
}

export class DeviceDto {
  @ApiPropertyOptional() @IsString() @Length(10, 4096) token: string;
  @ApiPropertyOptional({ enum: ['android', 'ios', 'web'] }) @IsIn(['android', 'ios', 'web']) platform: 'android' | 'ios' | 'web';
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(@CurrentUser() user: AuthUser, @Query() q: NotificationQueryDto) {
    return this.notifications.list(user.id, q);
  }

  @Get('notifications/unread-count')
  unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post('notifications/:id/read')
  @HttpCode(HttpStatus.OK)
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Get('notifications/preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.notifications.preferences(user.id);
  }

  @Put('notifications/preferences')
  savePreferences(@CurrentUser() user: AuthUser, @Body() dto: PreferencesDto) {
    return this.notifications.savePreferences(user.id, dto);
  }

  @Post('devices')
  @ApiOperation({ summary: 'Register a device for push notifications' })
  registerDevice(@CurrentUser() user: AuthUser, @Body() dto: DeviceDto) {
    return this.notifications.registerDevice(user.id, dto);
  }

  @Delete('devices/:token')
  removeDevice(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.notifications.removeDevice(user.id, token);
  }
}

@Global()
@Module({
  imports: [MailModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PushService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
