import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../helpers/sendEmail.js';
import NewsletterSubscriber from '../../models/NewsletterSubscriber.js';
import {
  createNewsletterConfirmationToken,
  createSubscribeFormToken,
  createUnsubscribeToken,
} from '../../services/newsletterService.js';
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

async function waitUntil(predicate) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Timed out waiting for test condition.');
}

function extractConfirmationToken() {
  const sentText = sendEmail.mock.calls.at(-1)?.[0]?.text || '';
  const match = sentText.match(/\/(?:bg|en)\/newsletter\/confirm#token=([^\s]+)/);

  return match ? decodeURIComponent(match[1]) : '';
}

async function waitForWelcomeEmailSent(subscriberId) {
  let updatedSubscriber = null;

  await waitUntil(async () => {
    updatedSubscriber = await NewsletterSubscriber.findById(subscriberId);

    return updatedSubscriber?.welcomeEmailSentAt instanceof Date;
  });

  return updatedSubscriber;
}

describe('newsletter integration', () => {
  it('sends a confirmation email for a valid subscribe request without creating a subscriber first', async () => {
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

    await waitUntil(() => sendEmail.mock.calls.length === 1);

    expect(res.body).toEqual({
      message: 'Благодарим ви. Ако е необходимо потвърждение, ще получите имейл с линк за абонамента.',
    });
    expect(await NewsletterSubscriber.countDocuments()).toBe(0);
    expect(sendEmail).toHaveBeenCalledWith({
      to: 'petya@example.com',
      subject: 'Потвърдете абонамента си за новини от Happy Colors',
      text: expect.stringContaining('Получихме заявка за абонамент за новини от Happy Colors.'),
    });
    expect(sendEmail.mock.calls[0][0].text).toContain('/bg/newsletter/confirm#token=');
    expect(sendEmail.mock.calls[0][0].text).toContain('https://happycolors.eu/bg/newsletter/confirm#token=');
    expect(sendEmail.mock.calls[0][0].text).not.toContain('/newsletter/confirm?token=');
  });

  it('confirms a valid token and creates an active subscriber with welcome email sent', async () => {
    const app = createExpressApp();

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.120')
      .send({
        email: '  Petya@Example.COM ',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.121'),
      })
      .expect(200);

    await waitUntil(() => sendEmail.mock.calls.length === 1);
    const token = extractConfirmationToken();

    const res = await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.122')
      .send({ token })
      .expect(200);

    const subscriber = await NewsletterSubscriber.findOne({ email: 'petya@example.com' });

    expect(res.body).toEqual({ message: 'Абонаментът ви е потвърден успешно.' });
    expect(subscriber).toMatchObject({
      email: 'petya@example.com',
      status: 'active',
      unsubscribedAt: null,
      unsubscribeTokenVersion: 1,
      subscribeCount: 1,
      hasEverUnsubscribed: false,
    });
    expect(subscriber.consentGivenAt).toBeInstanceOf(Date);
    expect(subscriber.confirmedAt).toBeInstanceOf(Date);
    expect(subscriber.firstSubscribedAt).toBeInstanceOf(Date);
    expect(subscriber.lastSubscribedAt).toBeInstanceOf(Date);
    expect(subscriber.lastStatusChangedAt).toBeInstanceOf(Date);
    expect(subscriber.welcomeEmailSentAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenLastCalledWith({
      to: 'petya@example.com',
      subject: 'Абонамент за новини от Happy Colors',
      text: expect.stringContaining('Вие се абонирахте за новини от Happy Colors.'),
    });
    expect(sendEmail.mock.calls.at(-1)[0].text).toContain('/bg/newsletter/unsubscribe?token=');
  });

  it('binds English subscribe requests to English confirmation and welcome emails', async () => {
    const app = createExpressApp();

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.250')
      .send({
        email: 'english@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.251'),
        locale: 'en',
      })
      .expect(200);

    await waitUntil(() => sendEmail.mock.calls.length === 1);

    expect(sendEmail.mock.calls[0][0]).toMatchObject({
      to: 'english@example.com',
      subject: 'Confirm your Happy Colors newsletter subscription',
      text: expect.stringContaining('Please confirm your subscription here:'),
    });
    expect(sendEmail.mock.calls[0][0].text).toContain('https://happycolors.eu/en/newsletter/confirm#token=');

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.252')
      .send({ token: extractConfirmationToken() })
      .expect(200);

    const subscriber = await NewsletterSubscriber.findOne({ email: 'english@example.com' });

    expect(subscriber.preferredLocale).toBe('en');
    expect(sendEmail).toHaveBeenLastCalledWith({
      to: 'english@example.com',
      subject: 'Happy Colors newsletter subscription',
      text: expect.stringContaining('You are subscribed to Happy Colors news.'),
    });
    expect(sendEmail.mock.calls.at(-1)[0].text).toContain('/en/newsletter/unsubscribe?token=');
  });

  it('keeps repeated confirmation idempotent for active subscribers', async () => {
    const app = createExpressApp();
    const token = createNewsletterConfirmationToken('repeat@example.com');

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.123')
      .send({ token })
      .expect(200);

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.124')
      .send({ token })
      .expect(200);

    const subscriber = await NewsletterSubscriber.findOne({ email: 'repeat@example.com' });

    expect(subscriber.subscribeCount).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('retries welcome email when confirming an active subscriber whose welcome is still pending', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber({ email: 'pending-welcome@example.com', welcomeEmailSentAt: null });
    const token = createNewsletterConfirmationToken('pending-welcome@example.com', subscriber);

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.125')
      .send({ token })
      .expect(200);

    const updated = await NewsletterSubscriber.findById(subscriber._id);

    expect(updated.status).toBe('active');
    expect(updated.subscribeCount).toBe(1);
    expect(updated.welcomeEmailSentAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledTimes(1);
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

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.132')
      .set('Content-Type', 'text/plain')
      .send('token=abc')
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

  it('rejects missing, malformed, subscribe-form, and unsubscribe tokens at confirmation', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber();

    for (const [token, ip] of [
      [undefined, '203.0.113.230'],
      ['not-a-token', '203.0.113.231'],
      [createSubscribeFormToken(), '203.0.113.232'],
      [createUnsubscribeToken(subscriber), '203.0.113.233'],
    ]) {
      const res = await request(app)
        .post('/newsletter/confirm')
        .set('x-forwarded-for', ip)
        .send(token === undefined ? {} : { token })
        .expect(400);

      expect(res.body.code).toBe('invalid_confirmation_token');
    }
  });

  it('rejects expired confirmation tokens with a non-enumerating code', async () => {
    const app = createExpressApp();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2000-01-01T00:00:00.000Z'));
    const expiredToken = createNewsletterConfirmationToken('expired@example.com');
    vi.useRealTimers();

    try {
      const res = await request(app)
        .post('/newsletter/confirm')
        .set('x-forwarded-for', '203.0.113.234')
        .send({ token: expiredToken })
        .expect(400);

      expect(res.body.code).toBe('expired_confirmation_token');
    } finally {
      vi.useRealTimers();
    }
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

    await waitUntil(() => sendEmail.mock.calls.length === 1);
    expect(await NewsletterSubscriber.countDocuments({ email: 'token-retry@example.com' })).toBe(0);
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

    await waitUntil(() => sendEmail.mock.calls.length === 1);
    expect(await NewsletterSubscriber.countDocuments({ email: 'honeypot-quota@example.com' })).toBe(0);
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

  it('changes an active subscriber newsletter language only after confirming the latest request', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber({
      email: 'language-change@example.com',
      preferredLocale: 'bg',
      localeChangeRequestVersion: 1,
    });

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.253')
      .send({
        email: 'language-change@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.254'),
        locale: 'en',
      })
      .expect(200);

    await waitUntil(() => sendEmail.mock.calls.length === 1);
    const staleToken = extractConfirmationToken();
    let pending = await NewsletterSubscriber.findById(subscriber._id);

    expect(pending).toMatchObject({
      preferredLocale: 'bg',
      pendingPreferredLocale: 'en',
      localeChangeRequestVersion: 2,
    });

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.255')
      .send({
        email: 'language-change@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.256'),
        locale: 'en',
      })
      .expect(200);

    await waitUntil(() => sendEmail.mock.calls.length === 2);
    const latestToken = extractConfirmationToken();

    const staleRes = await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.257')
      .send({ token: staleToken })
      .expect(400);

    expect(staleRes.body.code).toBe('invalid_locale_change_token');

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.258')
      .send({ token: latestToken })
      .expect(200);

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.264')
      .send({ token: latestToken })
      .expect(200);

    pending = await NewsletterSubscriber.findById(subscriber._id);

    expect(pending).toMatchObject({
      preferredLocale: 'en',
      pendingPreferredLocale: null,
    });
    expect(pending.pendingLocaleRequestedAt).toBeNull();
  });

  it('clears pending language changes when the latest subscribe request keeps the current locale', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber({
      email: 'language-cancel@example.com',
      preferredLocale: 'bg',
      pendingPreferredLocale: 'en',
      pendingLocaleRequestedAt: new Date(),
      localeChangeRequestVersion: 2,
    });
    const staleToken = createNewsletterConfirmationToken('language-cancel@example.com', subscriber, {
      locale: 'en',
      localeChangeRequestVersion: 2,
    });

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.261')
      .send({
        email: 'language-cancel@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.262'),
        locale: 'bg',
      })
      .expect(200);

    const updated = await NewsletterSubscriber.findById(subscriber._id);

    expect(updated).toMatchObject({
      preferredLocale: 'bg',
      pendingPreferredLocale: null,
      localeChangeRequestVersion: 3,
    });
    expect(updated.pendingLocaleRequestedAt).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();

    const staleRes = await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.263')
      .send({ token: staleToken })
      .expect(400);

    expect(staleRes.body.code).toBe('invalid_locale_change_token');
  });

  it('rejects unsupported newsletter subscription locales', async () => {
    const app = createExpressApp();

    const res = await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.259')
      .send({
        email: 'locale@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.260'),
        locale: 'fr',
      })
      .expect(400);

    expect(res.body.code).toBe('invalid_newsletter_locale');
    expect(await NewsletterSubscriber.countDocuments({ email: 'locale@example.com' })).toBe(0);
  });

  it('retries the welcome email for active subscribers when it was not sent yet', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber({ welcomeEmailSentAt: null });

    const res = await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.34')
      .send({ email: 'petya@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.225') })
      .expect(200);

    const updated = await waitForWelcomeEmailSent(subscriber._id);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'petya@example.com',
        subject: 'Абонамент за новини от Happy Colors',
      })
    );
    expect(updated.welcomeEmailSentAt).toBeInstanceOf(Date);
    expect(res.body.message).toBeTruthy();
  });

  it('confirms successfully when welcome delivery fails and allows a later active submit to retry it', async () => {
    const app = createExpressApp();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await request(app)
        .post('/newsletter/subscribe')
        .set('x-forwarded-for', '203.0.113.35')
        .send({ email: 'retry@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.226') })
        .expect(200);

      await waitUntil(() => sendEmail.mock.calls.length === 1);
      const token = extractConfirmationToken();
      sendEmail.mockRejectedValueOnce(new Error('smtp down'));

      await request(app)
        .post('/newsletter/confirm')
        .set('x-forwarded-for', '203.0.113.136')
        .send({ token })
        .expect(200);
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

    const updated = await waitForWelcomeEmailSent(pending._id);
    expect(updated.welcomeEmailSentAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledTimes(3);
  });

  it('reactivates an unsubscribed address only after confirmation and invalidates old tokens', async () => {
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

    await waitUntil(() => sendEmail.mock.calls.length === 1);
    let reactivated = await NewsletterSubscriber.findById(subscriber._id);
    expect(reactivated.status).toBe('unsubscribed');

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.126')
      .send({ token: extractConfirmationToken() })
      .expect(200);

    reactivated = await NewsletterSubscriber.findById(subscriber._id);

    expect(reactivated.status).toBe('active');
    expect(reactivated.unsubscribedAt).toBeNull();
    expect(reactivated.unsubscribeTokenVersion).toBe(3);
    expect(reactivated.subscribeCount).toBe(2);
    expect(reactivated.hasEverUnsubscribed).toBe(true);
    expect(reactivated.lastSubscribedAt).toBeInstanceOf(Date);
    expect(reactivated.lastStatusChangedAt).toBeInstanceOf(Date);
    expect(reactivated.consentGivenAt.getTime()).toBeGreaterThan(unsubscribedAt.getTime());
    expect(sendEmail).toHaveBeenLastCalledWith(
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

  it('rejects replay of an existing-subscriber confirmation token after a later unsubscribe', async () => {
    const app = createExpressApp();
    const subscriber = await createSubscriber({
      status: 'unsubscribed',
      unsubscribedAt: new Date('2026-01-01T00:00:00.000Z'),
      unsubscribeTokenVersion: 2,
      welcomeEmailSentAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.240')
      .send({ email: 'petya@example.com', consent: true, website: '', formToken: await getSubscribeToken(app, '203.0.113.241') })
      .expect(200);

    await waitUntil(() => sendEmail.mock.calls.length === 1);
    const token = extractConfirmationToken();

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.242')
      .send({ token })
      .expect(200);

    const unsubscribeToken = createUnsubscribeToken(await NewsletterSubscriber.findById(subscriber._id));

    await request(app)
      .post('/newsletter/unsubscribe')
      .set('x-forwarded-for', '203.0.113.243')
      .send({ token: unsubscribeToken })
      .expect(200);

    const replay = await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.244')
      .send({ token })
      .expect(400);

    const afterReplay = await NewsletterSubscriber.findById(subscriber._id);

    expect(replay.body.code).toBe('invalid_confirmation_token');
    expect(afterReplay.status).toBe('unsubscribed');
  });

  it('rejects replay of a new-email confirmation token after a later unsubscribe through timestamp fallback', async () => {
    const app = createExpressApp();
    const token = createNewsletterConfirmationToken('fallback@example.com');

    await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.245')
      .send({ token })
      .expect(200);

    const subscriber = await NewsletterSubscriber.findOne({ email: 'fallback@example.com' });
    const unsubscribeToken = createUnsubscribeToken(subscriber);

    await request(app)
      .post('/newsletter/unsubscribe')
      .set('x-forwarded-for', '203.0.113.246')
      .send({ token: unsubscribeToken })
      .expect(200);

    const replay = await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.247')
      .send({ token })
      .expect(400);

    const afterReplay = await NewsletterSubscriber.findById(subscriber._id);

    expect(replay.body.code).toBe('invalid_confirmation_token');
    expect(afterReplay.status).toBe('unsubscribed');
  });

  it('rejects no-version confirmation tokens for unsubscribed records without an unsubscribe timestamp', async () => {
    const app = createExpressApp();
    await createSubscriber({
      email: 'missing-unsubscribed-at@example.com',
      status: 'unsubscribed',
      unsubscribedAt: null,
      unsubscribeTokenVersion: 2,
    });
    const token = createNewsletterConfirmationToken('missing-unsubscribed-at@example.com');

    const res = await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', '203.0.113.249')
      .send({ token })
      .expect(400);

    const afterConfirm = await NewsletterSubscriber.findOne({ email: 'missing-unsubscribed-at@example.com' });

    expect(res.body.code).toBe('invalid_confirmation_token');
    expect(afterConfirm.status).toBe('unsubscribed');
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

    expect(res.headers.location).toBe(`https://happycolors.eu/bg/newsletter/unsubscribe?token=${encodeURIComponent(token)}`);
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

  it('rate limits confirmation attempts separately', async () => {
    const app = createExpressApp();
    const ip = '203.0.113.248';

    for (let index = 0; index < 10; index += 1) {
      await request(app)
        .post('/newsletter/confirm')
        .set('x-forwarded-for', ip)
        .send({ token: 'not-a-valid-token' })
        .expect(400);
    }

    const res = await request(app)
      .post('/newsletter/confirm')
      .set('x-forwarded-for', ip)
      .send({ token: 'not-a-valid-token' })
      .expect(429);

    expect(res.headers['retry-after']).toBeTruthy();
  });
});
