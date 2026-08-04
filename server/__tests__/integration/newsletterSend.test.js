import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../helpers/sendEmail.js';
import NewsletterCampaign from '../../models/NewsletterCampaign.js';
import NewsletterDelivery from '../../models/NewsletterDelivery.js';
import NewsletterSubscriber from '../../models/NewsletterSubscriber.js';
import { createExpressApp } from '../../server.js';
import {
  processNewsletterCampaignDeliveries,
  scheduleOpenNewsletterCampaignProcessing,
} from '../../services/newsletterSendService.js';
import { authCookie, createBlogArticle, createProduct, createFullAdmin } from './factories.js';

const validContentJson = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hello subscribers.' }],
    },
  ],
};

function newsletterPayload(overrides = {}) {
  return {
    subject: 'Newsletter update',
    contentHtml: '<p>Hello subscribers.</p>',
    contentJson: validContentJson,
    contentText: 'Hello subscribers.',
    sourceType: 'custom',
    ...overrides,
  };
}

function newsletterLocaleContent(overrides = {}) {
  return {
    subject: 'Newsletter update',
    contentHtml: '<p>Hello subscribers.</p>',
    contentJson: validContentJson,
    contentText: 'Hello subscribers.',
    ctaLabel: 'View more',
    ...overrides,
  };
}

function localizedNewsletterPayload(overrides = {}) {
  return {
    sourceType: 'custom',
    locales: ['bg', 'en'],
    contentByLocale: {
      bg: newsletterLocaleContent({
        subject: 'Новини от Happy Colors',
        contentHtml: '<p>Здравейте, абонати.</p>',
        contentText: 'Здравейте, абонати.',
        ctaLabel: 'Виж повече',
      }),
      en: newsletterLocaleContent({
        subject: 'Happy Colors news',
        contentHtml: '<p>Hello subscribers.</p>',
        contentText: 'Hello subscribers.',
        ctaLabel: 'View more',
      }),
    },
    ...overrides,
  };
}

async function createSubscriber(overrides = {}) {
  return NewsletterSubscriber.create({
    email: 'subscriber@example.com',
    status: 'active',
    consentGivenAt: new Date(),
    confirmedAt: new Date(),
    welcomeEmailSentAt: new Date(),
    ...overrides,
  });
}

async function createCampaignSnapshot(overrides = {}) {
  return NewsletterCampaign.create({
    status: 'sending',
    sourceType: 'custom',
    sourceId: '',
    selectedLocales: ['bg'],
    subject: 'Durable newsletter',
    title: 'Durable newsletter',
    contentHtml: '<p>Durable body.</p>',
    contentText: 'Durable body.',
    contentJson: validContentJson,
    ctaPath: '/products',
    imageUrl: 'https://cdn.example.com/default-newsletter.webp',
    recipientCountsByLocale: {
      bg: 1,
      en: 0,
    },
    totalRecipients: 1,
    startedAt: new Date(),
    ...overrides,
  });
}

function createOpenManualRetryWindow() {
  const startedAt = new Date();

  return {
    startedAt,
    manualRetryClosesAt: new Date(startedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
  };
}

async function getSubscribeToken(app, ip = '203.0.113.200') {
  const res = await request(app)
    .get('/newsletter/subscribe-token')
    .set('x-forwarded-for', ip)
    .expect(200);

  return res.body.token;
}

async function waitUntil(predicate) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  throw new Error('Timed out waiting for test condition.');
}

describe('newsletter send integration', () => {
  it('requires authentication before status, test, and broadcast work', async () => {
    const app = createExpressApp();

    await request(app).get('/newsletter/send/status').expect(401);
    await request(app).post('/newsletter/send/test').send(newsletterPayload()).expect(401);
    await request(app).post('/newsletter/send').send(newsletterPayload()).expect(401);
    await request(app)
      .post('/newsletter/send/campaigns/665000000000000000000101/retry-failed')
      .send({})
      .expect(401);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(await NewsletterSubscriber.countDocuments()).toBe(0);
  });

  it('returns active subscriber counts by locale from the authenticated status endpoint', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'active@example.com' });
    await createSubscriber({ email: 'english-active@example.com', preferredLocale: 'en' });
    await createSubscriber({ email: 'unsubscribed@example.com', status: 'unsubscribed' });

    const res = await request(app)
      .get('/newsletter/send/status')
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(res.body).toEqual({
      activeSubscribers: 2,
      activeSubscribersByLocale: {
        bg: 1,
        en: 1,
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('active@example.com');
    expect(JSON.stringify(res.body)).not.toContain('english-active@example.com');
  });

  it('excludes unconfirmed subscribe attempts from newsletter send targets', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', '203.0.113.210')
      .send({
        email: 'unconfirmed@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.211'),
      })
      .expect(200);

    await waitUntil(() => sendEmail.mock.calls.length === 1);

    const res = await request(app)
      .get('/newsletter/send/status')
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(res.body).toEqual({
      activeSubscribers: 0,
      activeSubscribersByLocale: {
        bg: 0,
        en: 0,
      },
    });
    expect(await NewsletterSubscriber.countDocuments()).toBe(0);
  });

  it('sends test emails to configured recipients without subscriber data', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/newsletter/send/test')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload())
      .expect(200);

    expect(res.body).toEqual({
      message: 'Test email sent.',
      recipients: 2,
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: 'test-owner@example.com',
        subject: 'Newsletter update',
        html: expect.stringContaining('Това е тестов имейл.'),
        headers: {},
      })
    );
    expect(JSON.stringify(res.body)).not.toContain('test-owner@example.com');
  });

  it('sends every selected language variant to configured test recipients', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/newsletter/send/test')
      .set('Cookie', authCookie(owner))
      .send(localizedNewsletterPayload())
      .expect(200);

    expect(res.body).toEqual({
      message: 'Test email sent.',
      recipients: 4,
    });
    expect(sendEmail).toHaveBeenCalledTimes(4);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test-owner@example.com',
        subject: 'Новини от Happy Colors',
        html: expect.stringContaining('lang="bg"'),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test-owner@example.com',
        subject: 'Happy Colors news',
        html: expect.stringContaining('lang="en"'),
      })
    );
  });

  it('defaults legacy top-level broadcast payloads without locales to Bulgarian subscribers only', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'legacy-bg@example.com', preferredLocale: 'bg' });
    await createSubscriber({ email: 'legacy-en@example.com', preferredLocale: 'en' });

    const res = await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload())
      .expect(200);

    expect(res.body).toMatchObject({
      sent: 1,
      failed: 0,
      activeSubscribers: 1,
      activeSubscribersByLocale: {
        bg: 1,
        en: 0,
      },
    });
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'legacy-bg@example.com' }));
    expect(sendEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'legacy-en@example.com' }));
  });

  it('rejects test send when test recipients are not configured', async () => {
    const previousRecipients = process.env.NEWSLETTER_TEST_RECIPIENTS;
    process.env.NEWSLETTER_TEST_RECIPIENTS = '';
    const app = createExpressApp();
    const owner = await createFullAdmin();

    try {
      await request(app)
        .post('/newsletter/send/test')
        .set('Cookie', authCookie(owner))
        .send(newsletterPayload())
        .expect(422);
    } finally {
      process.env.NEWSLETTER_TEST_RECIPIENTS = previousRecipients;
    }

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('broadcasts to active subscribers only and keeps subscriber data out of the response', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'first@example.com' });
    await createSubscriber({ email: 'second@example.com' });
    await createSubscriber({ email: 'skipped@example.com', status: 'unsubscribed' });

    const res = await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload())
      .expect(200);

    expect(res.body).toEqual({
      message: 'Newsletter send finished.',
      campaignStatus: 'completed',
      sent: 2,
      failed: 0,
      skipped: 0,
      pendingRetries: 0,
      nextProcessAt: null,
      activeSubscribers: 2,
      activeSubscribersByLocale: {
        bg: 2,
        en: 0,
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'first@example.com',
        html: expect.stringContaining('https://happycolors.eu/bg/newsletter/unsubscribe?token='),
        headers: expect.objectContaining({
          'List-Unsubscribe': expect.stringContaining('https://happycolors.eu/api/newsletter/unsubscribe/one-click?token='),
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'first@example.com',
        html: expect.stringContaining('https://happycolors.eu/bg/newsletter/preferences#token='),
      })
    );
    expect(sendEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'skipped@example.com' }));
    expect(JSON.stringify(res.body)).not.toContain('first@example.com');
    expect(JSON.stringify(res.body)).not.toContain('token=');
  });

  it('persists campaign aggregates and purges per-recipient delivery details after completion', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'durable-first@example.com' });
    await createSubscriber({ email: 'durable-second@example.com', preferredLocale: 'en' });

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(localizedNewsletterPayload())
      .expect(200);

    const campaign = await NewsletterCampaign.findOne().lean();
    const deliveryCount = await NewsletterDelivery.countDocuments({ campaignId: campaign._id });

    expect(campaign).toMatchObject({
      status: 'completed',
      sourceType: 'custom',
      selectedLocales: ['bg', 'en'],
      subject: 'Новини от Happy Colors',
      ctaPath: '/products',
      totalRecipients: 2,
      sentCount: 2,
      failedCount: 0,
      skippedCount: 0,
      recipientCountsByLocale: {
        bg: 1,
        en: 1,
      },
    });
    expect(campaign.finishedAt).toBeInstanceOf(Date);
    expect(deliveryCount).toBe(0);
  });

  it('rechecks active consent immediately before processing a claimed delivery', async () => {
    const subscriber = await createSubscriber({ email: 'revoked-before-send@example.com' });
    const campaign = await createCampaignSnapshot();
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
    });
    subscriber.status = 'unsubscribed';
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    const result = await processNewsletterCampaignDeliveries(campaign._id);
    const deliveryCount = await NewsletterDelivery.countDocuments({ campaignId: campaign._id });
    const finalizedCampaign = await NewsletterCampaign.findById(campaign._id).lean();

    expect(result).toMatchObject({
      sent: 0,
      failed: 0,
      skipped: 1,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(deliveryCount).toBe(0);
    expect(finalizedCampaign).toMatchObject({
      status: 'completed',
      sentCount: 0,
      failedCount: 0,
      skippedCount: 1,
    });
  });

  it('does not resend already sent campaign deliveries on repeated processing', async () => {
    const subscriber = await createSubscriber({ email: 'single-send@example.com' });
    const campaign = await createCampaignSnapshot();
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
    });

    const firstResult = await processNewsletterCampaignDeliveries(campaign._id);
    const secondResult = await processNewsletterCampaignDeliveries(campaign._id);

    const deliveryCount = await NewsletterDelivery.countDocuments({ campaignId: campaign._id });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(firstResult).toMatchObject({
      status: 'completed',
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    expect(secondResult).toMatchObject({
      status: 'completed',
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    expect(deliveryCount).toBe(0);
  });

  it('falls back to top-level content for legacy English campaign deliveries without contentByLocale', async () => {
    const subscriber = await createSubscriber({
      email: 'legacy-english-campaign@example.com',
      preferredLocale: 'en',
    });
    const campaign = await createCampaignSnapshot({
      selectedLocales: ['en'],
      subject: 'Legacy campaign subject',
      title: 'Legacy campaign subject',
      contentHtml: '<p>Legacy campaign body.</p>',
      contentText: 'Legacy campaign body.',
      ctaLabel: 'Legacy CTA',
      recipientCountsByLocale: {
        bg: 0,
        en: 1,
      },
    });
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'en',
    });

    const result = await processNewsletterCampaignDeliveries(campaign._id);
    const sentEmail = sendEmail.mock.calls[0][0];

    expect(result).toMatchObject({
      status: 'completed',
      sent: 1,
      failed: 0,
      skipped: 0,
    });
    expect(sentEmail).toMatchObject({
      to: 'legacy-english-campaign@example.com',
      subject: 'Legacy campaign subject',
    });
    expect(sentEmail.html).toContain('Legacy campaign body.');
    expect(sentEmail.html).toContain('https://happycolors.eu/en/products');
  });

  it('keeps transient failures retryable with backoff and completes after a successful retry', async () => {
    const now = new Date('2026-07-21T10:00:00.000Z');
    const subscriber = await createSubscriber({
      email: 'retryable@example.com',
      consecutiveUndeliveredCount: 2,
    });
    const campaign = await createCampaignSnapshot({
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T10:00:00.000Z'),
    });
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
    });
    sendEmail
      .mockRejectedValueOnce(new Error('Temporary SMTP outage'))
      .mockResolvedValue({ messageId: 'retry-ok' });

    const firstResult = await processNewsletterCampaignDeliveries(campaign._id, { now });
    const failedDelivery = await NewsletterDelivery.findOne({ campaignId: campaign._id }).lean();
    const pendingCampaign = await NewsletterCampaign.findById(campaign._id).lean();
    const unchangedSubscriber = await NewsletterSubscriber.findById(subscriber._id).lean();

    expect(firstResult).toMatchObject({
      status: 'sending',
      sent: 0,
      failed: 1,
      skipped: 0,
      pendingRetries: 1,
    });
    expect(failedDelivery).toMatchObject({
      status: 'failed',
      attemptCount: 1,
      isPermanentFailure: false,
      lastErrorReason: 'Temporary SMTP outage',
    });
    expect(failedDelivery.nextAttemptAt).toEqual(new Date('2026-07-21T10:05:00.000Z'));
    expect(pendingCampaign).toMatchObject({
      status: 'sending',
      sentCount: 0,
      failedCount: 1,
      skippedCount: 0,
    });
    expect(unchangedSubscriber.consecutiveUndeliveredCount).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const earlyRetry = await processNewsletterCampaignDeliveries(campaign._id, {
      now: new Date('2026-07-21T10:04:59.000Z'),
    });

    expect(earlyRetry).toMatchObject({
      status: 'sending',
      sent: 0,
      failed: 1,
      pendingRetries: 1,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);

    const retryResult = await processNewsletterCampaignDeliveries(campaign._id, {
      now: new Date('2026-07-21T10:05:00.000Z'),
    });
    const deliveryCount = await NewsletterDelivery.countDocuments({ campaignId: campaign._id });
    const completedCampaign = await NewsletterCampaign.findById(campaign._id).lean();
    const resetSubscriber = await NewsletterSubscriber.findById(subscriber._id).lean();

    expect(retryResult).toMatchObject({
      status: 'completed',
      sent: 1,
      failed: 0,
      skipped: 0,
      pendingRetries: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(deliveryCount).toBe(0);
    expect(completedCampaign).toMatchObject({
      status: 'completed',
      sentCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
    expect(resetSubscriber.consecutiveUndeliveredCount).toBe(0);
  });

  it('recovers stale sending delivery claims without double-counting attempts', async () => {
    const now = new Date('2026-07-21T10:30:00.000Z');
    const subscriber = await createSubscriber({ email: 'stale-claim@example.com' });
    const campaign = await createCampaignSnapshot({
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T10:30:00.000Z'),
    });
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
      status: 'sending',
      claimedAt: new Date('2026-07-21T09:29:59.000Z'),
      claimToken: 'abandoned-claim',
    });

    const result = await processNewsletterCampaignDeliveries(campaign._id, { now });
    const deliveryCount = await NewsletterDelivery.countDocuments({ campaignId: campaign._id });

    expect(result).toMatchObject({
      status: 'completed',
      sent: 1,
      failed: 0,
      skipped: 0,
      pendingRetries: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(deliveryCount).toBe(0);
  });

  it('recovers legacy sending delivery claims that are missing claimedAt', async () => {
    const now = new Date('2026-07-21T10:35:00.000Z');
    const subscriber = await createSubscriber({ email: 'missing-claimed-at@example.com' });
    const campaign = await createCampaignSnapshot({
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T10:35:00.000Z'),
    });
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
      status: 'sending',
      claimedAt: null,
      claimToken: 'missing-claimed-at',
    });

    const result = await processNewsletterCampaignDeliveries(campaign._id, { now });

    expect(result).toMatchObject({
      status: 'completed',
      sent: 1,
      failed: 0,
      skipped: 0,
      pendingRetries: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(await NewsletterDelivery.countDocuments({ campaignId: campaign._id })).toBe(0);
  });

  it('rejects overlapping processing for the same campaign', async () => {
    const now = new Date('2026-07-21T10:40:00.000Z');
    const subscriber = await createSubscriber({ email: 'overlap@example.com' });
    const campaign = await createCampaignSnapshot({
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T10:40:00.000Z'),
    });
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
    });
    let releaseSend;
    sendEmail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseSend = () => resolve({ messageId: 'overlap-finished' });
        })
    );

    const firstProcess = processNewsletterCampaignDeliveries(campaign._id, { now });
    firstProcess.catch(() => {});

    await waitUntil(() => Boolean(releaseSend));

    await expect(processNewsletterCampaignDeliveries(campaign._id, { now })).rejects.toMatchObject({
      statusCode: 409,
      message: 'Newsletter campaign is already being processed.',
    });

    releaseSend();
    await firstProcess;

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('finds open campaigns during startup resume scheduling', async () => {
    const now = new Date('2026-07-21T10:45:00.000Z');
    const subscriber = await createSubscriber({ email: 'resume-scheduled@example.com' });
    const campaign = await createCampaignSnapshot({
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T10:45:00.000Z'),
    });
    await createCampaignSnapshot({
      status: 'completed',
      finishedAt: now,
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T10:45:00.000Z'),
    });
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
      status: 'failed',
      attemptCount: 1,
      nextAttemptAt: new Date('2026-07-21T10:50:00.000Z'),
      lastErrorReason: 'Will retry after restart.',
    });

    const result = await scheduleOpenNewsletterCampaignProcessing({
      now,
      scheduleTimers: false,
    });

    expect(result).toEqual({
      purgedCompletedDeliveries: 0,
      openCampaigns: 1,
      scheduledCampaigns: 1,
    });
  });

  it('purges leftover delivery details for completed campaigns during startup reconciliation', async () => {
    const now = new Date('2026-07-21T10:55:00.000Z');
    const subscriber = await createSubscriber({ email: 'completed-leftover@example.com' });
    const completedCampaign = await createCampaignSnapshot({
      status: 'completed',
      sentCount: 1,
      finishedAt: now,
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T10:55:00.000Z'),
    });
    const openCampaign = await createCampaignSnapshot({
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T10:55:00.000Z'),
    });
    await NewsletterDelivery.create({
      campaignId: completedCampaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
      status: 'sent',
      attemptCount: 1,
      sentAt: now,
    });
    await NewsletterDelivery.create({
      campaignId: openCampaign._id,
      subscriberId: subscriber._id,
      email: 'open-leftover@example.com',
      locale: 'bg',
      status: 'failed',
      attemptCount: 1,
      nextAttemptAt: new Date('2026-07-21T11:00:00.000Z'),
    });

    const result = await scheduleOpenNewsletterCampaignProcessing({
      now,
      scheduleTimers: false,
    });

    expect(result).toEqual({
      purgedCompletedDeliveries: 1,
      openCampaigns: 1,
      scheduledCampaigns: 1,
    });
    expect(await NewsletterDelivery.countDocuments({ campaignId: completedCampaign._id })).toBe(0);
    expect(await NewsletterDelivery.countDocuments({ campaignId: openCampaign._id })).toBe(1);
  });

  it('finalizes and purges a sending campaign whose deliveries reached terminal states before a crash', async () => {
    const now = new Date('2026-07-21T10:58:00.000Z');
    const sentSubscriber = await createSubscriber({ email: 'terminal-sent@example.com' });
    const skippedSubscriber = await createSubscriber({ email: 'terminal-skipped@example.com' });
    const campaign = await createCampaignSnapshot({
      startedAt: now,
      totalRecipients: 2,
      manualRetryClosesAt: new Date('2026-07-28T10:58:00.000Z'),
    });
    await NewsletterDelivery.create([
      {
        campaignId: campaign._id,
        subscriberId: sentSubscriber._id,
        email: sentSubscriber.email,
        locale: 'bg',
        status: 'sent',
        attemptCount: 1,
        sentAt: now,
        subscriberCounterUpdatedAt: now,
      },
      {
        campaignId: campaign._id,
        subscriberId: skippedSubscriber._id,
        email: skippedSubscriber.email,
        locale: 'bg',
        status: 'skipped',
        skippedAt: now,
        lastErrorReason: 'Subscriber is no longer active.',
      },
    ]);

    const scheduleResult = await scheduleOpenNewsletterCampaignProcessing({
      now,
      scheduleTimers: false,
    });
    const processResult = await processNewsletterCampaignDeliveries(campaign._id, { now });
    const finalizedCampaign = await NewsletterCampaign.findById(campaign._id).lean();

    expect(scheduleResult).toEqual({
      purgedCompletedDeliveries: 0,
      openCampaigns: 1,
      scheduledCampaigns: 1,
    });
    expect(processResult).toMatchObject({
      status: 'completed',
      sent: 1,
      failed: 0,
      skipped: 1,
      pendingRetries: 0,
    });
    expect(finalizedCampaign).toMatchObject({
      status: 'completed',
      sentCount: 1,
      failedCount: 0,
      skippedCount: 1,
    });
    expect(await NewsletterDelivery.countDocuments({ campaignId: campaign._id })).toBe(0);
  });

  it('purges leftover completed-campaign deliveries while returning persisted failure aggregates', async () => {
    const now = new Date('2026-07-21T10:59:00.000Z');
    const subscriber = await createSubscriber({ email: 'completed-failed-leftover@example.com' });
    const campaign = await createCampaignSnapshot({
      status: 'completed',
      sentCount: 0,
      failedCount: 1,
      skippedCount: 0,
      finishedAt: now,
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T10:59:00.000Z'),
    });
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
      status: 'failed',
      attemptCount: 4,
      manualAttemptCount: 1,
      lastErrorReason: 'Leftover completed failure.',
      subscriberCounterUpdatedAt: now,
    });

    const result = await processNewsletterCampaignDeliveries(campaign._id, { now });

    expect(result).toMatchObject({
      status: 'completed',
      sent: 0,
      failed: 1,
      skipped: 0,
      pendingRetries: 0,
    });
    expect(await NewsletterDelivery.countDocuments({ campaignId: campaign._id })).toBe(0);
  });

  it('increments the undelivered counter only after automatic retries and the manual window are exhausted', async () => {
    const now = new Date('2026-07-21T11:00:00.000Z');
    const subscriber = await createSubscriber({
      email: 'final-failure@example.com',
      consecutiveUndeliveredCount: 4,
    });
    const campaign = await createCampaignSnapshot({
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T11:00:00.000Z'),
    });
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
      status: 'failed',
      attemptCount: 2,
      nextAttemptAt: now,
      lastErrorReason: 'Previous retry failed.',
    });
    sendEmail.mockRejectedValue(new Error('Still unavailable'));

    const exhaustedResult = await processNewsletterCampaignDeliveries(campaign._id, { now });
    const exhaustedDelivery = await NewsletterDelivery.findOne({ campaignId: campaign._id }).lean();
    const stillUnchangedSubscriber = await NewsletterSubscriber.findById(subscriber._id).lean();
    const openCampaign = await NewsletterCampaign.findById(campaign._id).lean();

    expect(exhaustedResult).toMatchObject({
      status: 'sending',
      sent: 0,
      failed: 1,
      pendingRetries: 1,
    });
    expect(exhaustedDelivery).toMatchObject({
      status: 'failed',
      attemptCount: 3,
      isPermanentFailure: false,
      lastErrorReason: 'Still unavailable',
    });
    expect(exhaustedDelivery.nextAttemptAt).toBeNull();
    expect(openCampaign.status).toBe('sending');
    expect(stillUnchangedSubscriber.consecutiveUndeliveredCount).toBe(4);

    sendEmail.mockClear();
    const closedResult = await processNewsletterCampaignDeliveries(campaign._id, {
      now: new Date('2026-07-28T11:00:01.000Z'),
    });
    const finalizedCampaign = await NewsletterCampaign.findById(campaign._id).lean();
    const countedSubscriber = await NewsletterSubscriber.findById(subscriber._id).lean();
    const deliveryCount = await NewsletterDelivery.countDocuments({ campaignId: campaign._id });

    expect(closedResult).toMatchObject({
      status: 'completed',
      sent: 0,
      failed: 1,
      pendingRetries: 0,
    });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(finalizedCampaign).toMatchObject({
      status: 'completed',
      sentCount: 0,
      failedCount: 1,
      skippedCount: 0,
    });
    expect(countedSubscriber.consecutiveUndeliveredCount).toBe(5);
    expect(deliveryCount).toBe(0);

    await processNewsletterCampaignDeliveries(campaign._id, {
      now: new Date('2026-07-28T11:00:02.000Z'),
    });
    const countedOnceSubscriber = await NewsletterSubscriber.findById(subscriber._id).lean();

    expect(countedOnceSubscriber.consecutiveUndeliveredCount).toBe(5);
  });

  it('treats permanent failures as manual-only without automatic retry', async () => {
    const now = new Date('2026-07-21T11:30:00.000Z');
    const subscriber = await createSubscriber({ email: 'permanent@example.com' });
    const campaign = await createCampaignSnapshot({
      startedAt: now,
      manualRetryClosesAt: new Date('2026-07-28T11:30:00.000Z'),
    });
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
    });
    const permanentError = new Error('Mailbox does not exist');
    permanentError.responseCode = 550;
    sendEmail.mockRejectedValue(permanentError);

    const result = await processNewsletterCampaignDeliveries(campaign._id, { now });
    const delivery = await NewsletterDelivery.findOne({ campaignId: campaign._id }).lean();

    expect(result).toMatchObject({
      status: 'sending',
      sent: 0,
      failed: 1,
      pendingRetries: 1,
    });
    expect(delivery).toMatchObject({
      status: 'failed',
      attemptCount: 1,
      manualAttemptCount: 0,
      isPermanentFailure: true,
      lastErrorReason: 'Mailbox does not exist',
    });
    expect(delivery.nextAttemptAt).toBeNull();

    await processNewsletterCampaignDeliveries(campaign._id, {
      now: new Date('2026-07-21T11:31:00.000Z'),
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('allows one full-admin manual retry for exhausted failed deliveries', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const retryWindow = createOpenManualRetryWindow();
    const subscriber = await createSubscriber({
      email: 'manual-retry@example.com',
      consecutiveUndeliveredCount: 3,
    });
    const campaign = await createCampaignSnapshot(retryWindow);
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
      status: 'failed',
      attemptCount: 3,
      manualAttemptCount: 0,
      lastErrorReason: 'Automatic attempts exhausted.',
    });

    const res = await request(app)
      .post(`/newsletter/send/campaigns/${campaign._id}/retry-failed`)
      .set('Cookie', authCookie(owner))
      .send({})
      .expect(200);

    const deliveryCount = await NewsletterDelivery.countDocuments({ campaignId: campaign._id });
    const finalizedCampaign = await NewsletterCampaign.findById(campaign._id).lean();
    const resetSubscriber = await NewsletterSubscriber.findById(subscriber._id).lean();

    expect(res.body).toMatchObject({
      status: 'completed',
      sent: 1,
      failed: 0,
      skipped: 0,
      pendingRetries: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(deliveryCount).toBe(0);
    expect(finalizedCampaign).toMatchObject({
      status: 'completed',
      sentCount: 1,
      failedCount: 0,
      skippedCount: 0,
    });
    expect(resetSubscriber.consecutiveUndeliveredCount).toBe(0);

    await request(app)
      .post(`/newsletter/send/campaigns/${campaign._id}/retry-failed`)
      .set('Cookie', authCookie(owner))
      .send({})
      .expect(200);

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('keeps subscriber emails out of failed manual retry responses', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const retryWindow = createOpenManualRetryWindow();
    const subscriber = await createSubscriber({ email: 'manual-failure@example.com' });
    const campaign = await createCampaignSnapshot(retryWindow);
    await NewsletterDelivery.create({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
      status: 'failed',
      attemptCount: 3,
      manualAttemptCount: 0,
      lastErrorReason: 'Automatic attempts exhausted.',
    });
    sendEmail.mockRejectedValue(new Error('Manual retry still failed'));

    const res = await request(app)
      .post(`/newsletter/send/campaigns/${campaign._id}/retry-failed`)
      .set('Cookie', authCookie(owner))
      .send({})
      .expect(200);
    const deliveryCount = await NewsletterDelivery.countDocuments({ campaignId: campaign._id });

    expect(res.body).toMatchObject({
      status: 'completed',
      sent: 0,
      failed: 1,
      skipped: 0,
      pendingRetries: 0,
    });
    expect(res.body.failures).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('manual-failure@example.com');
    expect(deliveryCount).toBe(0);
  });

  it('keeps legacy failed deliveries without manualAttemptCount eligible for manual retry', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const retryWindow = createOpenManualRetryWindow();
    const now = retryWindow.startedAt;
    const subscriber = await createSubscriber({ email: 'legacy-manual@example.com' });
    const campaign = await createCampaignSnapshot(retryWindow);
    await NewsletterDelivery.collection.insertOne({
      campaignId: campaign._id,
      subscriberId: subscriber._id,
      email: subscriber.email,
      locale: 'bg',
      status: 'failed',
      attemptCount: 3,
      claimToken: '',
      lastErrorReason: 'Created before manual retry fields existed.',
      createdAt: now,
      updatedAt: now,
    });

    const res = await request(app)
      .post(`/newsletter/send/campaigns/${campaign._id}/retry-failed`)
      .set('Cookie', authCookie(owner))
      .send({})
      .expect(200);
    const deliveryCount = await NewsletterDelivery.countDocuments({ campaignId: campaign._id });

    expect(res.body).toMatchObject({
      status: 'completed',
      sent: 1,
      failed: 0,
      pendingRetries: 0,
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(deliveryCount).toBe(0);
  });

  it('rejects manual retry for invalid campaign ids before querying deliveries', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    await request(app)
      .post('/newsletter/send/campaigns/not-a-mongo-id/retry-failed')
      .set('Cookie', authCookie(owner))
      .send({})
      .expect(400);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('sends only selected language groups with localized recipient links', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'bg-selected-skip@example.com', preferredLocale: 'bg' });
    await createSubscriber({ email: 'en-selected@example.com', preferredLocale: 'en' });

    const res = await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(localizedNewsletterPayload({ locales: ['en'] }))
      .expect(200);

    expect(res.body).toEqual({
      message: 'Newsletter send finished.',
      campaignStatus: 'completed',
      sent: 1,
      failed: 0,
      skipped: 0,
      pendingRetries: 0,
      nextProcessAt: null,
      activeSubscribers: 1,
      activeSubscribersByLocale: {
        bg: 0,
        en: 1,
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'en-selected@example.com',
        html: expect.stringContaining('<html lang="en">'),
        text: expect.stringContaining('View more: https://happycolors.eu/en/products'),
        headers: expect.objectContaining({
          'List-Unsubscribe': expect.stringContaining('https://happycolors.eu/api/newsletter/unsubscribe/one-click?token='),
        }),
      })
    );
    const sentEmail = sendEmail.mock.calls[0][0];
    expect(sentEmail.html).toContain('https://happycolors.eu/en/newsletter/unsubscribe?token=');
    expect(sentEmail.html).toContain('https://happycolors.eu/en/newsletter/preferences#token=');
    expect(sendEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'bg-selected-skip@example.com' }));
    expect(JSON.stringify(res.body)).not.toContain('en-selected@example.com');
    expect(JSON.stringify(res.body)).not.toContain('token=');
  });

  it('returns a conflict while another broadcast is in progress', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'slow@example.com' });
    let releaseFirstSend;

    sendEmail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirstSend = () => resolve({ messageId: 'slow-send-finished' });
        })
    );

    const firstRequest = request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload())
      .expect(200);
    firstRequest.catch(() => {});

    await waitUntil(() => Boolean(releaseFirstSend));

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload({ subject: 'Second send' }))
      .expect(409);

    releaseFirstSend();
    await firstRequest;
  });

  it('falls back to text extracted from sanitized HTML when contentText is empty', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'html-only@example.com' });

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(
        newsletterPayload({
          contentHtml:
            '<p>Body from sanitized HTML.</p><a href="http://example.com/path">HTTP link</a><a href="/products">Relative link</a><a href="//evil.example/path">Protocol link</a><a href="https://happycolors.eu/products">HTTPS link</a><a href="mailto:hello@happycolors.eu">Mail link</a>',
          contentText: '',
        })
      )
      .expect(200);

    const sentEmail = sendEmail.mock.calls.find(([options]) => options.to === 'html-only@example.com')?.[0];

    expect(sentEmail).toEqual(
      expect.objectContaining({
        text: expect.stringContaining('Body from sanitized HTML.'),
      })
    );
    expect(sentEmail.html).not.toContain('http://example.com/path');
    expect(sentEmail.html).not.toContain('href="/products"');
    expect(sentEmail.html).not.toContain('//evil.example/path');
    expect(sentEmail.html).toContain('https://happycolors.eu/products');
    expect(sentEmail.html).toContain('mailto:hello@happycolors.eu');
  });

  it('returns a clear zero-subscriber response without sending', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload())
      .expect(200);

    expect(res.body).toEqual({
      message: 'No active subscribers.',
      sent: 0,
      failed: 0,
      skipped: 0,
      activeSubscribers: 0,
      activeSubscribersByLocale: {
        bg: 0,
        en: 0,
      },
    });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('uses a configured public image URL for custom newsletters', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'custom-image@example.com' });

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload())
      .expect(200);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'custom-image@example.com',
        html: expect.stringContaining('https://cdn.example.com/default-newsletter.webp'),
        text: expect.stringContaining('Виж повече: https://happycolors.eu/bg/products'),
      })
    );
  });

  it('falls back to the default newsletter logo path when the public newsletter image is not configured', async () => {
    const previousImageUrl = process.env.NEWSLETTER_DEFAULT_IMAGE_URL;
    process.env.NEWSLETTER_DEFAULT_IMAGE_URL = '';
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'site-og@example.com' });

    try {
      await request(app)
        .post('/newsletter/send')
        .set('Cookie', authCookie(owner))
        .send(newsletterPayload())
        .expect(200);
    } finally {
      process.env.NEWSLETTER_DEFAULT_IMAGE_URL = previousImageUrl;
    }

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'site-og@example.com',
        html: expect.stringContaining('https://happycolors.eu/logo_64pxH.svg'),
      })
    );
  });

  it('rejects authenticated newsletter mutations from untrusted browser origins before sending', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'csrf-target@example.com' });

    await request(app)
      .post('/newsletter/send/test')
      .set('Cookie', authCookie(owner))
      .set('Referer', 'https://evil.example/newsletter/send')
      .send(newsletterPayload())
      .expect(403);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .set('Referer', 'https://evil.example/newsletter/send')
      .send(newsletterPayload())
      .expect(403);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('allows authenticated newsletter mutations from the configured public site origin', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/newsletter/send/test')
      .set('Cookie', authCookie(owner))
      .set('Origin', 'https://happycolors.eu')
      .send(newsletterPayload())
      .expect(200);

    expect(res.body).toEqual({
      message: 'Test email sent.',
      recipients: 2,
    });
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('requires a trusted origin for newsletter mutations in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLIENT_URL', 'https://happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('RENDER_EXTERNAL_URL', '');
    vi.stubEnv('ALLOWED_ORIGINS', '');
    const app = createExpressApp();
    const owner = await createFullAdmin();

    try {
      await request(app)
        .post('/newsletter/send/test')
        .set('Cookie', authCookie(owner))
        .send(newsletterPayload())
        .expect(403);

      await request(app)
        .post('/newsletter/send/test')
        .set('Cookie', authCookie(owner))
        .set('Referer', 'http://localhost:3000/newsletter/send')
        .send(newsletterPayload())
        .expect(403);

      await request(app)
        .post('/newsletter/send/test')
        .set('Cookie', authCookie(owner))
        .set('Referer', 'https://happycolors.eu/newsletter/send')
        .send(newsletterPayload())
        .expect(200);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('requires a trusted origin when NODE_ENV is unset outside local development', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousClientUrl = process.env.CLIENT_URL;
    delete process.env.NODE_ENV;
    process.env.CLIENT_URL = 'https://happycolors.eu';
    const app = createExpressApp();
    const owner = await createFullAdmin();

    try {
      await request(app)
        .post('/newsletter/send/test')
        .set('Cookie', authCookie(owner))
        .send(newsletterPayload())
        .expect(403);

      await request(app)
        .post('/newsletter/send/test')
        .set('Cookie', authCookie(owner))
        .set('Origin', 'https://happycolors.eu')
        .send(newsletterPayload())
        .expect(200);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.CLIENT_URL = previousClientUrl;
    }
  });

  it('emails the owner a private failure report for partial broadcast failures', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const badSubscriber = await createSubscriber({ email: 'bad@example.com' });
    const goodSubscriber = await createSubscriber({ email: 'good@example.com', consecutiveUndeliveredCount: 2 });
    sendEmail
      .mockRejectedValueOnce(new Error('Mailbox unavailable'))
      .mockResolvedValueOnce({ messageId: 'subscriber-ok' })
      .mockResolvedValueOnce({ messageId: 'report-ok' });

    const res = await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload())
      .expect(200);

    expect(res.body).toEqual({
      message: 'Newsletter send has pending retries.',
      campaignStatus: 'sending',
      sent: 1,
      failed: 1,
      skipped: 0,
      pendingRetries: 1,
      nextProcessAt: expect.any(String),
      activeSubscribers: 2,
      activeSubscribersByLocale: {
        bg: 2,
        en: 0,
      },
    });
    expect(sendEmail).toHaveBeenLastCalledWith(
      expect.objectContaining({
        subject: 'Happy Colors newsletter delivery failures',
        text: expect.stringContaining('bad@example.com - Mailbox unavailable'),
      })
    );
    const updatedBadSubscriber = await NewsletterSubscriber.findById(badSubscriber._id).lean();
    const updatedGoodSubscriber = await NewsletterSubscriber.findById(goodSubscriber._id).lean();
    const failedDelivery = await NewsletterDelivery.findOne({ email: 'bad@example.com' }).lean();

    expect(updatedBadSubscriber.consecutiveUndeliveredCount).toBe(0);
    expect(updatedGoodSubscriber.consecutiveUndeliveredCount).toBe(0);
    expect(failedDelivery).toMatchObject({
      status: 'failed',
      attemptCount: 1,
      isPermanentFailure: false,
      lastErrorReason: 'Mailbox unavailable',
    });
    expect(failedDelivery.nextAttemptAt).toBeInstanceOf(Date);
    expect(JSON.stringify(res.body)).not.toContain('bad@example.com');
  });

  it('records token/template failures for one recipient without aborting the campaign', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'token-failure@example.com' });
    await createSubscriber({ email: 'still-sent@example.com' });
    const tokenFailure = new Error('Preference token signing failed');

    sendEmail.mockResolvedValue({ messageId: 'subscriber-ok' });
    const newsletterService = await import('../../services/newsletterService.js');
    const createPreferencesTokenSpy = vi
      .spyOn(newsletterService, 'createNewsletterPreferencesToken')
      .mockImplementationOnce(() => {
        throw tokenFailure;
      });

    try {
      const res = await request(app)
        .post('/newsletter/send')
        .set('Cookie', authCookie(owner))
        .send(newsletterPayload())
        .expect(200);

      const failedDelivery = await NewsletterDelivery.findOne({ email: 'token-failure@example.com' }).lean();
      const sentDelivery = await NewsletterDelivery.findOne({ email: 'still-sent@example.com' }).lean();
      const campaign = await NewsletterCampaign.findOne().lean();

      expect(res.body).toEqual({
        message: 'Newsletter send has pending retries.',
        campaignStatus: 'sending',
        sent: 1,
        failed: 1,
        skipped: 0,
        pendingRetries: 1,
        nextProcessAt: expect.any(String),
        activeSubscribers: 2,
        activeSubscribersByLocale: {
          bg: 2,
          en: 0,
        },
      });
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'still-sent@example.com' }));
      expect(sendEmail).toHaveBeenLastCalledWith(
        expect.objectContaining({
          subject: 'Happy Colors newsletter delivery failures',
          text: expect.stringContaining('token-failure@example.com - Preference token signing failed'),
        })
      );
      expect(failedDelivery).toMatchObject({
        status: 'failed',
        attemptCount: 1,
        lastErrorReason: 'Preference token signing failed',
      });
      expect(failedDelivery.nextAttemptAt).toBeInstanceOf(Date);
      expect(sentDelivery).toMatchObject({
        status: 'sent',
        attemptCount: 1,
      });
      expect(campaign).toMatchObject({
        status: 'sending',
        sentCount: 1,
        failedCount: 1,
        skippedCount: 0,
      });
    } finally {
      createPreferencesTokenSpy.mockRestore();
    }
  });

  it('rejects invalid payloads before sending', async () => {
    const app = createExpressApp();

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(await createFullAdmin()))
      .set('x-forwarded-for', '203.0.113.10')
      .send(newsletterPayload({ email: 'owner@example.com', password: 'should-not-be-accepted' }))
      .expect(400);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(await createFullAdmin()))
      .set('x-forwarded-for', '203.0.113.11')
      .send(newsletterPayload({ subject: 'x'.repeat(161) }))
      .expect(400);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(await createFullAdmin()))
      .set('x-forwarded-for', '203.0.113.12')
      .send(newsletterPayload({ imageUrl: 'https://evil.example/image.png' }))
      .expect(400);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(await createFullAdmin()))
      .set('x-forwarded-for', '203.0.113.13')
      .send(newsletterPayload({ sourceType: 'admin' }))
      .expect(400);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(await createFullAdmin()))
      .set('x-forwarded-for', '203.0.113.14')
      .send(newsletterPayload({ sourceType: 'product', sourceId: 'not-a-mongo-id' }))
      .expect(400);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(await createFullAdmin()))
      .set('x-forwarded-for', '203.0.113.15')
      .send(newsletterPayload({ locales: ['en', 'fr'] }))
      .expect(400);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(await createFullAdmin()))
      .set('x-forwarded-for', '203.0.113.16')
      .send(localizedNewsletterPayload({
        locales: ['bg', 'en'],
        contentByLocale: {
          bg: newsletterLocaleContent(),
        },
      }))
      .expect(400);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(await createFullAdmin()))
      .set('x-forwarded-for', '203.0.113.17')
      .send(localizedNewsletterPayload({
        contentByLocale: {
          bg: newsletterLocaleContent(),
          en: newsletterLocaleContent({ imageUrl: 'https://evil.example/nested.png' }),
        },
      }))
      .expect(400);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('accepts nullable contentJson while still validating newsletter text content', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'nullable-json@example.com' });

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload({ contentJson: null }))
      .expect(200);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'nullable-json@example.com',
        text: expect.stringContaining('Hello subscribers.'),
      })
    );
  });

  it('requires JSON content for send mutations', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .set('Content-Type', 'text/plain')
      .send('subject=Hello')
      .expect(415);
  });

  it('does not expose subscriber listing routes in V1', async () => {
    const app = createExpressApp();

    await request(app).get('/newsletter/subscribers').expect(404);
    await request(app).get('/newsletter/send/subscribers').expect(404);
    await request(app).get('/newsletter/export').expect(404);
  });

  it('requires auth for product prefill before returning product data', async () => {
    const app = createExpressApp();
    const product = await createProduct({ title: 'Private product title' });

    await request(app)
      .get(`/newsletter/send/prefill/product/${product._id}`)
      .expect(401);
  });

  it('rejects invalid product prefill ids before loading product records', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    await request(app)
      .get('/newsletter/send/prefill/product/not-a-mongo-id')
      .set('Cookie', authCookie(owner))
      .expect(400);
  });

  it('returns product prefill without subscriber data', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const product = await createProduct({
      title: 'Source Lavender Candle',
      description: 'Source handmade candle.',
      imageUrls: ['https://cdn.example.com/lavender.webp'],
      sourceRevision: 2,
      translations: {
        en: {
          title: 'Lavender Candle',
          description: 'A relaxing handmade candle.',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });

    const res = await request(app)
      .get(`/newsletter/send/prefill/product/${product._id}`)
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(res.body).toMatchObject({
      sourceType: 'product',
      sourceId: String(product._id),
      subject: 'Source Lavender Candle',
      contentHtml: '<p>Source handmade candle.</p>',
      contentText: 'Source handmade candle.',
      imageUrl: 'https://cdn.example.com/lavender.webp',
      ctaUrl: `/products/${product._id}`,
      ctaLabel: 'Виж повече',
      contentByLocale: {
        bg: {
          subject: 'Source Lavender Candle',
          contentHtml: '<p>Source handmade candle.</p>',
          contentText: 'Source handmade candle.',
          ctaLabel: 'Виж повече',
        },
        en: {
          subject: 'Lavender Candle',
          contentHtml: '<p>A relaxing handmade candle.</p>',
          contentText: 'A relaxing handmade candle.',
          ctaLabel: 'View more',
        },
      },
    });
    expect(JSON.stringify(res.body)).not.toContain('subscriber@example.com');
    expect(JSON.stringify(res.body)).not.toContain('token=');
  });

  it('re-derives product CTA and image for product broadcasts', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const product = await createProduct({
      title: 'Product Newsletter',
      imageUrls: ['https://cdn.example.com/product-newsletter.webp'],
    });
    await createSubscriber({ email: 'product-subscriber@example.com' });

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(
        newsletterPayload({
          sourceType: 'product',
          sourceId: String(product._id),
        })
      )
      .expect(200);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'product-subscriber@example.com',
        html: expect.stringContaining(`https://happycolors.eu/bg/products/${product._id}`),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('https://cdn.example.com/product-newsletter.webp'),
      })
    );
  });

  it('returns 404 for missing product sources in prefill and send', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const missingId = '665000000000000000000001';

    await request(app)
      .get(`/newsletter/send/prefill/product/${missingId}`)
      .set('Cookie', authCookie(owner))
      .expect(404);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload({ sourceType: 'product', sourceId: missingId }))
      .expect(404);
  });

  it('requires auth for blog prefill before returning article data', async () => {
    const app = createExpressApp();
    const article = await createBlogArticle({ title: 'Private article title' });

    await request(app)
      .get(`/newsletter/send/prefill/blog/${article._id}`)
      .expect(401);
  });

  it('rejects invalid blog prefill ids before loading article records', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    await request(app)
      .get('/newsletter/send/prefill/blog/not-a-mongo-id')
      .set('Cookie', authCookie(owner))
      .expect(400);
  });

  it('returns blog prefill using the first paragraph and thumbnail image', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const article = await createBlogArticle({
      title: 'Colorful story',
      contentHtml: '<p>First paragraph for subscribers.</p><p>Second paragraph.</p>',
      contentText: 'First paragraph for subscribers. Second paragraph.',
      thumbnailImageUrl: 'https://cdn.example.com/blog-thumb.webp',
      sourceRevision: 2,
      translations: {
        en: {
          title: 'Colorful story EN',
          contentHtml: '<p>First English paragraph for subscribers.</p><p>Second English paragraph.</p>',
          contentText: 'First English paragraph for subscribers. Second English paragraph.',
          heroImageAlt: 'English alt',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });

    const res = await request(app)
      .get(`/newsletter/send/prefill/blog/${article._id}`)
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(res.body).toMatchObject({
      sourceType: 'blog',
      sourceId: String(article._id),
      subject: 'Colorful story',
      contentHtml: '<p>First paragraph for subscribers.</p>',
      contentText: 'First paragraph for subscribers.',
      imageUrl: 'https://cdn.example.com/blog-thumb.webp',
      ctaUrl: `/blog/${article._id}`,
      ctaLabel: 'Виж повече',
      contentByLocale: {
        bg: {
          subject: 'Colorful story',
          contentHtml: '<p>First paragraph for subscribers.</p>',
          contentText: 'First paragraph for subscribers.',
          ctaLabel: 'Виж повече',
        },
        en: {
          subject: 'Colorful story EN',
          contentHtml: '<p>First English paragraph for subscribers.</p>',
          contentText: 'First English paragraph for subscribers.',
          ctaLabel: 'View more',
        },
      },
    });
  });

  it('skips empty leading paragraphs when building blog prefill', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const article = await createBlogArticle({
      title: 'Intro after empty paragraph',
      contentHtml: '<p><br></p><p>Real intro for subscribers.</p><p>Second paragraph.</p>',
      contentText: 'Real intro for subscribers. Second paragraph.',
    });

    const res = await request(app)
      .get(`/newsletter/send/prefill/blog/${article._id}`)
      .set('Cookie', authCookie(owner))
      .expect(200);

    expect(res.body).toMatchObject({
      contentHtml: '<p>Real intro for subscribers.</p>',
      contentText: 'Real intro for subscribers.',
    });
  });

  it('re-derives blog CTA and image for blog broadcasts', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const article = await createBlogArticle({
      title: 'Blog Newsletter',
      thumbnailImageUrl: 'https://cdn.example.com/blog-newsletter.webp',
    });
    await createSubscriber({ email: 'blog-subscriber@example.com' });

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(
        newsletterPayload({
          sourceType: 'blog',
          sourceId: String(article._id),
        })
      )
      .expect(200);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'blog-subscriber@example.com',
        html: expect.stringContaining(`https://happycolors.eu/bg/blog/${article._id}`),
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('https://cdn.example.com/blog-newsletter.webp'),
      })
    );
  });

  it('returns 404 for missing blog sources in prefill and send', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const missingId = '665000000000000000000002';

    await request(app)
      .get(`/newsletter/send/prefill/blog/${missingId}`)
      .set('Cookie', authCookie(owner))
      .expect(404);

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .send(newsletterPayload({ sourceType: 'blog', sourceId: missingId }))
      .expect(404);
  });

  it('rate limits test sends separately from public subscribe', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const ip = '203.0.113.55';

    for (let index = 0; index < 10; index += 1) {
      await request(app)
        .post('/newsletter/send/test')
        .set('Cookie', authCookie(owner))
        .set('x-forwarded-for', ip)
        .send(newsletterPayload({ subject: `Test ${index}` }))
        .expect(200);
    }

    await request(app)
      .post('/newsletter/send/test')
      .set('Cookie', authCookie(owner))
      .set('x-forwarded-for', ip)
      .send(newsletterPayload({ subject: 'Limited' }))
      .expect(429);

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', ip)
      .send({
        email: 'new-subscriber@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.201'),
      })
      .expect(200);
  });

  it('rate limits broadcasts separately from public subscribe', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const ip = '203.0.113.56';
    await createSubscriber({ email: 'rate-limited-broadcast@example.com' });

    for (let index = 0; index < 3; index += 1) {
      await request(app)
        .post('/newsletter/send')
        .set('Cookie', authCookie(owner))
        .set('x-forwarded-for', ip)
        .send(newsletterPayload({ subject: `Broadcast ${index}` }))
        .expect(200);
    }

    expect(sendEmail).toHaveBeenCalledTimes(3);

    const rateLimited = await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .set('x-forwarded-for', ip)
      .send(newsletterPayload({ subject: 'Limited broadcast' }))
      .expect(429);

    expect(rateLimited.headers['retry-after']).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledTimes(3);

    await request(app)
      .post('/newsletter/subscribe')
      .set('x-forwarded-for', ip)
      .send({
        email: 'after-broadcast-limit@example.com',
        consent: true,
        website: '',
        formToken: await getSubscribeToken(app, '203.0.113.202'),
      })
      .expect(200);
  });

  it('does not let authenticated users bypass broadcast limits by changing x-forwarded-for', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createSubscriber({ email: 'spoofed-ip-broadcast@example.com' });

    for (let index = 0; index < 3; index += 1) {
      await request(app)
        .post('/newsletter/send')
        .set('Cookie', authCookie(owner))
        .set('x-forwarded-for', `203.0.113.${60 + index}`)
        .send(newsletterPayload({ subject: `Broadcast ${index}` }))
        .expect(200);
    }

    await request(app)
      .post('/newsletter/send')
      .set('Cookie', authCookie(owner))
      .set('x-forwarded-for', '203.0.113.99')
      .send(newsletterPayload({ subject: 'Spoofed IP should still be limited' }))
      .expect(429);

    expect(sendEmail).toHaveBeenCalledTimes(3);
  });
});
