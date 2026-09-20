import { fileURLToPath } from 'node:url';
import mongoose from '../server/mongoose.js';
import Category from '../server/models/Category.js';
import { slugify } from '../server/utils/slugify.js';

const __filename = fileURLToPath(import.meta.url);

export const CATEGORY_SEO_INVENTORY = Object.freeze([
  {
    sourceNames: ['Приказни герои'],
    bgName: 'Плетени приказни герои',
    enName: 'Crochet Fairytale Characters',
    canonicalSlug: 'fairytale-characters',
  },
  {
    sourceNames: ['Раници, чанти и комплекти'],
    bgName: 'Ръчно изработени раници и чанти',
    enName: 'Handmade Backpacks and Bags',
    canonicalSlug: 'handmade-backpacks-and-bags',
  },
  {
    sourceNames: ['Животинки'],
    bgName: 'Плетени животинки',
    enName: 'Crochet Animals',
    canonicalSlug: 'crochet-animals',
  },
  {
    sourceNames: ['Раница с играчка – комплект', 'Раница с играчка - комплект'],
    bgName: 'Комплекти с плетена играчка и раничка',
    enName: 'Crochet Toy & Backpack Sets',
    canonicalSlug: 'crochet-toy-backpack-sets',
  },
]);

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeText(value) {
  return cleanText(value).toLowerCase();
}

function normalizeSlug(value) {
  return slugify(cleanText(value));
}

function readSourceRevision(category) {
  const revision = Number(category?.sourceRevision);

  return Number.isInteger(revision) && revision > 0 ? revision : 1;
}

function getMapEntry(value, key) {
  if (!value) {
    return null;
  }

  if (typeof value.get === 'function') {
    return value.get(key) || null;
  }

  return value[key] || null;
}

function readTranslationRevision(translation) {
  const revision = Number(translation?.translationRevision);

  return Number.isInteger(revision) && revision > 0 ? revision : 0;
}

function normalizeSlugAliases(value) {
  return [...new Set(
    (Array.isArray(value) ? value : [])
      .map(normalizeSlug)
      .filter(Boolean)
  )].sort();
}

function addReservation(reservations, value, categoryId) {
  const normalized = normalizeSlug(value);

  if (!normalized) {
    return;
  }

  const ids = reservations.get(normalized) || new Set();
  ids.add(String(categoryId));
  reservations.set(normalized, ids);
}

function buildSlugReservations(categories) {
  const reservations = new Map();

  for (const category of categories) {
    addReservation(reservations, category.slug, category._id);
    addReservation(reservations, category.canonicalSlug, category._id);

    for (const alias of category.slugAliases || []) {
      addReservation(reservations, alias, category._id);
    }
  }

  return reservations;
}

function getConflictingCategoryIds(reservations, value, categoryId) {
  const normalized = normalizeSlug(value);

  if (!normalized) {
    return [];
  }

  return [...(reservations.get(normalized) || [])]
    .filter((id) => id !== String(categoryId))
    .sort();
}

function categoryMatchesInventoryItem(category, item) {
  const acceptedNames = new Set([
    ...item.sourceNames.map(normalizeText),
    normalizeText(item.bgName),
  ]);
  const categoryNames = [
    category.name,
    getMapEntry(category.translations, 'en')?.name,
  ].map(normalizeText);
  const categorySlugs = [
    category.slug,
    category.canonicalSlug,
    ...(Array.isArray(category.slugAliases) ? category.slugAliases : []),
  ].map(normalizeSlug);
  const canonicalSlug = normalizeSlug(item.canonicalSlug);

  return (
    categoryNames.some((name) => acceptedNames.has(name)) ||
    categorySlugs.some((slug) => slug === canonicalSlug)
  );
}

function buildAliases(category, canonicalSlug) {
  const aliases = new Set(normalizeSlugAliases(category.slugAliases));

  for (const previousSlug of [category.slug, category.canonicalSlug]) {
    const normalized = normalizeSlug(previousSlug);

    if (normalized && normalized !== canonicalSlug) {
      aliases.add(normalized);
    }
  }

  aliases.delete(canonicalSlug);

  return [...aliases].sort();
}

function valuesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildSnapshotGuard(category) {
  return {
    name: category.name,
    slug: category.slug,
    canonicalSlug: Object.prototype.hasOwnProperty.call(category, 'canonicalSlug')
      ? category.canonicalSlug
      : { $exists: false },
    canonicalSlugReviewed: Object.prototype.hasOwnProperty.call(category, 'canonicalSlugReviewed')
      ? category.canonicalSlugReviewed
      : { $exists: false },
    slugAliases: Object.prototype.hasOwnProperty.call(category, 'slugAliases')
      ? category.slugAliases
      : { $exists: false },
    sourceRevision: Object.prototype.hasOwnProperty.call(category, 'sourceRevision')
      ? category.sourceRevision
      : { $exists: false },
  };
}

function buildCategoryUpdate(category, item, reservations) {
  const categoryId = String(category._id);
  const canonicalSlug = normalizeSlug(item.canonicalSlug);
  const conflictingCanonicalIds = getConflictingCategoryIds(
    reservations,
    canonicalSlug,
    categoryId
  );

  if (conflictingCanonicalIds.length > 0) {
    return {
      blocked: {
        categoryId,
        canonicalSlug,
        reason: 'canonical_slug_collision',
        conflictingCategoryIds: conflictingCanonicalIds,
      },
    };
  }

  const slugAliases = buildAliases(category, canonicalSlug);
  const aliasCollisions = slugAliases.flatMap((alias) =>
    getConflictingCategoryIds(reservations, alias, categoryId).map((conflictingCategoryId) => ({
      alias,
      conflictingCategoryId,
    }))
  );

  if (aliasCollisions.length > 0) {
    return {
      blocked: {
        categoryId,
        canonicalSlug,
        reason: 'slug_alias_collision',
        aliasCollisions,
      },
    };
  }

  const currentSourceRevision = readSourceRevision(category);
  const nextName = cleanText(item.bgName);
  const sourceNameChanged = cleanText(category.name) !== nextName;
  const nextSourceRevision = sourceNameChanged
    ? currentSourceRevision + 1
    : currentSourceRevision;
  const existingTranslation = getMapEntry(category.translations, 'en');
  const translationChanged =
    cleanText(existingTranslation?.name) !== cleanText(item.enName) ||
    Number(existingTranslation?.sourceRevision) !== nextSourceRevision ||
    existingTranslation?.method !== 'manual';
  const nextTranslation = {
    name: cleanText(item.enName),
    sourceRevision: nextSourceRevision,
    translationRevision: translationChanged
      ? Math.max(readTranslationRevision(existingTranslation) + 1, 1)
      : readTranslationRevision(existingTranslation) || 1,
    method: 'manual',
    translatedAt: translationChanged
      ? new Date()
      : existingTranslation?.translatedAt || new Date(),
  };
  const set = {
    name: nextName,
    canonicalSlug,
    canonicalSlugReviewed: true,
    slugAliases,
    sourceRevision: nextSourceRevision,
    'translations.en': nextTranslation,
  };
  const currentComparable = {
    name: cleanText(category.name),
    canonicalSlug: normalizeSlug(category.canonicalSlug),
    canonicalSlugReviewed: category.canonicalSlugReviewed === true,
    slugAliases: normalizeSlugAliases(category.slugAliases),
    sourceRevision: currentSourceRevision,
    'translations.en': {
      name: cleanText(existingTranslation?.name),
      sourceRevision: Number(existingTranslation?.sourceRevision) || 0,
      translationRevision: readTranslationRevision(existingTranslation) || 1,
      method: existingTranslation?.method || '',
    },
  };
  const nextComparable = {
    name: set.name,
    canonicalSlug: set.canonicalSlug,
    canonicalSlugReviewed: set.canonicalSlugReviewed,
    slugAliases: set.slugAliases,
    sourceRevision: nextSourceRevision,
    'translations.en': {
      name: nextTranslation.name,
      sourceRevision: nextTranslation.sourceRevision,
      translationRevision: nextTranslation.translationRevision,
      method: nextTranslation.method,
    },
  };

  if (valuesEqual(currentComparable, nextComparable)) {
    return { update: null };
  }

  return {
    update: {
      categoryId,
      canonicalSlug,
      guard: buildSnapshotGuard(category),
      set,
      summary: {
        categoryId,
        previousName: cleanText(category.name),
        nextName,
        canonicalSlug,
        slugAliases,
        sourceRevision: nextSourceRevision,
        enName: nextTranslation.name,
      },
    },
  };
}

function buildInventoryPlan(categories, inventory) {
  const reservations = buildSlugReservations(categories);
  const updates = [];
  const blocked = [];
  const missing = [];

  for (const item of inventory) {
    const matches = categories.filter((category) => categoryMatchesInventoryItem(category, item));

    if (matches.length === 0) {
      missing.push({
        canonicalSlug: item.canonicalSlug,
        sourceNames: item.sourceNames,
      });
      continue;
    }

    if (matches.length > 1) {
      blocked.push({
        canonicalSlug: item.canonicalSlug,
        reason: 'ambiguous_category_match',
        categoryIds: matches.map((category) => String(category._id)).sort(),
      });
      continue;
    }

    const result = buildCategoryUpdate(matches[0], item, reservations);

    if (result.blocked) {
      blocked.push(result.blocked);
    } else if (result.update) {
      updates.push(result.update);
    }
  }

  return { updates, blocked, missing };
}

async function loadCategories(CategoryModel) {
  return CategoryModel.find(
    {},
    {
      _id: 1,
      name: 1,
      slug: 1,
      canonicalSlug: 1,
      canonicalSlugReviewed: 1,
      slugAliases: 1,
      sourceRevision: 1,
      translations: 1,
    }
  )
    .sort({ _id: 1 })
    .lean();
}

export async function freezeCategorySeoInventory({
  CategoryModel = Category,
  inventory = CATEGORY_SEO_INVENTORY,
  dryRun = true,
} = {}) {
  const categories = await loadCategories(CategoryModel);
  const plan = buildInventoryPlan(categories, inventory);

  if (!dryRun && plan.updates.length > 0 && plan.blocked.length === 0) {
    const result = await CategoryModel.bulkWrite(
      plan.updates.map(({ categoryId, guard, set }) => ({
        updateOne: {
          filter: {
            _id: categoryId,
            ...guard,
          },
          update: { $set: set },
        },
      })),
      { ordered: true }
    );

    return {
      dryRun: false,
      planned: plan.updates.length,
      updated: result.modifiedCount ?? result.nModified ?? 0,
      missing: plan.missing,
      blocked: [],
      updates: plan.updates.map((update) => update.summary),
    };
  }

  return {
    dryRun,
    planned: plan.updates.length,
    updated: 0,
    missing: plan.missing,
    blocked: plan.blocked,
    updates: plan.updates.map((update) => update.summary),
  };
}

export async function runMigrationFromEnv({ dryRun = true } = {}) {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required in the current environment. This script does not load .env files.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    return await freezeCategorySeoInventory({ dryRun });
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

    const result = await runMigration({ dryRun: !wantsWrite });
    const blocked = result.blocked?.length || 0;
    const missing = result.missing?.length || 0;
    const exitCode = blocked > 0 || missing > 0 ? 2 : 0;

    stdout(JSON.stringify(result, null, 2));

    return exitCode;
  } catch (error) {
    stderr(error?.message || error);

    return 1;
  }
}

if (__filename === process.argv[1]) {
  runMigrationCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
