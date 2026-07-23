import { fileURLToPath } from 'node:url';
import mongoose from '../server/mongoose.js';
import {
  ENTITY_TRANSLATION_CONFIG,
  TARGET_TRANSLATION_LOCALE,
  assertSupportedTranslationLocale,
  pickTranslationFields,
} from '../server/services/translation/entityTranslationConfig.js';

const DEFAULT_LOCALE = TARGET_TRANSLATION_LOCALE;
const SOURCE_LOCALE = 'bg';
const INPUT_CHARS_PER_TOKEN = 1.7;
const OUTPUT_CHARS_PER_TOKEN = 3.4;
const SYSTEM_PROMPT_CHARS = 290;
const OUTPUT_EXPANSION_RATIO = 1.15;
const OUTPUT_JSON_OVERHEAD_CHARS = 80;

export const OPENAI_TRANSLATION_MODEL_PRICES_USD = Object.freeze({
  'gpt-5': {
    inputPerMillionTokens: 1.25,
    outputPerMillionTokens: 10,
  },
  'gpt-5-mini': {
    inputPerMillionTokens: 0.25,
    outputPerMillionTokens: 2,
  },
  'gpt-5-nano': {
    inputPerMillionTokens: 0.05,
    outputPerMillionTokens: 0.4,
  },
});

function roundCurrency(value) {
  return Number(value.toFixed(6));
}

function roundTokens(value) {
  return Math.ceil(value);
}

function readSourceRevision(entity) {
  const revision = Number(entity?.sourceRevision);

  return Number.isInteger(revision) && revision > 0 ? revision : 1;
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

function isEntryCurrent(entity, entry) {
  return Boolean(entry && Number(entry.sourceRevision) === readSourceRevision(entity));
}

function getTranslationState(entity, config, locale) {
  const active = getMapEntry(entity.translations, locale);
  const draft = getMapEntry(entity.translationDrafts, locale);
  const activeCurrent = isEntryCurrent(entity, active);
  const draftCurrent = config.activation === 'draft' && isEntryCurrent(entity, draft);

  return {
    activeCurrent,
    draftCurrent,
    needsMachineGeneration: !activeCurrent && !draftCurrent,
  };
}

function estimateTextTokens(charCount, charsPerToken) {
  return roundTokens(charCount / charsPerToken);
}

export function estimateEntityTokens({
  entityType,
  sourceFields = {},
  fields = [],
  locale = DEFAULT_LOCALE,
}) {
  const requestPayload = {
    entityType,
    sourceLocale: SOURCE_LOCALE,
    targetLocale: locale,
    fields,
    sourceFields,
  };
  const inputChars = SYSTEM_PROMPT_CHARS + JSON.stringify(requestPayload).length;
  const sourceChars = Object.values(sourceFields).reduce(
    (total, value) => total + String(value ?? '').length,
    0
  );
  const fieldNameChars = fields.reduce((total, fieldName) => total + fieldName.length + 8, 0);
  const outputChars = Math.max(
    OUTPUT_JSON_OVERHEAD_CHARS + fieldNameChars,
    Math.ceil(sourceChars * OUTPUT_EXPANSION_RATIO) + OUTPUT_JSON_OVERHEAD_CHARS + fieldNameChars
  );

  return {
    sourceCharacters: sourceChars,
    inputTokens: estimateTextTokens(inputChars, INPUT_CHARS_PER_TOKEN),
    outputTokens: estimateTextTokens(outputChars, OUTPUT_CHARS_PER_TOKEN),
  };
}

function addTokenEstimate(target, estimate) {
  target.sourceCharacters += estimate.sourceCharacters;
  target.inputTokens += estimate.inputTokens;
  target.outputTokens += estimate.outputTokens;
}

function createTokenBucket() {
  return {
    entityCount: 0,
    sourceCharacters: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

function estimateUsdForModels({ inputTokens, outputTokens }) {
  return Object.fromEntries(
    Object.entries(OPENAI_TRANSLATION_MODEL_PRICES_USD).map(([model, price]) => {
      const inputCost = (inputTokens / 1_000_000) * price.inputPerMillionTokens;
      const outputCost = (outputTokens / 1_000_000) * price.outputPerMillionTokens;

      return [model, roundCurrency(inputCost + outputCost)];
    })
  );
}

function finalizeBucket(bucket) {
  return {
    ...bucket,
    estimatedUsd: estimateUsdForModels(bucket),
  };
}

function buildProjection(config) {
  const fields = [
    '_id',
    'sourceRevision',
    'translations',
    'translationDrafts',
    ...config.sourceFields,
  ];

  return Object.fromEntries(fields.map((field) => [field, 1]));
}

async function fetchEligibleEntities(config) {
  const filter = typeof config.buildPublicFilter === 'function' ? config.buildPublicFilter() : {};

  return config.model.find(filter, buildProjection(config)).sort({ updatedAt: -1, _id: 1 });
}

export async function estimateOpenAiTranslationCosts({
  locale = DEFAULT_LOCALE,
  configs = ENTITY_TRANSLATION_CONFIG,
  fetchEntities = fetchEligibleEntities,
} = {}) {
  assertSupportedTranslationLocale(locale);

  const totals = {
    allEligible: createTokenBucket(),
    pendingOnly: createTokenBucket(),
  };
  const entityTypes = {};

  for (const config of Object.values(configs)) {
    const entities = await fetchEntities(config);
    const summary = {
      eligibleCount: entities.length,
      currentCount: 0,
      currentDraftCount: 0,
      machineCandidateCount: 0,
      allEligible: createTokenBucket(),
      pendingOnly: createTokenBucket(),
    };

    for (const entity of entities) {
      const sourceFields = pickTranslationFields(entity, config.sourceFields);
      const tokenEstimate = estimateEntityTokens({
        entityType: config.entityType,
        sourceFields,
        fields: config.providerFields || config.translationFields,
        locale,
      });
      const state = getTranslationState(entity, config, locale);

      summary.allEligible.entityCount += 1;
      addTokenEstimate(summary.allEligible, tokenEstimate);
      totals.allEligible.entityCount += 1;
      addTokenEstimate(totals.allEligible, tokenEstimate);

      if (state.activeCurrent) {
        summary.currentCount += 1;
      } else if (state.draftCurrent) {
        summary.currentDraftCount += 1;
      } else {
        summary.machineCandidateCount += 1;
        summary.pendingOnly.entityCount += 1;
        addTokenEstimate(summary.pendingOnly, tokenEstimate);
        totals.pendingOnly.entityCount += 1;
        addTokenEstimate(totals.pendingOnly, tokenEstimate);
      }
    }

    entityTypes[config.entityType] = {
      ...summary,
      allEligible: finalizeBucket(summary.allEligible),
      pendingOnly: finalizeBucket(summary.pendingOnly),
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    locale,
    dryRun: true,
    assumptions: {
      inputCharsPerToken: INPUT_CHARS_PER_TOKEN,
      outputCharsPerToken: OUTPUT_CHARS_PER_TOKEN,
      inputTokenEstimateUsesConservativeCyrillicSourceRatio: true,
      outputExpansionRatio: OUTPUT_EXPANSION_RATIO,
      includesApproximatePromptAndJsonOverhead: true,
      sendsContentToOpenAI: false,
      readsEnvFiles: false,
    },
    pricesUsdPerMillionTokens: OPENAI_TRANSLATION_MODEL_PRICES_USD,
    totals: {
      allEligible: finalizeBucket(totals.allEligible),
      pendingOnly: finalizeBucket(totals.pendingOnly),
    },
    entityTypes,
  };
}

export async function estimateOpenAiTranslationCostsFromEnv(options = {}) {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required in the current environment. This script does not load .env files.');
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    return await estimateOpenAiTranslationCosts(options);
  } finally {
    await mongoose.disconnect();
  }
}

export async function runEstimateOpenAiTranslationCostsCli({
  stdout = console.log,
  stderr = console.error,
} = {}) {
  try {
    const result = await estimateOpenAiTranslationCostsFromEnv();
    stdout(JSON.stringify(result, null, 2));

    return 0;
  } catch (error) {
    stderr(error?.message || error);

    return 1;
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runEstimateOpenAiTranslationCostsCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
