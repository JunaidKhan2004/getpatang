import { HttpStatus, Injectable } from '@nestjs/common';
import { MatchStatus, ParticipantStatus, Prisma, TournamentStatus } from '@prisma/client';

import type { RequestMeta } from '../../common/auth/decorators.js';
import { textContains } from '../../common/db.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated } from '../../common/pagination.js';
import { uniqueSlug } from '../../common/slug.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { ProductRules } from '../seller/product-rules.js';
import { UploadsService } from '../storage/uploads.js';
import { bracketSize, firstRoundPairs, roundCount, roundName } from './bracket.js';
import { MatchesService } from './matches.service.js';
import { RegisterDto, TournamentInputDto, TournamentQueryDto, UpdateParticipantDto } from './tournaments.dto.js';

/** Spots counted against maxParticipants. */
const HOLDS_SPOT: ParticipantStatus[] = [ParticipantStatus.PENDING, ParticipantStatus.CONFIRMED];

const tErrors = {
  notOpen: () => new AppException('REGISTRATION_CLOSED', 'Registration for this tournament is not open.', HttpStatus.CONFLICT),
  tooYoung: (min: number) =>
    new AppException('AGE_REQUIREMENT', `Players must be at least ${min} years old on the tournament day.`, HttpStatus.FORBIDDEN),
  dobRequired: () =>
    new AppException('DOB_REQUIRED', 'Enter your date of birth to check the age requirement.', HttpStatus.BAD_REQUEST, [
      { field: 'dateOfBirth', message: 'Date of birth is required' },
    ]),
  alreadyRegistered: () => new AppException('ALREADY_REGISTERED', 'You are already registered for this tournament.', HttpStatus.CONFLICT),
  locked: () =>
    new AppException('TOURNAMENT_LOCKED', 'This tournament has started or finished, so it can no longer be changed this way.', HttpStatus.CONFLICT),
};

export const ageOn = (dob: Date, day: Date) => {
  let age = day.getUTCFullYear() - dob.getUTCFullYear();
  const m = day.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && day.getUTCDate() < dob.getUTCDate())) age--;
  return age;
};

export const tournamentCardSelect = {
  id: true,
  slug: true,
  name: true,
  city: true,
  venue: true,
  startsAt: true,
  endsAt: true,
  registrationOpensAt: true,
  registrationClosesAt: true,
  status: true,
  maxParticipants: true,
  entryFee: true,
  minAge: true,
  season: true,
  bannerUrl: true,
  organizerName: true,
  prizeInfo: true,
  _count: { select: { participants: { where: { status: { in: HOLDS_SPOT } } } } },
} satisfies Prisma.TournamentSelect;

type CardRow = Prisma.TournamentGetPayload<{ select: typeof tournamentCardSelect }>;

export function toTournamentCard(t: CardRow, now = new Date()) {
  const { _count, ...rest } = t;
  return {
    ...rest,
    registeredCount: _count.participants,
    registrationOpen:
      t.status === TournamentStatus.PUBLISHED && t.registrationOpensAt <= now && t.registrationClosesAt > now,
  };
}

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly matches: MatchesService,
    private readonly rules: ProductRules,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  // ─── Public ────────────────────────────────────────────────────────────────

  async list(query: TournamentQueryDto) {
    const now = new Date();
    const views: Record<string, Prisma.TournamentWhereInput> = {
      upcoming: { status: TournamentStatus.PUBLISHED, startsAt: { gt: now } },
      open: { status: TournamentStatus.PUBLISHED, registrationOpensAt: { lte: now }, registrationClosesAt: { gt: now } },
      live: { status: TournamentStatus.IN_PROGRESS },
      completed: { status: TournamentStatus.COMPLETED },
    };
    const where: Prisma.TournamentWhereInput = {
      AND: [
        query.view ? views[query.view] : { status: { in: [TournamentStatus.PUBLISHED, TournamentStatus.IN_PROGRESS, TournamentStatus.COMPLETED] } },
        query.city ? { city: query.city } : {},
        query.season ? { season: query.season } : {},
        query.q ? { OR: [{ name: textContains(query.q) }, { venue: textContains(query.q) }, { organizerName: textContains(query.q) }] } : {},
      ],
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tournament.findMany({
        where,
        select: tournamentCardSelect,
        orderBy: { startsAt: query.view === 'completed' ? 'desc' : 'asc' },
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.tournament.count({ where }),
    ]);
    return new Paginated(rows.map((r) => toTournamentCard(r, now)), total, query);
  }

  async detail(slug: string, userId?: string) {
    const t = await this.prisma.tournament.findFirst({
      where: { slug, status: { not: TournamentStatus.DRAFT } },
      select: {
        ...tournamentCardSelect,
        description: true,
        venueAddress: true,
        format: true,
        rules: true,
        safetyRules: true,
        approvedMaterials: true,
        venueRestrictions: true,
        permitReference: true,
        organizerContact: true,
        cancelReason: true,
        completedAt: true,
        _count: {
          select: {
            participants: { where: { status: { in: HOLDS_SPOT } } },
            matches: true,
          },
        },
      },
    });
    if (!t) throw Errors.notFound('Tournament');
    const myEntry = userId
      ? await this.prisma.tournamentParticipant.findUnique({
          where: { tournamentId_userId: { tournamentId: t.id, userId } },
          select: { id: true, status: true, statusNote: true, finalPlacement: true },
        })
      : null;
    const waitlisted = await this.prisma.tournamentParticipant.count({ where: { tournamentId: t.id, status: ParticipantStatus.WAITLISTED } });
    const champion = t.status === TournamentStatus.COMPLETED
      ? await this.prisma.tournamentParticipant.findFirst({
          where: { tournamentId: t.id, finalPlacement: 1 },
          select: { user: { select: { id: true, fullName: true, profile: { select: { displayName: true } } } } },
        })
      : null;
    return {
      ...toTournamentCard(t),
      matchCount: t._count.matches,
      waitlistedCount: waitlisted,
      myEntry,
      champion: champion ? { userId: champion.user.id, name: champion.user.profile?.displayName ?? champion.user.fullName } : null,
    };
  }

  async participants(slug: string) {
    const t = await this.publicTournament(slug);
    const rows = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId: t.id, status: { in: [ParticipantStatus.CONFIRMED, ParticipantStatus.DISQUALIFIED] } },
      orderBy: [{ finalPlacement: { sort: 'asc', nulls: 'last' } }, { seed: { sort: 'asc', nulls: 'last' } }, { registeredAt: 'asc' }],
      select: {
        id: true,
        seed: true,
        status: true,
        finalPlacement: true,
        user: { select: { id: true, fullName: true, profile: { select: { displayName: true, city: true, avatarUrl: true } } } },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      seed: p.seed,
      status: p.status,
      finalPlacement: p.finalPlacement,
      player: { userId: p.user.id, name: p.user.profile?.displayName ?? p.user.fullName, city: p.user.profile?.city ?? null, avatarUrl: p.user.profile?.avatarUrl ?? null },
    }));
  }

  /** Bracket grouped by round, for drawing. */
  async bracket(slug: string) {
    const t = await this.publicTournament(slug);
    const matches = await this.matches.listForTournament(t.id);
    const rounds = matches.length ? Math.max(...matches.map((m) => m.round)) : 0;
    return {
      rounds: Array.from({ length: rounds }, (_, i) => ({
        round: i + 1,
        name: roundName(i + 1, rounds),
        matches: matches.filter((m) => m.round === i + 1).sort((a, b) => a.position - b.position),
      })),
    };
  }

  async schedule(slug: string, status?: MatchStatus) {
    const t = await this.publicTournament(slug);
    const matches = await this.matches.listForTournament(t.id, status);
    return matches.filter((m) => !m.isBye).sort((a, b) => (a.scheduledAt ?? '9').localeCompare(b.scheduledAt ?? '9') || a.matchNumber - b.matchNumber);
  }

  private async publicTournament(slug: string) {
    const t = await this.prisma.tournament.findFirst({ where: { slug, status: { not: TournamentStatus.DRAFT } }, select: { id: true } });
    if (!t) throw Errors.notFound('Tournament');
    return t;
  }

  // ─── Registration ─────────────────────────────────────────────────────────

  async register(slug: string, userId: string, dto: RegisterDto, meta: RequestMeta) {
    const t = await this.prisma.tournament.findFirst({ where: { slug, status: TournamentStatus.PUBLISHED } });
    const now = new Date();
    if (!t || t.registrationOpensAt > now || t.registrationClosesAt <= now) throw tErrors.notOpen();

    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const dob = dto.dateOfBirth ? new Date(dto.dateOfBirth) : profile?.dateOfBirth;
    if (!dob) throw tErrors.dobRequired();
    if (ageOn(dob, t.startsAt) < t.minAge) throw tErrors.tooYoung(t.minAge);
    if (dto.dateOfBirth && profile && !profile.dateOfBirth) {
      await this.prisma.profile.update({ where: { userId }, data: { dateOfBirth: dob } });
    }

    const entry = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.tournamentParticipant.findUnique({ where: { tournamentId_userId: { tournamentId: t.id, userId } } });
      if (existing && existing.status !== ParticipantStatus.WITHDRAWN) throw tErrors.alreadyRegistered();
      const taken = await tx.tournamentParticipant.count({ where: { tournamentId: t.id, status: { in: HOLDS_SPOT } } });
      const status =
        taken >= t.maxParticipants ? ParticipantStatus.WAITLISTED : t.entryFee > 0 ? ParticipantStatus.PENDING : ParticipantStatus.CONFIRMED;
      const data = { status, acceptedRulesAt: now, statusNote: null, seed: null };
      return existing
        ? tx.tournamentParticipant.update({ where: { id: existing.id }, data })
        : tx.tournamentParticipant.create({ data: { ...data, tournamentId: t.id, userId } });
    });
    await this.audit.log({ actorId: userId, action: 'tournament.register', entityType: 'tournament', entityId: t.id, metadata: { status: entry.status }, meta });
    return {
      status: entry.status,
      message:
        entry.status === ParticipantStatus.CONFIRMED
          ? 'You are registered. See you on the field!'
          : entry.status === ParticipantStatus.PENDING
            ? `Your spot is held. Pay the Rs ${t.entryFee.toLocaleString('en-PK')} entry fee to the organizer to confirm it.`
            : 'The tournament is full, so you are on the waiting list. We will move you up if a spot opens.',
    };
  }

  async withdraw(slug: string, userId: string, meta: RequestMeta) {
    const t = await this.prisma.tournament.findFirst({ where: { slug } });
    if (!t) throw Errors.notFound('Tournament');
    if (t.status !== TournamentStatus.PUBLISHED) throw tErrors.locked();
    const entry = await this.prisma.tournamentParticipant.findUnique({ where: { tournamentId_userId: { tournamentId: t.id, userId } } });
    if (!entry || entry.status === ParticipantStatus.WITHDRAWN) throw Errors.notFound('Registration');

    const promoted = await this.prisma.$transaction(async (tx) => {
      await tx.tournamentParticipant.update({ where: { id: entry.id }, data: { status: ParticipantStatus.WITHDRAWN, seed: null } });
      return HOLDS_SPOT.includes(entry.status) ? this.promoteWaitlist(tx, t.id, t.entryFee) : null;
    });
    await this.audit.log({ actorId: userId, action: 'tournament.withdraw', entityType: 'tournament', entityId: t.id, meta });
    this.notifyPromoted(promoted, t);
    return { status: ParticipantStatus.WITHDRAWN };
  }

  private notifyPromoted(promoted: { userId: string; status: ParticipantStatus } | null, t: { name: string; slug: string; entryFee: number }) {
    if (!promoted) return;
    this.notifications.send({
      userIds: promoted.userId,
      category: 'tournaments',
      type: 'tournament.promoted',
      title: `A place opened in ${t.name}`,
      body:
        promoted.status === ParticipantStatus.CONFIRMED
          ? 'You moved up from the waiting list and your place is confirmed.'
          : 'You moved up from the waiting list. Pay the entry fee to the organizer to confirm your place.',
      link: `/tournaments/${t.slug}`,
    });
  }

  /** Moves the longest-waiting player into a freed spot and returns who moved up. */
  private async promoteWaitlist(tx: Prisma.TransactionClient, tournamentId: string, entryFee: number) {
    const next = await tx.tournamentParticipant.findFirst({
      where: { tournamentId, status: ParticipantStatus.WAITLISTED },
      orderBy: { registeredAt: 'asc' },
    });
    if (!next) return null;
    const status = entryFee > 0 ? ParticipantStatus.PENDING : ParticipantStatus.CONFIRMED;
    await tx.tournamentParticipant.update({ where: { id: next.id }, data: { status, statusNote: 'Moved up from the waiting list' } });
    return { userId: next.userId, status };
  }

  async myTournaments(userId: string) {
    const rows = await this.prisma.tournamentParticipant.findMany({
      where: { userId, status: { not: ParticipantStatus.WITHDRAWN } },
      orderBy: { tournament: { startsAt: 'desc' } },
      select: { id: true, status: true, statusNote: true, finalPlacement: true, tournament: { select: tournamentCardSelect } },
    });
    return rows.map((r) => ({ entryId: r.id, status: r.status, statusNote: r.statusNote, finalPlacement: r.finalPlacement, tournament: toTournamentCard(r.tournament) }));
  }

  // ─── Organizer (tournaments.manage) ───────────────────────────────────────

  private validateDates(dto: TournamentInputDto) {
    const opens = new Date(dto.registrationOpensAt);
    const closes = new Date(dto.registrationClosesAt);
    const starts = new Date(dto.startsAt);
    const fail = (field: string, message: string) => {
      throw new AppException('DATES_INVALID', message, 400, [{ field, message }]);
    };
    if (closes <= opens) fail('registrationClosesAt', 'Registration must close after it opens');
    if (closes > starts) fail('registrationClosesAt', 'Registration must close before the tournament starts');
    if (dto.endsAt && new Date(dto.endsAt) < starts) fail('endsAt', 'The end must be after the start');
  }

  private async data(dto: TournamentInputDto, actorId: string) {
    this.validateDates(dto);
    // Materials and descriptions are checked against the same banned list as products.
    await this.rules.assertAllowed(dto.name, dto.description, dto.approvedMaterials);
    const [banner] = await this.uploads.ownedUploads(actorId, dto.bannerUploadId ? [dto.bannerUploadId] : [], 'tournament_banner');
    return {
      name: dto.name,
      description: dto.description,
      city: dto.city,
      venue: dto.venue,
      venueAddress: dto.venueAddress || null,
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      registrationOpensAt: new Date(dto.registrationOpensAt),
      registrationClosesAt: new Date(dto.registrationClosesAt),
      maxParticipants: dto.maxParticipants,
      minAge: dto.minAge,
      entryFee: dto.entryFee,
      prizeInfo: dto.prizeInfo || null,
      rules: dto.rules,
      safetyRules: dto.safetyRules,
      approvedMaterials: dto.approvedMaterials,
      venueRestrictions: dto.venueRestrictions || null,
      permitReference: dto.permitReference || null,
      organizerName: dto.organizerName,
      organizerContact: dto.organizerContact || null,
      season: dto.season,
      ...(dto.bannerUploadId !== undefined && { bannerUrl: banner?.url ?? null }),
    };
  }

  async adminList(query: TournamentQueryDto & { status?: TournamentStatus }) {
    const where: Prisma.TournamentWhereInput = {
      ...(query.status && { status: query.status }),
      ...(query.q && { name: textContains(query.q) }),
    };
    const [rows, total, counts] = await this.prisma.$transaction([
      this.prisma.tournament.findMany({ where, select: tournamentCardSelect, orderBy: { startsAt: 'desc' }, skip: query.skip, take: query.pageSize }),
      this.prisma.tournament.count({ where }),
      this.prisma.tournament.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);
    const page = new Paginated(rows.map((r) => toTournamentCard(r)), total, query);
    Object.assign(page.meta, { statusCounts: Object.fromEntries(counts.map((c) => [c.status, (c._count as { _all: number })._all])) });
    return page;
  }

  async adminDetail(id: string) {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t) throw Errors.notFound('Tournament');
    const participants = await this.prisma.tournamentParticipant.findMany({
      where: { tournamentId: id },
      orderBy: [{ seed: { sort: 'asc', nulls: 'last' } }, { registeredAt: 'asc' }],
      select: {
        id: true,
        status: true,
        seed: true,
        statusNote: true,
        finalPlacement: true,
        registeredAt: true,
        user: { select: { id: true, fullName: true, email: true, phone: true, profile: { select: { city: true, dateOfBirth: true } } } },
      },
    });
    const matches = await this.matches.listForTournament(id);
    return { ...t, participants, matches };
  }

  async create(dto: TournamentInputDto, actorId: string, meta: RequestMeta) {
    const data = await this.data(dto, actorId);
    const slug = await uniqueSlug(`${dto.name} ${dto.season}`, async (s) => Boolean(await this.prisma.tournament.findUnique({ where: { slug: s }, select: { id: true } })));
    const t = await this.prisma.tournament.create({ data: { ...data, slug, createdById: actorId } });
    await this.audit.log({ actorId, action: 'tournament.create', entityType: 'tournament', entityId: t.id, meta });
    return this.adminDetail(t.id);
  }

  async update(id: string, dto: TournamentInputDto, actorId: string, meta: RequestMeta) {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t) throw Errors.notFound('Tournament');
    const editable: TournamentStatus[] = [TournamentStatus.DRAFT, TournamentStatus.PUBLISHED];
    if (!editable.includes(t.status)) throw tErrors.locked();
    const data = await this.data(dto, actorId);
    if (t.status === TournamentStatus.PUBLISHED && !data.permitReference) {
      throw new AppException('PERMIT_REQUIRED', 'A published tournament must keep its permit reference.', 400, [{ field: 'permitReference', message: 'Required' }]);
    }
    const taken = await this.prisma.tournamentParticipant.count({ where: { tournamentId: id, status: { in: HOLDS_SPOT } } });
    if (dto.maxParticipants < taken) {
      throw new AppException('CAPACITY_TOO_LOW', `${taken} players already hold a spot; the limit cannot be lower.`, 400, [{ field: 'maxParticipants', message: `At least ${taken}` }]);
    }
    await this.prisma.tournament.update({ where: { id }, data });
    await this.audit.log({ actorId, action: 'tournament.update', entityType: 'tournament', entityId: id, meta });
    return this.adminDetail(id);
  }

  /** Compliance gate: only permitted, safety-documented events go public. */
  async publish(id: string, actorId: string, meta: RequestMeta) {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t) throw Errors.notFound('Tournament');
    if (t.status !== TournamentStatus.DRAFT) throw new AppException('STATUS_CONFLICT', 'Only drafts can be published.', HttpStatus.CONFLICT);
    if (!t.permitReference) {
      throw new AppException(
        'PERMIT_REQUIRED',
        'Add the local authority permission reference before publishing. Only legally permitted events can be listed.',
        400,
        [{ field: 'permitReference', message: 'Required to publish' }],
      );
    }
    if (t.registrationClosesAt <= new Date()) {
      throw new AppException('DATES_INVALID', 'Registration has already closed. Update the dates before publishing.', 400);
    }
    await this.prisma.tournament.update({ where: { id }, data: { status: TournamentStatus.PUBLISHED, publishedAt: new Date() } });
    await this.audit.log({ actorId, action: 'tournament.publish', entityType: 'tournament', entityId: id, meta });
    return this.adminDetail(id);
  }

  async cancel(id: string, reason: string, actorId: string, meta: RequestMeta) {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t) throw Errors.notFound('Tournament');
    const closed: TournamentStatus[] = [TournamentStatus.COMPLETED, TournamentStatus.CANCELLED];
    if (closed.includes(t.status)) throw tErrors.locked();
    await this.prisma.$transaction([
      this.prisma.tournament.update({ where: { id }, data: { status: TournamentStatus.CANCELLED, cancelReason: reason } }),
      this.prisma.match.updateMany({
        where: { tournamentId: id, status: { in: [MatchStatus.SCHEDULED, MatchStatus.CHECK_IN, MatchStatus.LIVE, MatchStatus.DISPUTED] } },
        data: { status: MatchStatus.CANCELLED },
      }),
    ]);
    await this.audit.log({ actorId, action: 'tournament.cancel', entityType: 'tournament', entityId: id, metadata: { reason }, meta });
    const players = await this.prisma.tournamentParticipant.findMany({ where: { tournamentId: id, status: { notIn: [ParticipantStatus.WITHDRAWN, ParticipantStatus.REJECTED] } }, select: { userId: true } });
    this.notifications.send({
      userIds: players.map((p) => p.userId),
      category: 'tournaments',
      type: 'tournament.cancelled',
      title: `${t.name} is cancelled`,
      body: `Reason: ${reason}${t.entryFee ? ' Contact the organizer about any entry fee you paid.' : ''}`,
      link: `/tournaments/${t.slug}`,
    });
    return this.adminDetail(id);
  }

  async updateParticipant(id: string, participantId: string, dto: UpdateParticipantDto, actorId: string, meta: RequestMeta) {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t) throw Errors.notFound('Tournament');
    if (t.status !== TournamentStatus.PUBLISHED && t.status !== TournamentStatus.DRAFT) throw tErrors.locked();
    const p = await this.prisma.tournamentParticipant.findFirst({ where: { id: participantId, tournamentId: id } });
    if (!p) throw Errors.notFound('Participant');

    const promoted = await this.prisma.$transaction(async (tx) => {
      if (dto.status === ParticipantStatus.CONFIRMED && !HOLDS_SPOT.includes(p.status)) {
        const taken = await tx.tournamentParticipant.count({ where: { tournamentId: id, status: { in: HOLDS_SPOT } } });
        if (taken >= t.maxParticipants) {
          throw new AppException('TOURNAMENT_FULL', 'The tournament is full. Raise the player limit or remove someone first.', HttpStatus.CONFLICT);
        }
      }
      if (dto.seed) {
        const clash = await tx.tournamentParticipant.findFirst({ where: { tournamentId: id, seed: dto.seed, id: { not: participantId } } });
        if (clash) throw new AppException('SEED_TAKEN', `Seed ${dto.seed} is already given to another player.`, HttpStatus.CONFLICT);
      }
      await tx.tournamentParticipant.update({
        where: { id: participantId },
        data: {
          ...(dto.status && { status: dto.status }),
          ...(dto.seed !== undefined && { seed: dto.seed }),
          ...(dto.note !== undefined && { statusNote: dto.note || null }),
        },
      });
      const freedSpot = dto.status && HOLDS_SPOT.includes(p.status) && !HOLDS_SPOT.includes(dto.status);
      return freedSpot ? this.promoteWaitlist(tx, id, t.entryFee) : null;
    });
    this.notifyPromoted(promoted, t);
    await this.audit.log({ actorId, action: 'tournament.participant_update', entityType: 'tournament', entityId: id, metadata: { participantId, status: dto.status ?? null, seed: dto.seed ?? null }, meta });
    if (dto.status && dto.status !== p.status) {
      const words: Partial<Record<ParticipantStatus, string>> = {
        CONFIRMED: 'Your place is confirmed. See you there!',
        WAITLISTED: 'You are on the waiting list. We will tell you if a place opens.',
        REJECTED: 'Your registration was not accepted.',
        DISQUALIFIED: 'You were disqualified.',
      };
      if (words[dto.status]) {
        this.notifications.send({
          userIds: p.userId,
          category: 'tournaments',
          type: 'tournament.entry_status',
          title: `${t.name}: registration update`,
          body: `${words[dto.status]}${dto.note ? ` Note: ${dto.note}` : ''}`,
          link: `/tournaments/${t.slug}`,
        });
      }
    }
    return this.adminDetail(id);
  }

  /**
   * Closes registration and draws the single-elimination bracket from CONFIRMED players.
   * Seeded players are placed first (by seed); the rest are shuffled. Byes go to the top seeds
   * and are completed immediately.
   */
  async generateBracket(id: string, actorId: string, meta: RequestMeta) {
    const t = await this.prisma.tournament.findUnique({ where: { id } });
    if (!t) throw Errors.notFound('Tournament');
    if (t.status !== TournamentStatus.PUBLISHED) throw new AppException('STATUS_CONFLICT', 'The bracket can only be drawn for a published tournament.', HttpStatus.CONFLICT);
    const confirmed = await this.prisma.tournamentParticipant.findMany({ where: { tournamentId: id, status: ParticipantStatus.CONFIRMED } });
    if (confirmed.length < 2) throw new AppException('NOT_ENOUGH_PLAYERS', 'At least 2 confirmed players are needed to draw the bracket.', HttpStatus.CONFLICT);

    const seeded = confirmed.filter((p) => p.seed).sort((a, b) => a.seed! - b.seed!);
    const rest = shuffle(confirmed.filter((p) => !p.seed));
    const order = [...seeded, ...rest];
    const size = bracketSize(order.length);
    const rounds = roundCount(size);
    const pairs = firstRoundPairs(order);

    await this.prisma.$transaction(async (tx) => {
      // Create from the final backwards so every match can point at its next match.
      const ids: string[][] = [];
      let matchNumber = size - 1;
      for (let round = rounds; round >= 1; round--) {
        const count = size / 2 ** round;
        ids[round] = [];
        for (let position = count - 1; position >= 0; position--) {
          const next = round < rounds ? ids[round + 1][Math.floor(position / 2)] : null;
          const m = await tx.match.create({
            data: {
              tournamentId: id,
              round,
              position,
              matchNumber: matchNumber--,
              nextMatchId: next,
              nextSlot: next ? (position % 2 === 0 ? 'A' : 'B') : null,
              ...(round === 1 && { playerAId: pairs[position][0]?.id ?? null, playerBId: pairs[position][1]?.id ?? null }),
            },
          });
          ids[round][position] = m.id;
        }
      }
      await tx.tournament.update({
        where: { id },
        data: { status: TournamentStatus.IN_PROGRESS, registrationClosesAt: t.registrationClosesAt < new Date() ? t.registrationClosesAt : new Date() },
      });
      // Players left waiting are told the draw happened without them.
      await tx.tournamentParticipant.updateMany({
        where: { tournamentId: id, status: { in: [ParticipantStatus.PENDING, ParticipantStatus.WAITLISTED] } },
        data: { status: ParticipantStatus.REJECTED, statusNote: 'Not included in the draw' },
      });
      // Byes: the present player goes straight through.
      for (const [position, [a, b]] of pairs.entries()) {
        if (a && b) continue;
        await this.matches.completeBye(tx, ids[1][position], (a ?? b)!.id);
      }
    });

    await this.audit.log({ actorId, action: 'tournament.bracket_generate', entityType: 'tournament', entityId: id, metadata: { players: order.length, size }, meta });
    return this.adminDetail(id);
  }
}

/** Fisher–Yates with crypto randomness, so draws cannot be predicted. */
function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
