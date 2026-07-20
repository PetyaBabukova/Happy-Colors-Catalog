import { describe, expect, it, vi } from 'vitest';
import { backfillEnglishLocalizationFoundation } from '../../../../scripts/backfillEnglishLocalizationFoundation.js';

function matchesCondition(value, condition, hasKey) {
  if (!condition || typeof condition !== 'object') {
    return value === condition;
  }

  if (Object.prototype.hasOwnProperty.call(condition, '$exists')) {
    return condition.$exists ? hasKey : !hasKey;
  }

  if (Array.isArray(condition.$nin)) {
    return !condition.$nin.includes(value);
  }

  return false;
}

function matchesFilter(doc, filter) {
  if (Array.isArray(filter.$or)) {
    return filter.$or.some((childFilter) => matchesFilter(doc, childFilter));
  }

  return Object.entries(filter).every(([key, condition]) => {
    const hasKey = Object.prototype.hasOwnProperty.call(doc, key);

    return matchesCondition(doc[key], condition, hasKey);
  });
}

function applyUpdate(doc, update) {
  for (const [key, value] of Object.entries(update.$set || {})) {
    doc[key] = value;
  }
}

function buildFakeModel(initialDocs) {
  const docs = initialDocs.map((doc) => ({ ...doc }));

  return {
    docs,
    countDocuments: vi.fn(async (filter) => docs.filter((doc) => matchesFilter(doc, filter)).length),
    updateMany: vi.fn(async (filter, update) => {
      let modifiedCount = 0;

      for (const doc of docs) {
        if (matchesFilter(doc, filter)) {
          applyUpdate(doc, update);
          modifiedCount += 1;
        }
      }

      return { modifiedCount };
    }),
  };
}

function buildModels() {
  return {
    ProductModel: buildFakeModel([{ _id: 'product-1' }, { _id: 'product-2', sourceRevision: 3 }]),
    CategoryModel: buildFakeModel([{ _id: 'category-1' }]),
    BlogArticleModel: buildFakeModel([{ _id: 'article-1' }]),
    HomeBannerModel: buildFakeModel([{ _id: 'banner-1' }]),
    NewsletterSubscriberModel: buildFakeModel([
      { _id: 'subscriber-1' },
      {
        _id: 'subscriber-2',
        preferredLocale: 'en',
        pendingPreferredLocale: 'bg',
        pendingLocaleRequestedAt: new Date('2026-01-01T00:00:00.000Z'),
        localeChangeRequestVersion: 2,
        preferenceTokenVersion: 4,
        consecutiveUndeliveredCount: 1,
      },
      { _id: 'subscriber-3', preferredLocale: 'fr' },
    ]),
    CartoonOrderModel: buildFakeModel([
      { _id: 'order-1' },
      { _id: 'order-2', customerLocale: 'en' },
      { _id: 'order-3', customerLocale: 'fr' },
    ]),
  };
}

describe('backfillEnglishLocalizationFoundation', () => {
  it('reports pending records without mutating in dry-run mode', async () => {
    const models = buildModels();

    const result = await backfillEnglishLocalizationFoundation({ dryRun: true, models });

    expect(result.dryRun).toBe(true);
    expect(result.sourceRevision.products).toEqual({ pending: 1, updated: 0 });
    expect(result.newsletterSubscribers.preferredLocale).toEqual({ pending: 2, updated: 0 });
    expect(result.cartoonOrders.customerLocale).toEqual({ pending: 2, updated: 0 });
    expect(models.ProductModel.updateMany).not.toHaveBeenCalled();
    expect(models.NewsletterSubscriberModel.updateMany).not.toHaveBeenCalled();
    expect(models.CartoonOrderModel.updateMany).not.toHaveBeenCalled();
  });

  it('backfills missing localization foundation fields and is idempotent', async () => {
    const models = buildModels();

    const firstRun = await backfillEnglishLocalizationFoundation({ models });
    const secondRun = await backfillEnglishLocalizationFoundation({ models });

    expect(firstRun.sourceRevision).toMatchObject({
      products: { pending: 1, updated: 1 },
      categories: { pending: 1, updated: 1 },
      blogArticles: { pending: 1, updated: 1 },
      homeBanners: { pending: 1, updated: 1 },
    });
    expect(models.ProductModel.docs[0].sourceRevision).toBe(1);
    expect(models.ProductModel.docs[1].sourceRevision).toBe(3);

    expect(models.NewsletterSubscriberModel.docs[0]).toMatchObject({
      preferredLocale: 'bg',
      pendingPreferredLocale: null,
      pendingLocaleRequestedAt: null,
      localeChangeRequestVersion: 1,
      preferenceTokenVersion: 1,
      consecutiveUndeliveredCount: 0,
    });
    expect(models.NewsletterSubscriberModel.docs[1]).toMatchObject({
      preferredLocale: 'en',
      pendingPreferredLocale: 'bg',
      localeChangeRequestVersion: 2,
      preferenceTokenVersion: 4,
      consecutiveUndeliveredCount: 1,
    });
    expect(models.NewsletterSubscriberModel.docs[2].preferredLocale).toBe('bg');

    expect(models.CartoonOrderModel.docs[0].customerLocale).toBe('bg');
    expect(models.CartoonOrderModel.docs[1].customerLocale).toBe('en');
    expect(models.CartoonOrderModel.docs[2].customerLocale).toBe('bg');
    expect(secondRun.sourceRevision.products).toEqual({ pending: 0, updated: 0 });
    expect(secondRun.newsletterSubscribers.preferredLocale).toEqual({ pending: 0, updated: 0 });
    expect(secondRun.cartoonOrders.customerLocale).toEqual({ pending: 0, updated: 0 });
  });
});
