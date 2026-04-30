import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createExpressApp } from '../../server.js';
import { buildUser, createUser } from './factories.js';

describe('users integration', () => {
  it('registers a user without returning a password', async () => {
    const app = createExpressApp();
    const user = buildUser({ email: 'register@example.com' });

    const res = await request(app).post('/users/register').send(user).expect(201);

    expect(res.body).toMatchObject({
      username: user.username,
      email: user.email,
    });
    expect(res.body.password).toBeUndefined();
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('logs in and exposes the session through /users/me', async () => {
    const app = createExpressApp();
    await createUser({ username: 'Owner', email: 'owner@example.com', password: 'StrongPass1!' });

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
    });
  });

  it('rejects invalid login credentials', async () => {
    const app = createExpressApp();
    await createUser({ email: 'login@example.com', password: 'StrongPass1!' });

    await request(app)
      .post('/users/login')
      .send({ email: 'login@example.com', password: 'WrongPass1!' })
      .expect(401);
  });
});
