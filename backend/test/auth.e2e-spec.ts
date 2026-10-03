import type { INestApplication } from '@nestjs/common';
import { OtpPurpose } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let lastCode: (email: string, purpose: OtpPurpose) => string;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, lastCode } = await setupApp('test-auth'));
  });

  afterAll(async () => {
    await app?.close();
  });

  const user = { fullName: 'Sana Tariq', email: 'sana@example.com', phone: '0321 7654321', password: 'flyHigh2027' };
  let refreshToken = '';
  let accessToken = '';

  it('rejects invalid registration with per-field errors', async () => {
    const res = await api().post('/api/v1/auth/register').send({ email: 'x', password: 'short' }).expect(422);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    const fields = res.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['fullName', 'email', 'password']));
  });

  it('registers an unverified account and sends a code', async () => {
    const res = await api().post('/api/v1/auth/register').send(user).expect(201);
    expect(res.body.data).toEqual({ email: user.email, verificationRequired: true });
    expect(lastCode(user.email, OtpPurpose.VERIFY_ACCOUNT)).toMatch(/^\d{6}$/);
  });

  it('blocks sign-in until the email is verified', async () => {
    const res = await api().post('/api/v1/auth/login').send({ identifier: user.email, password: user.password }).expect(403);
    expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
  });

  it('rejects a wrong code, then verifies with the right one', async () => {
    await api().post('/api/v1/auth/verify-otp').send({ email: user.email, code: '999999' }).expect(400);
    const res = await api()
      .post('/api/v1/auth/verify-otp')
      .send({ email: user.email, code: lastCode(user.email, OtpPurpose.VERIFY_ACCOUNT) })
      .expect(200);
    expect(res.body.data.user).toMatchObject({ email: user.email, isVerified: true, roles: ['CUSTOMER'], phone: '+923217654321' });
    expect(res.body.data.user.passwordHash).toBeUndefined();
    ({ accessToken, refreshToken } = res.body.data.tokens);
  });

  it('does not accept the same code twice', async () => {
    await api()
      .post('/api/v1/auth/verify-otp')
      .send({ email: user.email, code: lastCode(user.email, OtpPurpose.VERIFY_ACCOUNT) })
      .expect(400);
  });

  it('signs in with phone number and returns the profile-less user', async () => {
    const res = await api().post('/api/v1/auth/login').send({ identifier: '03217654321', password: user.password }).expect(200);
    expect(res.body.data.user.profile).toBeNull();
  });

  it('rejects a wrong password with a generic message', async () => {
    const res = await api().post('/api/v1/auth/login').send({ identifier: user.email, password: 'wrongPass1' }).expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('saves the profile', async () => {
    const res = await api()
      .put('/api/v1/users/me/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ displayName: 'Sana T.', city: 'Karachi' })
      .expect(200);
    expect(res.body.data.profile).toMatchObject({ displayName: 'Sana T.', city: 'Karachi' });
  });

  it('enforces permissions on the server', async () => {
    const res = await api().get('/api/v1/users').set('Authorization', `Bearer ${accessToken}`).expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    await api().get('/api/v1/auth/me').expect(401);
  });

  it('lets staff with users.read list users, paginated', async () => {
    const login = await api().post('/api/v1/auth/login').send({ identifier: 'admin@test.local', password: 'AdminPass123' }).expect(200);
    const res = await api()
      .get('/api/v1/users?pageSize=5&q=sana')
      .set('Authorization', `Bearer ${login.body.data.tokens.accessToken}`)
      .expect(200);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 5, total: 1 });
    expect(res.body.data[0].email).toBe(user.email);
  });

  it('rotates refresh tokens and revokes the login when an old token is replayed', async () => {
    const first = await api().post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);
    const rotated = first.body.data.tokens.refreshToken;
    expect(rotated).not.toBe(refreshToken);

    await api().post('/api/v1/auth/refresh').send({ refreshToken }).expect(401); // replay
    await api().post('/api/v1/auth/refresh').send({ refreshToken: rotated }).expect(401); // family revoked
  });

  it('resets the password with a code and signs out other sessions', async () => {
    await api().post('/api/v1/auth/forgot-password').send({ email: user.email }).expect(200);
    await api().post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(200); // no enumeration

    const login = await api().post('/api/v1/auth/login').send({ identifier: user.email, password: user.password }).expect(200);
    await api()
      .post('/api/v1/auth/reset-password')
      .send({ email: user.email, code: lastCode(user.email, OtpPurpose.RESET_PASSWORD), newPassword: 'newKites2027' })
      .expect(200);

    await api().post('/api/v1/auth/refresh').send({ refreshToken: login.body.data.tokens.refreshToken }).expect(401);
    await api().post('/api/v1/auth/login').send({ identifier: user.email, password: user.password }).expect(401);
    await api().post('/api/v1/auth/login').send({ identifier: user.email, password: 'newKites2027' }).expect(200);
  });
});
