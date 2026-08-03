import mongoose from 'mongoose';
import {
  assertSupportedTranslationLocale,
  getEntityTranslationConfig,
  pickTranslationFields,
} from './entityTranslationConfig.js';
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

function setMapEntry(entity, fieldName, locale, value) {
  if (!entity[fieldName]) {
    entity[fieldName] = new Map();
  }

  if (typeof entity[fieldName].set === 'function') {
    entity[fieldName].set(locale, value);
  } else {
    entity[fieldName][locale] = value;
  }

  entity.markModified(fieldName);
}

function deleteMapEntry(entity, fieldName, locale) {
  if (!entity[fieldName]) {
    return;
  }

  if (typeof entity[fieldName].delete === 'function') {
    entity[fieldName].delete(locale);
  } else {
    delete entity[fieldName][locale];
  }

  entity.markModified(fieldName);
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
    assertSameProtectedValues(sourceFields, translatedFields, fieldName, collectUrls, 'URLs');
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

  if (activeCurrent) {
    status = 'current';
  } else if (config.activation === 'draft' && draftCurrent) {
    status = 'pending_review';
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

    setMapEntry(entity, 'translationDrafts', locale, nextDraft);
    await entity.save();

    return {
      status: 'pending_review',
      activation: config.activation,
      translation: serializeTranslation(active, config.translationFields),
      draft: serializeTranslation(getMapEntry(entity.translationDrafts, locale), config.translationFields),
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

  setMapEntry(entity, 'translations', locale, nextTranslation);
  await entity.save();

  return {
    status: 'current',
    activation: config.activation,
    translation: serializeTranslation(getMapEntry(entity.translations, locale), config.translationFields),
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

  setMapEntry(entity, 'translations', locale, nextTranslation);
  deleteMapEntry(entity, 'translationDrafts', locale);
  await entity.save();

  return {
    status: 'current',
    activation: config.activation,
    translation: serializeTranslation(getMapEntry(entity.translations, locale), config.translationFields),
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

  setMapEntry(entity, 'translations', locale, nextTranslation);
  deleteMapEntry(entity, 'translationDrafts', locale);
  await entity.save();

  return {
    status: 'current',
    activation: config.activation,
    translation: serializeTranslation(getMapEntry(entity.translations, locale), config.translationFields),
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
  deleteMapEntry(entity, 'translationDrafts', locale);
  await entity.save();

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

    setMapEntry(freshEntity, 'translationDrafts', locale, nextDraft);
    await freshEntity.save();

    return {
      status: 'pending_review',
      activation: config.activation,
      translation: serializeTranslation(freshActive, config.translationFields),
      draft: serializeTranslation(getMapEntry(freshEntity.translationDrafts, locale), config.translationFields),
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

  setMapEntry(freshEntity, 'translations', locale, nextTranslation);
  await freshEntity.save();

  return {
    status: 'current',
    activation: config.activation,
    translation: serializeTranslation(getMapEntry(freshEntity.translations, locale), config.translationFields),
    draft: null,
  };
}
