import type { INestApplication } from '@nestjs/common';
import { OtpPurpose, PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

// Smallest valid files of each type (real magic bytes; content otherwise irrelevant).
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
const PDF = Buffer.from('%PDF-1.4\n%test\n');

describe('Seller platform (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let lastCode: (email: string, purpose: OtpPurpose) => string;
  const api = () => request(app.getHttpServer());

  let seller = '';
  let admin = '';
  let customer = '';
  let shopId = '';
  let productId = '';
  let productSlug = '';

  async function signUp(email: string) {
    await api().post('/api/v1/auth/register').send({ fullName: 'Test User', email, password: 'flyHigh2027' }).expect(201);
    const res = await api().post('/api/v1/auth/verify-otp').send({ email, code: lastCode(email, OtpPurpose.VERIFY_ACCOUNT) }).expect(200);
    return res.body.data.tokens.accessToken as string;
  }
  const upload = (token: string, purpose: string, buf: Buffer, name: string) =>
    api().post(`/api/v1/uploads?purpose=${purpose}`).set('Authorization', `Bearer ${token}`).attach('file', buf, name);

  beforeAll(async () => {
    ({ app, lastCode } = await setupApp('test-seller'));
    prisma = new PrismaClient();
    seller = await signUp('seller@example.com');
    customer = await signUp('buyer@example.com');
    admin = (await api().post('/api/v1/auth/login').send({ identifier: 'admin@test.local', password: 'AdminPass123' })).body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  const as = (token: string) => ({
    get: (url: string) => api().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => api().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url: string, body: object) => api().put(url).set('Authorization', `Bearer ${token}`).send(body),
    patch: (url: string, body: object) => api().patch(url).set('Authorization', `Bearer ${token}`).send(body),
  });

  let docs: { type: string; uploadId: string }[] = [];
  const application = () => ({
    shopName: 'Lahore Sky Kites',
    description: 'Hand-made paper kites and cotton string from the walled city.',
    phone: '0300 1112223',
    email: 'shop@example.com',
    city: 'Lahore',
    address: 'Shop 4, Mochi Gate, Lahore',
    cnicNumber: '35202-1234567-1',
    payoutMethod: 'bank',
    payoutAccountTitle: 'Lahore Sky Kites',
    payoutAccountNumber: 'PK36SCBL0000001123456702',
    documents: docs,
  });

  it('checks uploaded file types by content, not by name', async () => {
    const fake = await upload(seller, 'seller_document', Buffer.from('not really a pdf'), 'cnic.pdf').expect(415);
    expect(fake.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
    await upload(seller, 'product_image', PDF, 'photo.png').expect(415);

    const front = await upload(seller, 'seller_document', PNG, 'front.png').expect(201);
    const back = await upload(seller, 'seller_document', PDF, 'back.pdf').expect(201);
    expect(front.body.data.url).toBeNull(); // private
    docs = [
      { type: 'cnic_front', uploadId: front.body.data.id },
      { type: 'cnic_back', uploadId: back.body.data.id },
    ];
  });

  it('keeps seller documents private', async () => {
    await as(customer).get(`/api/v1/uploads/${docs[0].uploadId}/file`).expect(404);
    await as(seller).get(`/api/v1/uploads/${docs[0].uploadId}/file`).expect(200);
    await as(admin).get(`/api/v1/uploads/${docs[0].uploadId}/file`).expect(200);
  });

  it('requires both sides of the CNIC and someone else’s files are rejected', async () => {
    const missing = await as(seller).put('/api/v1/seller/application', { ...application(), documents: [docs[0]] }).expect(400);
    expect(missing.body.error.code).toBe('DOCUMENTS_MISSING');
    const stolen = await as(customer).put('/api/v1/seller/application', application()).expect(400);
    expect(stolen.body.error.code).toBe('UPLOAD_NOT_FOUND');
  });

  it('submits an application that waits for review', async () => {
    const res = await as(seller).put('/api/v1/seller/application', application()).expect(200);
    expect(res.body.data).toMatchObject({ status: 'PENDING', slug: 'lahore-sky-kites', cnicNumber: '3520212345671' });
    shopId = res.body.data.id;
    const blocked = await as(seller).get('/api/v1/seller/products').expect(403);
    expect(blocked.body.error.code).toBe('FORBIDDEN');
  });

  it('lets an admin reject with a reason, then approve the resubmission', async () => {
    await as(customer).get('/api/v1/admin/shops').expect(403);
    const queue = await as(admin).get('/api/v1/admin/shops?status=PENDING').expect(200);
    expect(queue.body.data.map((s: { id: string }) => s.id)).toContain(shopId);

    await as(admin).post(`/api/v1/admin/shops/${shopId}/decision`, { decision: 'start_review' }).expect(200);
    await as(seller).put('/api/v1/seller/application', application()).expect(409); // locked while under review
    await as(admin).post(`/api/v1/admin/shops/${shopId}/decision`, { decision: 'reject' }).expect(400);
    await as(admin).post(`/api/v1/admin/shops/${shopId}/decision`, { decision: 'reject', note: 'CNIC photo is blurry' }).expect(200);

    const mine = await as(seller).get('/api/v1/seller/application').expect(200);
    expect(mine.body.data).toMatchObject({ status: 'REJECTED', reviewNote: 'CNIC photo is blurry' });

    await as(seller).put('/api/v1/seller/application', application()).expect(200);
    const approved = await as(admin).post(`/api/v1/admin/shops/${shopId}/decision`, { decision: 'approve' }).expect(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.history.length).toBeGreaterThanOrEqual(3);

    const me = await as(seller).get('/api/v1/auth/me').expect(200);
    expect(me.body.data.roles).toContain('SELLER');
  });

  it('blocks prohibited materials', async () => {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'cotton-string' } });
    const res = await as(seller)
      .post('/api/v1/seller/products', {
        title: 'Sharp Chemical Dor 12 reels',
        description: 'Very strong coated string for cutting other kites.',
        categoryId: category.id,
        price: 900,
        stock: 10,
        imageUploadIds: [],
        specifications: [],
        variants: [],
        publish: false,
      })
      .expect(422);
    expect(res.body.error.code).toBe('PROHIBITED_ITEM');
  });

  it('creates a product that needs approval before it is visible', async () => {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: 'paper-kites' } });
    const img = await upload(seller, 'product_image', PNG, 'kite.png').expect(201);
    expect(img.body.data.url).toMatch(/^http.*\/uploads\/product_image\//);

    const res = await as(seller)
      .post('/api/v1/seller/products', {
        title: 'Walled City Patang',
        description: 'Light tissue patang with a bamboo frame, made in Lahore.',
        categoryId: category.id,
        price: 300,
        compareAtPrice: 350,
        imageUploadIds: [img.body.data.id],
        specifications: [{ label: 'Material', value: 'Tissue paper' }],
        variants: [
          { name: 'Medium', stock: 10 },
          { name: 'Large', price: 400, stock: 3 },
        ],
        publish: true,
      })
      .expect(201);
    expect(res.body.data).toMatchObject({ status: 'PENDING_APPROVAL', stock: 13, isLowStock: true });
    productId = res.body.data.id;
    productSlug = res.body.data.slug;
    await api().get(`/api/v1/products/${productSlug}`).expect(404);

    await as(admin).post(`/api/v1/admin/products/${productId}/decision`, { decision: 'approve' }).expect(200);
    await api().get(`/api/v1/products/${productSlug}`).expect(200);
  });

  it('keeps a price change live but sends a title change back for approval', async () => {
    const current = (await as(seller).get(`/api/v1/seller/products/${productId}`)).body.data;
    const body = {
      title: current.title,
      description: current.description,
      categoryId: current.category.id,
      price: 320,
      imageUploadIds: (await prisma.upload.findMany({ where: { purpose: 'product_image' } })).map((u) => u.id),
      specifications: current.specifications,
      variants: current.variants.map((v: { id: string; name: string; price: number | null; stock: number }) => ({ id: v.id, name: v.name, price: v.price ?? undefined, stock: v.stock })),
      publish: true,
    };
    const priced = await as(seller).put(`/api/v1/seller/products/${productId}`, body).expect(200);
    expect(priced.body.data.status).toBe('ACTIVE');

    const renamed = await as(seller).put(`/api/v1/seller/products/${productId}`, { ...body, title: 'Walled City Patang, Hand-made' }).expect(200);
    expect(renamed.body.data.status).toBe('PENDING_APPROVAL');
    await as(admin).post(`/api/v1/admin/products/${productId}/decision`, { decision: 'approve' }).expect(200);
  });

  let orderNumber = '';

  it('lets the seller move an order through fulfilment', async () => {
    const product = (await api().get(`/api/v1/products/${productSlug}`)).body.data;
    const medium = product.variants.find((v: { name: string }) => v.name === 'Medium');
    await as(customer).post('/api/v1/cart/items', { productId: product.id, variantId: medium.id, quantity: 2 }).expect(201);
    const address = await as(customer).post('/api/v1/addresses', { fullName: 'Buyer', phone: '03001234567', line1: 'House 9, Model Town', city: 'Lahore' }).expect(201);
    const placed = await as(customer).post('/api/v1/checkout', { addressId: address.body.data.id, deliveryMethod: 'standard', paymentMethod: 'cod' }).expect(201);
    orderNumber = placed.body.data.orders[0].orderNumber;

    const list = await as(seller).get('/api/v1/seller/orders?status=PENDING').expect(200);
    expect(list.body.data[0].orderNumber).toBe(orderNumber);

    const skip = await as(seller).post(`/api/v1/seller/orders/${orderNumber}/status`, { status: 'DELIVERED' }).expect(409);
    expect(skip.body.error.code).toBe('STATUS_NOT_ALLOWED');
    await as(seller).post(`/api/v1/seller/orders/${orderNumber}/status`, { status: 'CANCELLED' }).expect(400); // reason required

    for (const status of ['CONFIRMED', 'PREPARING']) {
      await as(seller).post(`/api/v1/seller/orders/${orderNumber}/status`, { status }).expect(200);
    }
    const shipped = await as(seller)
      .post(`/api/v1/seller/orders/${orderNumber}/status`, { status: 'SHIPPED', courierName: 'TCS', trackingNumber: 'TCS123' })
      .expect(200);
    expect(shipped.body.data).toMatchObject({ courierName: 'TCS', trackingNumber: 'TCS123' });
    const delivered = await as(seller).post(`/api/v1/seller/orders/${orderNumber}/status`, { status: 'DELIVERED' }).expect(200);
    expect(delivered.body.data.payment.status).toBe('PAID');
    expect(delivered.body.data.nextStatuses).toEqual(['RETURNED']); // refunds are staff-only

    const customerView = await as(customer).get(`/api/v1/orders/${orderNumber}`).expect(200);
    expect(customerView.body.data.timeline.map((t: { status: string }) => t.status)).toEqual(['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED']);
    expect(customerView.body.data.timeline[3].note).toContain('TCS123');
  });

  it('keeps other sellers out of this shop’s orders', async () => {
    await as(customer).get(`/api/v1/seller/orders/${orderNumber}`).expect(403);
  });

  it('reports dashboard figures and earnings from real orders', async () => {
    const dash = await as(seller).get('/api/v1/seller/dashboard?days=7').expect(200);
    const d = dash.body.data;
    expect(d.series).toHaveLength(7);
    expect(d.totals).toMatchObject({ periodOrders: 1, deliveredOrders: 1, customers: 1, pendingOrders: 0 });
    expect(d.topProducts[0]).toMatchObject({ slug: productSlug, unitsSold: 2 });
    expect(d.series.reduce((n: number, s: { revenue: number }) => n + s.revenue, 0)).toBe(d.totals.periodRevenue);

    const earnings = await as(seller).get('/api/v1/seller/earnings').expect(200);
    expect(earnings.body.meta.summary).toMatchObject({ commissionPercent: 0, deliveredOrders: 1, commission: 0 });
    expect(earnings.body.meta.summary.netEarnings).toBe(earnings.body.meta.summary.grossSales);
  });

  it('updates shop details within the allowed fields and features a product', async () => {
    const res = await as(seller).patch('/api/v1/seller/shop', { description: 'Hand-made kites since 1990, from the walled city of Lahore.', featuredProductIds: [productId] }).expect(200);
    expect(res.body.data.featuredProductIds).toEqual([productId]);
    await as(seller).patch('/api/v1/seller/shop', { name: 'New name' }).expect(422); // name is fixed after approval
  });

  it('suspending a shop hides its products immediately', async () => {
    await as(admin).post(`/api/v1/admin/shops/${shopId}/decision`, { decision: 'suspend', note: 'Investigating a complaint' }).expect(200);
    await api().get(`/api/v1/products/${productSlug}`).expect(404);
    const blocked = await as(seller).get('/api/v1/seller/products').expect(403);
    expect(blocked.body.error.code).toBe('SHOP_NOT_APPROVED');
    await as(admin).post(`/api/v1/admin/shops/${shopId}/decision`, { decision: 'reinstate' }).expect(200);
    await api().get(`/api/v1/products/${productSlug}`).expect(200);
  });
});
