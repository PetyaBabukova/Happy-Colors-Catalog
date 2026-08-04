import BlogArticle from '../../models/BlogArticle.js';
import Category from '../../models/Category.js';
import HomeBanner from '../../models/HomeBanner.js';
import Product from '../../models/Product.js';
import { buildPublicProductFilter } from '../../utils/productPublication.js';
import {
  extractContentText,
  generateExcerpt,
  sanitizeArticleHtml,
} from '../blogArticlesService.js';

export const TARGET_TRANSLATION_LOCALE = 'en';

function createTranslationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeTextField({ fieldName, value, required = false, maxLength }) {
  const normalized = String(value ?? '').trim();

  if (required && !normalized) {
    throw createTranslationError(`${fieldName} is required.`);
  }

  if (typeof maxLength === 'number' && normalized.length > maxLength) {
    throw createTranslationError(`${fieldName} cannot be longer than ${maxLength} characters.`);
  }

  return normalized;
}

function normalizePlainTextPayload(payload = {}, fields = []) {
  const normalized = {};

  for (const field of fields) {
    normalized[field.name] = normalizeTextField({
      fieldName: field.name,
      value: payload[field.name],
      required: field.required,
      maxLength: field.maxLength,
    });
  }

  return normalized;
}

function hasSourceText(value) {
  return String(value ?? '').trim().length > 0;
}

function normalizeBlogArticleTranslation(payload = {}) {
  const contentHtml = sanitizeArticleHtml(payload.contentHtml);
  const contentText = extractContentText(contentHtml);

  return {
    title: normalizeTextField({
      fieldName: 'title',
      value: payload.title,
      required: true,
      maxLength: 160,
    }),
    contentHtml,
    contentText,
    excerpt: generateExcerpt(contentText),
    heroImageAlt: normalizeTextField({
      fieldName: 'heroImageAlt',
      value: payload.heroImageAlt,
      required: true,
      maxLength: 180,
    }),
    seoTitle: normalizeTextField({
      fieldName: 'seoTitle',
      value: payload.seoTitle,
      maxLength: 70,
    }),
    seoDescription: normalizeTextField({
      fieldName: 'seoDescription',
      value: payload.seoDescription,
      maxLength: 170,
    }),
  };
}

export const ENTITY_TRANSLATION_CONFIG = Object.freeze({
  product: {
    entityType: 'product',
    labelField: 'title',
    model: Product,
    activation: 'active',
    sourceFields: ['title', 'description'],
    translationFields: ['title', 'description'],
    providerFields: ['title', 'description'],
    normalizeTranslation(payload) {
      return normalizePlainTextPayload(payload, [
        { name: 'title', required: true, maxLength: 160 },
        { name: 'description', required: true, maxLength: 10000 },
      ]);
    },
    buildPublicFilter() {
      return {
        $and: [
          buildPublicProductFilter(),
          { $or: [{ isInCatalog: true }, { isInCatalog: { $exists: false } }, { isCartoonGallery: true }] },
        ],
      };
    },
  },
  category: {
    entityType: 'category',
    labelField: 'name',
    model: Category,
    activation: 'active',
    sourceFields: ['name'],
    translationFields: ['name'],
    providerFields: ['name'],
    normalizeTranslation(payload) {
      return normalizePlainTextPayload(payload, [
        { name: 'name', required: true, maxLength: 120 },
      ]);
    },
  },
  blogArticle: {
    entityType: 'blogArticle',
    labelField: 'title',
    model: BlogArticle,
    activation: 'draft',
    sourceFields: ['title', 'contentHtml', 'heroImageAlt', 'seoTitle', 'seoDescription'],
    providerFields: ['title', 'contentHtml', 'heroImageAlt', 'seoTitle', 'seoDescription'],
    translationFields: [
      'title',
      'contentHtml',
      'contentText',
      'excerpt',
      'heroImageAlt',
      'seoTitle',
      'seoDescription',
    ],
    normalizeTranslation: normalizeBlogArticleTranslation,
    buildPublicFilter() {
      return {
        archivedAt: null,
        status: 'published',
      };
    },
  },
  homeBanner: {
    entityType: 'homeBanner',
    labelField: 'title',
    model: HomeBanner,
    activation: 'draft',
    sourceFields: ['title', 'description', 'ctaLabel'],
    translationFields: ['title', 'description', 'ctaLabel'],
    providerFields: ['title', 'description', 'ctaLabel'],
    validateStoredTranslation: true,
    normalizeTranslation(payload, { entity } = {}) {
      return normalizePlainTextPayload(payload, [
        { name: 'title', required: hasSourceText(entity?.title), maxLength: 120 },
        {
          name: 'description',
          required: hasSourceText(entity?.description),
          maxLength: 600,
        },
        { name: 'ctaLabel', required: hasSourceText(entity?.ctaLabel), maxLength: 60 },
      ]);
    },
    buildPublicFilter() {
      return {
        isActive: true,
      };
    },
  },
});

export function getEntityTranslationConfig(entityType) {
  const config = ENTITY_TRANSLATION_CONFIG[entityType];

  if (!config) {
    throw createTranslationError('Unsupported translation entity type.', 400);
  }

  return config;
}

export function assertSupportedTranslationLocale(locale) {
  if (locale !== TARGET_TRANSLATION_LOCALE) {
    throw createTranslationError('Unsupported translation locale.', 400);
  }
}

export function pickTranslationFields(source = {}, fields = []) {
  const picked = {};

  for (const field of fields) {
    picked[field] = source?.[field];
  }

  return picked;
}
