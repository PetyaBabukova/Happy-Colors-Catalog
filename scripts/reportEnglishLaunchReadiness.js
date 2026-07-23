import { fileURLToPath } from 'node:url';
import mongoose from '../server/mongoose.js';
import {
  ENTITY_TRANSLATION_CONFIG,
  TARGET_TRANSLATION_LOCALE,
  assertSupportedTranslationLocale,
  pickTranslationFields,
} from '../server/services/translation/entityTranslationConfig.js';
import {
  hasValidBlogArticleTranslation,
  hasValidCategoryTranslation,
  hasValidHomeBannerTranslation,
  hasValidProductTranslation,
} from '../server/services/localization/publicProjection.js';

const DEFAULT_LOCALE = TARGET_TRANSLATION_LOCALE;
const REQUIRED_TRANSLATION_ENTITY_TYPES = Object.freeze(['product', 'category', 'blogArticle']);
const BANNER_ENTITY_TYPE = 'homeBanner';
const DEFAULT_REQUIRED_BANNER_PLACEMENTS = Object.freeze(['home']);
const RUNTIME_TRANSLATION_VALIDATORS = Object.freeze({
  product: hasValidProductTranslation,
  category: hasValidCategoryTranslation,
  blogArticle: hasValidBlogArticleTranslation,
  homeBanner: hasValidHomeBannerTranslation,
});

function readSourceRevision(entity) {
  const revision = Number(entity?.sourceRevision);

  return Number.isInteger(revision) && revision > 0 ? revision : 1;
}

function readPositiveRevision(entry, fieldName) {
  const revision = Number(entry?.[fieldName]);

  return Number.isInteger(revision) && revision > 0 ? revision : 0;
}

function getMapEntry(map, locale) {
  if (!map) {
    return null;
  }

  if (typeof map.get === 'function') {
    return map.get(locale) || null;
  }

  return map[locale] || null;
}

function isCurrentForSource(entity, entry) {
  return Boolean(entry && readPositiveRevision(entry, 'sourceRevision') === readSourceRevision(entity));
}

function createEntitySummary() {
  return {
    total: 0,
    current: 0,
    missing: 0,
    outdated: 0,
    invalid: 0,
    pendingReview: 0,
    blockers: [],
  };
}

function createBlocker({ type, entityType, entityId, reason, details = {} }) {
  return {
    type,
    entityType,
    entityId: entityId ? String(entityId) : '',
    reason,
    ...details,
  };
}

function validateActiveTranslation({ entity, config, locale }) {
  const active = getMapEntry(entity.translations, locale);
  const draft = getMapEntry(entity.translationDrafts, locale);

  if (!active) {
    if (config.activation === 'draft' && isCurrentForSource(entity, draft)) {
      return {
        status: 'pendingReview',
        blocker: createBlocker({
          type: 'pending_review',
          entityType: config.entityType,
          entityId: entity._id,
          reason: 'Current English draft exists but has not been approved.',
        }),
      };
    }

    return {
      status: 'missing',
      blocker: createBlocker({
        type: 'missing_translation',
        entityType: config.entityType,
        entityId: entity._id,
        reason: 'No active English translation exists.',
      }),
    };
  }

  if (!isCurrentForSource(entity, active)) {
    return {
      status: 'outdated',
      blocker: createBlocker({
        type: 'outdated_translation',
        entityType: config.entityType,
        entityId: entity._id,
        reason: 'Active English translation is not current for the Bulgarian source revision.',
      }),
    };
  }

  try {
    config.normalizeTranslation(pickTranslationFields(active, config.translationFields));
  } catch (error) {
    return {
      status: 'invalid',
      blocker: createBlocker({
        type: 'invalid_translation',
        entityType: config.entityType,
        entityId: entity._id,
        reason: error?.message || 'Active English translation failed validation.',
      }),
    };
  }

  const runtimeValidator = RUNTIME_TRANSLATION_VALIDATORS[config.entityType];

  if (runtimeValidator && !runtimeValidator(entity)) {
    return {
      status: 'invalid',
      blocker: createBlocker({
        type: 'invalid_translation',
        entityType: config.entityType,
        entityId: entity._id,
        reason: 'Active English translation failed runtime public projection validation.',
      }),
    };
  }

  return {
    status: 'current',
    blocker: null,
  };
}

function buildProjection(config) {
  const fields = [
    '_id',
    'sourceRevision',
    'translations',
    'translationDrafts',
    'canonicalSlug',
    'canonicalSlugReviewed',
    'placement',
  ];

  return Object.fromEntries(fields.map((field) => [field, 1]));
}

async function fetchEligibleEntities(config) {
  const filter = typeof config.buildPublicFilter === 'function' ? config.buildPublicFilter() : {};

  return config.model.find(filter, buildProjection(config)).sort({ updatedAt: -1, _id: 1 });
}

function applyValidationResult(summary, validation) {
  summary[validation.status] += 1;

  if (validation.blocker) {
    summary.blockers.push(validation.blocker);
  }
}

function summarizeCategorySlug(entity) {
  const canonicalSlug = String(entity?.canonicalSlug || '').trim();

  if (!canonicalSlug) {
    return {
      status: 'missing',
      blocker: createBlocker({
        type: 'missing_category_canonical_slug',
        entityType: 'category',
        entityId: entity._id,
        reason: 'Category has no stable canonical slug.',
      }),
    };
  }

  if (entity?.canonicalSlugReviewed !== true) {
    return {
      status: 'unreviewed',
      blocker: createBlocker({
        type: 'unreviewed_category_canonical_slug',
        entityType: 'category',
        entityId: entity._id,
        reason: 'Category canonical slug has not been reviewed.',
      }),
    };
  }

  return {
    status: 'reviewed',
    blocker: null,
  };
}

function createCategorySlugSummary() {
  return {
    total: 0,
    reviewed: 0,
    missing: 0,
    unreviewed: 0,
    blockers: [],
  };
}

function normalizePlacement(value) {
  return String(value || 'home').trim() || 'home';
}

function createPlacementSummary(placement) {
  return {
    placement,
    activeBannerCount: 0,
    currentActiveEnglishBannerCount: 0,
    missing: 0,
    outdated: 0,
    invalid: 0,
    pendingReview: 0,
    ready: false,
    blockers: [],
  };
}

function finalizeBannerPlacementSummary(placements) {
  for (const summary of Object.values(placements)) {
    summary.ready = summary.currentActiveEnglishBannerCount > 0 && summary.blockers.length === 0;

    if (!summary.ready && summary.blockers.length === 0) {
      summary.blockers.push(
        createBlocker({
          type: 'missing_required_banner_placement_translation',
          entityType: BANNER_ENTITY_TYPE,
          reason: 'Active banner placement has no current valid active English banner.',
          details: { placement: summary.placement },
        })
      );
    }
  }

  return {
    totalRequiredPlacements: Object.keys(placements).length,
    readyPlacements: Object.values(placements).filter((summary) => summary.ready).length,
    blockedPlacements: Object.values(placements).filter((summary) => !summary.ready).length,
    placements,
    blockers: Object.values(placements).flatMap((summary) => summary.blockers),
  };
}

export async function reportEnglishLaunchReadiness({
  locale = DEFAULT_LOCALE,
  configs = ENTITY_TRANSLATION_CONFIG,
  fetchEntities = fetchEligibleEntities,
  requiredBannerPlacements = DEFAULT_REQUIRED_BANNER_PLACEMENTS,
} = {}) {
  assertSupportedTranslationLocale(locale);

  const entityTypes = {};
  const blockers = [];
  const categorySlugs = createCategorySlugSummary();
  const bannerPlacements = {};

  for (const entityType of REQUIRED_TRANSLATION_ENTITY_TYPES) {
    const config = configs[entityType];
    const entities = await fetchEntities(config);
    const summary = createEntitySummary();

    for (const entity of entities) {
      summary.total += 1;
      const validation = validateActiveTranslation({ entity, config, locale });
      applyValidationResult(summary, validation);

      if (config.entityType === 'category') {
        categorySlugs.total += 1;
        const slugStatus = summarizeCategorySlug(entity);
        categorySlugs[slugStatus.status] += 1;

        if (slugStatus.blocker) {
          categorySlugs.blockers.push(slugStatus.blocker);
        }
      }
    }

    entityTypes[entityType] = summary;
    blockers.push(...summary.blockers);
  }

  const bannerConfig = configs[BANNER_ENTITY_TYPE];
  const activeBanners = await fetchEntities(bannerConfig);

  for (const placement of requiredBannerPlacements) {
    const normalizedPlacement = normalizePlacement(placement);
    bannerPlacements[normalizedPlacement] =
      bannerPlacements[normalizedPlacement] || createPlacementSummary(normalizedPlacement);
  }

  for (const banner of activeBanners) {
    const placement = normalizePlacement(banner.placement);
    const placementSummary =
      bannerPlacements[placement] || (bannerPlacements[placement] = createPlacementSummary(placement));
    const validation = validateActiveTranslation({ entity: banner, config: bannerConfig, locale });

    placementSummary.activeBannerCount += 1;

    if (validation.status === 'current') {
      placementSummary.currentActiveEnglishBannerCount += 1;
    } else {
      placementSummary[validation.status] += 1;
      placementSummary.blockers.push({
        ...validation.blocker,
        placement,
      });
    }
  }

  const bannerSummary = finalizeBannerPlacementSummary(bannerPlacements);
  blockers.push(...categorySlugs.blockers, ...bannerSummary.blockers);

  return {
    generatedAt: new Date().toISOString(),
    locale,
    dryRun: true,
    ready: blockers.length === 0,
    assumptions: {
      sendsContentToOpenAI: false,
      writesDatabase: false,
      readsEnvFiles: false,
      requiresCurrentTranslationsFor: REQUIRED_TRANSLATION_ENTITY_TYPES,
      categoryScope: 'allCategoryDocuments',
      requiresReviewedCategorySlugs: true,
      requiredBannerPlacements,
      requiresCurrentActiveEnglishBannerForRequiredAndActivePlacements: true,
    },
    totals: {
      blockerCount: blockers.length,
    },
    entityTypes,
    categorySlugs,
    bannerPlacements: bannerSummary,
    blockers,
  };
}

export async function reportEnglishLaunchReadinessFromEnv(options = {}) {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required in the current environment. This script does not load .env files.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    return await reportEnglishLaunchReadiness(options);
  } finally {
    await mongoose.disconnect();
  }
}

export async function runReportEnglishLaunchReadinessCli({
  stdout = console.log,
  stderr = console.error,
} = {}) {
  try {
    const result = await reportEnglishLaunchReadinessFromEnv();
    stdout(JSON.stringify(result, null, 2));

    return 0;
  } catch (error) {
    stderr(error?.message || error);

    return 1;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runReportEnglishLaunchReadinessCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
