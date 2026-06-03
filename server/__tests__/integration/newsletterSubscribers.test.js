import request from 'supertest';
import { describe, expect, it } from 'vitest';
import NewsletterSubscriber from '../../models/NewsletterSubscriber.js';
import { createExpressApp } from '../../server.js';
import { authCookie, createFullAdmin, createUser } from './factories.js';

async function createSubscriber(overrides = {}) {
  const now = new Date('2026-06-02T10:00:00.000Z');

  return NewsletterSubscriber.create({
    email: 'subscriber@example.com',
    status: 'active',
    consentGivenAt: now,
    firstSubscribedAt: now,
    lastSubscribedAt: now,
    lastStatusChangedAt: now,
    subscribeCount: 1,
    hasEverUnsubscribed: false,
    welcomeEmailSentAt: now,
    ...overrides,
  });
}

describe('newsletter subscriber analytics integration', () => {
  it('requires full admin access', async () => {
    const app = createExpressApp();
    const customer = await createUser({ role: 'customer' });

    await request(app).get('/newsletter/subscribers/analytics').expect(401);

    await request(app)
      .get('/newsletter/subscribers/analytics')
      .set('Cookie', authCookie(customer))
      .expect(403);
  });

  it('returns full-admin subscriber summary, badges, pagination, and no-store headers', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const oldDate = new Date('2026-01-01T00:00:00.000Z');
    const newDate = new Date();
    await createSubscriber({
      email: 'new@example.com',
      firstSubscribedAt: newDate,
      lastSubscribedAt: newDate,
      lastStatusChangedAt: newDate,
    });
    await createSubscriber({
      email: 'resubscribed@example.com',
      subscribeCount: 2,
      hasEverUnsubscribed: true,
      firstSubscribedAt: oldDate,
      lastSubscribedAt: newDate,
      lastStatusChangedAt: newDate,
    });
    await createSubscriber({
      email: 'unsubscribed@example.com',
      status: 'unsubscribed',
      hasEverUnsubscribed: true,
      firstSubscribedAt: oldDate,
      lastSubscribedAt: oldDate,
      lastStatusChangedAt: oldDate,
      unsubscribedAt: oldDate,
    });

    const res = await request(app)
      .get('/newsletter/subscribers/analytics?page=1&pageSize=2')
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body.summary).toEqual({
      total: 3,
      active: 2,
      unsubscribed: 1,
      new: 1,
      resubscribed: 1,
    });
    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalPages: 2,
    });
    expect(res.body.subscribers).toHaveLength(2);
    expect(res.body.subscribers.map((subscriber) => subscriber.email)).toContain('new@example.com');
    expect(res.body.subscribers.find((subscriber) => subscriber.email === 'new@example.com').badge).toBe('new');
    expect(
      res.body.subscribers.find((subscriber) => subscriber.email === 'resubscribed@example.com').badge
    ).toBe('subscribed');
  });

  it('normalizes invalid pagination query values', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'single@example.com' });

    const res = await request(app)
      .get('/newsletter/subscribers/analytics?page=bad&pageSize=500')
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(res.body.pagination).toEqual({
      page: 1,
      pageSize: 100,
      totalPages: 1,
    });
  });

  it('returns an empty subscriber list for out-of-range pages', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'single@example.com' });

    const res = await request(app)
      .get('/newsletter/subscribers/analytics?page=3&pageSize=2')
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(res.body.pagination).toEqual({
      page: 3,
      pageSize: 2,
      totalPages: 1,
    });
    expect(res.body.subscribers).toEqual([]);
  });
});
