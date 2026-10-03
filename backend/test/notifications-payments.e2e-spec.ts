import type { INestApplication } from '@nestjs/common';
import { OtpPurpose, PrismaClient, ShopStatus } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

describe('Notifications & payments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let lastCode: (email: string, purpose: OtpPurpose) => string;
  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => api().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => api().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url: string, body?: object) => api().put(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    patch: (url: string, body: object) => api().patch(url).set('Authorization', `Bearer ${token}`).send(body),
  });

  const users: { token: string; id: string; email: string }[] = [];
  let admin = '';
  let seller = '';
  let shopId = '';

  async function signUp(email: string) {
    await api().post('/api/v1/auth/register').send({ fullName: email.split('@')[0], email, password: 'flyHigh2027' }).expect(201);
    const res = await api().post('/api/v1/auth/verify-otp').send({ email, code: lastCode(email, OtpPurpose.VERIFY_ACCOUNT) }).expect(200);
    return { token: res.body.data.tokens.accessToken as string, id: res.body.data.user.id as string, email };
  }

  /** Notifications are delivered after the response; wait for them to land. */
  async function inbox(token: string, type: string) {
    for (let i = 0; i < 40; i++) {
      const res = await as(token).get('/api/v1/notifications?pageSize=50').expect(200);
      const hit = (res.body.data as { type: string }[]).find((n) => n.type === type);
      if (hit) return hit as { id: string; title: string; body: string; link: string; type: string };
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`No ${type} notification`);
  }

  beforeAll(async () => {
    ({ app, lastCode } = await setupApp('test-notify'));
    prisma = new PrismaClient();
    for (let i = 0; i < 3; i++) users.push(await signUp(`buyer${i}@example.com`));
    admin = (await api().post('/api/v1/auth/login').send({ identifier: 'admin@test.local', password: 'AdminPass123' })).body.data.tokens.accessToken;

    const owner = users[2];
    const role = await prisma.role.findUniqueOrThrow({ where: { key: 'SELLER' } });
    await prisma.userRole.create({ data: { userId: owner.id, roleId: role.id } });
    shopId = (await prisma.shop.create({ data: { ownerId: owner.id, name: 'Patang Ghar', slug: 'patang-ghar', city: 'Lahore', status: ShopStatus.APPROVED } })).id;
    seller = (await api().post('/api/v1/auth/login').send({ identifier: owner.email, password: 'flyHigh2027' })).body.data.tokens.accessToken;
    await prisma.setting.create({
      data: { key: 'payments.bank_transfer', value: { enabled: true, bankName: 'Test Bank', accountTitle: 'GetPatang', iban: 'PK36SCBL0000001123456702' } },
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  const buyer = 0;
  let requestId = '';
  let orderNumber = '';
  let paymentId = '';

  it('notifies both sides through a custom order and places a bank-transfer order', async () => {
    const design = await as(users[buyer].token)
      .post('/api/v1/designs', { name: 'Club kite', design: { shape: 'diamond', size: 'medium', background: '#420000', pattern: 'none', patternColor: '#F6F6F6', textColor: '#F6F6F6', font: 'sans', tail: false, tailColor: '#D4D7DD' } })
      .expect(201);
    requestId = (await as(users[buyer].token).post('/api/v1/custom-orders', { designId: design.body.data.id, shopId, quantity: 4, requirements: 'Four kites for our club.' }).expect(201)).body.data.id;
    expect((await inbox(seller, 'custom_order.new')).link).toBe(`/seller/custom-orders/${requestId}`);

    await as(seller).post(`/api/v1/seller/custom-orders/${requestId}/quote`, { price: 2000, deliveryDays: 4, validDays: 3 }).expect(200);
    const quote = await inbox(users[buyer].token, 'custom_order.quote');
    expect(quote.title).toContain('Rs 2,000');

    const address = await as(users[buyer].token).post('/api/v1/addresses', { fullName: 'Buyer Zero', phone: '03001234567', line1: 'House 2, Model Town', city: 'Lahore' }).expect(201);
    const accepted = await as(users[buyer].token)
      .post(`/api/v1/custom-orders/${requestId}/accept`, { addressId: address.body.data.id, deliveryMethod: 'standard', paymentMethod: 'bank_transfer' })
      .expect(200);
    orderNumber = accepted.body.data.order.orderNumber;
    expect(accepted.body.data.paymentInstructions).toContain('PK36SCBL0000001123456702');
    await inbox(seller, 'custom_order.accepted');
    await inbox(users[buyer].token, 'order.placed');
  });

  it('holds a bank-transfer order until staff verify the payment', async () => {
    const seller_ = (status: string, extra: object = {}) => as(seller).post(`/api/v1/seller/orders/${orderNumber}/status`, { status, ...extra });
    await seller_('CONFIRMED').expect(200);
    expect((await inbox(users[buyer].token, 'order.status')).body).toContain('confirmed');
    const early = await seller_('PREPARING').expect(409);
    expect(early.body.error.code).toBe('PAYMENT_NOT_VERIFIED');

    const proof = await api().post('/api/v1/uploads?purpose=payment_proof').set('Authorization', `Bearer ${users[buyer].token}`).attach('file', PNG, 'receipt.png').expect(201);
    expect(proof.body.data.url).toBeNull(); // private
    await as(users[1].token).post(`/api/v1/orders/${orderNumber}/payment-proof`, { reference: 'TXN12345' }).expect(404);
    const sent = await as(users[buyer].token).post(`/api/v1/orders/${orderNumber}/payment-proof`, { reference: 'TXN12345', proofUploadId: proof.body.data.id }).expect(200);
    expect(sent.body.data).toMatchObject({ status: 'VERIFYING', orders: [orderNumber] });
    await inbox(admin, 'payment.to_verify');

    await as(users[buyer].token).get('/api/v1/admin/payments').expect(403);
    const queue = await as(admin).get('/api/v1/admin/payments?status=VERIFYING').expect(200);
    const row = queue.body.data.find((p: { order: { orderNumber: string } }) => p.order.orderNumber === orderNumber);
    expect(row).toMatchObject({ reference: 'TXN12345', status: 'VERIFYING' });
    expect(row.amount).toBe(row.order.total);
    paymentId = row.id;
    await as(admin).get(`/api/v1/uploads/${proof.body.data.id}/file`).expect(200);
    await as(users[1].token).get(`/api/v1/uploads/${proof.body.data.id}/file`).expect(404);

    const noNote = await as(admin).post(`/api/v1/admin/payments/${paymentId}/review`, { decision: 'reject' }).expect(400);
    expect(noNote.body.error.code).toBe('NOTE_REQUIRED');
    await as(admin).post(`/api/v1/admin/payments/${paymentId}/review`, { decision: 'reject', note: 'No transfer with this reference.' }).expect(200);
    expect((await inbox(users[buyer].token, 'payment.rejected')).body).toContain('No transfer with this reference.');
    const detail = await as(users[buyer].token).get(`/api/v1/orders/${orderNumber}`).expect(200);
    expect(detail.body.data.payment).toMatchObject({ status: 'PENDING', canSubmitProof: true, reviewNote: 'No transfer with this reference.' });

    await as(users[buyer].token).post(`/api/v1/orders/${orderNumber}/payment-proof`, { reference: 'TXN99999' }).expect(200);
    await as(admin).post(`/api/v1/admin/payments/${paymentId}/review`, { decision: 'approve' }).expect(200);
    await as(admin).post(`/api/v1/admin/payments/${paymentId}/review`, { decision: 'approve' }).expect(409);
    await inbox(users[buyer].token, 'payment.verified');
    await inbox(seller, 'payment.verified_seller');
    await seller_('PREPARING').expect(200);
  });

  it('creates a refund when a paid order is cancelled, and staff complete it', async () => {
    await as(seller).post(`/api/v1/seller/orders/${orderNumber}/status`, { status: 'CANCELLED', note: 'Out of bamboo' }).expect(200);
    const refunds = await as(admin).get('/api/v1/admin/refunds?status=PENDING').expect(200);
    const refund = refunds.body.data.find((r: { order: { orderNumber: string } }) => r.order.orderNumber === orderNumber);
    expect(refund).toMatchObject({ status: 'PENDING', reason: 'Cancelled by the shop: Out of bamboo' });

    await as(admin).post(`/api/v1/admin/refunds/${refund.id}/complete`, { reference: 'RF-777' }).expect(200);
    await as(admin).post(`/api/v1/admin/refunds/${refund.id}/complete`, { reference: 'RF-777' }).expect(409);
    const detail = await as(users[buyer].token).get(`/api/v1/orders/${orderNumber}`).expect(200);
    expect(detail.body.data).toMatchObject({ status: 'REFUNDED', payment: { status: 'REFUNDED' }, refunds: [{ status: 'COMPLETED', reference: 'RF-777' }] });
    expect((await inbox(users[buyer].token, 'refund.completed')).body).toContain('RF-777');
  });

  it('manages the inbox, preferences and devices', async () => {
    const t = users[buyer].token;
    const count = (await as(t).get('/api/v1/notifications/unread-count').expect(200)).body.data.count;
    expect(count).toBeGreaterThan(3);
    const first = (await as(t).get('/api/v1/notifications?unread=true').expect(200)).body.data[0];
    expect((await as(t).post(`/api/v1/notifications/${first.id}/read`).expect(200)).body.data.count).toBe(count - 1);
    await as(users[1].token).post(`/api/v1/notifications/${first.id}/read`).expect(404);
    await as(t).post('/api/v1/notifications/read-all').expect(200);
    expect((await as(t).get('/api/v1/notifications/unread-count').expect(200)).body.data.count).toBe(0);

    const prefs = await as(t).put('/api/v1/notifications/preferences', { prefs: { community: { inApp: false }, bogus: { email: true } } }).expect(200);
    expect(prefs.body.data.channels.push).toBe(false);
    expect(prefs.body.data.categories.find((c: { key: string }) => c.key === 'community')).toMatchObject({ inApp: false, email: false });
    expect(prefs.body.data.categories.some((c: { key: string }) => c.key === 'bogus')).toBe(false);

    // Muted in-app: a follow creates nothing for buyer 0, but buyer 1 still gets one.
    await as(users[1].token).put(`/api/v1/community/users/${users[buyer].id}/follow`).expect(200);
    await as(t).put(`/api/v1/community/users/${users[1].id}/follow`).expect(200);
    await inbox(users[1].token, 'user.follow');
    await new Promise((r) => setTimeout(r, 300));
    const mine = (await as(t).get('/api/v1/notifications?pageSize=50').expect(200)).body.data as { type: string }[];
    expect(mine.some((n) => n.type === 'user.follow')).toBe(false);

    const device = await as(t).post('/api/v1/devices', { token: 'device-token-abc123', platform: 'android' }).expect(201);
    expect(device.body.data).toEqual({ registered: true, pushEnabled: false });
  });
});
