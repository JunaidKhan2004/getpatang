import { HttpStatus, Injectable } from '@nestjs/common';
import { MatchStatus, Prisma, TournamentStatus } from '@prisma/client';

import type { AuthUser, RequestMeta } from '../../common/auth/decorators.js';
import { PERMISSIONS } from '../../common/auth/permissions.js';
import { Role } from '../../common/auth/roles.js';
import { AppException, Errors } from '../../common/errors/app.exception.js';
import { Paginated } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { NotificationsService } from '../notifications/notifications.js';
import { SettingsService } from '../settings/settings.service.js';
import { UploadsService } from '../storage/uploads.js';
import { placementForLoss, rankingPoints, roundName } from './bracket.js';
import { DisputeDto, MatchResultDto, OfficialMatchQueryDto, ResolveDisputeDto, ScheduleMatchDto } from './tournaments.dto.js';

type Tx = Prisma.TransactionClient;

const playerSelect = {
  id: true,
  seed: true,
  user: { select: { id: true, fullName: true, profile: { select: { displayName: true, city: true } } } },
} satisfies Prisma.TournamentParticipantSelect;

export const matchInclude = {
  playerA: { select: playerSelect },
  playerB: { select: playerSelect },
  official: { select: { id: true, fullName: true } },
  tournament: { select: { id: true, slug: true, name: true, venue: true, city: true, status: true } },
} satisfies Prisma.MatchInclude;

type MatchRow = Prisma.MatchGetPayload<{ include: typeof matchInclude }>;
type PlayerRow = Prisma.TournamentParticipantGetPayload<{ select: typeof playerSelect }>;

const toPlayer = (p: PlayerRow | null) =>
  p ? { participantId: p.id, userId: p.user.id, name: p.user.profile?.displayName ?? p.user.fullName, city: p.user.profile?.city ?? null, seed: p.seed } : null;

export function toMatch(m: MatchRow, totalRounds?: number) {
  return {
    id: m.id,
    round: m.round,
    roundName: totalRounds ? roundName(m.round, totalRounds) : null,
    matchNumber: m.matchNumber,
    position: m.position,
    status: m.status,
    isBye: m.isBye,
    isWalkover: m.isWalkover,
    playerA: toPlayer(m.playerA),
    playerB: toPlayer(m.playerB),
    winnerId: m.winnerId,
    scoreA: m.scoreA,
    scoreB: m.scoreB,
    scheduledAt: m.scheduledAt?.toISOString() ?? null,
    location: m.location,
    official: m.official ? { id: m.official.id, name: m.official.fullName } : null,
    resultNote: m.resultNote,
    disputeReason: m.disputeReason,
    startedAt: m.startedAt,
    completedAt: m.completedAt,
    tournament: m.tournament,
  };
}

/** A completed final can still be disputed for this long. */
const FINAL_DISPUTE_WINDOW_MS = 24 * 60 * 60 * 1000;

const mErrors = {
  notAllowed: () => new AppException('NOT_YOUR_MATCH', 'Only the assigned official or a tournament manager can run this match.', HttpStatus.FORBIDDEN),
  badState: (msg: string) => new AppException('MATCH_STATE', msg, HttpStatus.CONFLICT),
};

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly uploads: UploadsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Tells both players of a match about a change. */
  private async notifyPlayers(matchId: string, type: string, title: (t: string) => string, body: string) {
    const m = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { tournament: { select: { name: true, slug: true } }, playerA: { select: { userId: true } }, playerB: { select: { userId: true } } },
    });
    if (!m) return;
    this.notifications.send({
      userIds: [m.playerA?.userId, m.playerB?.userId],
      category: 'tournaments',
      type,
      title: title(m.tournament.name),
      body,
      link: `/tournaments/${m.tournament.slug}?tab=schedule`,
    });
  }

  async listForTournament(tournamentId: string, status?: MatchStatus) {
    const rows = await this.prisma.match.findMany({
      where: { tournamentId, ...(status && { status }) },
      include: matchInclude,
      orderBy: [{ round: 'asc' }, { position: 'asc' }],
    });
    const rounds = rows.length ? Math.max(...rows.map((m) => m.round)) : 0;
    return rows.map((m) => toMatch(m, rounds));
  }

  async get(id: string) {
    const m = await this.prisma.match.findUnique({ where: { id }, include: { ...matchInclude, results: { orderBy: { createdAt: 'asc' }, select: { kind: true, winnerId: true, scoreA: true, scoreB: true, isWalkover: true, note: true, createdAt: true, submittedBy: { select: { fullName: true } } } } } });
    if (!m || m.tournament.status === TournamentStatus.DRAFT) throw Errors.notFound('Match');
    const rounds = await this.totalRounds(m.tournamentId);
    return { ...toMatch(m, rounds), history: m.results.map((r) => ({ ...r, submittedBy: r.submittedBy.fullName })) };
  }

  private async totalRounds(tournamentId: string) {
    const agg = await this.prisma.match.aggregate({ where: { tournamentId }, _max: { round: true } });
    return agg._max.round ?? 0;
  }

  /** Officials see their assigned matches; managers can see every match. */
  async officialMatches(user: AuthUser, query: OfficialMatchQueryDto) {
    const isManager = user.permissions.has(PERMISSIONS.TOURNAMENTS_MANAGE);
    const where: Prisma.MatchWhereInput = {
      isBye: false,
      tournament: { status: TournamentStatus.IN_PROGRESS },
      ...(!(isManager && query.all) && { officialId: user.id }),
      ...(query.status ? { status: query.status } : { status: { notIn: [MatchStatus.COMPLETED, MatchStatus.CANCELLED] } }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.match.findMany({
        where,
        include: matchInclude,
        orderBy: [{ scheduledAt: { sort: 'asc', nulls: 'last' } }, { matchNumber: 'asc' }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.match.count({ where }),
    ]);
    return new Paginated(rows.map((m) => toMatch(m)), total, query);
  }

  async officials() {
    const users = await this.prisma.user.findMany({
      where: { status: 'ACTIVE', roles: { some: { role: { key: { in: [Role.MATCH_OFFICIAL, Role.TOURNAMENT_MANAGER] } } } } },
      select: { id: true, fullName: true, email: true, roles: { select: { role: { select: { key: true } } } } },
      orderBy: { fullName: 'asc' },
    });
    return users.map((u) => ({ id: u.id, name: u.fullName, email: u.email, roles: u.roles.map((r) => r.role.key) }));
  }

  private async loadForAction(id: string, user: AuthUser) {
    const m = await this.prisma.match.findUnique({ where: { id }, include: { tournament: true } });
    if (!m) throw Errors.notFound('Match');
    const isManager = user.permissions.has(PERMISSIONS.TOURNAMENTS_MANAGE);
    const isAssignedOfficial = m.officialId === user.id && user.permissions.has(PERMISSIONS.MATCHES_OFFICIATE);
    if (!isManager && !isAssignedOfficial) throw mErrors.notAllowed();
    if (m.tournament.status !== TournamentStatus.IN_PROGRESS) throw mErrors.badState('This tournament is not in progress.');
    return { match: m, isManager };
  }

  async schedule(id: string, dto: ScheduleMatchDto, actor: AuthUser, meta: RequestMeta) {
    const m = await this.prisma.match.findUnique({ where: { id }, include: { tournament: true } });
    if (!m) throw Errors.notFound('Match');
    if (m.isBye || m.status === MatchStatus.COMPLETED || m.status === MatchStatus.CANCELLED) throw mErrors.badState('Finished matches cannot be rescheduled.');
    if (dto.officialId) {
      const official = await this.prisma.user.findFirst({
        where: { id: dto.officialId, status: 'ACTIVE', roles: { some: { role: { permissions: { some: { permission: { key: PERMISSIONS.MATCHES_OFFICIATE } } } } } } },
        select: { id: true },
      });
      if (!official) throw new AppException('OFFICIAL_INVALID', 'Choose a user with the Match Official role.', 400, [{ field: 'officialId', message: 'Not a match official' }]);
    }
    await this.prisma.match.update({
      where: { id },
      data: {
        ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null }),
        ...(dto.location !== undefined && { location: dto.location || null }),
        ...(dto.officialId !== undefined && { officialId: dto.officialId }),
      },
    });
    await this.audit.log({ actorId: actor.id, action: 'match.schedule', entityType: 'match', entityId: id, metadata: { scheduledAt: dto.scheduledAt ?? null, location: dto.location ?? null, officialId: dto.officialId ?? null }, meta });
    if (dto.scheduledAt || dto.location) {
      const when = dto.scheduledAt ? new Date(dto.scheduledAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Karachi' }) : null;
      void this.notifyPlayers(id, 'match.scheduled', (t) => `Match scheduled: ${t}`, [when && `When: ${when}.`, dto.location && `Where: ${dto.location}.`].filter(Boolean).join(' '));
    }
    return this.get(id);
  }

  async setStatus(id: string, status: MatchStatus, actor: AuthUser, meta: RequestMeta) {
    const { match } = await this.loadForAction(id, actor);
    if (!match.playerAId || !match.playerBId) throw mErrors.badState('Both players must be known before the match can start.');
    const allowed: Record<string, MatchStatus[]> = {
      [MatchStatus.CHECK_IN]: [MatchStatus.SCHEDULED],
      [MatchStatus.LIVE]: [MatchStatus.SCHEDULED, MatchStatus.CHECK_IN],
    };
    if (!allowed[status]?.includes(match.status)) throw mErrors.badState(`A ${match.status.toLowerCase()} match cannot move to ${status.toLowerCase()}.`);
    const { count } = await this.prisma.match.updateMany({
      where: { id, status: match.status },
      data: { status, ...(status === MatchStatus.LIVE && { startedAt: new Date() }) },
    });
    if (count === 0) throw mErrors.badState('This match was just updated. Refresh and try again.');
    await this.audit.log({ actorId: actor.id, action: `match.${status.toLowerCase()}`, entityType: 'match', entityId: id, meta });
    return this.get(id);
  }

  /** Official result. Only the assigned official (with result permission) or a tournament manager. */
  async submitResult(id: string, dto: MatchResultDto, actor: AuthUser, meta: RequestMeta) {
    const { match } = await this.loadForAction(id, actor);
    if (!actor.permissions.has(PERMISSIONS.MATCH_RESULTS_SUBMIT) && !actor.permissions.has(PERMISSIONS.TOURNAMENTS_MANAGE)) throw mErrors.notAllowed();
    if (!match.playerAId || !match.playerBId) throw mErrors.badState('Both players must be known before a result can be recorded.');
    const open: MatchStatus[] = [MatchStatus.CHECK_IN, MatchStatus.LIVE, ...(dto.walkover ? [MatchStatus.SCHEDULED] : [])];
    if (!open.includes(match.status)) {
      throw mErrors.badState(dto.walkover ? 'This match already has a result.' : 'Start the match before recording a result.');
    }
    if (dto.winnerId !== match.playerAId && dto.winnerId !== match.playerBId) {
      throw new AppException('WINNER_INVALID', 'The winner must be one of the two players.', 400, [{ field: 'winnerId', message: 'Choose player A or B' }]);
    }
    if (!dto.walkover && dto.scoreA !== undefined && dto.scoreB !== undefined) {
      const winnerScore = dto.winnerId === match.playerAId ? dto.scoreA : dto.scoreB;
      const loserScore = dto.winnerId === match.playerAId ? dto.scoreB : dto.scoreA;
      if (winnerScore <= loserScore) throw new AppException('SCORE_INVALID', 'The winner must have the higher score.', 400, [{ field: 'scoreA', message: 'Check the scores' }]);
    }
    if (dto.evidenceUploadId) await this.uploads.ownedUploads(actor.id, [dto.evidenceUploadId], 'match_evidence');

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.match.updateMany({
        where: { id, status: match.status },
        data: {
          status: MatchStatus.COMPLETED,
          winnerId: dto.winnerId,
          scoreA: dto.scoreA ?? null,
          scoreB: dto.scoreB ?? null,
          isWalkover: Boolean(dto.walkover),
          resultNote: dto.note || null,
          completedAt: new Date(),
        },
      });
      if (count === 0) throw mErrors.badState('This match was just updated. Refresh and try again.');
      await tx.matchResult.create({
        data: { matchId: id, submittedById: actor.id, winnerId: dto.winnerId, scoreA: dto.scoreA, scoreB: dto.scoreB, isWalkover: Boolean(dto.walkover), note: dto.note, evidenceUploadId: dto.evidenceUploadId },
      });
      await this.advance(tx, id, dto.winnerId);
    });
    await this.audit.log({ actorId: actor.id, action: 'match.result', entityType: 'match', entityId: id, metadata: { winnerId: dto.winnerId, walkover: Boolean(dto.walkover) }, meta });
    void this.notifyPlayers(id, 'match.result', (t) => `Result recorded: ${t}`, 'The official result of your match is in. You can dispute it from the tournament page if something is wrong.');
    return this.get(id);
  }

  /** Byes are completed at draw time; the present player advances. */
  async completeBye(tx: Tx, matchId: string, winnerId: string) {
    await tx.match.update({ where: { id: matchId }, data: { status: MatchStatus.COMPLETED, isBye: true, winnerId, completedAt: new Date(), resultNote: 'Bye' } });
    await this.advance(tx, matchId, winnerId);
  }

  /** Puts the winner into the next match, or finishes the tournament after the final. */
  private async advance(tx: Tx, matchId: string, winnerId: string) {
    const m = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
    if (m.nextMatchId) {
      await tx.match.update({ where: { id: m.nextMatchId }, data: m.nextSlot === 'A' ? { playerAId: winnerId } : { playerBId: winnerId } });
    } else {
      await this.completeTournament(tx, m.tournamentId);
    }
  }

  /** Placements from the bracket, then ranking points (config: setting rankings.points). */
  async completeTournament(tx: Tx, tournamentId: string) {
    const t = await tx.tournament.findUniqueOrThrow({ where: { id: tournamentId } });
    const matches = await tx.match.findMany({ where: { tournamentId } });
    const rounds = Math.max(...matches.map((m) => m.round));
    const final = matches.find((m) => m.round === rounds)!;
    const cfg = await this.settings.get('rankings.points');

    const stats = new Map<string, { wins: number; losses: number; placement: number }>();
    const stat = (pid: string) => stats.get(pid) ?? stats.set(pid, { wins: 0, losses: 0, placement: 0 }).get(pid)!;
    for (const m of matches) {
      if (m.isBye || !m.winnerId || !m.playerAId || !m.playerBId) continue;
      const loser = m.winnerId === m.playerAId ? m.playerBId : m.playerAId;
      // A walkover is not a win the player earned on the field, and not a loss for the absent player's record.
      if (!m.isWalkover) {
        stat(m.winnerId).wins++;
        stat(loser).losses++;
      }
      stat(loser).placement = placementForLoss(m.round, rounds);
    }
    if (final.winnerId) stat(final.winnerId).placement = 1;

    const participants = await tx.tournamentParticipant.findMany({ where: { tournamentId, id: { in: [...stats.keys()] } }, select: { id: true, userId: true } });
    await tx.rankingPoint.deleteMany({ where: { tournamentId } });
    for (const p of participants) {
      const s = stats.get(p.id)!;
      await tx.tournamentParticipant.update({ where: { id: p.id }, data: { finalPlacement: s.placement } });
      await tx.rankingPoint.create({
        data: {
          userId: p.userId,
          tournamentId,
          season: t.season,
          city: t.city,
          placement: s.placement,
          wins: s.wins,
          losses: s.losses,
          points: rankingPoints(cfg, s.placement, s.wins),
          awardedAt: t.completedAt ?? new Date(),
        },
      });
    }
    await tx.tournament.update({ where: { id: tournamentId }, data: { status: TournamentStatus.COMPLETED, completedAt: t.completedAt ?? new Date() } });
  }

  /** Re-applies the current points formula to every completed tournament. */
  async recalculateRankings(actorId: string, meta: RequestMeta) {
    const done = await this.prisma.tournament.findMany({ where: { status: TournamentStatus.COMPLETED }, select: { id: true } });
    for (const t of done) await this.prisma.$transaction((tx) => this.completeTournament(tx, t.id));
    await this.audit.log({ actorId, action: 'rankings.recalculate', entityType: 'rankings', metadata: { tournaments: done.length }, meta });
    return { tournaments: done.length };
  }

  /** A player in the match disputes it. Allowed while the result can still be corrected. */
  async dispute(id: string, userId: string, dto: DisputeDto, meta: RequestMeta) {
    const m = await this.prisma.match.findUnique({ where: { id }, include: { playerA: true, playerB: true, tournament: true } });
    if (!m || (m.playerA?.userId !== userId && m.playerB?.userId !== userId)) throw Errors.notFound('Match');
    await this.assertCorrectable(m);
    const disputable: MatchStatus[] = [MatchStatus.LIVE, MatchStatus.COMPLETED];
    if (!disputable.includes(m.status)) throw mErrors.badState('Only live or finished matches can be disputed.');
    await this.prisma.match.update({ where: { id }, data: { status: MatchStatus.DISPUTED, disputeReason: dto.reason, disputedById: userId } });
    await this.audit.log({ actorId: userId, action: 'match.dispute', entityType: 'match', entityId: id, metadata: { reason: dto.reason }, meta });
    return this.get(id);
  }

  /** A result can be changed only while the next match has not started (or within 24h for the final). */
  private async assertCorrectable(m: { nextMatchId: string | null; completedAt: Date | null; tournament: { status: TournamentStatus } }) {
    if (m.nextMatchId) {
      const next = await this.prisma.match.findUnique({ where: { id: m.nextMatchId }, select: { status: true } });
      const started: MatchStatus[] = [MatchStatus.LIVE, MatchStatus.COMPLETED, MatchStatus.DISPUTED];
      if (next && started.includes(next.status)) throw mErrors.badState('The next round has already started, so this result can no longer be changed.');
    } else if (m.completedAt && Date.now() - m.completedAt.getTime() > FINAL_DISPUTE_WINDOW_MS) {
      throw mErrors.badState('Final results can only be disputed within 24 hours.');
    }
  }

  async resolveDispute(id: string, dto: ResolveDisputeDto, actor: AuthUser, meta: RequestMeta) {
    const m = await this.prisma.match.findUnique({ where: { id }, include: { tournament: true } });
    if (!m) throw Errors.notFound('Match');
    if (m.status !== MatchStatus.DISPUTED) throw mErrors.badState('This match is not disputed.');

    await this.prisma.$transaction(async (tx) => {
      if (!m.winnerId) {
        // Disputed while live: back to live, the official records the result normally.
        // No result exists yet, so the decision is recorded in the audit log only.
        await tx.match.update({ where: { id }, data: { status: MatchStatus.LIVE, disputeReason: null, disputedById: null } });
        return;
      }
      if (dto.decision === 'uphold') {
        await tx.match.update({ where: { id }, data: { status: MatchStatus.COMPLETED, disputeReason: null, disputedById: null } });
        await tx.matchResult.create({ data: { matchId: id, submittedById: actor.id, winnerId: m.winnerId, note: dto.note, kind: 'dispute_upheld' } });
        return;
      }
      await this.assertCorrectable(m);
      const newWinner = m.winnerId === m.playerAId ? m.playerBId! : m.playerAId!;
      await tx.match.update({
        where: { id },
        data: { status: MatchStatus.COMPLETED, winnerId: newWinner, scoreA: m.scoreB, scoreB: m.scoreA, disputeReason: null, disputedById: null, resultNote: dto.note },
      });
      await tx.matchResult.create({ data: { matchId: id, submittedById: actor.id, winnerId: newWinner, note: dto.note, kind: 'dispute_overturned' } });
      if (m.nextMatchId) {
        await tx.match.update({ where: { id: m.nextMatchId }, data: m.nextSlot === 'A' ? { playerAId: newWinner } : { playerBId: newWinner } });
      } else {
        await this.completeTournament(tx, m.tournamentId);
      }
    });
    await this.audit.log({ actorId: actor.id, action: `match.dispute_${dto.decision}`, entityType: 'match', entityId: id, metadata: { note: dto.note }, meta });
    void this.notifyPlayers(
      id,
      'match.dispute_resolved',
      (t) => `Dispute ${dto.decision === 'uphold' ? 'reviewed' : 'upheld — result changed'}: ${t}`,
      dto.decision === 'uphold' ? `The original result stands. ${dto.note}` : `The result was corrected. ${dto.note}`,
    );
    return this.get(id);
  }

}
