import type { INestApplication } from '@nestjs/common';
import { OtpPurpose, PrismaClient, ShopStatus } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const DAY = 24 * 3600 * 1000;

describe('Events & custom kites (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let lastCode: (email: string, purpose: OtpPurpose) => string;
  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => api().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => api().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url: string, body?: object) => api().put(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    del: (url: string) => api().delete(url).set('Authorization', `Bearer ${token}`),
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

  beforeAll(async () => {
    ({ app, lastCode } = await setupApp('test-events'));
    prisma = new PrismaClient();
    for (let i = 0; i < 4; i++) users.push(await signUp(`guest${i}@example.com`));
    admin = (await api().post('/api/v1/auth/login').send({ identifier: 'admin@test.local', password: 'AdminPass123' })).body.data.tokens.accessToken;

    // An approved shop, set up directly; the application flow is covered in seller.e2e-spec.
    const owner = users[3];
    const role = await prisma.role.findUniqueOrThrow({ where: { key: 'SELLER' } });
    await prisma.userRole.create({ data: { userId: owner.id, roleId: role.id } });
    shopId = (await prisma.shop.create({ data: { ownerId: owner.id, name: 'Custom Kite Works', slug: 'custom-kite-works', city: 'Lahore', status: ShopStatus.APPROVED } })).id;
    seller = (await api().post('/api/v1/auth/login').send({ identifier: owner.email, password: 'flyHigh2027' })).body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  // ─── Events ─────────────────────────────────────────────────────────────

  const event = (over: object = {}) => ({
    name: 'Basant Family Festival',
    type: 'festival',
    description: 'A family day of kite flying with music, food stalls and a safe flying area for children.',
    city: 'Lahore',
    venue: 'Race Course Park',
    startsAt: new Date(Date.now() + 10 * DAY).toISOString(),
    organizerName: 'Lahore Kite Club',
    safetyNotes: 'Cotton string only. Flying is allowed in the marked field, away from roads and power lines.',
    capacity: 3,
    registrationRequired: true,
    fee: 0,
    maxGuests: 2,
    ...over,
  });
  let slug = '';
  let eventId = '';

  it('lets staff create and publish events, and blocks unsafe content', async () => {
    await as(users[0].token).post('/api/v1/admin/events', event()).expect(403);
    const unsafe = await as(admin).post('/api/v1/admin/events', event({ description: 'Bring your own glass coated string for the big cutting contest at the park.' })).expect(422);
    expect(unsafe.body.error.details[0].field).toBe('description');

    const banner = await api().post('/api/v1/uploads?purpose=event_banner').set('Authorization', `Bearer ${admin}`).attach('file', PNG, 'b.png').expect(201);
    const created = await as(admin).post('/api/v1/admin/events', event({ bannerUploadId: banner.body.data.id })).expect(201);
    expect(created.body.data).toMatchObject({ status: 'DRAFT', slug: 'basant-family-festival' });
    expect(created.body.data.bannerUrl).toBeTruthy();
    ({ id: eventId, slug } = created.body.data);

    await api().get(`/api/v1/events/${slug}`).expect(404); // drafts are hidden
    await as(admin).post(`/api/v1/admin/events/${eventId}/publish`).expect(200);
    const list = await api().get('/api/v1/events?city=Lahore').expect(200);
    expect(list.body.data[0]).toMatchObject({ slug, attending: 0, registrationOpen: true });
  });

  it('registers with guests up to capacity, waitlists the rest and promotes on cancel', async () => {
    const tooMany = await as(users[0].token).post(`/api/v1/events/${slug}/registration`, { guests: 3 }).expect(400);
    expect(tooMany.body.error.code).toBe('TOO_MANY_GUESTS');

    const first = await as(users[0].token).post(`/api/v1/events/${slug}/registration`, { guests: 1 }).expect(201);
    expect(first.body.data.status).toBe('CONFIRMED');
    await as(users[0].token).post(`/api/v1/events/${slug}/registration`, { guests: 0 }).expect(409);

    const second = await as(users[1].token).post(`/api/v1/events/${slug}/registration`, { guests: 1 }).expect(201);
    expect(second.body.data.status).toBe('WAITLISTED'); // 2 + 2 > 3
    const third = await as(users[2].token).post(`/api/v1/events/${slug}/registration`, { guests: 0 }).expect(201);
    expect(third.body.data.status).toBe('CONFIRMED');

    const detail = await as(users[1].token).get(`/api/v1/events/${slug}`).expect(200);
    expect(detail.body.data).toMatchObject({ attending: 3, waitlisted: 1, myRegistration: { status: 'WAITLISTED', guests: 1 } });

    await as(users[0].token).del(`/api/v1/events/${slug}/registration`).expect(200);
    const mine = await as(users[1].token).get('/api/v1/events/mine').expect(200);
    expect(mine.body.data[0]).toMatchObject({ status: 'CONFIRMED', event: { slug } });

    const manage = await as(admin).get(`/api/v1/admin/events/${eventId}`).expect(200);
    expect(manage.body.data.attending).toBe(3);
    expect(manage.body.data.registrations).toHaveLength(3);
  });

  it('closes registration when an event is cancelled', async () => {
    await as(admin).post(`/api/v1/admin/events/${eventId}/cancel`, { reason: 'Heavy rain forecast for the whole weekend.' }).expect(200);
    const res = await as(users[0].token).post(`/api/v1/events/${slug}/registration`, { guests: 0 }).expect(409);
    expect(res.body.error.code).toBe('REGISTRATION_CLOSED');
  });

  // ─── Designs & custom orders ────────────────────────────────────────────

  const design = (over: object = {}) => ({
    shape: 'diamond',
    size: 'medium',
    background: '#420000',
    pattern: 'stripes',
    patternColor: '#F6F6F6',
    text: 'Team Falcon',
    textColor: '#F6F6F6',
    font: 'display',
    tail: true,
    tailColor: '#D4D7DD',
    ...over,
  });
  let designId = '';
  let requestId = '';

  it('saves designs for the owner only', async () => {
    const bad = await as(users[0].token).post('/api/v1/designs', { name: 'Bad', design: design({ background: 'red', shape: 'star' }) }).expect(422);
    expect(bad.body.error.code).toBe('VALIDATION_FAILED');

    const logo = await api().post('/api/v1/uploads?purpose=design_asset').set('Authorization', `Bearer ${users[0].token}`).attach('file', PNG, 'logo.png').expect(201);
    const saved = await as(users[0].token).post('/api/v1/designs', { name: 'Falcon diamond', design: design({ imageUploadId: logo.body.data.id }) }).expect(201);
    expect(saved.body.data.design).toMatchObject({ shape: 'diamond', text: 'Team Falcon' });
    expect(saved.body.data.design.imageUrl).toBeTruthy();
    designId = saved.body.data.id;

    await as(users[1].token).get(`/api/v1/designs/${designId}`).expect(404);
    await as(users[1].token).post('/api/v1/designs', { name: 'Stolen', design: design({ imageUploadId: logo.body.data.id }) }).expect(400);
    const renamed = await as(users[0].token).put(`/api/v1/designs/${designId}`, { name: 'Falcon v2', design: design({ shape: 'patang' }) }).expect(200);
    expect(renamed.body.data).toMatchObject({ name: 'Falcon v2', design: { shape: 'patang', imageUrl: null } });
  });

  it('runs request → clarify → reply → quote → accept and creates a real order', async () => {
    const shops = await api().get('/api/v1/custom-orders/shops').expect(200);
    expect(shops.body.data.map((s: { id: string }) => s.id)).toContain(shopId);

    const req = { designId, shopId, quantity: 20, requirements: 'Twenty kites for our club day, team name on each one.', budget: 6000 };
    const sent = await as(users[0].token).post('/api/v1/custom-orders', req).expect(201);
    expect(sent.body.data).toMatchObject({ status: 'REQUESTED', designName: 'Falcon v2', quantity: 20, shop: { id: shopId } });
    expect(sent.body.data.number).toMatch(/^CO-/);
    requestId = sent.body.data.id;

    await as(users[1].token).get(`/api/v1/custom-orders/${requestId}`).expect(404);
    await as(users[0].token).get('/api/v1/seller/custom-orders').expect(403);

    const queue = await as(seller).get('/api/v1/seller/custom-orders').expect(200);
    expect(queue.body.data[0].id).toBe(requestId);
    expect(queue.body.meta.statusCounts).toMatchObject({ REQUESTED: 1 });

    await as(seller).post(`/api/v1/seller/custom-orders/${requestId}/clarify`, { body: 'Paper or plastic sheet?' }).expect(200);
    await as(users[0].token).post(`/api/v1/custom-orders/${requestId}/accept`, { addressId: 'x', deliveryMethod: 'standard', paymentMethod: 'cod' }).expect(409);
    const replied = await as(users[0].token).post(`/api/v1/custom-orders/${requestId}/messages`, { body: 'Paper please.' }).expect(201);
    expect(replied.body.data.status).toBe('REQUESTED');

    const quoted = await as(seller).post(`/api/v1/seller/custom-orders/${requestId}/quote`, { price: 5500, deliveryDays: 7, validDays: 5, note: 'Paper, bamboo frame.' }).expect(200);
    expect(quoted.body.data).toMatchObject({ status: 'QUOTED', quote: { price: 5500, deliveryDays: 7 } });

    const address = await as(users[0].token).post('/api/v1/addresses', { fullName: 'Guest Zero', phone: '03001234567', line1: 'House 9, Model Town', city: 'Lahore' }).expect(201);
    const accepted = await as(users[0].token)
      .post(`/api/v1/custom-orders/${requestId}/accept`, { addressId: address.body.data.id, deliveryMethod: 'standard', paymentMethod: 'cod' })
      .expect(200);
    expect(accepted.body.data.status).toBe('ACCEPTED');
    const orderNumber = accepted.body.data.order.orderNumber as string;

    const order = await as(users[0].token).get(`/api/v1/orders/${orderNumber}`).expect(200);
    expect(order.body.data).toMatchObject({ subtotal: 5500, items: [{ title: 'Custom kite: Falcon v2', quantity: 20 }] });
    const sellerOrders = await as(seller).get('/api/v1/seller/orders').expect(200);
    expect(sellerOrders.body.data[0].orderNumber).toBe(orderNumber);

    await as(seller).post(`/api/v1/seller/custom-orders/${requestId}/quote`, { price: 1, deliveryDays: 1, validDays: 1 }).expect(409);
  });

  it('lets the shop reject, the customer cancel, and refuses expired quotes', async () => {
    const make = async () =>
      (await as(users[0].token).post('/api/v1/custom-orders', { designId, shopId, quantity: 2, requirements: 'Two kites, same design as before.' }).expect(201)).body.data.id as string;

    const rejectMe = await make();
    const rejected = await as(seller).post(`/api/v1/seller/custom-orders/${rejectMe}/reject`, { reason: 'Fully booked for Basant.' }).expect(200);
    expect(rejected.body.data.status).toBe('REJECTED');

    const cancelMe = await make();
    expect((await as(users[0].token).post(`/api/v1/custom-orders/${cancelMe}/cancel`).expect(200)).body.data.status).toBe('CANCELLED');

    const expireMe = await make();
    await as(seller).post(`/api/v1/seller/custom-orders/${expireMe}/quote`, { price: 800, deliveryDays: 3, validDays: 1 }).expect(200);
    await prisma.customOrderRequest.update({ where: { id: expireMe }, data: { quoteValidUntil: new Date(Date.now() - 1000) } });
    const address = (await as(users[0].token).get('/api/v1/addresses').expect(200)).body.data[0].id;
    const expired = await as(users[0].token).post(`/api/v1/custom-orders/${expireMe}/accept`, { addressId: address, deliveryMethod: 'standard', paymentMethod: 'cod' }).expect(409);
    expect(expired.body.error.code).toBe('REQUEST_STATE');
    expect((await as(users[0].token).post(`/api/v1/custom-orders/${expireMe}/decline`).expect(200)).body.data.status).toBe('DECLINED');

    await api().patch('/api/v1/seller/shop').set('Authorization', `Bearer ${seller}`).send({ acceptsCustomOrders: false }).expect(200);
    const closed = await as(users[0].token).post('/api/v1/custom-orders', { designId, shopId, quantity: 1, requirements: 'One more kite please.' }).expect(400);
    expect(closed.body.error.code).toBe('SHOP_UNAVAILABLE');
  });
});
