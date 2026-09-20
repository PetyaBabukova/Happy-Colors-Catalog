import Category from '../models/Category.js';
import Product from '../models/Product.js';
import { slugify } from '../utils/slugify.js';
import mongoose from 'mongoose'; 
import { revalidateProductSurfacesSafely } from '../helpers/revalidateProducts.js';
import { buildPublicProductFilter } from '../utils/productPublication.js';
import {
  getSourceRevision,
  hasValidCategoryTranslation,
  hasValidProductTranslation,
  projectPublicCategory,
} from './localization/publicProjection.js';

function getTranslationEntry(translations, locale) {
  if (!translations) {
    return null;
  }

  if (typeof translations.get === 'function') {
    return translations.get(locale) || null;
  }

  return translations[locale] || null;
}

function getTranslationDecision(category, { changedPublicSource = false } = {}) {
  const englishTranslation = getTranslationEntry(category?.translations, 'en');
  const sourceRevision = getSourceRevision(category?.sourceRevision);
  const translationSourceRevision = getSourceRevision(englishTranslation?.sourceRevision);
  const translationRevision = Number(englishTranslation?.translationRevision) || 0;

  if (!changedPublicSource || !englishTranslation || translationSourceRevision === sourceRevision) {
    return null;
  }

  return {
    locale: 'en',
    status: 'needs_decision',
    sourceRevision,
    translationRevision,
    translationSourceRevision,
  };
}

function withTranslationDecision(category, options) {
  const plainCategory = typeof category?.toObject === 'function' ? category.toObject() : category;
  const decision = getTranslationDecision(plainCategory, options);

  return decision
    ? {
        ...plainCategory,
        englishTranslationDecision: decision,
      }
    : plainCategory;
}


// 👉 Създаване на категория със slug
function getTranslationEntryValue(category, locale, fieldName) {
  const translation = getTranslationEntry(category?.translations, locale);

  return translation?.[fieldName] || '';
}

function getObjectIdTimestamp(value) {
  const id = value?._id || value;

  return typeof id?.getTimestamp === 'function' ? id.getTimestamp() : null;
}

function getCategoryTimestamp(category, fieldName) {
  return category?.[fieldName] || getObjectIdTimestamp(category);
}

function projectCategoryRedirectCandidate(category, locale = 'bg', { eligibleLocales = ['bg'] } = {}) {
  const projectedCategory = projectPublicCategory(category, locale);

  if (!projectedCategory) {
    return projectedCategory;
  }

  return {
    _id: projectedCategory._id,
    name: projectedCategory.name,
    contentLocale: projectedCategory.contentLocale,
    translationPending: projectedCategory.translationPending,
    filterSlug: projectedCategory.filterSlug,
    slug: category?.slug || '',
    canonicalSlug: category?.canonicalSlug || '',
    canonicalSlugReviewed: Boolean(category?.canonicalSlugReviewed),
    slugAliases: Array.isArray(category?.slugAliases) ? category.slugAliases : [],
    eligibleLocales,
    displayNames: {
      bg: category?.name || '',
      en: hasValidCategoryTranslation(category)
        ? getTranslationEntryValue(category, 'en', 'name')
        : '',
    },
    createdAt: getCategoryTimestamp(category, 'createdAt'),
    updatedAt: getCategoryTimestamp(category, 'updatedAt'),
  };
}

function getCategoryId(category) {
  return String(category?._id || '');
}

function buildCategoryLocaleEligibility(products = []) {
  const eligibilityByCategoryId = new Map();

  for (const product of products) {
    const category = product?.category;
    const categoryId = getCategoryId(category);

    if (!categoryId) {
      continue;
    }

    const currentEligibility = eligibilityByCategoryId.get(categoryId) || new Set();

    currentEligibility.add('bg');

    if (hasValidCategoryTranslation(category) && hasValidProductTranslation(product)) {
      currentEligibility.add('en');
    }

    eligibilityByCategoryId.set(categoryId, currentEligibility);
  }

  return eligibilityByCategoryId;
}

function getEligibleLocalesForCategory(category, eligibilityByCategoryId) {
  const locales = eligibilityByCategoryId.get(getCategoryId(category));

  return locales ? [...locales] : [];
}

function createCategoryError(message, { field = null, statusCode = 400 } = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;

  if (field) {
    error.field = field;
  }

  return error;
}

function normalizeCanonicalSlug(value) {
  return slugify(String(value || '').trim());
}

function normalizeSlugAliases(value) {
  const aliases = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((alias) => alias.trim());

  return [...new Set(aliases.map(normalizeCanonicalSlug).filter(Boolean))];
}

async function assertCategorySlugAvailable(slug, { categoryId = null, field = 'canonicalSlug' } = {}) {
  const normalizedSlug = normalizeCanonicalSlug(slug);

  if (!normalizedSlug) {
    throw createCategoryError('Stable category slug is required.', { field });
  }

  const existingCategory = await Category.findOne({
    ...(categoryId ? { _id: { $ne: categoryId } } : {}),
    $or: [
      { slug: normalizedSlug },
      { canonicalSlug: normalizedSlug },
      { slugAliases: normalizedSlug },
    ],
  }).lean();

  if (existingCategory) {
    throw createCategoryError('Stable category slug is already used by another category.', { field });
  }
}

async function assertCategorySlugAliasesAvailable(aliases, { categoryId = null } = {}) {
  for (const alias of aliases) {
    await assertCategorySlugAvailable(alias, { categoryId, field: 'slugAliases' });
  }
}

function buildSlugAliases({ existingAliases = [], previousSlug = '', previousCanonicalSlug = '', nextSlug = '', nextCanonicalSlug = '' }) {
  const aliases = new Set(normalizeSlugAliases(existingAliases));

  for (const previousValue of [previousSlug, previousCanonicalSlug]) {
    const normalizedPreviousValue = normalizeCanonicalSlug(previousValue);

    if (normalizedPreviousValue) {
      aliases.add(normalizedPreviousValue);
    }
  }

  aliases.delete(normalizeCanonicalSlug(nextSlug));
  aliases.delete(normalizeCanonicalSlug(nextCanonicalSlug));

  return [...aliases].sort();
}

export async function createCategory(data) {
  const slug = slugify(data.name);
  const canonicalSlug = normalizeCanonicalSlug(data.canonicalSlug) || slug;
  const slugAliases = buildSlugAliases({
    existingAliases: data.slugAliases,
    nextSlug: slug,
    nextCanonicalSlug: canonicalSlug,
  });

  await assertCategorySlugAvailable(slug, { field: 'name' });

  if (canonicalSlug !== slug) {
    await assertCategorySlugAvailable(canonicalSlug, { field: 'canonicalSlug' });
  }

  await assertCategorySlugAliasesAvailable(slugAliases);

  const category = new Category({
    ...data,
    slug,
    canonicalSlug,
    canonicalSlugReviewed: Boolean(data.canonicalSlugReviewed),
    slugAliases,
  });
  const savedCategory = await category.save();

  await revalidateProductSurfacesSafely();

  return savedCategory;
}

// 👉 Връща всички категории (за create/edit форми)
export async function getAllCategories({ locale = 'bg' } = {}) {
  const categories = await Category.find().lean();

  return categories.map((category) => projectPublicCategory(category, locale));
}

// 👉 Връща само категориите, които имат поне 1 продукт (за хедър/shop)
export async function getVisibleCategories({ locale = 'bg' } = {}) {
  const visibleCategoryIds = await Product.distinct('category', {
    ...buildPublicProductFilter(),
    // Only catalog products make a category visible in catalog navigation.
    isInCatalog: true,
  });
  const categories = await Category.find({ _id: { $in: visibleCategoryIds } }).lean();

  return categories.map((category) => projectPublicCategory(category, locale));
}

export async function getVisibleCategoryRedirectCandidates({ locale = 'bg' } = {}) {
  const products = await Product.find({
    ...buildPublicProductFilter(),
    isInCatalog: true,
  })
    .select('category translations sourceRevision')
    .populate('category', 'name slug canonicalSlug slugAliases canonicalSlugReviewed translations sourceRevision createdAt updatedAt')
    .lean();
  const eligibilityByCategoryId = buildCategoryLocaleEligibility(products);
  const categoriesById = new Map();

  for (const product of products) {
    const category = product?.category;
    const categoryId = getCategoryId(category);

    if (categoryId && category && typeof category === 'object' && !categoriesById.has(categoryId)) {
      categoriesById.set(categoryId, category);
    }
  }

  return [...categoriesById.values()].map((category) =>
    projectCategoryRedirectCandidate(category, locale, {
      eligibleLocales: getEligibleLocalesForCategory(category, eligibilityByCategoryId),
    })
  );
}

export async function deleteCategory(categoryId) {
  const categoryToDelete = await Category.findById(categoryId);

  if (!categoryToDelete) {
    throw new Error('Категорията не съществува.');
  }

  // Брой продукти, които използват тази категория
  const productCount = await Product.countDocuments({ category: categoryId });

  if (productCount === 0) {
    // Няма продукти → директно изтриваме категорията
    await Category.findByIdAndDelete(categoryId);
    await revalidateProductSurfacesSafely();
    return { message: 'Категорията беше изтрита успешно.', reassigned: false };
  }

  // Има продукти → намираме/създаваме категория "Други"
  let fallbackCategory = await Category.findOne({ name: 'Други' });

  if (!fallbackCategory) {
    fallbackCategory = new Category({
      name: 'Други',
      slug: slugify('Други'),
    });
    await fallbackCategory.save();
  }

  // Прехвърляме продуктите към категория "Други"
  await Product.updateMany(
    { category: categoryId },
    { category: fallbackCategory._id }
  );

  // Изтриваме оригиналната категория
  await Category.findByIdAndDelete(categoryId);
  await revalidateProductSurfacesSafely();

  return {
    message: `Категорията беше изтрита. Продуктите бяха прехвърлени към категория "${fallbackCategory.name}".`,
    reassigned: true,
  };
}

export async function getCategoryById(categoryId) {
  if (!mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new Error('Невалидно ID');
  }

  return await Category.findById(categoryId).lean();
}

export async function updateCategory(categoryId, data) {
  const category = await Category.findById(categoryId);

  if (!category) {
    return null;
  }

  const slug = slugify(data.name);
  const nextName = String(data.name || '').trim();
  const previousSlug = category.slug;
  const previousCanonicalSlug = category.canonicalSlug;
  const hasCanonicalSlugInput = Object.prototype.hasOwnProperty.call(data, 'canonicalSlug');
  const nextCanonicalSlug = hasCanonicalSlugInput
    ? normalizeCanonicalSlug(data.canonicalSlug)
    : normalizeCanonicalSlug(category.canonicalSlug) || normalizeCanonicalSlug(category.slug) || slug;
  const hasReviewedInput = Object.prototype.hasOwnProperty.call(data, 'canonicalSlugReviewed');
  const nextCanonicalSlugReviewed = hasReviewedInput
    ? Boolean(data.canonicalSlugReviewed)
    : Boolean(category.canonicalSlugReviewed);
  const nextSlugAliases = buildSlugAliases({
    existingAliases: Object.prototype.hasOwnProperty.call(data, 'slugAliases')
      ? data.slugAliases
      : category.slugAliases,
    previousSlug,
    previousCanonicalSlug,
    nextSlug: slug,
    nextCanonicalSlug,
  });

  const hasSourceNameChange = String(category.name || '') !== nextName;

  await assertCategorySlugAvailable(slug, { categoryId, field: 'name' });
  await assertCategorySlugAvailable(nextCanonicalSlug, { categoryId, field: 'canonicalSlug' });
  await assertCategorySlugAliasesAvailable(nextSlugAliases, { categoryId });

  if (hasSourceNameChange) {
    category.sourceRevision = (Number(category.sourceRevision) || 1) + 1;
  }

  category.name = data.name;
  category.slug = slug;
  category.canonicalSlug = nextCanonicalSlug;
  category.canonicalSlugReviewed = nextCanonicalSlugReviewed;
  category.slugAliases = nextSlugAliases;

  await category.save();
  await revalidateProductSurfacesSafely();

  return withTranslationDecision(category, {
    changedPublicSource: hasSourceNameChange,
  });
}

