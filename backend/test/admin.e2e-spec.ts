import type { INestApplication } from '@nestjs/common';
import { OtpPurpose, PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

describe('Admin & moderation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let lastCode: (email: string, purpose: OtpPurpose) => string;
  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => api().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => api().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url: string, body?: object) => api().put(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
  });

  const users: { token: string; refresh: string; id: string; email: string }[] = [];
  let admin = '';
  let adminId = '';

  async function signUp(email: string) {
    await api().post('/api/v1/auth/register').send({ fullName: email.split('@')[0], email, password: 'flyHigh2027' }).expect(201);
    const res = await api().post('/api/v1/auth/verify-otp').send({ email, code: lastCode(email, OtpPurpose.VERIFY_ACCOUNT) }).expect(200);
    return { token: res.body.data.tokens.accessToken as string, refresh: res.body.data.tokens.refreshToken as string, id: res.body.data.user.id as string, email };
  }
  const login = async (email: string) => (await api().post('/api/v1/auth/login').send({ identifier: email, password: 'flyHigh2027' }).expect(200)).body.data.tokens.accessToken as string;

  beforeAll(async () => {
    ({ app, lastCode } = await setupApp('test-admin', { demo: true }));
    prisma = new PrismaClient();
    for (let i = 0; i < 3; i++) users.push(await signUp(`member${i}@example.com`));
    const res = await api().post('/api/v1/auth/login').send({ identifier: 'admin@test.local', password: 'AdminPass123' });
    admin = res.body.data.tokens.accessToken;
    adminId = res.body.data.user.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('returns permissions with the signed-in user', async () => {
    const me = await as(admin).get('/api/v1/auth/me').expect(200);
    expect(me.body.data.permissions).toEqual(expect.arrayContaining(['settings.manage', 'roles.manage']));
    expect((await as(users[0].token).get('/api/v1/auth/me').expect(200)).body.data.permissions).not.toContain('admin.access');
  });

  it('suspends and restores accounts, signing them out everywhere', async () => {
    const [, b] = users;
    await as(users[0].token).post(`/api/v1/admin/users/${b.id}/status`, { status: 'SUSPENDED', reason: 'Spam posts' }).expect(403);
    await as(admin).post(`/api/v1/admin/users/${adminId}/status`, { status: 'SUSPENDED', reason: 'Testing myself' }).expect(400);
    await as(admin).post(`/api/v1/admin/users/${b.id}/status`, { status: 'SUSPENDED' }).expect(422);

    const suspended = await as(admin).post(`/api/v1/admin/users/${b.id}/status`, { status: 'SUSPENDED', reason: 'Repeated spam in the community' }).expect(200);
    expect(suspended.body.data).toMatchObject({ status: 'SUSPENDED', counts: { activeSessions: 0 } });
    expect((await as(b.token).get('/api/v1/auth/me').expect(403)).body.error.code).toBe('ACCOUNT_BLOCKED');
    await api().post('/api/v1/auth/refresh').send({ refreshToken: b.refresh }).expect(401);
    await new Promise((r) => setTimeout(r, 200));
    expect(await prisma.notification.count({ where: { userId: b.id, type: 'account.suspended' } })).toBe(1);

    const list = await as(admin).get('/api/v1/admin/users?status=SUSPENDED').expect(200);
    expect(list.body.data.map((u: { id: string }) => u.id)).toEqual([b.id]);
    expect(list.body.meta.statusCounts.SUSPENDED).toBe(1);

    await as(admin).post(`/api/v1/admin/users/${b.id}/status`, { status: 'ACTIVE', reason: 'Appeal accepted' }).expect(200);
    users[1].token = await login(b.email);
    await as(users[1].token).get('/api/v1/auth/me').expect(200);

    const detail = await as(admin).get(`/api/v1/admin/users/${b.id}`).expect(200);
    expect(detail.body.data.history.map((h: { action: string }) => h.action)).toEqual(expect.arrayContaining(['user.suspended', 'user.active']));
  });

  it('manages staff roles with Super Admin protection', async () => {
    const [a, , c] = users;
    const res = await as(admin).put(`/api/v1/admin/users/${a.id}/roles`, { roles: ['MODERATOR'] }).expect(200);
    expect(res.body.data.roles.sort()).toEqual(['CUSTOMER', 'MODERATOR']);
    const mod = await login(a.email);
    expect((await as(mod).get('/api/v1/auth/me').expect(200)).body.data.permissions).toContain('community.moderate');
    await as(mod).put(`/api/v1/admin/users/${c.id}/roles`, { roles: ['MODERATOR'] }).expect(403);
    await as(mod).get('/api/v1/admin/users').expect(200); // users.read

    await as(admin).put(`/api/v1/admin/users/${c.id}/roles`, { roles: ['ADMIN'] }).expect(200);
    const adminC = await login(c.email);
    const blocked = await as(adminC).post(`/api/v1/admin/users/${adminId}/status`, { status: 'SUSPENDED', reason: 'Trying to lock out the owner' }).expect(403);
    expect(blocked.body.error.code).toBe('NOT_ALLOWED');

    const roles = await as(admin).get('/api/v1/admin/roles').expect(200);
    expect(roles.body.data.find((r: { key: string }) => r.key === 'SELLER')).toMatchObject({ assignable: false });
  });

  it('validates settings and keeps the core safety words', async () => {
    const list = await as(admin).get('/api/v1/admin/settings').expect(200);
    const words = list.body.data.find((s: { key: string }) => s.key === 'products.banned_keywords');
    expect(words.isDefault).toBe(true);

    const removed = await as(admin).put('/api/v1/admin/settings/products.banned_keywords', { value: words.value.filter((w: string) => w !== 'manjha') }).expect(400);
    expect(removed.body.error.message).toContain('manjha');
    await as(admin).put('/api/v1/admin/settings/products.banned_keywords', { value: [...words.value, 'Razor String'] }).expect(200);
    const post = await as(users[1].token).post('/api/v1/posts', { body: 'Selling razor string, message me' }).expect(422);
    expect(post.body.error.details[0].field).toBe('body');

    await as(admin).put('/api/v1/admin/settings/community.auto_hide_reports', { value: 1 }).expect(400);
    await as(admin).put('/api/v1/admin/settings/checkout.delivery_methods', { value: [{ key: 'standard', label: 'Standard', description: '', fee: -5, freeAbove: null }] }).expect(400);
    await as(admin).put('/api/v1/admin/settings/payments.bank_transfer', { value: { enabled: true, bankName: 'X', accountTitle: 'Y', iban: 'not-an-iban' } }).expect(400);
    await as(admin).put('/api/v1/admin/settings/nope', { value: 1 }).expect(404);
    await as(users[0].token).get('/api/v1/admin/settings').expect(403);

    const reset = await as(admin).post('/api/v1/admin/settings/products.banned_keywords/reset').expect(200);
    expect(reset.body.data.isDefault).toBe(true);
    const audit = await as(admin).get('/api/v1/admin/audit-logs?action=setting.').expect(200);
    expect(audit.body.data.map((l: { action: string }) => l.action)).toEqual(['setting.reset', 'setting.update']);
  });

  it('publishes content pages', async () => {
    await api().get('/api/v1/pages/terms').expect(404);
    await api().get('/api/v1/pages/secret').expect(404);
    await as(users[1].token).put('/api/v1/admin/pages/terms', { title: 'Terms', body: 'These are the terms of service.', published: true }).expect(403);
    await as(admin).put('/api/v1/admin/pages/terms', { title: 'Terms of Service', body: '## Using the platform\n\nBe kind and fly safely.', published: true }).expect(200);
    const page = await api().get('/api/v1/pages/terms').expect(200);
    expect(page.body.data).toMatchObject({ slug: 'terms', title: 'Terms of Service' });
  });

  it('lets staff see and cancel any order, refunding nothing that was not paid', async () => {
    const product = await prisma.product.findFirstOrThrow({ where: { status: 'ACTIVE', variants: { none: {} }, stock: { gt: 2 } } });
    const t = users[1].token;
    await as(t).post('/api/v1/cart/items', { productId: product.id, quantity: 1 }).expect(201);
    const address = await as(t).post('/api/v1/addresses', { fullName: 'Member One', phone: '03001234567', line1: 'House 4, Johar Town', city: 'Lahore' }).expect(201);
    const placed = await as(t)
      .post('/api/v1/checkout', { addressId: address.body.data.id, deliveryMethod: 'standard', paymentMethod: 'cod', checkoutId: '2b6f1c1e-9a3e-4d6e-8e2f-3a4b5c6d7e8f' })
      .expect(201);
    const orderNumber = placed.body.data.orders[0].orderNumber as string;

    const list = await as(admin).get(`/api/v1/admin/orders?q=${orderNumber}`).expect(200);
    expect(list.body.data[0]).toMatchObject({ orderNumber, status: 'PENDING', paymentLabel: 'Cash on delivery' });
    await as(users[0].token).get('/api/v1/admin/orders').expect(403);

    const cancelled = await as(admin).post(`/api/v1/admin/orders/${orderNumber}/cancel`, { reason: 'Shop is closed for Eid' }).expect(200);
    expect(cancelled.body.data).toMatchObject({ status: 'CANCELLED', paymentStatus: 'FAILED', refunds: [] });
    const restocked = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(restocked.stock).toBe(product.stock);
    await as(admin).post(`/api/v1/admin/orders/${orderNumber}/cancel`, { reason: 'Again' }).expect(409);
  });

  it('shows queues and analytics from real data', async () => {
    const queues = await as(admin).get('/api/v1/admin/queues').expect(200);
    expect(queues.body.data).toMatchObject({ paymentsToVerify: 0, refundsToSend: 0, openReports: 0 });
    const analytics = await as(admin).get('/api/v1/admin/analytics?days=7').expect(200);
    expect(analytics.body.data.daily).toHaveLength(7);
    expect(analytics.body.data.totals.users).toBeGreaterThanOrEqual(4);
    expect(analytics.body.data.ordersByStatus.CANCELLED).toBe(1);
    const mod = await login(users[0].email);
    expect((await as(mod).get('/api/v1/admin/queues').expect(200)).body.data.paymentsToVerify).toBeNull();
  });
});
