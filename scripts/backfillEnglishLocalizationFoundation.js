import { fileURLToPath } from 'url';
import mongoose from '../server/mongoose.js';
import BlogArticle from '../server/models/BlogArticle.js';
import CartoonOrder from '../server/models/CartoonOrder.js';
import Category from '../server/models/Category.js';
import HomeBanner from '../server/models/HomeBanner.js';
import NewsletterSubscriber from '../server/models/NewsletterSubscriber.js';
import Product from '../server/models/Product.js';

const PUBLIC_LOCALES = ['bg', 'en'];

async function backfillUpdate({
  Model,
  dryRun,
  filter,
  update,
}) {
  const pending = await Model.countDocuments(filter);

  if (dryRun || pending === 0) {
    return { pending, updated: 0 };
  }

  const result = await Model.updateMany(filter, update);

  return {
    pending,
    updated: result.modifiedCount ?? result.nModified ?? 0,
  };
}

async function backfillSourceRevision({ dryRun, models }) {
  const sourceRevisionModels = [
    ['products', models.ProductModel],
    ['categories', models.CategoryModel],
    ['blogArticles', models.BlogArticleModel],
    ['homeBanners', models.HomeBannerModel],
  ];
  const result = {};

  for (const [name, Model] of sourceRevisionModels) {
    result[name] = await backfillUpdate({
      Model,
      dryRun,
      filter: { sourceRevision: { $exists: false } },
      update: { $set: { sourceRevision: 1 } },
    });
  }

  return result;
}

async function backfillNewsletterSubscribers({ dryRun, Model }) {
  return {
    preferredLocale: await backfillUpdate({
      Model,
      dryRun,
      filter: {
        $or: [
          { preferredLocale: { $exists: false } },
          { preferredLocale: { $nin: PUBLIC_LOCALES } },
        ],
      },
      update: { $set: { preferredLocale: 'bg' } },
    }),
    pendingPreferredLocale: await backfillUpdate({
      Model,
      dryRun,
      filter: {
        pendingPreferredLocale: { $exists: false },
      },
      update: { $set: { pendingPreferredLocale: null } },
    }),
    pendingLocaleRequestedAt: await backfillUpdate({
      Model,
      dryRun,
      filter: {
        pendingLocaleRequestedAt: { $exists: false },
      },
      update: { $set: { pendingLocaleRequestedAt: null } },
    }),
    localeChangeRequestVersion: await backfillUpdate({
      Model,
      dryRun,
      filter: {
        localeChangeRequestVersion: { $exists: false },
      },
      update: { $set: { localeChangeRequestVersion: 1 } },
    }),
    preferenceTokenVersion: await backfillUpdate({
      Model,
      dryRun,
      filter: {
        preferenceTokenVersion: { $exists: false },
      },
      update: { $set: { preferenceTokenVersion: 1 } },
    }),
    consecutiveUndeliveredCount: await backfillUpdate({
      Model,
      dryRun,
      filter: {
        consecutiveUndeliveredCount: { $exists: false },
      },
      update: { $set: { consecutiveUndeliveredCount: 0 } },
    }),
  };
}

async function backfillCartoonOrders({ dryRun, Model }) {
  return {
    customerLocale: await backfillUpdate({
      Model,
      dryRun,
      filter: {
        $or: [
          { customerLocale: { $exists: false } },
          { customerLocale: { $nin: PUBLIC_LOCALES } },
        ],
      },
      update: { $set: { customerLocale: 'bg' } },
    }),
  };
}

export async function backfillEnglishLocalizationFoundation({
  dryRun = false,
  models = {},
} = {}) {
  const resolvedModels = {
    ProductModel: Product,
    CategoryModel: Category,
    BlogArticleModel: BlogArticle,
    HomeBannerModel: HomeBanner,
    NewsletterSubscriberModel: NewsletterSubscriber,
    CartoonOrderModel: CartoonOrder,
    ...models,
  };

  return {
    dryRun,
    sourceRevision: await backfillSourceRevision({ dryRun, models: resolvedModels }),
    newsletterSubscribers: await backfillNewsletterSubscribers({
      dryRun,
      Model: resolvedModels.NewsletterSubscriberModel,
    }),
    cartoonOrders: await backfillCartoonOrders({
      dryRun,
      Model: resolvedModels.CartoonOrderModel,
    }),
  };
}

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    const result = await backfillEnglishLocalizationFoundation({
      dryRun: process.argv.includes('--dry-run'),
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
