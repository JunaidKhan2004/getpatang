import type { INestApplication } from '@nestjs/common';
import type { OtpPurpose } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

/**
 * Sweeps every registered route. Adding a public endpoint, or exposing an admin/seller endpoint to
 * ordinary members, makes this test fail until the change is deliberate and listed below.
 */

/** Routes that answer without signing in. Keep this list short and reviewed. */
const PUBLIC = new Set([
  'GET /api/v1/health',
  'POST /api/v1/auth/register',
  'POST /api/v1/auth/verify-otp',
  'POST /api/v1/auth/resend-otp',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/logout',
  'POST /api/v1/auth/forgot-password',
  'POST /api/v1/auth/reset-password',
  // Guests can share posts; it only increments the share counter (rate-limited).
  'POST /api/v1/posts/:id/share',
]);

/** Members-only areas a signed-in customer may still reach (e.g. to apply as a seller). */
const MEMBER_ALLOWED_UNDER_SELLER = new Set(['GET /api/v1/seller/application', 'PUT /api/v1/seller/application']);

interface Route {
  method: string;
  path: string;
}

function routes(app: INestApplication<App>): Route[] {
  const instance = app.getHttpAdapter().getInstance() as { router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] } };
  const out: Route[] = [];
  for (const layer of instance.router.stack) {
    if (!layer.route) continue;
    for (const [method, on] of Object.entries(layer.route.methods)) {
      if (on && method !== '_all') out.push({ method: method.toUpperCase(), path: layer.route.path });
    }
  }
  return out;
}

const fill = (path: string) => path.replace(/:(\w+)/g, (_, name: string) => `probe-${name}`);

describe('Route security (e2e)', () => {
  let app: INestApplication<App>;
  let lastCode: (email: string, purpose: OtpPurpose) => string;
  let all: Route[] = [];
  let member = '';

  const send = (r: Route, token?: string) => {
    const req = request(app.getHttpServer())[r.method.toLowerCase() as 'get'](fill(r.path));
    return (token ? req.set('Authorization', `Bearer ${token}`) : req).send({});
  };

  beforeAll(async () => {
    ({ app, lastCode } = await setupApp('test-security', { demo: true, throttle: false }));
    all = routes(app);
    const email = 'probe@example.com';
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ fullName: 'Route Probe', email, password: 'flyHigh2027' }).expect(201);
    const res = await request(app.getHttpServer()).post('/api/v1/auth/verify-otp').send({ email, code: lastCode(email, 'VERIFY_ACCOUNT') }).expect(200);
    member = res.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('finds the API routes', () => {
    expect(all.length).toBeGreaterThan(150);
  });

  it('requires sign-in everywhere except reviewed public routes', async () => {
    const open: string[] = [];
    for (const r of all) {
      const res = await send(r);
      if (res.status !== 401) open.push(`${r.method} ${r.path}`);
    }
    // Catalogue browsing, events, tournaments and similar read-only pages are public by design.
    const unexpected = open.filter((k) => !PUBLIC.has(k) && !(k.startsWith('GET ') && isPublicRead(k)));
    expect(unexpected).toEqual([]);
    // No public route may change data, apart from the sign-in flow.
    expect(open.filter((k) => !k.startsWith('GET ') && !PUBLIC.has(k))).toEqual([]);
  });

  it('keeps admin routes away from ordinary members', async () => {
    const leaks: string[] = [];
    for (const r of all.filter((x) => x.path.startsWith('/api/v1/admin'))) {
      const res = await send(r, member);
      if (res.status !== 403) leaks.push(`${r.method} ${r.path} → ${res.status}`);
    }
    expect(leaks).toEqual([]);
  });

  it('keeps seller tools away from members without a shop', async () => {
    const leaks: string[] = [];
    for (const r of all.filter((x) => x.path.startsWith('/api/v1/seller'))) {
      const key = `${r.method} ${r.path}`;
      if (MEMBER_ALLOWED_UNDER_SELLER.has(key)) continue;
      const res = await send(r, member);
      if (res.status !== 403) leaks.push(`${key} → ${res.status}`);
    }
    expect(leaks).toEqual([]);
  });

  it('rejects forged and expired tokens', async () => {
    const forged = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl';
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
    expect(res.body.error.code).toBe('SESSION_EXPIRED');
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', 'Basic abc').expect(401);
  });
});

/** Read-only browsing that guests may use. */
const PUBLIC_READ_PREFIXES = [
  '/api/v1/categories',
  '/api/v1/products',
  '/api/v1/shops',
  '/api/v1/search',
  '/api/v1/tournaments',
  '/api/v1/matches',
  '/api/v1/rankings',
  '/api/v1/players',
  '/api/v1/events',
  '/api/v1/feed',
  '/api/v1/posts',
  '/api/v1/community/users',
  '/api/v1/custom-orders/shops',
  '/api/v1/pages',
  '/api/v1/checkout/options',
];

function isPublicRead(key: string) {
  const path = key.slice(4);
  // Personal lists under these prefixes must still require sign-in.
  if (path.endsWith('/mine') || path.includes('/registration')) return false;
  return PUBLIC_READ_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}
