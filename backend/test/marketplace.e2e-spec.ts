import type { INestApplication } from '@nestjs/common';
import { OrderStatus, PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

describe('Marketplace (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let token = '';
  const api = () => request(app.getHttpServer());
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ({ app } = await setupApp('test-market', { demo: true }));
    prisma = new PrismaClient();
    // A verified customer, signed in through the real login endpoint.
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ identifier: 'basant-kite-house@demo.kiteplatform.local', password: 'DemoSeller123' })
      .expect(200);
    token = login.body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  it('lists categories as a tree with product counts', async () => {
    const res = await api().get('/api/v1/categories').expect(200);
    const kites = res.body.data.find((c: { slug: string }) => c.slug === 'kites');
    expect(kites.children.map((c: { slug: string }) => c.slug)).toContain('paper-kites');
    expect(kites.children.find((c: { slug: string }) => c.slug === 'paper-kites').productCount).toBe(2);
  });

  it('filters, sorts and paginates products', async () => {
    const parent = await api().get('/api/v1/products?category=kites').expect(200);
    expect(parent.body.meta.total).toBe(4); // includes sub-categories

    const cheap = await api().get('/api/v1/products?maxPrice=400&sort=price_asc').expect(200);
    const prices = cheap.body.data.map((p: { price: number }) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(Math.max(...prices)).toBeLessThanOrEqual(400);

    const inStock = await api().get('/api/v1/products?inStock=true&pageSize=50').expect(200);
    expect(inStock.body.data.every((p: { inStock: boolean }) => p.inStock)).toBe(true);
    expect(inStock.body.data.find((p: { slug: string }) => p.slug === 'weatherproof-plastic-kite')).toBeUndefined();

    const page = await api().get('/api/v1/products?pageSize=2&page=2').expect(200);
    expect(page.body.meta).toMatchObject({ page: 2, pageSize: 2, total: 9, totalPages: 5 });

    const city = await api().get('/api/v1/products?city=Karachi').expect(200);
    expect(city.body.data.every((p: { shop: { city: string } }) => p.shop.city === 'Karachi')).toBe(true);
  });

  it('searches products, shops and categories', async () => {
    const res = await api().get('/api/v1/search?q=charkhi').expect(200);
    expect(res.body.data.products[0].slug).toBe('wooden-charkhi-medium');
    expect(res.body.data.categories[0].slug).toBe('charkhis-spools');
  });

  it('shows product details with variants and wishlist state', async () => {
    const res = await auth(api().get('/api/v1/products/classic-gudda-kite-tissue-paper')).expect(200);
    expect(res.body.data.variants).toHaveLength(2);
    expect(res.body.data.isWishlisted).toBe(false);
    expect(res.body.data.stock).toBe(58);
  });

  it('adds to wishlist and follows a shop', async () => {
    const product = await api().get('/api/v1/products/wooden-charkhi-medium').expect(200);
    await auth(api().put(`/api/v1/wishlist/${product.body.data.id}`)).expect(200);
    const list = await auth(api().get('/api/v1/wishlist')).expect(200);
    expect(list.body.data[0].slug).toBe('wooden-charkhi-medium');

    const follow = await auth(api().put('/api/v1/shops/karachi-kite-works/follow')).expect(200);
    expect(follow.body.data).toEqual({ isFollowing: true, followerCount: 1 });
    await auth(api().put('/api/v1/shops/karachi-kite-works/follow')).expect(200); // idempotent
    const shop = await auth(api().get('/api/v1/shops/karachi-kite-works')).expect(200);
    expect(shop.body.data).toMatchObject({ isFollowing: true, followerCount: 1 });
  });

  let guddaId = '';
  let largeVariantId = '';

  it('validates cart additions (variant required, stock limits)', async () => {
    const gudda = (await api().get('/api/v1/products/classic-gudda-kite-tissue-paper')).body.data;
    guddaId = gudda.id;
    largeVariantId = gudda.variants.find((v: { name: string }) => v.name.startsWith('Large')).id;

    const noVariant = await auth(api().post('/api/v1/cart/items').send({ productId: guddaId, quantity: 1 })).expect(400);
    expect(noVariant.body.error.code).toBe('VARIANT_REQUIRED');

    const tooMany = await auth(api().post('/api/v1/cart/items').send({ productId: guddaId, variantId: largeVariantId, quantity: 19 })).expect(409);
    expect(tooMany.body.error.code).toBe('OUT_OF_STOCK');

    const outOfStock = (await api().get('/api/v1/products/weatherproof-plastic-kite')).body.data;
    await auth(api().post('/api/v1/cart/items').send({ productId: outOfStock.id, quantity: 1 })).expect(409);
  });

  it('builds a cart grouped by shop and supports save-for-later', async () => {
    await auth(api().post('/api/v1/cart/items').send({ productId: guddaId, variantId: largeVariantId, quantity: 2 })).expect(201);
    const string = (await api().get('/api/v1/products/plain-cotton-string-6-reels')).body.data;
    const cart = await auth(api().post('/api/v1/cart/items').send({ productId: string.id, quantity: 1 })).expect(201);
    expect(cart.body.data.shops).toHaveLength(2);
    expect(cart.body.data.subtotal).toBe(2 * 550 + 1200);

    const guards = (await api().get('/api/v1/products/leather-finger-guards-pair')).body.data;
    const withGuards = await auth(api().post('/api/v1/cart/items').send({ productId: guards.id, quantity: 1 })).expect(201);
    const guardLine = withGuards.body.data.shops.flatMap((s: { items: { id: string; slug: string }[] }) => s.items).find((i: { slug: string }) => i.slug === 'leather-finger-guards-pair');
    const saved = await auth(api().patch(`/api/v1/cart/items/${guardLine.id}`).send({ savedForLater: true })).expect(200);
    expect(saved.body.data.savedForLater).toHaveLength(1);
    expect(saved.body.data.subtotal).toBe(2300);
  });

  it('quotes per-shop shipping and applies a coupon', async () => {
    const quote = await auth(api().post('/api/v1/checkout/quote').send({ deliveryMethod: 'standard', couponCode: 'demo10' })).expect(200);
    const q = quote.body.data;
    expect(q.subtotal).toBe(2300);
    expect(q.shippingFee).toBe(500); // Rs 250 per shop order, neither shop reaches the free-shipping threshold
    expect(q.discount).toBe(230);
    expect(q.total).toBe(2300 + 500 - 230);
    expect(q.shops.reduce((n: number, s: { discount: number }) => n + s.discount, 0)).toBe(230);

    const bad = await auth(api().post('/api/v1/checkout/quote').send({ deliveryMethod: 'standard', couponCode: 'NOPE' })).expect(400);
    expect(bad.body.error.code).toBe('COUPON_INVALID');
  });

  it('offers only payment methods that are configured', async () => {
    const res = await auth(api().get('/api/v1/checkout/options')).expect(200);
    expect(res.body.data.paymentMethods.map((m: { key: string }) => m.key)).toEqual(['cod']);
  });

  let orderNumbers: string[] = [];

  it('places one order per shop, reserves stock and empties the cart (idempotent)', async () => {
    const address = await auth(
      api().post('/api/v1/addresses').send({ fullName: 'Test Buyer', phone: '03001234567', line1: 'House 1, Street 2, Gulberg', city: 'Lahore' }),
    ).expect(201);
    expect(address.body.data.isDefault).toBe(true);

    const checkoutId = '6f1c1f6e-2b9a-4a3e-9d6e-1e2f3a4b5c6d';
    const body = { addressId: address.body.data.id, deliveryMethod: 'standard', paymentMethod: 'cod', couponCode: 'DEMO10', checkoutId };
    const placed = await auth(api().post('/api/v1/checkout').send(body)).expect(201);
    expect(placed.body.data.orders).toHaveLength(2);
    expect(placed.body.data.total).toBe(2570);
    expect(placed.body.data.paymentInstructions).toMatch(/rider/);
    orderNumbers = placed.body.data.orders.map((o: { orderNumber: string }) => o.orderNumber);

    const again = await auth(api().post('/api/v1/checkout').send(body)).expect(201);
    expect(again.body.data.orders.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(orderNumbers);

    const variant = await prisma.productVariant.findUniqueOrThrow({ where: { id: largeVariantId } });
    expect(variant.stock).toBe(16);
    const cart = await auth(api().get('/api/v1/cart')).expect(200);
    expect(cart.body.data.shops).toHaveLength(0);
    expect(cart.body.data.savedForLater).toHaveLength(1); // saved items stay
    expect((await prisma.coupon.findUniqueOrThrow({ where: { code: 'DEMO10' } })).usedCount).toBe(1);
  });

  it('rejects a payment method that is not configured', async () => {
    const res = await auth(api().post('/api/v1/checkout').send({ addressId: 'x', deliveryMethod: 'standard', paymentMethod: 'bank_transfer' })).expect(400);
    expect(res.body.error.code).toBe('PAYMENT_METHOD_UNAVAILABLE');
  });

  it('shows orders with a timeline, and cancelling returns the stock', async () => {
    const list = await auth(api().get('/api/v1/orders')).expect(200);
    expect(list.body.meta.total).toBe(2);

    const guddaOrder = orderNumbers[0];
    const detail = await auth(api().get(`/api/v1/orders/${guddaOrder}`)).expect(200);
    expect(detail.body.data.timeline[0].status).toBe('PENDING');
    expect(detail.body.data.canCancel).toBe(true);

    const cancelled = await auth(api().post(`/api/v1/orders/${guddaOrder}/cancel`).send({ reason: 'Ordered by mistake' })).expect(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
    expect(cancelled.body.data.timeline.at(-1).note).toContain('Ordered by mistake');
    expect((await prisma.productVariant.findUniqueOrThrow({ where: { id: largeVariantId } })).stock).toBe(18);

    await auth(api().post(`/api/v1/orders/${guddaOrder}/cancel`).send({})).expect(409);
  });

  it('allows reviews only after delivery, once', async () => {
    const stringOrder = orderNumbers[1];
    const early = await auth(api().post('/api/v1/products/plain-cotton-string-6-reels/reviews').send({ rating: 5 })).expect(403);
    expect(early.body.error.code).toBe('REVIEW_NOT_ALLOWED');

    // Delivery is recorded by the shop in Phase 3; set it directly here.
    await prisma.order.update({ where: { orderNumber: stringOrder }, data: { status: OrderStatus.DELIVERED } });
    await auth(api().post('/api/v1/products/plain-cotton-string-6-reels/reviews').send({ rating: 4, comment: 'Good, smooth string.' })).expect(201);
    await auth(api().post('/api/v1/products/plain-cotton-string-6-reels/reviews').send({ rating: 5 })).expect(409);

    const product = await api().get('/api/v1/products/plain-cotton-string-6-reels').expect(200);
    expect(product.body.data).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
    const reviews = await api().get('/api/v1/products/plain-cotton-string-6-reels/reviews').expect(200);
    expect(reviews.body.meta.distribution['4']).toBe(1);
  });

  it('keeps other users out of my orders', async () => {
    const other = await api().post('/api/v1/auth/login').send({ identifier: 'karachi-kite-works@demo.kiteplatform.local', password: 'DemoSeller123' });
    await api().get(`/api/v1/orders/${orderNumbers[1]}`).set('Authorization', `Bearer ${other.body.data.tokens.accessToken}`).expect(404);
  });
});
