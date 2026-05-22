import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../helpers/sendEmail.js';
import { createExpressApp } from '../../server.js';
import {
  authCookie,
  buildUser,
  createActiveArtist,
  createFullAdmin,
  createProduct,
  createUser,
} from './factories.js';

describe('users integration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects public registration in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const app = createExpressApp();
    const user = buildUser({ email: 'disabled-register@example.com' });

    const res = await request(app).post('/users/register').send(user).expect(404);

    expect(res.body).toMatchObject({ message: 'Registration is disabled.' });
  });

  it('registers a user outside production without returning a password', async () => {
    const app = createExpressApp();
    const user = buildUser({ email: 'register@example.com' });

    const res = await request(app).post('/users/register').send(user).expect(201);

    expect(res.body).toMatchObject({
      username: user.username,
      email: user.email,
      role: 'customer',
      artistStatus: null,
    });
    expect(res.body.password).toBeUndefined();
    expect(res.headers['set-cookie'] || []).toHaveLength(0);
  });

  it('logs in and exposes the session through /users/me', async () => {
    const app = createExpressApp();
    await createUser({
      username: 'Owner',
      email: 'owner@example.com',
      password: 'StrongPass1!',
      role: 'full_admin',
    });

    const loginRes = await request(app)
      .post('/users/login')
      .send({ email: 'owner@example.com', password: 'StrongPass1!' })
      .expect(200);
    const cookie = loginRes.headers['set-cookie'];

    expect(cookie?.[0]).toContain('token=');

    const meRes = await request(app).get('/users/me').set('Cookie', cookie).expect(200);

    expect(meRes.body).toMatchObject({
      username: 'Owner',
      email: 'owner@example.com',
      role: 'full_admin',
      artistStatus: null,
    });
  });

  it('rejects /users/me when the token user no longer exists', async () => {
    const app = createExpressApp();
    const user = await createUser({ email: 'deleted@example.com', password: 'StrongPass1!' });
    const loginRes = await request(app)
      .post('/users/login')
      .send({ email: 'deleted@example.com', password: 'StrongPass1!' })
      .expect(200);

    await user.deleteOne();

    await request(app).get('/users/me').set('Cookie', loginRes.headers['set-cookie']).expect(401);
  });

  it('rejects invalid login credentials', async () => {
    const app = createExpressApp();
    await createUser({ email: 'login@example.com', password: 'StrongPass1!' });

    await request(app)
      .post('/users/login')
      .send({ email: 'login@example.com', password: 'WrongPass1!' })
      .expect(401);
  });

  it('requires full admin access for the user admin list', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'artist-list@example.com' });

    await request(app).get('/users/admin').expect(401);
    await request(app).get('/users/admin').set('Cookie', authCookie(artist)).expect(403);
  });

  it('lists users for full admins with product counts and no passwords', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin({ email: 'admin-list@example.com' });
    const artist = await createActiveArtist({ email: 'listed-artist@example.com' });
    await createProduct({ owner: artist, title: 'Listed product one' });
    await createProduct({ owner: artist, title: 'Listed product two' });

    const res = await request(app)
      .get('/users/admin')
      .set('Cookie', authCookie(admin))
      .expect(200);

    const listedArtist = res.body.find((user) => user.email === artist.email);
    expect(listedArtist).toMatchObject({
      email: artist.email,
      role: 'artist',
      artistStatus: 'active',
      productCount: 2,
    });
    expect(listedArtist.password).toBeUndefined();
  });

  it('returns a full admin user dossier with product links', async () => {
    vi.stubEnv('CLIENT_URL', 'https://happycolors.example');
    const app = createExpressApp();
    const admin = await createFullAdmin({ email: 'admin-dossier@example.com' });
    const artist = await createActiveArtist({ email: 'dossier-artist@example.com' });
    const product = await createProduct({
      owner: artist,
      title: 'Dossier candle',
      publicationStatus: 'pending_review',
    });

    const res = await request(app)
      .get(`/users/admin/${artist._id}`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body.user).toMatchObject({
      email: artist.email,
      role: 'artist',
      artistStatus: 'active',
    });
    expect(res.body.products).toEqual([
      expect.objectContaining({
        _id: String(product._id),
        title: 'Dossier candle',
        publicationStatus: 'pending_review',
        url: `https://happycolors.example/products/${product._id}/edit`,
      }),
    ]);
    expect(res.body.user.password).toBeUndefined();
  });

  it('lets full admins change roles and sends a suspended artist product reminder', async () => {
    vi.stubEnv('CLIENT_URL', 'https://happycolors.example');
    const app = createExpressApp();
    const admin = await createFullAdmin({ email: 'admin-update@example.com' });
    const artist = await createActiveArtist({ email: 'artist-update@example.com' });
    const product = await createProduct({ owner: artist, title: 'Artist product' });

    const res = await request(app)
      .patch(`/users/admin/${artist._id}`)
      .set('Cookie', authCookie(admin))
      .send({ role: 'artist', artistStatus: 'suspended' })
      .expect(200);

    expect(res.body).toMatchObject({
      user: {
        email: artist.email,
        role: 'artist',
        artistStatus: 'suspended',
      },
      reminder: {
        sent: true,
        productCount: 1,
      },
    });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('Suspended artist'),
        text: expect.stringContaining(`https://happycolors.example/products/${product._id}/edit`),
      })
    );
  });

  it('rejects invalid role updates and self-demotion', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin({ email: 'admin-invalid@example.com' });
    const artist = await createActiveArtist({ email: 'artist-invalid@example.com' });

    await request(app)
      .patch(`/users/admin/${artist._id}`)
      .set('Cookie', authCookie(admin))
      .send({ role: 'super_admin' })
      .expect(400);

    await request(app)
      .patch(`/users/admin/${artist._id}`)
      .set('Cookie', authCookie(admin))
      .send({ role: 'artist', artistStatus: 'blocked' })
      .expect(400);

    await request(app)
      .patch(`/users/admin/${admin._id}`)
      .set('Cookie', authCookie(admin))
      .send({ role: 'customer' })
      .expect(400);
  });

  it('requires a trusted origin for production role changes', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLIENT_URL', 'https://happycolors.example');
    const app = createExpressApp();
    const admin = await createFullAdmin({ email: 'admin-origin@example.com' });
    const artist = await createActiveArtist({ email: 'artist-origin@example.com' });

    await request(app)
      .patch(`/users/admin/${artist._id}`)
      .set('Cookie', authCookie(admin))
      .send({ role: 'artist', artistStatus: 'suspended' })
      .expect(403);
  });
});
