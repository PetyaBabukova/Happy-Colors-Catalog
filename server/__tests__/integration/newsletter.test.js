import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../helpers/sendEmail.js';
import NewsletterSubscriber from '../../models/NewsletterSubscriber.js';
import { createUnsubscribeToken } from '../../services/newsletterService.js';
import { createExpressApp } from '../../server.js';

async function createSubscriber(overrides = {}) {
  return NewsletterSubscriber.create({
    email: 'petya@example.com',
    status: 'active',
    consentGivenAt: new Date(),
    welcomeEmailSentAt: new Date(),
    ...overrides,
  });
}

async function getSubscribeToken(app, ip = '203.0.113.200') {
  const res = await request(app)
    .get('/newsletter/subscribe-token')
    .set('x-forwarded-for', ip)
    .expect(200);

  expect(res.headers['cache-control']).toContain('no-store');
  return res.body.token;
}

describe('newsletter integration', () => {
  it('subscribes a valid email with consent and normalizes the stored address', async () => {
    const app = createExpressApp();

    const res = await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.20')
      .send({
        email: '  Petya@Example.COM ',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app),
      })
      .expect(200);

    const subscriber = await NewsletterSubscriber.findOne({ email: 'petya@example.com' });

    expect(res.body.message).toBeTruthy();
    expect(subscriber).toMatchObject({
      email: 'petya@example.com',
      status: 'active',
      unsubscribedAt: null,
      unsubscribeTokenVersion: 1,
      subscribeCount: 1,
      hasEverUnsubscribed: false,
    });
    expect(subscriber.consentGivenAt).toBeInstanceOf(Date);
    expect(subscriber.firstSubscribedAt).toBeInstanceOf(Date);
    expect(subscriber.lastSubscribedAt).toBeInstanceOf(Date);
    expect(subscriber.lastStatusChangedAt).toBeInstanceOf(Date);
    expect(subscriber.welcomeEmailSentAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'petya@example.com',
      subject: 'Абонамент за новини от Happy Colors',
      text: expect.stringContaining('Вие се абонирахте за новини от Happy Colors.'),
    });
    expect(sendEmail.mock.calls[0][0].text).toContain('/newsletter/unsubscribe?token=');
    expect(sendEmail.mock.calls[0][0].text).toContain('https://happycolors.eu/newsletter/unsubscribe?token=');
  });

  it('rejects invalid subscribe payloads before creating subscribers', async () => {
    const app = createExpressApp();

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.21')
      .send({ email: 'bad-email', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.221') })
      .expect(400);

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.22')
      .send({ email: 'petya@example.com', consent: false, website: '', formToken: await getSubscribeToken(app, '203.0.113.222') })
      .expect(400);

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.23')
      .send({ email: 'petya@example.com', consent: true, extra: 'nope', formToken: await getSubscribeToken(app, '203.0.113.223') })
      .expect(400);

    expect(await NewsletterSubscriber.countDocuments()).toBe(0);
  });

  it('requires JSON requests for newsletter endpoints', async () => {
    const app = createExpressApp();

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.32')
      .set('Content-Type', 'text/plain')
      .send('email=petya@example.com')
      .expect(415);
  });

  it('issues unique no-store subscribe form tokens', async () => {
    const app = createExpressApp();

    const firstToken = await getSubscribeToken(app, '203.0.113.60');
    const secondToken = await getSubscribeToken(app, '203.0.113.60');

    expect(firstToken).toBeTruthy();
    expect(secondToken).toBeTruthy();
    expect(firstToken).not.toBe(secondToken);
  });

  it('rate limits subscribe form token requests separately', async () => {
    const app = createExpressApp();
    const ip = '203.0.113.62';

    for (let index = 0; index < 30; index += 1) {
      await request(app)
        .get('/newsletter/subscribe-token')
        .set('x-forwarded-for', ip)
        .expect(200);
    }

    const res = await request(app)
      .get('/newsletter/subscribe-token')
      .set('x-forwarded-for', ip)
      .expect(429);

    expect(res.headers['retry-after']).toBeTruthy();
  });

  it('rejects real subscribe submissions without a valid form token', async () => {
    const app = createExpressApp();

    const res = await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.61')
      .send({ email: 'petya@example.com', consent: true, website: '' })
      .expect(400);

    expect(res.body.code).toBe('invalid_form_token');
    expect(await NewsletterSubscriber.countDocuments()).toBe(0);
  });

  it('does not consume the same-email quota when token validation rejects first', async () => {
    const app = createExpressApp();

    for (let index = 0; index < 3; index += 1) {
      await request(app)
        .post('/newsletter/subscribe')
        .set('x-forwarded-for', `203.0.113.${63 + index}`)
        .send({
          email: 'token-retry@example.com',
          consent: true,
          website: '',
          formToken: 'invalid-token',
        })
        .expect(400);
    }

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.66')
      .send({
        email: 'token-retry@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.67'),
      })
      .expect(200);

    expect(await NewsletterSubscriber.countDocuments({ email: 'token-retry@example.com' })).toBe(1);
  });

  it('treats honeypot submissions as generic success without creating a subscriber', async () => {
    const app = createExpressApp();

    const res = await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.24')
      .send({
        email: 'petya@example.com',
        consent: true,
        website: 'https://bot.example',
      })
      .expect(200);

    expect(res.body.message).toBeTruthy();
    expect(await NewsletterSubscriber.countDocuments()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('lets honeypot submissions skip form tokens and same-email quota', async () => {
    const app = createExpressApp();

    for (let index = 0; index < 4; index += 1) {
      await request(app)
        .post('/newsletter/subscribe')
        .set('x-forwarded-for', `203.0.113.${68 + index}`)
        .send({
          email: 'honeypot-quota@example.com',
          consent: true,
          website: 'https://bot.example',
        })
        .expect(200);
    }

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.72')
      .send({
        email: 'honeypot-quota@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.73'),
      })
      .expect(200);

    expect(await NewsletterSubscriber.countDocuments({ email: 'honeypot-quota@example.com' })).toBe(1);
  });

  it('rate limits repeated attempts for the same email after token validation', async () => {
    const app = createExpressApp();

    for (let index = 0; index < 3; index += 1) {
      await request(app)
        .post('/newsletter/subscribe')
        .set('x-forwarded-for', `203.0.113.${140 + index}`)
        .send({
          email: 'same-email@example.com',
          consent: true,
          website: '',
          formToken: await getSubscribeToken(app, `203.0.113.${150 + index}`),
        })
        .expect(200);
    }

    const res = await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.144')
      .send({
        email: 'same-email@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.154'),
      })
      .expect(429);

    expect(res.headers['retry-after']).toBeTruthy();
  });

  it('handles duplicate active subscriptions without changing the token version', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber({ unsubscribeTokenVersion: 4 });

    const res = await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.25')
      .send({ email: 'petya@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.224') })
      .expect(200);

    const updated = await NewsletterSubscriber.findById(subscriber._id);

    expect(await NewsletterSubscriber.countDocuments()).toBe(1);
    expect(updated.unsubscribeTokenVersion).toBe(4);
    expect(updated.status).toBe('active');
    expect(updated.subscribeCount).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(res.body.message).toBeTruthy();
    expect(res.body.status).toBeUndefined();
  });

  it('retries the welcome email for active subscribers when it was not sent yet', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber({ welcomeEmailSentAt: null });

    const res = await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.34')
      .send({ email: 'petya@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.225') })
      .expect(200);

    const updated = await NewsletterSubscriber.findById(subscriber._id);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'petya@example.com',
        subject: 'Абонамент за новини от Happy Colors',
      })
    );
    expect(updated.welcomeEmailSentAt).toBeInstanceOf(Date);
    expect(res.body.message).toBeTruthy();
  });

  it('leaves welcome email pending when delivery fails so a later submit can retry it', async () => {
    const app = createExpressApp();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sendEmail.mockRejectedValueOnce(new Error('smtp down'));

    try {
      await request(app)
        .post('/newsletter/subscribe')
        .set('x-forwarded-for', '203.0.113.35')
        .send({ email: 'retry@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.226') })
        .expect(500);
    } finally {
      consoleErrorSpy.mockRestore();
    }

    const pending = await NewsletterSubscriber.findOne({ email: 'retry@example.com' });
    expect(pending.status).toBe('active');
    expect(pending.welcomeEmailSentAt).toBeNull();

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.36')
      .send({ email: 'retry@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.227') })
      .expect(200);

    const updated = await NewsletterSubscriber.findById(pending._id);
    expect(updated.welcomeEmailSentAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('reactivates an unsubscribed address with new consent and invalidates old tokens', async () => {
    const app = createExpressApp();
    const unsubscribedAt = new Date('2026-01-01T00:00:00.000Z');
    const subscriber = await createSubscriber({
      status: 'unsubscribed',
      unsubscribedAt,
      unsubscribeTokenVersion: 2,
      welcomeEmailSentAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const oldToken = createUnsubscribeToken(subscriber);

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.26')
      .send({ email: 'petya@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.228') })
      .expect(200);

    const reactivated = await NewsletterSubscriber.findById(subscriber._id);

    expect(reactivated.status).toBe('active');
    expect(reactivated.unsubscribedAt).toBeNull();
    expect(reactivated.unsubscribeTokenVersion).toBe(3);
    expect(reactivated.subscribeCount).toBe(2);
    expect(reactivated.hasEverUnsubscribed).toBe(true);
    expect(reactivated.lastSubscribedAt).toBeInstanceOf(Date);
    expect(reactivated.lastStatusChangedAt).toBeInstanceOf(Date);
    expect(reactivated.consentGivenAt.getTime()).toBeGreaterThan(unsubscribedAt.getTime());
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'petya@example.com',
        subject: 'Абонамент за новини от Happy Colors',
      })
    );

    await request(app)
      .post('/newsletter/unsubscribe')
      .set('x-forwarded-for', '203.0.113.27')
      .send({ token: oldToken })
      .expect(200);

    const afterStaleToken = await NewsletterSubscriber.findById(subscriber._id);
    expect(afterStaleToken.status).toBe('active');
  });

  it('rate limits newsletter subscribe without consuming the contacts quota', async () => {
    const app = createExpressApp();
    const ip = '203.0.113.28';

    for (let index = 0; index < 5; index += 1) {
      await request(app)
        .post('/newsletter/subscribe')
        .set('x-forwarded-for', ip)
        .send({ email: `petya-${index}@example.com`, consent: true, website: '', formToken: await getSubscribeToken(app, `203.0.113.${80 + index}`) })
        .expect(200);
    }

    const rateLimited = await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', ip)
      .send({ email: 'petya-limited@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.90') })
      .expect(429);

    expect(rateLimited.headers['retry-after']).toBeTruthy();

    await request(app)
      .post('/contacts')
      .set('x-forwarded-for', ip)
      .send({
        name: 'Petya',
        email: 'petya@example.com',
        message: 'Newsletter attempts should not consume contacts.',
      })
      .expect(200);
  });

  it('keeps newsletter subscription available when catalog mode is enabled', async () => {
    const previousCatalogMode = process.env.CATALOG_MODE;
    process.env.CATALOG_MODE = 'true';
    const app = createExpressApp();

    try {
      await request(app)
        .post('/newsletter/subscribe')
        .set('x-forwarded-for', '203.0.113.33')
        .send({ email: 'catalog@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.229') })
        .expect(200);
    } finally {
      if (previousCatalogMode === undefined) {
        delete process.env.CATALOG_MODE;
      } else {
        process.env.CATALOG_MODE = previousCatalogMode;
      }
    }
  });

  it('unsubscribes with a valid token and treats repeated or invalid tokens generically', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber();
    const token = createUnsubscribeToken(subscriber);

    await request(app)
      .post('/newsletter/unsubscribe')
      .set('x-forwarded-for', '203.0.113.29')
      .send({ token })
      .expect(200);

    const unsubscribed = await NewsletterSubscriber.findById(subscriber._id);
    expect(unsubscribed.status).toBe('unsubscribed');
    expect(unsubscribed.unsubscribedAt).toBeInstanceOf(Date);
    expect(unsubscribed.hasEverUnsubscribed).toBe(true);
    expect(unsubscribed.lastStatusChangedAt).toBeInstanceOf(Date);

    await request(app)
      .post('/newsletter/unsubscribe')
      .set('x-forwarded-for', '203.0.113.29')
      .send({ token })
      .expect(200);

    await request(app)
      .post('/newsletter/unsubscribe')
      .set('x-forwarded-for', '203.0.113.30')
      .send({ token: 'not-a-valid-token' })
      .expect(200);
  });

  it('supports direct one-click unsubscribe POST requests from email clients', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber({ email: 'one-click@example.com' });
    const token = createUnsubscribeToken(subscriber);

    await request(app)
      .post(`/newsletter/unsubscribe/one-click?token=${encodeURIComponent(token)}`)
      .set('x-forwarded-for', '203.0.113.32')
      .type('form')
      .send({ 'List-Unsubscribe': 'One-Click' })
      .expect(200);

    const unsubscribed = await NewsletterSubscriber.findById(subscriber._id);
    expect(unsubscribed.status).toBe('unsubscribed');
    expect(unsubscribed.unsubscribedAt).toBeInstanceOf(Date);
  });

  it('redirects one-click unsubscribe GET requests to the public confirmation page', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber({ email: 'one-click-get@example.com' });
    const token = createUnsubscribeToken(subscriber);

    const res = await request(app)
      .get(`/newsletter/unsubscribe/one-click?token=${encodeURIComponent(token)}`)
      .set('x-forwarded-for', '203.0.113.34')
      .expect(302);

    expect(res.headers.location).toBe(`https://happycolors.eu/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
  });

  it('rate limits unsubscribe attempts separately', async () => {
    const app = createExpressApp();
    const ip = '203.0.113.31';

    for (let index = 0; index < 10; index += 1) {
      await request(app)
        .post('/newsletter/unsubscribe')
        .set('x-forwarded-for', ip)
        .send({ token: 'not-a-valid-token' })
        .expect(200);
    }

    const res = await request(app)
      .post('/newsletter/unsubscribe')
      .set('x-forwarded-for', ip)
      .send({ token: 'not-a-valid-token' })
      .expect(429);

    expect(res.headers['retry-after']).toBeTruthy();
  });
});
