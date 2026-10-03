import { Injectable } from '@nestjs/common';
import { MatchStatus, Prisma, TournamentStatus, UserStatus } from '@prisma/client';

import { Errors } from '../../common/errors/app.exception.js';
import { Paginated } from '../../common/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { matchInclude, toMatch } from './matches.service.js';
import { RankingQueryDto } from './tournaments.dto.js';

export interface Badge {
  key: string;
  label: string;
  description: string;
}

@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  private async filter(q: RankingQueryDto): Promise<Prisma.RankingPointWhereInput> {
    let tournamentId: string | undefined;
    if (q.tournament) {
      const t = await this.prisma.tournament.findUnique({ where: { slug: q.tournament }, select: { id: true } });
      tournamentId = t?.id ?? '__none__';
    }
    return {
      user: { status: UserStatus.ACTIVE },
      ...(q.season && { season: q.season }),
      ...(q.city && { city: q.city }),
      ...(tournamentId && { tournamentId }),
      ...((q.from || q.to) && { awardedAt: { ...(q.from && { gte: new Date(q.from) }), ...(q.to && { lte: new Date(q.to) }) } }),
    };
  }

  /** Leaderboard: points summed from completed tournaments, tie-broken by wins. */
  async rankings(q: RankingQueryDto) {
    const where = await this.filter(q);
    const [groups, all] = await Promise.all([
      this.prisma.rankingPoint.groupBy({
        by: ['userId'],
        where,
        _sum: { points: true, wins: true, losses: true },
        _count: { _all: true },
        _min: { placement: true },
        orderBy: [{ _sum: { points: 'desc' } }, { _sum: { wins: 'desc' } }],
        skip: q.skip,
        take: q.pageSize,
      }),
      this.prisma.rankingPoint.groupBy({ by: ['userId'], where, orderBy: { userId: 'asc' } }),
    ]);
    const users = await this.prisma.user.findMany({
      where: { id: { in: groups.map((g) => g.userId) } },
      select: { id: true, fullName: true, profile: { select: { displayName: true, city: true, avatarUrl: true } } },
    });
    const titles = await this.prisma.rankingPoint.groupBy({
      by: ['userId'],
      where: { ...where, userId: { in: groups.map((g) => g.userId) }, placement: 1 },
      _count: { _all: true },
      orderBy: { userId: 'asc' },
    });
    const cfg = await this.settings.get('rankings.points');

    const page = new Paginated(
      groups.map((g, i) => {
        const u = users.find((x) => x.id === g.userId);
        const wins = g._sum.wins ?? 0;
        const losses = g._sum.losses ?? 0;
        const championships = (titles.find((t) => t.userId === g.userId)?._count as { _all: number } | undefined)?._all ?? 0;
        return {
          rank: q.skip + i + 1,
          player: { userId: g.userId, name: u?.profile?.displayName ?? u?.fullName ?? 'Player', city: u?.profile?.city ?? null, avatarUrl: u?.profile?.avatarUrl ?? null },
          points: g._sum.points ?? 0,
          tournaments: g._count._all,
          matches: wins + losses,
          wins,
          losses,
          winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : null,
          championships,
          bestPlacement: g._min.placement,
        };
      }),
      all.length,
      q,
    );
    Object.assign(page.meta, { pointsFormula: cfg });
    return page;
  }

  /** Filter choices for the rankings page. */
  async filters() {
    const [seasons, cities, tournaments] = await Promise.all([
      this.prisma.rankingPoint.groupBy({ by: ['season'], orderBy: { season: 'desc' } }),
      this.prisma.rankingPoint.groupBy({ by: ['city'], orderBy: { city: 'asc' } }),
      this.prisma.tournament.findMany({ where: { status: TournamentStatus.COMPLETED }, select: { slug: true, name: true }, orderBy: { startsAt: 'desc' }, take: 50 }),
    ]);
    return { seasons: seasons.map((s) => s.season), cities: cities.map((c) => c.city), tournaments };
  }

  async player(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true, fullName: true, createdAt: true, profile: { select: { displayName: true, city: true, bio: true, avatarUrl: true } } },
    });
    if (!user) throw Errors.notFound('Player');

    const [points, entries, participantIds] = await Promise.all([
      this.prisma.rankingPoint.findMany({ where: { userId }, orderBy: { awardedAt: 'desc' }, include: { tournament: { select: { slug: true, name: true, startsAt: true, city: true } } } }),
      this.prisma.tournamentParticipant.findMany({
        where: { userId, status: { in: ['CONFIRMED', 'DISQUALIFIED'] }, tournament: { status: { in: [TournamentStatus.PUBLISHED, TournamentStatus.IN_PROGRESS] } } },
        select: { status: true, tournament: { select: { slug: true, name: true, startsAt: true, status: true, city: true } } },
      }),
      this.prisma.tournamentParticipant.findMany({ where: { userId }, select: { id: true } }),
    ]);
    const ids = participantIds.map((p) => p.id);
    const recent = await this.prisma.match.findMany({
      where: { isBye: false, status: MatchStatus.COMPLETED, OR: [{ playerAId: { in: ids } }, { playerBId: { in: ids } }] },
      include: matchInclude,
      orderBy: { completedAt: 'desc' },
      take: 10,
    });

    const wins = points.reduce((n, p) => n + p.wins, 0);
    const losses = points.reduce((n, p) => n + p.losses, 0);
    const totalPoints = points.reduce((n, p) => n + p.points, 0);
    const championships = points.filter((p) => p.placement === 1).length;

    // Overall rank: number of players with more points, plus one.
    const ahead = totalPoints
      ? (await this.prisma.rankingPoint.groupBy({ by: ['userId'], _sum: { points: true }, having: { points: { _sum: { gt: totalPoints } } }, orderBy: { userId: 'asc' } })).length
      : null;

    return {
      player: { userId: user.id, name: user.profile?.displayName ?? user.fullName, city: user.profile?.city ?? null, bio: user.profile?.bio ?? null, avatarUrl: user.profile?.avatarUrl ?? null, memberSince: user.createdAt },
      stats: {
        rank: ahead === null ? null : ahead + 1,
        points: totalPoints,
        tournaments: points.length,
        championships,
        matches: wins + losses,
        wins,
        losses,
        winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : null,
      },
      badges: badgesFor({ championships, finals: points.filter((p) => p.placement <= 2).length, tournaments: points.length, wins }),
      results: points.map((p) => ({ tournament: p.tournament, placement: p.placement, points: p.points, wins: p.wins, losses: p.losses })),
      upcoming: entries.map((e) => e.tournament),
      recentMatches: recent.map((m) => {
        const mine = ids.includes(m.playerAId ?? '') ? 'A' : 'B';
        const view = toMatch(m);
        return { ...view, won: m.winnerId === (mine === 'A' ? m.playerAId : m.playerBId), opponent: mine === 'A' ? view.playerB : view.playerA };
      }),
    };
  }
}

/** Badges are derived from results, never awarded by hand. */
export function badgesFor(s: { championships: number; finals: number; tournaments: number; wins: number }): Badge[] {
  const all: (Badge & { earned: boolean })[] = [
    { key: 'first_tournament', label: 'Debut', description: 'Finished a first tournament', earned: s.tournaments >= 1 },
    { key: 'finalist', label: 'Finalist', description: 'Reached a tournament final', earned: s.finals >= 1 },
    { key: 'champion', label: 'Champion', description: 'Won a tournament', earned: s.championships >= 1 },
    { key: 'triple_champion', label: 'Triple Champion', description: 'Won three tournaments', earned: s.championships >= 3 },
    { key: 'ten_wins', label: '10 Wins', description: 'Won ten matches', earned: s.wins >= 10 },
    { key: 'regular', label: 'Regular', description: 'Played five tournaments', earned: s.tournaments >= 5 },
  ];
  return all.filter((b) => b.earned).map(({ earned: _e, ...b }) => b);
}
