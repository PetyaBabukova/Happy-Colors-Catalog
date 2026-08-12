import mongoose from 'mongoose';
import {
  assertSupportedTranslationLocale,
  getEntityTranslationConfig,
  pickTranslationFields,
} from './entityTranslationConfig.js';
import { revalidateBlogSurfacesSafely } from '../../helpers/revalidateBlog.js';
import { revalidateCartoonHeroBannerSurfacesSafely } from '../../helpers/revalidateCartoonHeroBanners.js';
import { revalidateHomeBannerSurfacesSafely } from '../../helpers/revalidateHomeBanners.js';
import { revalidateProductSurfacesSafely } from '../../helpers/revalidateProducts.js';
import { getSourceRevision as normalizeSourceRevision } from '../localization/publicProjection.js';
import { translateEntityFields } from './translationProvider.js';

function createTranslationError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeExpectedRevision(value, fieldName) {
  if (typeof value === 'undefined' || value === null || value === '') {
    throw createTranslationError(`${fieldName} is required.`);
  }

  const revision = Number(value);

  if (!Number.isInteger(revision) || revision < 0) {
    throw createTranslationError(`${fieldName} must be a non-negative integer.`);
  }

  return revision;
}

function getEntitySourceRevision(entity) {
  return normalizeSourceRevision(entity?.sourceRevision);
}

function hasTranslatableSourceContent(sourceFields, fields) {
  return fields.some((fieldName) => String(sourceFields?.[fieldName] ?? '').trim().length > 0);
}

function createEmptyTranslationResult(fields) {
  return {
    provider: '',
    providerModel: '',
    fields: Object.fromEntries(fields.map((fieldName) => [fieldName, ''])),
  };
}

function normalizeStoredTranslation(config, entity, translation) {
  const fields = pickTranslationFields(translation, config.translationFields);

  return config.validateStoredTranslation
    ? config.normalizeTranslation(fields, { entity })
    : fields;
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

function buildLocalePath(fieldName, locale) {
  return `${fieldName}.${locale}`;
}

function buildSourceRevisionGuard(expectedSourceRevision) {
  const expected = normalizeExpectedRevision(expectedSourceRevision, 'expectedSourceRevision');

  if (expected === 1) {
    return {
      $or: [
        { sourceRevision: expected },
        { sourceRevision: { $exists: false } },
        { sourceRevision: null },
      ],
    };
  }

  return { sourceRevision: expected };
}

function buildStoredEntryRevisionGuard(fieldName, locale, revisionField, expected) {
  const revisionPath = `${buildLocalePath(fieldName, locale)}.${revisionField}`;

  if (expected === 0) {
    return {
      $or: [
        { [revisionPath]: 0 },
        { [revisionPath]: { $exists: false } },
        { [revisionPath]: null },
      ],
    };
  }

  return { [revisionPath]: expected };
}

function buildEntryRevisionGuard(fieldName, locale, expectedFieldName, expectedValue) {
  const expected = normalizeExpectedRevision(expectedValue, expectedFieldName);
  const revisionField =
    expectedFieldName === 'expectedDraftRevision' ? 'draftRevision' : 'translationRevision';

  return buildStoredEntryRevisionGuard(fieldName, locale, revisionField, expected);
}

function buildDraftStateGuard(locale, draft) {
  return buildStoredEntryRevisionGuard(
    'translationDrafts',
    locale,
    'draftRevision',
    readRevision(draft, 'draftRevision')
  );
}

function buildActiveTranslationWriteGuards(locale, payload) {
  return [
    buildSourceRevisionGuard(payload.expectedSourceRevision),
    buildEntryRevisionGuard(
      'translations',
      locale,
      'expectedTranslationRevision',
      payload.expectedTranslationRevision
    ),
  ];
}

function buildDraftTranslationWriteGuards(locale, payload) {
  return [
    buildSourceRevisionGuard(payload.expectedSourceRevision),
    buildEntryRevisionGuard(
      'translationDrafts',
      locale,
      'expectedDraftRevision',
      payload.expectedDraftRevision
    ),
  ];
}

async function persistTranslationChanges(
  config,
  entity,
  { setEntries = [], unsetEntries = [], guardClauses = [] } = {}
) {
  const $set = {};
  const $unset = {};

  for (const { fieldName, locale, value } of setEntries) {
    $set[buildLocalePath(fieldName, locale)] = value;
  }

  for (const { fieldName, locale } of unsetEntries) {
    $unset[buildLocalePath(fieldName, locale)] = '';
  }

  const update = {};

  if (Object.keys($set).length > 0) {
    update.$set = $set;
  }

  if (Object.keys($unset).length > 0) {
    update.$unset = $unset;
  }

  if (Object.keys(update).length === 0) {
    throw createTranslationError('No translation changes to persist.', 400);
  }

  const result = await config.model.updateOne(
    { $and: [{ _id: entity._id }, ...guardClauses] },
    update,
    { runValidators: true, context: 'query' }
  );

  if (result.matchedCount !== 1) {
    throw createTranslationError('The source or English translation changed. Reload and retry.', 409);
  }
}

function readRevision(entry, fieldName) {
  const revision = Number(entry?.[fieldName]);

  return Number.isInteger(revision) && revision > 0 ? revision : 0;
}

function isCurrentTranslation(entity, translation) {
  return Boolean(
    translation &&
      normalizeSourceRevision(translation.sourceRevision) === getEntitySourceRevision(entity)
  );
}

function collectProtectedTokens(value) {
  const text = String(value || '');
  const tokens = [];
  const tokenPatterns = [
    /\{\{\s*[\w.-]+\s*\}\}/g,
    /\{[\w.-]+\}/g,
    /%[sdif]/g,
  ];

  for (const pattern of tokenPatterns) {
    for (const match of text.matchAll(pattern)) {
      tokens.push(match[0]);
    }
  }

  return tokens.sort();
}

function collectUrls(value) {
  const text = String(value || '');
  const urls = [];
  const attrPattern = /\b(?:href|src)=["']([^"']+)["']/gi;
  const plainPattern = /\b(?:https:\/\/|mailto:)[^\s<>"']+/gi;

  for (const match of text.matchAll(attrPattern)) {
    urls.push(match[1]);
  }

  for (const match of text.matchAll(plainPattern)) {
    urls.push(match[0]);
  }

  return [...new Set(urls)].sort();
}

function getInternalHostnames() {
  const allowLocalHosts = process.env.NODE_ENV !== 'production';
  const localHostnames = new Set(['localhost', '127.0.0.1']);
  const configuredHosts = [
    process.env.CLIENT_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.PUBLIC_SITE_URL,
    process.env.NEWSLETTER_PUBLIC_SITE_URL,
  ]
    .map((value) => {
      try {
        return new URL(String(value || '')).hostname.toLowerCase();
      } catch {
        return '';
      }
    })
    .filter((hostname) => hostname && (allowLocalHosts || !localHostnames.has(hostname)));

  return new Set([
    'happycolors.eu',
    'www.happycolors.eu',
    ...(allowLocalHosts ? localHostnames : []),
    ...configuredHosts,
  ]);
}

function normalizeInternalPath(pathname = '') {
  const normalizedPathname = pathname || '/';
  const localeMatch = normalizedPathname.match(/^\/(?:bg|en)(?=\/|$)/);
  let pathWithoutLocale = localeMatch
    ? normalizedPathname.slice(localeMatch[0].length) || '/'
    : normalizedPathname;

  if (pathWithoutLocale.length > 1) {
    pathWithoutLocale = pathWithoutLocale.replace(/\/+$/, '');
  }

  return pathWithoutLocale || '/';
}

function buildComparableInternalUrl(parsedUrl) {
  const pathname = normalizeInternalPath(parsedUrl.pathname);
  const search = pathname === '/search' ? '' : parsedUrl.search;

  return `internal:${pathname}${search}${parsedUrl.hash}`;
}

function normalizeExternalUrl(parsedUrl) {
  if (parsedUrl.pathname === '/' && !parsedUrl.search && !parsedUrl.hash) {
    return `${parsedUrl.protocol}//${parsedUrl.host.toLowerCase()}`;
  }

  return parsedUrl.href;
}

function normalizeComparableUrl(value) {
  const text = String(value || '').trim();

  if (text.startsWith('/') && !text.startsWith('//')) {
    const parsedRelativeUrl = new URL(text, 'https://happycolors.eu');

    return buildComparableInternalUrl(parsedRelativeUrl);
  }

  try {
    const parsedUrl = new URL(text);
    const hostname = parsedUrl.hostname.toLowerCase();

    if (getInternalHostnames().has(hostname)) {
      return buildComparableInternalUrl(parsedUrl);
    }

    return normalizeExternalUrl(parsedUrl);
  } catch {
    return text;
  }

  return text;
}

function collectComparableUrls(value) {
  return collectUrls(value).map(normalizeComparableUrl).sort();
}

function assertSameProtectedValues(sourceValues, translatedValues, fieldName, collector, label) {
  const sourceTokens = collector(sourceValues?.[fieldName]);
  const translatedTokens = collector(translatedValues?.[fieldName]);

  if (JSON.stringify(sourceTokens) !== JSON.stringify(translatedTokens)) {
    throw createTranslationError(`Translation must preserve ${label} in ${fieldName}.`, 400);
  }
}

function assertProtectedContentPreserved({ sourceFields, translatedFields, fields }) {
  for (const fieldName of fields) {
    assertSameProtectedValues(sourceFields, translatedFields, fieldName, collectProtectedTokens, 'placeholders');
    assertSameProtectedValues(sourceFields, translatedFields, fieldName, collectComparableUrls, 'URLs');
  }
}

function buildTranslationMetadata({
  entity,
  existingTranslation,
  method,
  userId,
  provider = '',
  providerModel = '',
}) {
  return {
    sourceRevision: getEntitySourceRevision(entity),
    translationRevision: readRevision(existingTranslation, 'translationRevision') + 1,
    method,
    translatedAt: new Date(),
    translatedBy: userId || null,
    provider,
    providerModel,
  };
}

function buildDraftMetadata({
  entity,
  existingDraft,
  existingTranslation,
  method,
  userId,
  provider = '',
  providerModel = '',
}) {
  return {
    sourceRevision: getEntitySourceRevision(entity),
    translationRevision: readRevision(existingTranslation, 'translationRevision') || 1,
    draftRevision: readRevision(existingDraft, 'draftRevision') + 1,
    method,
    translatedAt: new Date(),
    translatedBy: userId || null,
    provider,
    providerModel,
  };
}

function serializeTranslation(entry, fields = []) {
  if (!entry) {
    return null;
  }

  return {
    ...pickTranslationFields(entry, fields),
    sourceRevision: readRevision(entry, 'sourceRevision'),
    translationRevision: readRevision(entry, 'translationRevision'),
    draftRevision: readRevision(entry, 'draftRevision'),
    method: entry.method || '',
    translatedAt: entry.translatedAt || null,
    translatedBy: entry.translatedBy || null,
    provider: entry.provider || '',
    providerModel: entry.providerModel || '',
  };
}

function serializeQueueItem(entity, config, locale) {
  const active = getMapEntry(entity.translations, locale);
  const draft = getMapEntry(entity.translationDrafts, locale);
  const sourceRevision = getEntitySourceRevision(entity);
  const activeCurrent = isCurrentTranslation(entity, active);
  const draftCurrent = draft && normalizeSourceRevision(draft.sourceRevision) === sourceRevision;
  let status = 'missing';

  if (config.activation === 'draft' && draftCurrent) {
    status = 'pending_review';
  } else if (activeCurrent) {
    status = 'current';
  } else if (draft && !draftCurrent) {
    status = 'outdated_draft';
  } else if (active) {
    status = 'needs_decision';
  }

  return {
    entityType: config.entityType,
    entityId: String(entity._id),
    label: String(entity?.[config.labelField] || '').trim(),
    locale,
    status,
    activation: config.activation,
    sourceRevision,
    translationRevision: readRevision(active, 'translationRevision'),
    translationSourceRevision: readRevision(active, 'sourceRevision'),
    draftRevision: readRevision(draft, 'draftRevision'),
    draftSourceRevision: readRevision(draft, 'sourceRevision'),
    translation: serializeTranslation(active, config.translationFields),
    draft: serializeTranslation(draft, config.translationFields),
  };
}

async function revalidateActivatedTranslation(config, entity) {
  if (config.entityType === 'product') {
    await revalidateProductSurfacesSafely({ productId: entity._id });
    return;
  }

  if (config.entityType === 'category') {
    await revalidateProductSurfacesSafely();
    return;
  }

  if (config.entityType === 'blogArticle') {
    await revalidateBlogSurfacesSafely({ articleId: entity._id });
    return;
  }

  if (config.entityType === 'homeBanner') {
    if (String(entity?.placement || 'home').trim().toLowerCase() === 'cartoons') {
      await revalidateCartoonHeroBannerSurfacesSafely();
      return;
    }

    await revalidateHomeBannerSurfacesSafely();
  }
}

async function findEntityOr404(config, entityId) {
  if (!mongoose.Types.ObjectId.isValid(String(entityId || ''))) {
    throw createTranslationError('Translation entity was not found.', 404);
  }

  const entity = await config.model.findById(entityId);

  if (!entity) {
    throw createTranslationError('Translation entity was not found.', 404);
  }

  return entity;
}

function assertCurrentSourceRevision(entity, expectedSourceRevision) {
  const expected = normalizeExpectedRevision(expectedSourceRevision, 'expectedSourceRevision');

  if (expected !== getEntitySourceRevision(entity)) {
    throw createTranslationError('The Bulgarian source changed. Reload and retry.', 409);
  }
}

function assertExpectedEntryRevision(entry, fieldName, expectedValue) {
  const expected = normalizeExpectedRevision(expectedValue, fieldName);
  const actual = readRevision(entry, fieldName === 'expectedDraftRevision' ? 'draftRevision' : 'translationRevision');

  if (expected !== actual) {
    throw createTranslationError('The English translation changed. Reload and retry.', 409);
  }
}

export async function getTranslationQueue({ locale = 'en', entityType = '', entityId = '' } = {}) {
  assertSupportedTranslationLocale(locale);

  if (entityType || entityId) {
    if (!entityType || !entityId) {
      throw createTranslationError('Both translation entity type and id are required.', 400);
    }

    const config = getEntityTranslationConfig(entityType);
    const entity = await findEntityOr404(config, entityId);
    const item = serializeQueueItem(entity, config, locale);

    return {
      locale,
      unresolvedCount: item.status === 'current' ? 0 : 1,
      items: [item],
    };
  }

  const configs = ['product', 'category', 'blogArticle', 'homeBanner'].map(getEntityTranslationConfig);
  const queueGroups = await Promise.all(
    configs.map(async (config) => {
      const filter = typeof config.buildPublicFilter === 'function' ? config.buildPublicFilter() : {};
      const entities = await config.model.find(filter).sort({ updatedAt: -1, _id: 1 });

      return entities
        .map((entity) => serializeQueueItem(entity, config, locale))
        .filter((item) => item.status !== 'current');
    })
  );

  const items = queueGroups.flat();

  return {
    locale,
    unresolvedCount: items.length,
    items,
  };
}

export async function saveManualTranslation({
  entityType,
  entityId,
  locale = 'en',
  payload = {},
  userId,
}) {
  assertSupportedTranslationLocale(locale);
  const config = getEntityTranslationConfig(entityType);
  const entity = await findEntityOr404(config, entityId);
  const active = getMapEntry(entity.translations, locale);
  const draft = getMapEntry(entity.translationDrafts, locale);

  assertCurrentSourceRevision(entity, payload.expectedSourceRevision);

  const normalizedTranslation = config.normalizeTranslation(payload.fields || {}, { entity });
  assertProtectedContentPreserved({
    sourceFields: pickTranslationFields(entity, config.sourceFields),
    translatedFields: normalizedTranslation,
    fields: config.providerFields || config.translationFields,
  });

  if (config.activation === 'draft') {
    assertExpectedEntryRevision(draft, 'expectedDraftRevision', payload.expectedDraftRevision);

    const nextDraft = {
      ...normalizedTranslation,
      ...buildDraftMetadata({
        entity,
        existingDraft: draft,
        existingTranslation: active,
        method: 'manual',
        userId,
      }),
    };

    await persistTranslationChanges(config, entity, {
      setEntries: [{ fieldName: 'translationDrafts', locale, value: nextDraft }],
      guardClauses: buildDraftTranslationWriteGuards(locale, payload),
    });

    return {
      status: 'pending_review',
      activation: config.activation,
      translation: serializeTranslation(active, config.translationFields),
      draft: serializeTranslation(nextDraft, config.translationFields),
    };
  }

  assertExpectedEntryRevision(active, 'expectedTranslationRevision', payload.expectedTranslationRevision);

  const nextTranslation = {
    ...normalizedTranslation,
    ...buildTranslationMetadata({
      entity,
      existingTranslation: active,
      method: 'manual',
      userId,
    }),
  };

  await persistTranslationChanges(config, entity, {
    setEntries: [{ fieldName: 'translations', locale, value: nextTranslation }],
    guardClauses: buildActiveTranslationWriteGuards(locale, payload),
  });
  await revalidateActivatedTranslation(config, entity);

  return {
    status: 'current',
    activation: config.activation,
    translation: serializeTranslation(nextTranslation, config.translationFields),
    draft: null,
  };
}

export async function acceptCurrentTranslation({
  entityType,
  entityId,
  locale = 'en',
  payload = {},
  userId,
}) {
  assertSupportedTranslationLocale(locale);
  const config = getEntityTranslationConfig(entityType);
  const entity = await findEntityOr404(config, entityId);
  const active = getMapEntry(entity.translations, locale);

  if (!active) {
    throw createTranslationError('No existing English translation to accept.', 400);
  }

  assertCurrentSourceRevision(entity, payload.expectedSourceRevision);
  assertExpectedEntryRevision(active, 'expectedTranslationRevision', payload.expectedTranslationRevision);

  if (isCurrentTranslation(entity, active)) {
    return {
      status: 'current',
      activation: config.activation,
      translation: serializeTranslation(active, config.translationFields),
      draft: serializeTranslation(getMapEntry(entity.translationDrafts, locale), config.translationFields),
    };
  }

  const normalizedTranslation = normalizeStoredTranslation(config, entity, active);
  const nextTranslation = {
    ...normalizedTranslation,
    ...buildTranslationMetadata({
      entity,
      existingTranslation: active,
      method: 'accepted_unchanged',
      userId,
    }),
  };

  await persistTranslationChanges(config, entity, {
    setEntries: [{ fieldName: 'translations', locale, value: nextTranslation }],
    unsetEntries: [{ fieldName: 'translationDrafts', locale }],
    guardClauses: [
      ...buildActiveTranslationWriteGuards(locale, payload),
      buildDraftStateGuard(locale, getMapEntry(entity.translationDrafts, locale)),
    ],
  });
  await revalidateActivatedTranslation(config, entity);

  return {
    status: 'current',
    activation: config.activation,
    translation: serializeTranslation(nextTranslation, config.translationFields),
    draft: null,
  };
}

export async function approveTranslationDraft({
  entityType,
  entityId,
  locale = 'en',
  payload = {},
  userId,
}) {
  assertSupportedTranslationLocale(locale);
  const config = getEntityTranslationConfig(entityType);

  if (config.activation !== 'draft') {
    throw createTranslationError('This entity type does not use translation drafts.', 400);
  }

  const entity = await findEntityOr404(config, entityId);
  const active = getMapEntry(entity.translations, locale);
  const draft = getMapEntry(entity.translationDrafts, locale);

  if (!draft) {
    throw createTranslationError('No English translation draft to approve.', 404);
  }

  assertCurrentSourceRevision(entity, payload.expectedSourceRevision);
  assertExpectedEntryRevision(draft, 'expectedDraftRevision', payload.expectedDraftRevision);

  if (normalizeSourceRevision(draft.sourceRevision) !== getEntitySourceRevision(entity)) {
    throw createTranslationError('The English draft is outdated. Regenerate or edit it first.', 409);
  }

  const normalizedDraft = normalizeStoredTranslation(config, entity, draft);
  const nextTranslation = {
    ...normalizedDraft,
    ...buildTranslationMetadata({
      entity,
      existingTranslation: active,
      method: draft.method || 'manual',
      userId,
      provider: draft.provider || '',
      providerModel: draft.providerModel || '',
    }),
  };

  await persistTranslationChanges(config, entity, {
    setEntries: [{ fieldName: 'translations', locale, value: nextTranslation }],
    unsetEntries: [{ fieldName: 'translationDrafts', locale }],
    guardClauses: buildDraftTranslationWriteGuards(locale, payload),
  });
  await revalidateActivatedTranslation(config, entity);

  return {
    status: 'current',
    activation: config.activation,
    translation: serializeTranslation(nextTranslation, config.translationFields),
    draft: null,
  };
}

export async function rejectTranslationDraft({
  entityType,
  entityId,
  locale = 'en',
  payload = {},
}) {
  assertSupportedTranslationLocale(locale);
  const config = getEntityTranslationConfig(entityType);

  if (config.activation !== 'draft') {
    throw createTranslationError('This entity type does not use translation drafts.', 400);
  }

  const entity = await findEntityOr404(config, entityId);
  const draft = getMapEntry(entity.translationDrafts, locale);

  if (!draft) {
    throw createTranslationError('No English translation draft to reject.', 404);
  }

  assertCurrentSourceRevision(entity, payload.expectedSourceRevision);
  assertExpectedEntryRevision(draft, 'expectedDraftRevision', payload.expectedDraftRevision);
  await persistTranslationChanges(config, entity, {
    unsetEntries: [{ fieldName: 'translationDrafts', locale }],
    guardClauses: buildDraftTranslationWriteGuards(locale, payload),
  });

  return {
    status: getMapEntry(entity.translations, locale) ? 'needs_decision' : 'missing',
    activation: config.activation,
    translation: serializeTranslation(getMapEntry(entity.translations, locale), config.translationFields),
    draft: null,
  };
}

export async function generateTranslation({
  entityType,
  entityId,
  locale = 'en',
  payload = {},
  userId,
}) {
  assertSupportedTranslationLocale(locale);
  const config = getEntityTranslationConfig(entityType);
  const entity = await findEntityOr404(config, entityId);
  const active = getMapEntry(entity.translations, locale);
  const draft = getMapEntry(entity.translationDrafts, locale);

  assertCurrentSourceRevision(entity, payload.expectedSourceRevision);

  if (config.activation === 'draft') {
    assertExpectedEntryRevision(draft, 'expectedDraftRevision', payload.expectedDraftRevision);
  } else {
    assertExpectedEntryRevision(active, 'expectedTranslationRevision', payload.expectedTranslationRevision);
  }

  const sourceFields = pickTranslationFields(entity, config.sourceFields);
  const providerFields = config.providerFields || config.translationFields;
  // The fresh-entity revision check below rejects source-copy changes after this snapshot.
  const providerResult = hasTranslatableSourceContent(sourceFields, providerFields)
    ? await translateEntityFields({
        entityType: config.entityType,
        sourceFields,
        fields: providerFields,
      })
    : createEmptyTranslationResult(providerFields);
  const freshEntity = await findEntityOr404(config, entityId);
  const freshActive = getMapEntry(freshEntity.translations, locale);
  const freshDraft = getMapEntry(freshEntity.translationDrafts, locale);

  assertCurrentSourceRevision(freshEntity, payload.expectedSourceRevision);

  if (config.activation === 'draft') {
    assertExpectedEntryRevision(freshDraft, 'expectedDraftRevision', payload.expectedDraftRevision);
  } else {
    assertExpectedEntryRevision(freshActive, 'expectedTranslationRevision', payload.expectedTranslationRevision);
  }

  const normalizedTranslation = config.normalizeTranslation(
    providerResult.fields || {},
    { entity: freshEntity }
  );
  assertProtectedContentPreserved({
    sourceFields: pickTranslationFields(freshEntity, config.sourceFields),
    translatedFields: normalizedTranslation,
    fields: providerFields,
  });

  if (config.activation === 'draft') {
    const nextDraft = {
      ...normalizedTranslation,
      ...buildDraftMetadata({
        entity: freshEntity,
        existingDraft: freshDraft,
        existingTranslation: freshActive,
        method: 'machine',
        userId,
        provider: providerResult.provider || '',
        providerModel: providerResult.providerModel || '',
      }),
    };

    await persistTranslationChanges(config, freshEntity, {
      setEntries: [{ fieldName: 'translationDrafts', locale, value: nextDraft }],
      guardClauses: buildDraftTranslationWriteGuards(locale, payload),
    });

    return {
      status: 'pending_review',
      activation: config.activation,
      translation: serializeTranslation(freshActive, config.translationFields),
      draft: serializeTranslation(nextDraft, config.translationFields),
    };
  }

  const nextTranslation = {
    ...normalizedTranslation,
    ...buildTranslationMetadata({
      entity: freshEntity,
      existingTranslation: freshActive,
      method: 'machine',
      userId,
      provider: providerResult.provider || '',
      providerModel: providerResult.providerModel || '',
    }),
  };

  await persistTranslationChanges(config, freshEntity, {
    setEntries: [{ fieldName: 'translations', locale, value: nextTranslation }],
    guardClauses: buildActiveTranslationWriteGuards(locale, payload),
  });
  await revalidateActivatedTranslation(config, freshEntity);

  return {
    status: 'current',
    activation: config.activation,
    translation: serializeTranslation(nextTranslation, config.translationFields),
    draft: null,
  };
}
