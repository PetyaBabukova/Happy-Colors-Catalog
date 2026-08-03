import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { backfillEnglishLocalizationFoundation } from '../../../../scripts/backfillEnglishLocalizationFoundation.js';
import BlogArticle from '../../../models/BlogArticle.js';
import CartoonOrder from '../../../models/CartoonOrder.js';
import Category from '../../../models/Category.js';
import HomeBanner from '../../../models/HomeBanner.js';
import NewsletterSubscriber from '../../../models/NewsletterSubscriber.js';
import Product from '../../../models/Product.js';

const models = {
  ProductModel: Product,
  CategoryModel: Category,
  BlogArticleModel: BlogArticle,
  HomeBannerModel: HomeBanner,
  NewsletterSubscriberModel: NewsletterSubscriber,
  CartoonOrderModel: CartoonOrder,
};

describe('English localization foundation migration', () => {
  it('is a no-op on an empty database', async () => {
    const result = await backfillEnglishLocalizationFoundation({
      batchSize: 2,
      models,
    });

    expect(result.sourceRevision.products).toMatchObject({
      pending: 0,
      updated: 0,
      remaining: 0,
    });
    expect(result.translationStorage.products).toMatchObject({
      pending: 0,
      updated: 0,
      remaining: 0,
    });
    expect(result.categorySlugs).toMatchObject({
      pending: 0,
      updated: 0,
      remaining: 0,
      collisionCount: 0,
    });
  });

  it('runs dry-run, bounded writes, and an idempotent rerun without changing Bulgarian content', async () => {
    const firstProductId = new mongoose.Types.ObjectId('660000000000000000000101');
    const secondProductId = new mongoose.Types.ObjectId('660000000000000000000102');
    const categoryId = new mongoose.Types.ObjectId('660000000000000000000103');

    await Product.collection.insertMany([
      {
        _id: firstProductId,
        title: 'Първи продукт',
        description: 'Първо описание',
      },
      {
        _id: secondProductId,
        title: 'Втори продукт',
        description: 'Второ описание',
      },
    ]);
    await Category.collection.insertOne({
      _id: categoryId,
      name: 'Подаръци',
      slug: 'podaratsi',
    });
    await BlogArticle.collection.insertOne({
      _id: new mongoose.Types.ObjectId('660000000000000000000104'),
      title: 'Блог статия',
    });
    await HomeBanner.collection.insertOne({
      _id: new mongoose.Types.ObjectId('660000000000000000000105'),
      title: 'Начален банер',
    });
    await NewsletterSubscriber.collection.insertOne({
      _id: new mongoose.Types.ObjectId('660000000000000000000106'),
      email: 'legacy@example.com',
    });
    await CartoonOrder.collection.insertOne({
      _id: new mongoose.Types.ObjectId('660000000000000000000107'),
      customer: {
        name: 'Legacy customer',
        email: 'legacy-customer@example.com',
        message: 'Legacy inquiry',
      },
    });

    const dryRun = await backfillEnglishLocalizationFoundation({
      batchSize: 1,
      dryRun: true,
      models,
    });
    const productAfterDryRun = await Product.collection.findOne({ _id: firstProductId });

    expect(dryRun.sourceRevision.products).toMatchObject({
      pending: 2,
      selected: 1,
      updated: 0,
      remaining: 2,
    });
    expect(dryRun.translationStorage.products).toMatchObject({
      pending: 2,
      selected: 1,
      updated: 0,
      remaining: 2,
    });
    expect(productAfterDryRun).not.toHaveProperty('sourceRevision');
    expect(productAfterDryRun).not.toHaveProperty('translations');

    const firstWrite = await backfillEnglishLocalizationFoundation({
      batchSize: 1,
      models,
    });

    expect(firstWrite.sourceRevision.products).toMatchObject({
      pending: 2,
      selected: 1,
      updated: 1,
      remaining: 1,
    });
    expect(firstWrite.translationStorage.products).toMatchObject({
      pending: 2,
      selected: 1,
      updated: 1,
      remaining: 1,
    });
    expect(firstWrite.categorySlugs).toMatchObject({
      pending: 1,
      selected: 1,
      updated: 1,
      remaining: 0,
      collisionCount: 0,
    });

    const secondWrite = await backfillEnglishLocalizationFoundation({
      batchSize: 1,
      models,
    });
    const finalRerun = await backfillEnglishLocalizationFoundation({
      batchSize: 1,
      models,
    });
    const migratedProducts = await Product.collection.find({}).sort({ _id: 1 }).toArray();
    const migratedCategory = await Category.collection.findOne({ _id: categoryId });
    const migratedSubscriber = await NewsletterSubscriber.collection.findOne({
      email: 'legacy@example.com',
    });
    const migratedOrder = await CartoonOrder.collection.findOne({
      _id: new mongoose.Types.ObjectId('660000000000000000000107'),
    });

    expect(secondWrite.sourceRevision.products).toMatchObject({
      pending: 1,
      selected: 1,
      updated: 1,
      remaining: 0,
    });
    expect(secondWrite.translationStorage.products).toMatchObject({
      pending: 1,
      selected: 1,
      updated: 1,
      remaining: 0,
    });
    expect(finalRerun.sourceRevision.products).toMatchObject({
      pending: 0,
      updated: 0,
      remaining: 0,
    });
    expect(finalRerun.translationStorage.products).toMatchObject({
      pending: 0,
      updated: 0,
      remaining: 0,
    });
    expect(finalRerun.categorySlugs).toMatchObject({
      pending: 0,
      updated: 0,
      remaining: 0,
      collisionCount: 0,
    });

    expect(migratedProducts.map((product) => product.title)).toEqual([
      'Първи продукт',
      'Втори продукт',
    ]);
    expect(migratedProducts).toEqual([
      expect.objectContaining({ sourceRevision: 1, translations: {} }),
      expect.objectContaining({ sourceRevision: 1, translations: {} }),
    ]);
    expect(migratedCategory).toMatchObject({
      name: 'Подаръци',
      slug: 'podaratsi',
      canonicalSlug: 'podaratsi',
      canonicalSlugReviewed: false,
      slugAliases: ['podaratsi'],
      sourceRevision: 1,
      translations: {},
    });
    expect(migratedSubscriber).toMatchObject({
      preferredLocale: 'bg',
      pendingPreferredLocale: null,
      pendingLocaleRequestedAt: null,
      localeChangeRequestVersion: 1,
      preferenceTokenVersion: 1,
      consecutiveUndeliveredCount: 0,
    });
    expect(migratedOrder.customerLocale).toBe('bg');
  });
});
