import type { INestApplication } from '@nestjs/common';
import { OtpPurpose, PrismaClient } from '@prisma/client';
import request from 'supertest';
import type { App } from 'supertest/types.js';

import { setupApp } from './setup-app.js';

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
// "ftyp" box at offset 4 → recognised as MP4.
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(16)]);

describe('Community (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaClient;
  let lastCode: (email: string, purpose: OtpPurpose) => string;
  const api = () => request(app.getHttpServer());
  const as = (token: string) => ({
    get: (url: string) => api().get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string, body?: object) => api().post(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    put: (url: string, body?: object) => api().put(url).set('Authorization', `Bearer ${token}`).send(body ?? {}),
    patch: (url: string, body: object) => api().patch(url).set('Authorization', `Bearer ${token}`).send(body),
    del: (url: string) => api().delete(url).set('Authorization', `Bearer ${token}`),
  });

  const users: { token: string; id: string }[] = [];
  let admin = '';

  async function signUp(email: string) {
    await api().post('/api/v1/auth/register').send({ fullName: email.split('@')[0], email, password: 'flyHigh2027' }).expect(201);
    const res = await api().post('/api/v1/auth/verify-otp').send({ email, code: lastCode(email, OtpPurpose.VERIFY_ACCOUNT) }).expect(200);
    return { token: res.body.data.tokens.accessToken as string, id: res.body.data.user.id as string };
  }

  beforeAll(async () => {
    ({ app, lastCode } = await setupApp('test-community'));
    prisma = new PrismaClient();
    for (let i = 0; i < 7; i++) users.push(await signUp(`flyer${i}@example.com`));
    admin = (await api().post('/api/v1/auth/login').send({ identifier: 'admin@test.local', password: 'AdminPass123' })).body.data.tokens.accessToken;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  const [a, b, c] = [0, 1, 2];
  let postId = '';

  it('creates posts with photos or a single video, and blocks unsafe content', async () => {
    const up = (buf: Buffer, name: string) =>
      api().post('/api/v1/uploads?purpose=post_media').set('Authorization', `Bearer ${users[a].token}`).attach('file', buf, name);
    const img = (await up(PNG, 'kite.png').expect(201)).body.data;
    const vid = (await up(MP4, 'flight.mp4').expect(201)).body.data;
    expect(vid.mimeType).toBe('video/mp4');

    const mixed = await as(users[a].token).post('/api/v1/posts', { body: 'Mixed', mediaUploadIds: [img.id, vid.id] }).expect(400);
    expect(mixed.body.error.code).toBe('MEDIA_INVALID');
    const unsafe = await as(users[a].token).post('/api/v1/posts', { body: 'Selling sharp manjha, DM me' }).expect(422);
    expect(unsafe.body.error.details[0].field).toBe('body');

    const created = await as(users[a].token).post('/api/v1/posts', { body: 'First flight of the season at Minar-e-Pakistan!', mediaUploadIds: [img.id] }).expect(201);
    expect(created.body.data).toMatchObject({ isMine: true, media: [{ kind: 'image' }] });
    postId = created.body.data.id;
    await as(users[b].token).post('/api/v1/posts', { body: 'Reusing someone else’s file', mediaUploadIds: [vid.id] }).expect(400);
  });

  it('shows the latest feed to guests and a following feed to members', async () => {
    const guest = await api().get('/api/v1/feed').expect(200);
    expect(guest.body.data[0].id).toBe(postId);
    await api().get('/api/v1/feed?scope=following').expect(401);

    const before = await as(users[b].token).get('/api/v1/feed?scope=following').expect(200);
    expect(before.body.meta.total).toBe(0);
    const followed = await as(users[b].token).put(`/api/v1/community/users/${users[a].id}/follow`).expect(200);
    expect(followed.body.data).toMatchObject({ isFollowing: true, followers: 1, posts: 1 });
    const after = await as(users[b].token).get('/api/v1/feed?scope=following').expect(200);
    expect(after.body.data[0].id).toBe(postId);
  });

  it('likes, comments with one level of replies, and shares', async () => {
    await as(users[b].token).put(`/api/v1/posts/${postId}/like`).expect(200);
    const again = await as(users[b].token).put(`/api/v1/posts/${postId}/like`).expect(200);
    expect(again.body.data.likeCount).toBe(1); // idempotent

    const top = (await as(users[b].token).post(`/api/v1/posts/${postId}/comments`, { body: 'Beautiful patang!' }).expect(201)).body.data;
    const reply = (await as(users[a].token).post(`/api/v1/posts/${postId}/comments`, { body: 'Thanks! Made it myself.', parentId: top.id }).expect(201)).body.data;
    await as(users[b].token).post(`/api/v1/posts/${postId}/comments`, { body: 'Too deep', parentId: reply.id }).expect(400);

    const comments = await api().get(`/api/v1/posts/${postId}/comments`).expect(200);
    expect(comments.body.data[0].replies[0].body).toBe('Thanks! Made it myself.');
    const share = await api().post(`/api/v1/posts/${postId}/share`).expect(200);
    expect(share.body.data).toEqual({ path: `/community/posts/${postId}`, shareCount: 1 });

    const post = await as(users[b].token).get(`/api/v1/posts/${postId}`).expect(200);
    expect(post.body.data).toMatchObject({ likeCount: 1, commentCount: 2, likedByMe: true, isMine: false });

    // The post author may delete comments on their post; replies leave the count with their parent.
    await as(users[a].token).del(`/api/v1/comments/${top.id}`).expect(200);
    expect((await api().get(`/api/v1/posts/${postId}`)).body.data.commentCount).toBe(0);
  });

  it('blocking hides each other’s content and removes follows', async () => {
    await as(users[c].token).post('/api/v1/posts', { body: 'Hello from flyer2' }).expect(201);
    await as(users[c].token).put(`/api/v1/community/users/${users[a].id}/follow`).expect(200);
    await as(users[a].token).put(`/api/v1/community/users/${users[c].id}/block`).expect(200);

    const aFeed = await as(users[a].token).get('/api/v1/feed').expect(200);
    expect(aFeed.body.data.some((p: { author: { id: string } }) => p.author.id === users[c].id)).toBe(false);
    await as(users[c].token).get(`/api/v1/posts/${postId}`).expect(404);
    await as(users[c].token).post(`/api/v1/posts/${postId}/comments`, { body: 'Can I still comment?' }).expect(404);
    await as(users[c].token).put(`/api/v1/community/users/${users[a].id}/follow`).expect(403);
    const profile = await as(users[a].token).get(`/api/v1/community/users/${users[a].id}`).expect(200);
    expect(profile.body.data.followers).toBe(1); // flyer2's follow was removed

    await as(users[a].token).del(`/api/v1/community/users/${users[c].id}/block`).expect(200);
    await as(users[c].token).get(`/api/v1/posts/${postId}`).expect(200);
  });

  it('hides a post automatically after five reports and lets a moderator decide', async () => {
    await as(users[a].token).post('/api/v1/reports', { targetType: 'post', targetId: postId, reason: 'spam' }).expect(400); // own post
    for (let i = 1; i <= 5; i++) {
      await as(users[i].token).post('/api/v1/reports', { targetType: 'post', targetId: postId, reason: i === 5 ? 'dangerous' : 'spam', details: 'test' }).expect(201);
    }
    await as(users[1].token).post('/api/v1/reports', { targetType: 'post', targetId: postId, reason: 'spam' }).expect(409);
    await api().get(`/api/v1/posts/${postId}`).expect(404); // hidden pending review

    await as(users[6].token).get('/api/v1/admin/moderation').expect(403);
    const queue = await as(admin).get('/api/v1/admin/moderation').expect(200);
    expect(queue.body.data[0]).toMatchObject({ targetType: 'post', targetId: postId, reportCount: 5, reasons: { spam: 4, dangerous: 1 } });
    expect(queue.body.data[0].preview.status).toBe('HIDDEN');

    await as(admin).post(`/api/v1/admin/moderation/post/${postId}`, { action: 'remove' }).expect(400); // reason required
    const dismissed = await as(admin).post(`/api/v1/admin/moderation/post/${postId}`, { action: 'dismiss', note: 'Normal kite photo' }).expect(200);
    expect(dismissed.body.data).toMatchObject({ reportsClosed: 5, preview: { status: 'VISIBLE' } });
    await api().get(`/api/v1/posts/${postId}`).expect(200);
    expect((await as(admin).get('/api/v1/admin/moderation')).body.meta.total).toBe(0);

    const removed = await as(admin).post(`/api/v1/admin/moderation/post/${postId}`, { action: 'remove', note: 'Breaks community rules' }).expect(200);
    expect(removed.body.data.preview.status).toBe('REMOVED');
    await api().get(`/api/v1/posts/${postId}`).expect(404);
  });

  it('lets authors edit and delete only their own posts', async () => {
    const p = (await as(users[b].token).post('/api/v1/posts', { body: 'Typo in this post' }).expect(201)).body.data;
    await as(users[c].token).patch(`/api/v1/posts/${p.id}`, { body: 'Not mine' }).expect(404);
    const edited = await as(users[b].token).patch(`/api/v1/posts/${p.id}`, { body: 'Fixed the typo' }).expect(200);
    expect(edited.body.data.editedAt).not.toBeNull();
    await as(users[b].token).del(`/api/v1/posts/${p.id}`).expect(200);
    await api().get(`/api/v1/posts/${p.id}`).expect(404);
  });
});
