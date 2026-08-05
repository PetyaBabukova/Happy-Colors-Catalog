import { fileURLToPath } from 'node:url';
import mongoose from '../server/mongoose.js';
import BlogArticle from '../server/models/BlogArticle.js';
import CartoonOrder from '../server/models/CartoonOrder.js';
import Category from '../server/models/Category.js';
import HomeBanner from '../server/models/HomeBanner.js';
import NewsletterSubscriber from '../server/models/NewsletterSubscriber.js';
import Product from '../server/models/Product.js';
import { slugify } from '../server/utils/slugify.js';
import { loadMigrationEnv } from './migrateProductGalleryFlags.js';

const PUBLIC_LOCALES = ['bg', 'en'];
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1000;

function normalizeBatchSize(value = DEFAULT_BATCH_SIZE) {
  const batchSize = Number(value);

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new Error(`batchSize must be an integer between 1 and ${MAX_BATCH_SIZE}.`);
  }

  return batchSize;
}

async function findBatchIds(Model, filter, batchSize) {
  const docs = await Model.find(filter, { _id: 1 })
    .sort({ _id: 1 })
    .limit(batchSize)
    .lean();

  return docs.map((doc) => doc._id);
}

async function backfillUpdate({
  Model,
  batchSize,
  dryRun,
  filter,
  update,
}) {
  const pending = await Model.countDocuments(filter);
  const selected = Math.min(pending, batchSize);

  if (dryRun || pending === 0) {
    return {
      pending,
      selected,
      updated: 0,
      remaining: pending,
    };
  }

  const ids = await findBatchIds(Model, filter, batchSize);

  if (ids.length === 0) {
    return {
      pending,
      selected: 0,
      updated: 0,
      remaining: pending,
    };
  }

  const result = await Model.updateMany(
    {
      ...filter,
      _id: { $in: ids },
    },
    update
  );
  const updated = result.modifiedCount ?? result.nModified ?? 0;
  const remaining = await Model.countDocuments(filter);

  return {
    pending,
    selected: ids.length,
    updated,
    remaining,
  };
}

async function backfillSourceRevision({ batchSize, dryRun, models }) {
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
      batchSize,
      dryRun,
      filter: { sourceRevision: { $exists: false } },
      update: { $set: { sourceRevision: 1 } },
    });
  }

  return result;
}

async function backfillTranslationStorage({ batchSize, dryRun, models }) {
  const storageFields = [
    ['products', models.ProductModel, 'translations'],
    ['categories', models.CategoryModel, 'translations'],
    ['blogArticleTranslations', models.BlogArticleModel, 'translations'],
    ['blogArticleDrafts', models.BlogArticleModel, 'translationDrafts'],
    ['homeBannerTranslations', models.HomeBannerModel, 'translations'],
    ['homeBannerDrafts', models.HomeBannerModel, 'translationDrafts'],
  ];
  const result = {};

  for (const [name, Model, field] of storageFields) {
    result[name] = await backfillUpdate({
      Model,
      batchSize,
      dryRun,
      filter: { [field]: { $exists: false } },
      update: { $set: { [field]: {} } },
    });
  }

  return result;
}

function normalizeSlug(value) {
  return slugify(String(value || '').trim());
}

function readStoredSlugAliases(value) {
  return (Array.isArray(value) ? value : [])
    .map((alias) => String(alias || '').trim())
    .filter(Boolean);
}

function normalizeSlugAliases(value) {
  return [...new Set(
    readStoredSlugAliases(value)
      .map(normalizeSlug)
      .filter(Boolean)
  )].sort();
}

function addSlugReservation(reservations, value, entityId) {
  const slug = normalizeSlug(value);

  if (!slug) {
    return;
  }

  const ids = reservations.get(slug) || new Set();
  ids.add(String(entityId));
  reservations.set(slug, ids);
}

function getConflictingEntityIds(reservations, value, entityId) {
  const slug = normalizeSlug(value);

  if (!slug) {
    return [];
  }

  return [...(reservations.get(slug) || [])]
    .filter((id) => id !== String(entityId))
    .sort();
}

function buildSnapshotGuard(document, fields) {
  return Object.fromEntries(fields.map((field) => [
    field,
    Object.prototype.hasOwnProperty.call(document, field)
      ? document[field]
      : { $exists: false },
  ]));
}

function buildCategorySlugPlan(categories) {
  const reservations = new Map();

  for (const category of categories) {
    addSlugReservation(reservations, category.slug, category._id);
    addSlugReservation(reservations, category.canonicalSlug, category._id);

    for (const alias of normalizeSlugAliases(category.slugAliases)) {
      addSlugReservation(reservations, alias, category._id);
    }
  }

  const updates = [];
  const collisions = [];
  let pending = 0;

  for (const category of categories) {
    const entityId = String(category._id);
    const legacySlug = normalizeSlug(category.slug);
    const canonicalSlug = normalizeSlug(category.canonicalSlug);
    const storedAliases = readStoredSlugAliases(category.slugAliases);
    const aliases = normalizeSlugAliases(category.slugAliases);
    const needsCanonicalSlug = !canonicalSlug;
    const needsLegacyAlias = Boolean(legacySlug) && !aliases.includes(legacySlug);
    const needsReviewedDefault =
      !Object.prototype.hasOwnProperty.call(category, 'canonicalSlugReviewed');

    if (!needsCanonicalSlug && !needsLegacyAlias && !needsReviewedDefault) {
      continue;
    }

    pending += 1;
    const set = {};

    if (needsReviewedDefault) {
      set.canonicalSlugReviewed = false;
    }

    if (needsCanonicalSlug) {
      const conflictingEntityIds = getConflictingEntityIds(
        reservations,
        legacySlug,
        entityId
      );

      if (!legacySlug || conflictingEntityIds.length > 0) {
        collisions.push({
          entityId,
          field: 'canonicalSlug',
          candidate: legacySlug,
          reason: legacySlug ? 'slug_collision' : 'missing_legacy_slug',
          conflictingEntityIds,
        });
      } else {
        set.canonicalSlug = legacySlug;
      }
    }

    if (needsLegacyAlias) {
      const conflictingEntityIds = getConflictingEntityIds(
        reservations,
        legacySlug,
        entityId
      );

      if (conflictingEntityIds.length > 0) {
        collisions.push({
          entityId,
          field: 'slugAliases',
          candidate: legacySlug,
          reason: 'slug_collision',
          conflictingEntityIds,
        });
      } else {
        set.slugAliases = [...storedAliases, legacySlug];
      }
    }

    if (Object.keys(set).length > 0) {
      updates.push({
        entityId,
        set,
        guard: buildSnapshotGuard(category, Object.keys(set)),
      });
    }
  }

  const blockedEntityCount = new Set(
    collisions.map(({ entityId }) => entityId)
  ).size;

  return {
    pending,
    updates,
    actionable: updates.length,
    blocked: blockedEntityCount,
    collisions: collisions.sort((a, b) => (
      a.entityId.localeCompare(b.entityId) || a.field.localeCompare(b.field)
    )),
  };
}

async function loadCategorySlugDocuments(Model) {
  return Model.find(
    {},
    {
      _id: 1,
      slug: 1,
      canonicalSlug: 1,
      canonicalSlugReviewed: 1,
      slugAliases: 1,
    }
  )
    .sort({ _id: 1 })
    .lean();
}

export async function backfillCategorySlugs({
  CategoryModel = Category,
  batchSize = DEFAULT_BATCH_SIZE,
  dryRun = false,
} = {}) {
  const normalizedBatchSize = normalizeBatchSize(batchSize);
  const categories = await loadCategorySlugDocuments(CategoryModel);
  const plan = buildCategorySlugPlan(categories);
  const selectedUpdates = plan.updates.slice(0, normalizedBatchSize);

  if (dryRun || selectedUpdates.length === 0) {
    return {
      pending: plan.pending,
      selected: selectedUpdates.length,
      updated: 0,
      remaining: plan.pending,
      actionableRemaining: plan.actionable,
      blocked: plan.blocked,
      collisionCount: plan.collisions.length,
      collisions: plan.collisions,
    };
  }

  const result = await CategoryModel.bulkWrite(
    selectedUpdates.map(({ entityId, set, guard }) => ({
      updateOne: {
        filter: {
          _id: entityId,
          ...guard,
        },
        update: { $set: set },
      },
    })),
    { ordered: true }
  );
  const updated = result.modifiedCount ?? result.nModified ?? 0;
  const remainingPlan = buildCategorySlugPlan(
    await loadCategorySlugDocuments(CategoryModel)
  );

  return {
    pending: plan.pending,
    selected: selectedUpdates.length,
    updated,
    remaining: remainingPlan.pending,
    actionableRemaining: remainingPlan.actionable,
    blocked: remainingPlan.blocked,
    collisionCount: remainingPlan.collisions.length,
    collisions: remainingPlan.collisions,
  };
}

async function backfillNewsletterSubscribers({ batchSize, dryRun, Model }) {
  return {
    preferredLocale: await backfillUpdate({
      Model,
      batchSize,
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
      batchSize,
      dryRun,
      filter: {
        pendingPreferredLocale: { $exists: false },
      },
      update: { $set: { pendingPreferredLocale: null } },
    }),
    pendingLocaleRequestedAt: await backfillUpdate({
      Model,
      batchSize,
      dryRun,
      filter: {
        pendingLocaleRequestedAt: { $exists: false },
      },
      update: { $set: { pendingLocaleRequestedAt: null } },
    }),
    localeChangeRequestVersion: await backfillUpdate({
      Model,
      batchSize,
      dryRun,
      filter: {
        localeChangeRequestVersion: { $exists: false },
      },
      update: { $set: { localeChangeRequestVersion: 1 } },
    }),
    preferenceTokenVersion: await backfillUpdate({
      Model,
      batchSize,
      dryRun,
      filter: {
        preferenceTokenVersion: { $exists: false },
      },
      update: { $set: { preferenceTokenVersion: 1 } },
    }),
    consecutiveUndeliveredCount: await backfillUpdate({
      Model,
      batchSize,
      dryRun,
      filter: {
        consecutiveUndeliveredCount: { $exists: false },
      },
      update: { $set: { consecutiveUndeliveredCount: 0 } },
    }),
  };
}

async function backfillCartoonOrders({ batchSize, dryRun, Model }) {
  return {
    customerLocale: await backfillUpdate({
      Model,
      batchSize,
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
  batchSize = DEFAULT_BATCH_SIZE,
  dryRun = false,
  models = {},
} = {}) {
  const normalizedBatchSize = normalizeBatchSize(batchSize);
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
    batchSize: normalizedBatchSize,
    sourceRevision: await backfillSourceRevision({
      batchSize: normalizedBatchSize,
      dryRun,
      models: resolvedModels,
    }),
    translationStorage: await backfillTranslationStorage({
      batchSize: normalizedBatchSize,
      dryRun,
      models: resolvedModels,
    }),
    categorySlugs: await backfillCategorySlugs({
      CategoryModel: resolvedModels.CategoryModel,
      batchSize: normalizedBatchSize,
      dryRun,
    }),
    newsletterSubscribers: await backfillNewsletterSubscribers({
      batchSize: normalizedBatchSize,
      dryRun,
      Model: resolvedModels.NewsletterSubscriberModel,
    }),
    cartoonOrders: await backfillCartoonOrders({
      batchSize: normalizedBatchSize,
      dryRun,
      Model: resolvedModels.CartoonOrderModel,
    }),
  };
}

function readCliBatchSize(argv) {
  const option = argv.find((argument) => argument.startsWith('--batch-size='));

  return option
    ? normalizeBatchSize(option.slice('--batch-size='.length))
    : DEFAULT_BATCH_SIZE;
}

function getAutomaticRemaining(result) {
  const sections = [
    result.sourceRevision,
    result.translationStorage,
    result.newsletterSubscribers,
    result.cartoonOrders,
  ];
  const fieldRemaining = sections.reduce(
    (total, section) => total + Object.values(section || {}).reduce(
      (sectionTotal, field) => sectionTotal + Number(field?.remaining || 0),
      0
    ),
    0
  );

  return fieldRemaining + Number(result.categorySlugs?.actionableRemaining || 0);
}

export function summarizeMigrationExecution(result) {
  const automaticRemaining = getAutomaticRemaining(result);
  const blockedCategoryCount = Number(result.categorySlugs?.blocked || 0);
  const incomplete = automaticRemaining > 0 || blockedCategoryCount > 0;

  return {
    mode: result.dryRun ? 'dry-run' : 'write',
    complete: !incomplete,
    requiresWrite: result.dryRun && incomplete,
    requiresRerun: !result.dryRun && automaticRemaining > 0,
    manualResolutionRequired: blockedCategoryCount > 0,
    automaticRemaining,
    blockedCategoryCount,
  };
}

export async function runMigrationFromEnv({
  batchSize = DEFAULT_BATCH_SIZE,
  dryRun = false,
  loadEnv = loadMigrationEnv,
} = {}) {
  loadEnv();

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    return await backfillEnglishLocalizationFoundation({ batchSize, dryRun });
  } finally {
    await mongoose.disconnect();
  }
}

export async function runMigrationCli({
  argv = process.argv.slice(2),
  runMigration = runMigrationFromEnv,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  try {
    const wantsDryRun = argv.includes('--dry-run');
    const wantsWrite = argv.includes('--write');

    if (wantsDryRun && wantsWrite) {
      throw new Error('Choose either --dry-run or --write, not both.');
    }

    const result = await runMigration({
      dryRun: !wantsWrite,
      batchSize: readCliBatchSize(argv),
    });
    const execution = summarizeMigrationExecution(result);

    stdout(JSON.stringify({ ...result, execution }, null, 2));

    return execution.complete ? 0 : 2;
  } catch (error) {
    stderr(error?.message || error);

    return 1;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runMigrationCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
