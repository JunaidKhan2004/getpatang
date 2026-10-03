import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Injectable, Module, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { EventRegistrationStatus, EventStatus, Prisma } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

import {
  type AuthUser,
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  Public,
  ReqMeta,
  type RequestMeta,
  RequirePermissions,
} from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { textContains } from '../../common/db.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated, PaginationQueryDto } from '../../common/pagination.js';
import { uniqueSlug } from '../../common/slug.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { ProductRules } from '../seller/product-rules.js';
import { UploadsService } from '../storage/uploads.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const EVENT_TYPES = ['festival', 'exhibition', 'workshop', 'gathering', 'competition'] as const;

export class EventQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EVENT_TYPES })
  @IsOptional()
  @IsIn(EVENT_TYPES)
  type?: (typeof EVENT_TYPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional({ enum: ['upcoming', 'past'], default: 'upcoming' })
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  when: 'upcoming' | 'past' = 'upcoming';
}

export class AdminEventQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsIn(Object.values(EventStatus))
  status?: EventStatus;
}

export class EventInputDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(5, 100, { message: 'Name must be 5–100 characters' }) name: string;
  @ApiProperty({ enum: EVENT_TYPES }) @IsIn(EVENT_TYPES, { message: 'Choose an event type' }) type: (typeof EVENT_TYPES)[number];
  @ApiProperty() @Transform(trim) @IsString() @Length(30, 5000, { message: 'Describe the event in 30–5000 characters' }) description: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 60) city: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(3, 120) venue: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(200) venueAddress?: string;
  @ApiProperty() @IsDateString({}, { message: 'Choose a start date and time' }) startsAt: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endsAt?: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(2, 100) organizerName: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(120) organizerContact?: string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @MaxLength(5000) rules?: string;
  @ApiProperty() @Transform(trim) @IsString() @Length(10, 3000, { message: 'Safety notes are required' }) safetyNotes: string;

  @ApiPropertyOptional({ description: 'People including guests; empty = no limit' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100_000)
  capacity?: number | null;

  @ApiProperty() @IsBoolean() registrationRequired: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() registrationClosesAt?: string;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(1_000_000) fee: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(0) @Max(10) maxGuests: number;
  @ApiPropertyOptional({ description: 'Upload id (event_banner), or null to remove' }) @IsOptional() @IsString() bannerUploadId?: string | null;
  @ApiPropertyOptional({ description: 'Slug of a tournament held at this event' }) @IsOptional() @IsString() tournamentSlug?: string;
}

export class RegisterEventDto {
  @ApiProperty({ minimum: 0, maximum: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10)
  guests: number = 0;
}

export class CancelEventDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(5, 500, { message: 'Tell people why it is cancelled' }) reason: string;
}

const COUNTED: EventRegistrationStatus[] = [EventRegistrationStatus.CONFIRMED];

const eventSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  city: true,
  venue: true,
  startsAt: true,
  endsAt: true,
  organizerName: true,
  fee: true,
  capacity: true,
  registrationRequired: true,
  registrationClosesAt: true,
  bannerUrl: true,
  status: true,
} satisfies Prisma.EventSelect;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly rules: ProductRules,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private notifyPromoted(userIds: string[], e: { name: string; slug: string }) {
    this.notifications.send({
      userIds,
      category: 'events',
      type: 'event.promoted',
      title: `You have a place at ${e.name}`,
      body: 'A place opened and you moved up from the waiting list. See you there!',
      link: `/events/${e.slug}`,
    });
  }

  /** People attending (each registration plus its guests). */
  private async attendance(eventId: string, tx: Prisma.TransactionClient = this.prisma) {
    const agg = await tx.eventRegistration.aggregate({ where: { eventId, status: { in: COUNTED } }, _sum: { guests: true }, _count: true });
    return agg._count + (agg._sum.guests ?? 0);
  }

  private registrationOpen(e: { status: EventStatus; registrationRequired: boolean; registrationClosesAt: Date | null; startsAt: Date }) {
    const now = new Date();
    return e.status === EventStatus.PUBLISHED && e.registrationRequired && e.startsAt > now && (!e.registrationClosesAt || e.registrationClosesAt > now);
  }

  async list(q: EventQueryDto) {
    const now = new Date();
    const where: Prisma.EventWhereInput = {
      status: q.when === 'past' ? { in: [EventStatus.PUBLISHED, EventStatus.COMPLETED] } : EventStatus.PUBLISHED,
      ...(q.when === 'past' ? { startsAt: { lt: now } } : { OR: [{ startsAt: { gte: now } }, { endsAt: { gte: now } }] }),
      ...(q.type && { type: q.type }),
      ...(q.city && { city: q.city }),
      ...(q.q && { AND: [{ OR: [{ name: textContains(q.q) }, { venue: textContains(q.q) }, { organizerName: textContains(q.q) }] }] }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({ where, select: eventSelect, orderBy: { startsAt: q.when === 'past' ? 'desc' : 'asc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.event.count({ where }),
    ]);
    const withCounts = await Promise.all(rows.map(async (e) => ({ ...e, attending: await this.attendance(e.id), registrationOpen: this.registrationOpen(e) })));
    return new Paginated(withCounts, total, q);
  }

  async detail(slug: string, userId?: string) {
    const e = await this.prisma.event.findFirst({ where: { slug, status: { not: EventStatus.DRAFT } } });
    if (!e) throw Errors.notFound('Event');
    const [attending, waitlisted, mine, tournament] = await Promise.all([
      this.attendance(e.id),
      this.prisma.eventRegistration.count({ where: { eventId: e.id, status: EventRegistrationStatus.WAITLISTED } }),
      userId ? this.prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: e.id, userId } }, select: { status: true, guests: true } }) : null,
      e.tournamentId ? this.prisma.tournament.findUnique({ where: { id: e.tournamentId }, select: { slug: true, name: true } }) : null,
    ]);
    const { createdById: _c, tournamentId: _t, ...rest } = e;
    return { ...rest, attending, waitlisted, registrationOpen: this.registrationOpen(e), myRegistration: mine?.status === EventRegistrationStatus.CANCELLED ? null : mine, tournament };
  }

  async register(slug: string, userId: string, dto: RegisterEventDto, meta: RequestMeta) {
    const e = await this.prisma.event.findFirst({ where: { slug } });
    if (!e || !this.registrationOpen(e)) throw new AppException('REGISTRATION_CLOSED', 'Registration for this event is not open.', HttpStatus.CONFLICT);
    if (dto.guests > e.maxGuests) {
      throw new AppException('TOO_MANY_GUESTS', `You can bring at most ${e.maxGuests} guests.`, 400, [{ field: 'guests', message: `At most ${e.maxGuests}` }]);
    }
    const reg = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.eventRegistration.findUnique({ where: { eventId_userId: { eventId: e.id, userId } } });
      if (existing && existing.status !== EventRegistrationStatus.CANCELLED) {
        throw new AppException('ALREADY_REGISTERED', 'You are already registered for this event.', HttpStatus.CONFLICT);
      }
      const fits = e.capacity === null || (await this.attendance(e.id, tx)) + 1 + dto.guests <= e.capacity;
      const status = fits ? EventRegistrationStatus.CONFIRMED : EventRegistrationStatus.WAITLISTED;
      return existing
        ? tx.eventRegistration.update({ where: { id: existing.id }, data: { status, guests: dto.guests } })
        : tx.eventRegistration.create({ data: { eventId: e.id, userId, status, guests: dto.guests } });
    });
    await this.audit.log({ actorId: userId, action: 'event.register', entityType: 'event', entityId: e.id, metadata: { status: reg.status, guests: reg.guests }, meta });
    return {
      status: reg.status,
      message:
        reg.status === EventRegistrationStatus.CONFIRMED
          ? `You are registered${e.fee ? `. Pay the Rs ${e.fee.toLocaleString('en-PK')} fee to the organizer at the venue` : ''}.`
          : 'The event is full, so you are on the waiting list. We will move you up if places open.',
    };
  }

  async cancelRegistration(slug: string, userId: string, meta: RequestMeta) {
    const e = await this.prisma.event.findFirst({ where: { slug } });
    if (!e) throw Errors.notFound('Event');
    const reg = await this.prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: e.id, userId } } });
    if (!reg || reg.status === EventRegistrationStatus.CANCELLED) throw Errors.notFound('Registration');
    const promoted = await this.prisma.$transaction(async (tx) => {
      await tx.eventRegistration.update({ where: { id: reg.id }, data: { status: EventRegistrationStatus.CANCELLED } });
      return reg.status === EventRegistrationStatus.CONFIRMED ? this.promoteWaitlist(tx, e.id, e.capacity) : [];
    });
    await this.audit.log({ actorId: userId, action: 'event.unregister', entityType: 'event', entityId: e.id, meta });
    this.notifyPromoted(promoted, e);
    return { cancelled: true };
  }

  /** Moves waiting people up, oldest first, while they fit. Returns who moved up. */
  private async promoteWaitlist(tx: Prisma.TransactionClient, eventId: string, capacity: number | null) {
    const waiting = await tx.eventRegistration.findMany({ where: { eventId, status: EventRegistrationStatus.WAITLISTED }, orderBy: { createdAt: 'asc' } });
    let used = await this.attendance(eventId, tx);
    const moved: string[] = [];
    for (const w of waiting) {
      if (capacity !== null && used + 1 + w.guests > capacity) break;
      await tx.eventRegistration.update({ where: { id: w.id }, data: { status: EventRegistrationStatus.CONFIRMED } });
      used += 1 + w.guests;
      moved.push(w.userId);
    }
    return moved;
  }

  async mine(userId: string) {
    const rows = await this.prisma.eventRegistration.findMany({
      where: { userId, status: { not: EventRegistrationStatus.CANCELLED } },
      orderBy: { event: { startsAt: 'desc' } },
      select: { status: true, guests: true, event: { select: eventSelect } },
    });
    return rows.map((r) => ({ status: r.status, guests: r.guests, event: { ...r.event, registrationOpen: this.registrationOpen(r.event) } }));
  }

  // ─── Admin (events.manage) ──────────────────────────────────────────────

  async adminList(q: AdminEventQueryDto) {
    const where: Prisma.EventWhereInput = { ...(q.status && { status: q.status }), ...(q.q && { name: textContains(q.q) }) };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({ where, select: eventSelect, orderBy: { startsAt: 'desc' }, skip: q.skip, take: q.pageSize }),
      this.prisma.event.count({ where }),
    ]);
    return new Paginated(await Promise.all(rows.map(async (e) => ({ ...e, attending: await this.attendance(e.id) }))), total, q);
  }

  async adminDetail(id: string) {
    const e = await this.prisma.event.findUnique({ where: { id } });
    if (!e) throw Errors.notFound('Event');
    const registrations = await this.prisma.eventRegistration.findMany({
      where: { eventId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, status: true, guests: true, createdAt: true, user: { select: { fullName: true, email: true, phone: true } } },
    });
    const tournament = e.tournamentId ? await this.prisma.tournament.findUnique({ where: { id: e.tournamentId }, select: { slug: true } }) : null;
    return { ...e, tournamentSlug: tournament?.slug ?? null, attending: await this.attendance(id), registrations };
  }

  private async data(dto: EventInputDto, actorId: string) {
    const starts = new Date(dto.startsAt);
    if (dto.endsAt && new Date(dto.endsAt) < starts) throw new AppException('DATES_INVALID', 'The end must be after the start.', 400, [{ field: 'endsAt', message: 'Must be after the start' }]);
    if (dto.registrationClosesAt && new Date(dto.registrationClosesAt) > starts) {
      throw new AppException('DATES_INVALID', 'Registration must close before the event starts.', 400, [{ field: 'registrationClosesAt', message: 'Must be before the start' }]);
    }
    await this.rules.assertAllowedIn('description', dto.name, dto.description, dto.rules);
    const [banner] = await this.uploads.ownedUploads(actorId, dto.bannerUploadId ? [dto.bannerUploadId] : [], 'event_banner');
    let tournamentId: string | null = null;
    if (dto.tournamentSlug) {
      const t = await this.prisma.tournament.findUnique({ where: { slug: dto.tournamentSlug }, select: { id: true } });
      if (!t) throw new AppException('TOURNAMENT_NOT_FOUND', 'No tournament has that web address.', 400, [{ field: 'tournamentSlug', message: 'Not found' }]);
      tournamentId = t.id;
    }
    return {
      name: dto.name,
      type: dto.type,
      description: dto.description,
      city: dto.city,
      venue: dto.venue,
      venueAddress: dto.venueAddress || null,
      startsAt: starts,
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      organizerName: dto.organizerName,
      organizerContact: dto.organizerContact || null,
      rules: dto.rules || null,
      safetyNotes: dto.safetyNotes,
      capacity: dto.capacity ?? null,
      registrationRequired: dto.registrationRequired,
      registrationClosesAt: dto.registrationClosesAt ? new Date(dto.registrationClosesAt) : null,
      fee: dto.fee,
      maxGuests: dto.maxGuests,
      tournamentId,
      ...(dto.bannerUploadId !== undefined && { bannerUrl: banner?.url ?? null }),
    };
  }

  async create(dto: EventInputDto, actorId: string, meta: RequestMeta) {
    const data = await this.data(dto, actorId);
    const slug = await uniqueSlug(dto.name, async (s) => Boolean(await this.prisma.event.findUnique({ where: { slug: s }, select: { id: true } })));
    const e = await this.prisma.event.create({ data: { ...data, slug, createdById: actorId } });
    await this.audit.log({ actorId, action: 'event.create', entityType: 'event', entityId: e.id, meta });
    return this.adminDetail(e.id);
  }

  async update(id: string, dto: EventInputDto, actorId: string, meta: RequestMeta) {
    const e = await this.prisma.event.findUnique({ where: { id } });
    if (!e) throw Errors.notFound('Event');
    const editable: EventStatus[] = [EventStatus.DRAFT, EventStatus.PUBLISHED];
    if (!editable.includes(e.status)) throw new AppException('EVENT_LOCKED', 'Cancelled or finished events cannot be edited.', HttpStatus.CONFLICT);
    const data = await this.data(dto, actorId);
    if (data.capacity !== null && data.capacity < (await this.attendance(id))) {
      throw new AppException('CAPACITY_TOO_LOW', 'More people are already registered than this capacity.', 400, [{ field: 'capacity', message: 'Too low' }]);
    }
    const promoted = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.event.update({ where: { id }, data });
      const moved = data.capacity === null || data.capacity > (e.capacity ?? 0) ? await this.promoteWaitlist(tx, id, data.capacity) : [];
      return { moved, event: updated };
    });
    await this.audit.log({ actorId, action: 'event.update', entityType: 'event', entityId: id, meta });
    this.notifyPromoted(promoted.moved, promoted.event);
    return this.adminDetail(id);
  }

  async publish(id: string, actorId: string, meta: RequestMeta) {
    const e = await this.prisma.event.findUnique({ where: { id } });
    if (!e) throw Errors.notFound('Event');
    if (e.status !== EventStatus.DRAFT) throw new AppException('STATUS_CONFLICT', 'Only drafts can be published.', HttpStatus.CONFLICT);
    if (e.startsAt <= new Date()) throw new AppException('DATES_INVALID', 'This event has already started. Update the date first.', 400);
    await this.prisma.event.update({ where: { id }, data: { status: EventStatus.PUBLISHED, publishedAt: new Date() } });
    await this.audit.log({ actorId, action: 'event.publish', entityType: 'event', entityId: id, meta });
    return this.adminDetail(id);
  }

  async cancel(id: string, reason: string, actorId: string, meta: RequestMeta) {
    const e = await this.prisma.event.findUnique({ where: { id } });
    if (!e) throw Errors.notFound('Event');
    if (e.status === EventStatus.CANCELLED) throw new AppException('STATUS_CONFLICT', 'Already cancelled.', HttpStatus.CONFLICT);
    await this.prisma.event.update({ where: { id }, data: { status: EventStatus.CANCELLED, cancelReason: reason } });
    await this.audit.log({ actorId, action: 'event.cancel', entityType: 'event', entityId: id, metadata: { reason }, meta });
    const regs = await this.prisma.eventRegistration.findMany({ where: { eventId: id, status: { not: EventRegistrationStatus.CANCELLED } }, select: { userId: true } });
    this.notifications.send({
      userIds: regs.map((r) => r.userId),
      category: 'events',
      type: 'event.cancelled',
      title: `${e.name} is cancelled`,
      body: `Reason: ${reason}`,
      link: `/events/${e.slug}`,
    });
    return this.adminDetail(id);
  }
}

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Festivals, exhibitions, workshops and gatherings' })
  list(@Query() q: EventQueryDto) {
    return this.events.list(q);
  }

  @ApiBearerAuth()
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.events.mine(user.id);
  }

  @OptionalAuth()
  @Get(':slug')
  detail(@Param('slug') slug: string, @MaybeUser() user?: AuthUser) {
    return this.events.detail(slug, user?.id);
  }

  @ApiBearerAuth()
  @Post(':slug/registration')
  register(@Param('slug') slug: string, @Body() dto: RegisterEventDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.events.register(slug, user.id, dto, meta);
  }

  @ApiBearerAuth()
  @Delete(':slug/registration')
  unregister(@Param('slug') slug: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.events.cancelRegistration(slug, user.id, meta);
  }
}

@ApiTags('Admin')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.EVENTS_MANAGE)
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(@Query() q: AdminEventQueryDto) {
    return this.events.adminList(q);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.events.adminDetail(id);
  }

  @Post()
  create(@Body() dto: EventInputDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.events.create(dto, user.id, meta);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: EventInputDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.events.update(id, dto, user.id, meta);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param('id') id: string, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.events.publish(id, user.id, meta);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string, @Body() dto: CancelEventDto, @CurrentUser() user: AuthUser, @ReqMeta() meta: RequestMeta) {
    return this.events.cancel(id, dto.reason, user.id, meta);
  }
}

@Module({
  controllers: [EventsController, AdminEventsController],
  providers: [EventsService, ProductRules],
})
export class EventsModule {}
