import type { INestApplication } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

describe('Urdu responses (e2e)', () => {
  let app: INestApplication<App>;
  let lastCode: (email: string, purpose: OtpPurpose) => string;
  const api = () => request(app.getHttpServer());
  const UR = { 'Accept-Language': 'ur-PK,ur;q=0.9' };

  beforeAll(async () => {
    ({ app, lastCode } = await setupApp('test-i18n', { demo: true }));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('answers errors and field checks in Urdu', async () => {
    const login = await api().post('/api/v1/auth/login').set(UR).send({ identifier: 'nobody@example.com', password: 'wrongPass123' }).expect(401);
    expect(login.body.error.message).toBe('ای میل/فون یا پاس ورڈ درست نہیں۔');

    const bad = await api().post('/api/v1/auth/register').set(UR).send({ fullName: 'A', email: 'not-an-email', password: 'short' }).expect(422);
    expect(bad.body.error.message).toBe('کچھ خانوں کو درست کرنا ضروری ہے۔');
    const byField = Object.fromEntries(bad.body.error.details.map((d: { field: string; message: string }) => [d.field, d.message]));
    expect(byField.email).toBe('درست ای میل ایڈریس درج کریں');
    expect(byField.fullName).toBe('پورا نام 2 سے 80 حروف کا ہونا چاہیے');

    const english = await api().post('/api/v1/auth/login').send({ identifier: 'nobody@example.com', password: 'wrongPass123' }).expect(401);
    expect(english.body.error.message).toBe('The email/phone or password is incorrect.');
  });

  it('translates platform labels but never user content', async () => {
    const cats = await api().get('/api/v1/categories').set(UR).expect(200);
    expect(cats.body.data.map((c: { name: string }) => c.name)).toContain('پتنگیں');
    const products = await api().get('/api/v1/products?pageSize=1').set(UR).expect(200);
    const english = await api().get('/api/v1/products?pageSize=1').expect(200);
    expect(products.body.data[0].title).toBe(english.body.data[0].title); // a shop's product title stays as written
  });

  it('remembers the language people sign up in and lets them change it', async () => {
    const email = 'urdu@example.com';
    await api().post('/api/v1/auth/register').set(UR).send({ fullName: 'Urdu Reader', email, password: 'flyHigh2027' }).expect(201);
    const verified = await api().post('/api/v1/auth/verify-otp').set(UR).send({ email, code: lastCode(email, OtpPurpose.VERIFY_ACCOUNT) }).expect(200);
    expect(verified.body.data.user.locale).toBe('ur');
    const token = verified.body.data.tokens.accessToken;

    const changed = await api().put('/api/v1/users/me/locale').set('Authorization', `Bearer ${token}`).send({ locale: 'en' }).expect(200);
    expect(changed.body.data.locale).toBe('en');
    await api().put('/api/v1/users/me/locale').set('Authorization', `Bearer ${token}`).send({ locale: 'fr' }).expect(422);

    const options = await api().get('/api/v1/checkout/options').set(UR).set('Authorization', `Bearer ${token}`).expect(200);
    expect(options.body.data.deliveryMethods[0].label).toBe('عام ڈیلیوری');
    expect(options.body.data.paymentMethods[0].label).toBe('کیش آن ڈیلیوری');
  });
});
