import type { INestApplication } from '@nestjs/common';
import { OtpPurpose, PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

describe('Tournaments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let lastCode: (email: string, purpose: OtpPurpose) => string;
  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => api().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => api().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url: string, body: object) => api().put(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object) => api().patch(url).set('Authorization', `Bearer ${token}`).send(body),
    del: (url: string) => api().delete(url).set('Authorization', `Bearer ${token}`),
  });

  let admin = '';
  let official = '';
  let otherOfficial = '';
  const players: { token: string; email: string; userId: string }[] = [];

  async function signUp(email: string) {
    await api().post('/api/v1/auth/register').send({ fullName: email.split('@')[0], email, password: 'flyHigh2027' }).expect(201);
    const res = await api().post('/api/v1/auth/verify-otp').send({ email, code: lastCode(email, OtpPurpose.VERIFY_ACCOUNT) }).expect(200);
    await as(res.body.data.tokens.accessToken).put('/api/v1/users/me/profile', { displayName: email.split('@')[0], city: 'Lahore' }).expect(200);
    return { token: res.body.data.tokens.accessToken as string, userId: res.body.data.user.id as string, email };
  }
  async function makeOfficial(email: string) {
    const u = await signUp(email);
    const role = await prisma.role.findUniqueOrThrow({ where: { key: 'MATCH_OFFICIAL' } });
    await prisma.userRole.create({ data: { userId: u.userId, roleId: role.id } });
    return u;
  }

  const day = 24 * 3600 * 1000;
  const input = (over: object = {}) => ({
    name: 'Lahore Spring Cup',
    description: 'A friendly knockout tournament for paper kite flyers in Lahore, run by the city kite club.',
    city: 'Lahore',
    venue: 'Racecourse Park',
    startsAt: new Date(Date.now() + 7 * day).toISOString(),
    registrationOpensAt: new Date(Date.now() - day).toISOString(),
    registrationClosesAt: new Date(Date.now() + 5 * day).toISOString(),
    maxParticipants: 4,
    minAge: 16,
    entryFee: 0,
    rules: 'Single elimination. Each match lasts 10 minutes; the kite still flying wins.',
    safetyRules: 'Finger guards required. Stay inside the marked area. No flying near power lines.',
    approvedMaterials: 'Paper kites and plain cotton string only.',
    organizerName: 'Lahore Kite Club',
    season: '2027',
    ...over,
  });

  beforeAll(async () => {
    ({ app, lastCode } = await setupApp('test-tournaments'));
    prisma = new PrismaClient();
    admin = (await api().post('/api/v1/auth/login').send({ identifier: 'admin@test.local', password: 'AdminPass123' })).body.data.tokens.accessToken;
    for (let i = 1; i <= 5; i++) players.push(await signUp(`player${i}@example.com`));
    official = (await makeOfficial('official@example.com')).token;
    otherOfficial = (await makeOfficial('official2@example.com')).token;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  let id = '';
  let slug = '';

  it('blocks banned materials and unsafe dates, and only staff can create', async () => {
    await as(players[0].token).post('/api/v1/admin/tournaments', input()).expect(403);
    const banned = await as(admin).post('/api/v1/admin/tournaments', input({ approvedMaterials: 'Any string including manjha' })).expect(422);
    expect(banned.body.error.code).toBe('PROHIBITED_ITEM');
    const dates = await as(admin).post('/api/v1/admin/tournaments', input({ registrationClosesAt: new Date(Date.now() + 9 * day).toISOString() })).expect(400);
    expect(dates.body.error.code).toBe('DATES_INVALID');
  });

  it('requires a permit reference before publishing', async () => {
    const created = await as(admin).post('/api/v1/admin/tournaments', input()).expect(201);
    ({ id, slug } = created.body.data);
    await api().get(`/api/v1/tournaments/${slug}`).expect(404); // drafts are private
    const noPermit = await as(admin).post(`/api/v1/admin/tournaments/${id}/publish`).expect(400);
    expect(noPermit.body.error.code).toBe('PERMIT_REQUIRED');
    await as(admin).put(`/api/v1/admin/tournaments/${id}`, input({ permitReference: 'DC-LHR-2027-114' })).expect(200);
    await as(admin).post(`/api/v1/admin/tournaments/${id}/publish`).expect(200);
    const open = await api().get('/api/v1/tournaments?view=open').expect(200);
    expect(open.body.data.map((t: { slug: string }) => t.slug)).toContain(slug);
  });

  it('checks rules acceptance and age', async () => {
    const p = players[0];
    await as(p.token).post(`/api/v1/tournaments/${slug}/registration`, { acceptRules: false }).expect(422);
    const noDob = await as(p.token).post(`/api/v1/tournaments/${slug}/registration`, { acceptRules: true }).expect(400);
    expect(noDob.body.error.code).toBe('DOB_REQUIRED');
    const young = await as(p.token).post(`/api/v1/tournaments/${slug}/registration`, { acceptRules: true, dateOfBirth: '2015-05-01' }).expect(403);
    expect(young.body.error.code).toBe('AGE_REQUIREMENT');
  });

  it('fills spots, waitlists the rest and promotes on withdrawal', async () => {
    for (const [i, p] of players.entries()) {
      const res = await as(p.token).post(`/api/v1/tournaments/${slug}/registration`, { acceptRules: true, dateOfBirth: '1995-03-0' + (i + 1) }).expect(201);
      expect(res.body.data.status).toBe(i < 4 ? 'CONFIRMED' : 'WAITLISTED');
    }
    await as(players[0].token).post(`/api/v1/tournaments/${slug}/registration`, { acceptRules: true }).expect(409);
    await as(players[1].token).del(`/api/v1/tournaments/${slug}/registration`).expect(200);
    const detail = await as(players[4].token).get(`/api/v1/tournaments/${slug}`).expect(200);
    expect(detail.body.data.myEntry.status).toBe('CONFIRMED');
    expect(detail.body.data).toMatchObject({ registeredCount: 4, waitlistedCount: 0 });
  });

  let matches: { id: string; round: number; isBye: boolean; status: string; playerA: { participantId: string; userId: string } | null; playerB: { participantId: string; userId: string } | null; winnerId: string | null }[] = [];

  it('draws a bracket with a bye for the top seed', async () => {
    const t = (await as(admin).get(`/api/v1/admin/tournaments/${id}`)).body.data;
    const byUser = (u: string) => t.participants.find((p: { user: { id: string } }) => p.user.id === u).id;
    // 3 players: reject one, seed player 0 first.
    await as(admin).patch(`/api/v1/admin/tournaments/${id}/participants/${byUser(players[4].userId)}`, { status: 'REJECTED', note: 'Did not attend check-in day' }).expect(200);
    await as(admin).patch(`/api/v1/admin/tournaments/${id}/participants/${byUser(players[0].userId)}`, { seed: 1 }).expect(200);
    await as(admin).patch(`/api/v1/admin/tournaments/${id}/participants/${byUser(players[2].userId)}`, { seed: 1 }).expect(409); // seed taken

    const drawn = await as(admin).post(`/api/v1/admin/tournaments/${id}/bracket`).expect(200);
    expect(drawn.body.data.status).toBe('IN_PROGRESS');
    const bracket = await api().get(`/api/v1/tournaments/${slug}/bracket`).expect(200);
    expect(bracket.body.data.rounds.map((r: { name: string }) => r.name)).toEqual(['Semi-finals', 'Final']);
    matches = bracket.body.data.rounds.flatMap((r: { matches: unknown[] }) => r.matches);
    const bye = matches.find((m) => m.isBye)!;
    expect(bye.status).toBe('COMPLETED');
    expect(bye.playerA?.userId ?? bye.playerB?.userId).toBe(players[0].userId); // top seed gets the bye
    const final = matches.find((m) => m.round === 2)!;
    expect(final.playerA?.userId).toBe(players[0].userId);
  });

  it('lets only the assigned official (or a manager) run a match', async () => {
    const semi = matches.find((m) => m.round === 1 && !m.isBye)!;
    const officials = (await as(admin).get('/api/v1/admin/officials')).body.data;
    const officialId = officials.find((o: { email: string }) => o.email === 'official@example.com').id;
    await as(admin).patch(`/api/v1/admin/matches/${semi.id}`, { officialId, location: 'Field 2', scheduledAt: new Date(Date.now() + 7 * day).toISOString() }).expect(200);

    await as(players[2].token).post(`/api/v1/officials/matches/${semi.id}/status`, { status: 'LIVE' }).expect(403); // players cannot
    const notMine = await as(otherOfficial).post(`/api/v1/officials/matches/${semi.id}/status`, { status: 'LIVE' }).expect(403);
    expect(notMine.body.error.code).toBe('NOT_YOUR_MATCH');

    const mine = await as(official).get('/api/v1/officials/matches').expect(200);
    expect(mine.body.data.map((m: { id: string }) => m.id)).toEqual([semi.id]);

    await as(official).post(`/api/v1/officials/matches/${semi.id}/result`, { winnerId: semi.playerA!.participantId }).expect(409); // not started
    await as(official).post(`/api/v1/officials/matches/${semi.id}/status`, { status: 'CHECK_IN' }).expect(200);
    await as(official).post(`/api/v1/officials/matches/${semi.id}/status`, { status: 'LIVE' }).expect(200);
    const badScore = await as(official).post(`/api/v1/officials/matches/${semi.id}/result`, { winnerId: semi.playerA!.participantId, scoreA: 1, scoreB: 3 }).expect(400);
    expect(badScore.body.error.code).toBe('SCORE_INVALID');
    const done = await as(official).post(`/api/v1/officials/matches/${semi.id}/result`, { winnerId: semi.playerA!.participantId, scoreA: 3, scoreB: 1 }).expect(200);
    expect(done.body.data.status).toBe('COMPLETED');

    const final = (await api().get(`/api/v1/matches/${matches.find((m) => m.round === 2)!.id}`)).body.data;
    expect(final.playerB.participantId).toBe(semi.playerA!.participantId);
  });

  it('lets the losing player dispute, and a manager overturn the result', async () => {
    const semi = matches.find((m) => m.round === 1 && !m.isBye)!;
    const loser = players.find((p) => p.userId === semi.playerB!.userId)!;
    await as(players[0].token).post(`/api/v1/matches/${semi.id}/dispute`, { reason: 'I was not even in this match' }).expect(404);
    await as(loser.token).post(`/api/v1/matches/${semi.id}/dispute`, { reason: 'The other kite landed first; the official missed it.' }).expect(200);
    const overturned = await as(admin).post(`/api/v1/admin/matches/${semi.id}/resolve-dispute`, { decision: 'overturn', note: 'Video review shows player B won.' }).expect(200);
    expect(overturned.body.data.winnerId).toBe(semi.playerB!.participantId);
    expect(overturned.body.data.history.map((h: { kind: string }) => h.kind)).toEqual(['result', 'dispute_overturned']);

    const final = (await api().get(`/api/v1/matches/${matches.find((m) => m.round === 2)!.id}`)).body.data;
    expect(final.playerB.participantId).toBe(semi.playerB!.participantId);
  });

  it('completes the tournament, awards ranking points and badges', async () => {
    const final = (await api().get(`/api/v1/matches/${matches.find((m) => m.round === 2)!.id}`)).body.data;
    await as(admin).post(`/api/v1/officials/matches/${final.id}/status`, { status: 'LIVE' }).expect(200); // managers may run any match
    await as(admin).post(`/api/v1/officials/matches/${final.id}/result`, { winnerId: final.playerA.participantId, scoreA: 2, scoreB: 0 }).expect(200);

    const t = (await api().get(`/api/v1/tournaments/${slug}`)).body.data;
    expect(t.status).toBe('COMPLETED');
    expect(t.champion.userId).toBe(players[0].userId);

    const rankings = await api().get('/api/v1/rankings?season=2027&city=Lahore').expect(200);
    const top = rankings.body.data[0];
    // Champion: 100 (1st) + 5 participation + 3 per win × 1 win (the bye is not a win).
    expect(top).toMatchObject({ rank: 1, points: 108, wins: 1, losses: 0, championships: 1, tournaments: 1 });
    expect(top.player.userId).toBe(players[0].userId);
    expect(rankings.body.meta.total).toBe(3);
    const third = rankings.body.data[2];
    expect(third).toMatchObject({ points: 50, wins: 0, losses: 1, bestPlacement: 3 }); // 45 + 5

    const profile = await api().get(`/api/v1/players/${players[0].userId}`).expect(200);
    expect(profile.body.data.stats).toMatchObject({ rank: 1, championships: 1 });
    expect(profile.body.data.badges.map((b: { key: string }) => b.key)).toEqual(expect.arrayContaining(['first_tournament', 'finalist', 'champion']));

    const empty = await api().get('/api/v1/rankings?season=2026').expect(200);
    expect(empty.body.meta.total).toBe(0);
  });

  it('recalculates rankings with a changed points formula', async () => {
    await prisma.setting.create({ data: { key: 'rankings.points', value: { placement: { '1': 200 }, participation: 0, perWin: 0 } } });
    await as(admin).post('/api/v1/admin/rankings/recalculate').expect(200);
    const rankings = await api().get('/api/v1/rankings').expect(200);
    expect(rankings.body.data[0].points).toBe(200);
  });
});
