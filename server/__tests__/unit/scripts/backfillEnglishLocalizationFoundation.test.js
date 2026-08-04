import { describe, expect, it, vi } from 'vitest';
import {
  backfillCategorySlugs,
  backfillEnglishLocalizationFoundation,
  runMigrationCli,
} from '../../../../scripts/backfillEnglishLocalizationFoundation.js';

function matchesCondition(value, condition, hasKey) {
  if (Array.isArray(condition)) {
    return Array.isArray(value) &&
      JSON.stringify(value) === JSON.stringify(condition);
  }

  if (!condition || typeof condition !== 'object') {
    return value === condition;
  }

  if (Object.prototype.hasOwnProperty.call(condition, '$exists')) {
    return condition.$exists ? hasKey : !hasKey;
  }

  if (Array.isArray(condition.$nin)) {
    return !condition.$nin.includes(value);
  }

  if (Array.isArray(condition.$in)) {
    return condition.$in.map(String).includes(String(value));
  }

  return false;
}

function matchesFilter(doc, filter = {}) {
  if (
    Array.isArray(filter.$or) &&
    !filter.$or.some((childFilter) => matchesFilter(doc, childFilter))
  ) {
    return false;
  }

  return Object.entries(filter)
    .filter(([key]) => key !== '$or')
    .every(([key, condition]) => {
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
  const buildFindQuery = (filter = {}) => {
    let result = docs.filter((doc) => matchesFilter(doc, filter));

    const query = {
      sort: vi.fn(() => {
        result = [...result].sort((a, b) => String(a._id).localeCompare(String(b._id)));
        return query;
      }),
      limit: vi.fn((limit) => {
        result = result.slice(0, limit);
        return query;
      }),
      lean: vi.fn(async () => result.map((doc) => ({ ...doc }))),
    };

    return query;
  };

  return {
    docs,
    countDocuments: vi.fn(async (filter) => docs.filter((doc) => matchesFilter(doc, filter)).length),
    find: vi.fn((filter) => buildFindQuery(filter)),
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
    bulkWrite: vi.fn(async (operations) => {
      let modifiedCount = 0;

      for (const operation of operations) {
        const { filter, update } = operation.updateOne;
        const doc = docs.find((item) => matchesFilter(item, filter));

        if (doc) {
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
    ProductModel: buildFakeModel([
      { _id: 'product-1' },
      { _id: 'product-2', sourceRevision: 3 },
      {
        _id: 'product-3',
        sourceRevision: 7,
        translations: {
          en: {
            title: 'Existing English title',
          },
        },
      },
    ]),
    CategoryModel: buildFakeModel([
      { _id: 'category-1', slug: 'toys' },
    ]),
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
  it('reports bounded pending records without mutating in dry-run mode', async () => {
    const models = buildModels();

    const result = await backfillEnglishLocalizationFoundation({
      batchSize: 1,
      dryRun: true,
      models,
    });

    expect(result).toMatchObject({
      dryRun: true,
      batchSize: 1,
      sourceRevision: {
        products: { pending: 1, selected: 1, updated: 0, remaining: 1 },
      },
      translationStorage: {
        products: { pending: 2, selected: 1, updated: 0, remaining: 2 },
      },
      categorySlugs: {
        pending: 1,
        selected: 1,
        updated: 0,
        remaining: 1,
        collisionCount: 0,
      },
      newsletterSubscribers: {
        preferredLocale: { pending: 2, selected: 1, updated: 0, remaining: 2 },
      },
      cartoonOrders: {
        customerLocale: { pending: 2, selected: 1, updated: 0, remaining: 2 },
      },
    });
    expect(models.ProductModel.updateMany).not.toHaveBeenCalled();
    expect(models.CategoryModel.bulkWrite).not.toHaveBeenCalled();
    expect(models.NewsletterSubscriberModel.updateMany).not.toHaveBeenCalled();
  });

  it('backfills missing localization fields and is idempotent', async () => {
    const models = buildModels();

    const firstRun = await backfillEnglishLocalizationFoundation({ models });
    const secondRun = await backfillEnglishLocalizationFoundation({ models });

    expect(firstRun.sourceRevision).toMatchObject({
      products: { pending: 1, updated: 1, remaining: 0 },
      categories: { pending: 1, updated: 1, remaining: 0 },
      blogArticles: { pending: 1, updated: 1, remaining: 0 },
      homeBanners: { pending: 1, updated: 1, remaining: 0 },
    });
    expect(models.ProductModel.docs[0]).toMatchObject({
      sourceRevision: 1,
      translations: {},
    });
    expect(models.ProductModel.docs[1]).toMatchObject({
      sourceRevision: 3,
      translations: {},
    });
    expect(models.ProductModel.docs[2]).toEqual({
      _id: 'product-3',
      sourceRevision: 7,
      translations: {
        en: {
          title: 'Existing English title',
        },
      },
    });
    expect(models.CategoryModel.docs[0]).toMatchObject({
      canonicalSlug: 'toys',
      canonicalSlugReviewed: false,
      slugAliases: ['toys'],
      translations: {},
    });
    expect(models.BlogArticleModel.docs[0]).toMatchObject({
      translations: {},
      translationDrafts: {},
    });
    expect(models.HomeBannerModel.docs[0]).toMatchObject({
      translations: {},
      translationDrafts: {},
    });
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

    expect(secondRun.sourceRevision.products).toMatchObject({ pending: 0, updated: 0 });
    expect(secondRun.translationStorage.products).toMatchObject({ pending: 0, updated: 0 });
    expect(secondRun.categorySlugs).toMatchObject({ pending: 0, updated: 0 });
    expect(secondRun.newsletterSubscribers.preferredLocale).toMatchObject({
      pending: 0,
      updated: 0,
    });
    expect(secondRun.cartoonOrders.customerLocale).toMatchObject({ pending: 0, updated: 0 });
  });

  it('continues large collections through bounded reruns', async () => {
    const models = buildModels();

    const firstRun = await backfillEnglishLocalizationFoundation({
      batchSize: 1,
      models,
    });
    const secondRun = await backfillEnglishLocalizationFoundation({
      batchSize: 1,
      models,
    });

    expect(firstRun.translationStorage.products).toMatchObject({
      pending: 2,
      selected: 1,
      updated: 1,
      remaining: 1,
    });
    expect(secondRun.translationStorage.products).toMatchObject({
      pending: 1,
      selected: 1,
      updated: 1,
      remaining: 0,
    });
  });

  it('reports category slug collisions without exposing category content', async () => {
    const CategoryModel = buildFakeModel([
      { _id: 'category-1', name: 'Private source name', slug: 'toys' },
      {
        _id: 'category-2',
        slug: 'decor',
        canonicalSlug: 'toys',
        canonicalSlugReviewed: true,
        slugAliases: ['decor'],
      },
    ]);

    const result = await backfillCategorySlugs({
      CategoryModel,
      dryRun: true,
    });

    expect(result.collisionCount).toBe(2);
    expect(result.collisions).toEqual([
      {
        entityId: 'category-1',
        field: 'canonicalSlug',
        candidate: 'toys',
        reason: 'slug_collision',
        conflictingEntityIds: ['category-2'],
      },
      {
        entityId: 'category-1',
        field: 'slugAliases',
        candidate: 'toys',
        reason: 'slug_collision',
        conflictingEntityIds: ['category-2'],
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('Private source name');
  });

  it('leaves collided category slugs unchanged and reports terminal manual work on rerun', async () => {
    const CategoryModel = buildFakeModel([
      { _id: 'category-1', slug: 'toys' },
      {
        _id: 'category-2',
        slug: 'decor',
        canonicalSlug: 'toys',
        canonicalSlugReviewed: true,
        slugAliases: ['decor'],
      },
    ]);

    const firstRun = await backfillCategorySlugs({
      CategoryModel,
      dryRun: false,
    });
    const secondRun = await backfillCategorySlugs({
      CategoryModel,
      dryRun: false,
    });

    expect(CategoryModel.docs[0]).toMatchObject({
      slug: 'toys',
      canonicalSlugReviewed: false,
    });
    expect(CategoryModel.docs[0]).not.toHaveProperty('canonicalSlug');
    expect(CategoryModel.docs[0]).not.toHaveProperty('slugAliases');
    expect(CategoryModel.docs[1]).toEqual({
      _id: 'category-2',
      slug: 'decor',
      canonicalSlug: 'toys',
      canonicalSlugReviewed: true,
      slugAliases: ['decor'],
    });
    expect(firstRun).toMatchObject({
      updated: 1,
      remaining: 1,
      actionableRemaining: 0,
      blocked: 1,
      collisionCount: 2,
    });
    expect(secondRun).toMatchObject({
      selected: 0,
      updated: 0,
      remaining: 1,
      actionableRemaining: 0,
      blocked: 1,
      collisionCount: 2,
    });
  });

  it('does not overwrite category fields changed after the migration snapshot', async () => {
    const CategoryModel = buildFakeModel([
      { _id: 'category-1', slug: 'toys' },
    ]);
    const applyBulkWrite = CategoryModel.bulkWrite;

    CategoryModel.bulkWrite = vi.fn(async (operations) => {
      Object.assign(CategoryModel.docs[0], {
        canonicalSlug: 'admin-selected',
        canonicalSlugReviewed: true,
        slugAliases: ['toys'],
      });

      return applyBulkWrite(operations);
    });

    const result = await backfillCategorySlugs({ CategoryModel });

    expect(result).toMatchObject({
      selected: 1,
      updated: 0,
      remaining: 0,
      actionableRemaining: 0,
      blocked: 0,
    });
    expect(CategoryModel.docs[0]).toEqual({
      _id: 'category-1',
      slug: 'toys',
      canonicalSlug: 'admin-selected',
      canonicalSlugReviewed: true,
      slugAliases: ['toys'],
    });
    expect(CategoryModel.bulkWrite.mock.calls[0][0][0].updateOne.filter).toEqual({
      _id: 'category-1',
      canonicalSlugReviewed: { $exists: false },
      canonicalSlug: { $exists: false },
      slugAliases: { $exists: false },
    });
  });

  it('continues provisional category slugs through bounded reruns', async () => {
    const CategoryModel = buildFakeModel([
      { _id: 'category-1', slug: 'toys' },
      { _id: 'category-2', slug: 'gifts' },
    ]);

    const firstRun = await backfillCategorySlugs({
      CategoryModel,
      batchSize: 1,
    });
    const secondRun = await backfillCategorySlugs({
      CategoryModel,
      batchSize: 1,
    });

    expect(firstRun).toMatchObject({
      pending: 2,
      selected: 1,
      updated: 1,
      remaining: 1,
      actionableRemaining: 1,
      blocked: 0,
    });
    expect(secondRun).toMatchObject({
      pending: 1,
      selected: 1,
      updated: 1,
      remaining: 0,
      actionableRemaining: 0,
      blocked: 0,
    });
    expect(CategoryModel.docs).toEqual([
      expect.objectContaining({
        canonicalSlug: 'toys',
        canonicalSlugReviewed: false,
        slugAliases: ['toys'],
      }),
      expect.objectContaining({
        canonicalSlug: 'gifts',
        canonicalSlugReviewed: false,
        slugAliases: ['gifts'],
      }),
    ]);
  });

  it('rejects unbounded or invalid batch sizes', async () => {
    const models = buildModels();

    await expect(
      backfillEnglishLocalizationFoundation({ batchSize: 0, models })
    ).rejects.toThrow('batchSize must be an integer between 1 and 1000.');
    await expect(
      backfillEnglishLocalizationFoundation({ batchSize: 1001, models })
    ).rejects.toThrow('batchSize must be an integer between 1 and 1000.');
  });

  it('keeps the CLI dry-run by default and returns a nonzero status until work is complete', async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const runMigration = vi.fn(async ({ dryRun, batchSize }) => ({
      dryRun,
      batchSize,
      sourceRevision: {
        products: { remaining: 2 },
      },
      translationStorage: {},
      categorySlugs: {
        actionableRemaining: 0,
        blocked: 1,
      },
      newsletterSubscribers: {},
      cartoonOrders: {},
    }));

    const exitCode = await runMigrationCli({
      argv: ['--batch-size=25'],
      runMigration,
      stdout,
      stderr,
    });
    const output = JSON.parse(stdout.mock.calls[0][0]);

    expect(exitCode).toBe(2);
    expect(runMigration).toHaveBeenCalledWith({
      dryRun: true,
      batchSize: 25,
    });
    expect(output.execution).toEqual({
      mode: 'dry-run',
      complete: false,
      requiresWrite: true,
      requiresRerun: false,
      manualResolutionRequired: true,
      automaticRemaining: 2,
      blockedCategoryCount: 1,
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it('requires explicit write mode and reports completed CLI runs with exit zero', async () => {
    const stdout = vi.fn();
    const runMigration = vi.fn(async ({ dryRun, batchSize }) => ({
      dryRun,
      batchSize,
      sourceRevision: {},
      translationStorage: {},
      categorySlugs: {
        actionableRemaining: 0,
        blocked: 0,
      },
      newsletterSubscribers: {},
      cartoonOrders: {},
    }));

    const exitCode = await runMigrationCli({
      argv: ['--write', '--batch-size=10'],
      runMigration,
      stdout,
      stderr: vi.fn(),
    });
    const output = JSON.parse(stdout.mock.calls[0][0]);

    expect(exitCode).toBe(0);
    expect(runMigration).toHaveBeenCalledWith({
      dryRun: false,
      batchSize: 10,
    });
    expect(output.execution).toMatchObject({
      mode: 'write',
      complete: true,
      requiresWrite: false,
      requiresRerun: false,
      manualResolutionRequired: false,
    });
  });

  it('rejects conflicting modes and invalid CLI batch sizes before connecting', async () => {
    const runMigration = vi.fn();
    const stderr = vi.fn();

    await expect(runMigrationCli({
      argv: ['--dry-run', '--write'],
      runMigration,
      stdout: vi.fn(),
      stderr,
    })).resolves.toBe(1);
    await expect(runMigrationCli({
      argv: ['--batch-size=0'],
      runMigration,
      stdout: vi.fn(),
      stderr,
    })).resolves.toBe(1);

    expect(runMigration).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenNthCalledWith(
      1,
      'Choose either --dry-run or --write, not both.'
    );
    expect(stderr).toHaveBeenNthCalledWith(
      2,
      'batchSize must be an integer between 1 and 1000.'
    );
  });
});
