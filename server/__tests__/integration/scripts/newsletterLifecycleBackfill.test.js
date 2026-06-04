import { describe, expect, it } from 'vitest';
import NewsletterSubscriber from '../../../models/NewsletterSubscriber.js';
import { backfillNewsletterSubscriberLifecycle } from '../../../../scripts/backfillNewsletterSubscriberLifecycle.js';

describe('newsletter lifecycle backfill script', () => {
  it('backfills legacy subscriber lifecycle fields conservatively', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const consentGivenAt = new Date('2026-02-05T00:00:00.000Z');
    const legacyRows = await NewsletterSubscriber.collection.insertMany([
      {
        email: 'legacy-reactivated@example.com',
        status: 'active',
        consentGivenAt,
        createdAt,
        updatedAt: consentGivenAt,
        firstSubscribedAt: null,
        lastSubscribedAt: null,
        lastStatusChangedAt: null,
        hasEverUnsubscribed: false,
      },
      {
        email: 'legacy-unsubscribed@example.com',
        status: 'unsubscribed',
        consentGivenAt: createdAt,
        unsubscribedAt: consentGivenAt,
        createdAt,
        updatedAt: consentGivenAt,
      },
    ]);

    const result = await backfillNewsletterSubscriberLifecycle();

    expect(result.matchedCount).toBe(2);
    const reactivated = await NewsletterSubscriber.findById(legacyRows.insertedIds[0]).lean();
    const unsubscribed = await NewsletterSubscriber.findById(legacyRows.insertedIds[1]).lean();

    expect(reactivated.firstSubscribedAt.toISOString()).toBe(createdAt.toISOString());
    expect(reactivated.lastSubscribedAt.toISOString()).toBe(consentGivenAt.toISOString());
    expect(reactivated.confirmedAt.toISOString()).toBe(consentGivenAt.toISOString());
    expect(reactivated.subscribeCount).toBe(1);
    expect(reactivated.hasEverUnsubscribed).toBe(true);
    expect(unsubscribed.hasEverUnsubscribed).toBe(true);
    expect(unsubscribed.confirmedAt.toISOString()).toBe(createdAt.toISOString());
    expect(unsubscribed.lastStatusChangedAt.toISOString()).toBe(consentGivenAt.toISOString());
  });
});
