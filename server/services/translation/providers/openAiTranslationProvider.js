import { createTranslationProviderError } from '../providerErrors.js';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5';
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 120000;

function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();

  if (!value) {
    throw createTranslationProviderError(`${name} is not configured.`, 501);
  }

  return value;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, MAX_TIMEOUT_MS);
}

function getTranslationModel() {
  return String(process.env.OPENAI_TRANSLATION_MODEL || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
}

function getTimeoutMs() {
  return parsePositiveInteger(process.env.OPENAI_TRANSLATION_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
}

function buildJsonSchema(fields = []) {
  const properties = fields.reduce((schema, fieldName) => {
    schema[fieldName] = {
      type: 'string',
      description: `English translation for ${fieldName}.`,
    };

    return schema;
  }, {});

  return {
    type: 'object',
    additionalProperties: false,
    properties,
    required: fields,
  };
}

function buildInput({ entityType, sourceFields = {}, fields = [] }) {
  return [
    {
      role: 'system',
      content:
        'You translate Happy Colors public catalog content from Bulgarian to American English. ' +
        'Return only the requested JSON fields. Preserve HTML tags, attributes, URLs, placeholders, product names, and brand names. ' +
        'Do not add facts, prices, delivery promises, countries, or store functionality.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        entityType,
        sourceLocale: 'bg',
        targetLocale: 'en-US',
        fields,
        sourceFields,
      }),
    },
  ];
}

function extractOutputText(responseBody) {
  if (typeof responseBody?.output_text === 'string') {
    return responseBody.output_text;
  }

  const parts = [];

  for (const outputItem of responseBody?.output || []) {
    for (const contentItem of outputItem?.content || []) {
      if (typeof contentItem?.text === 'string') {
        parts.push(contentItem.text);
      }
    }
  }

  return parts.join('').trim();
}

function parseProviderJson(responseBody) {
  const outputText = extractOutputText(responseBody);

  if (!outputText) {
    throw createTranslationProviderError('OpenAI returned an empty translation response.');
  }

  try {
    return JSON.parse(outputText);
  } catch {
    throw createTranslationProviderError('OpenAI returned invalid translation JSON.');
  }
}

export async function translateWithOpenAI({ entityType, sourceFields, fields }) {
  const apiKey = getRequiredEnv('OPENAI_API_KEY');
  const model = getTranslationModel();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        input: buildInput({ entityType, sourceFields, fields }),
        text: {
          format: {
            type: 'json_schema',
            name: `${entityType}_en_translation`,
            strict: true,
            schema: buildJsonSchema(fields),
          },
        },
      }),
    });

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      throw createTranslationProviderError('OpenAI translation request failed.');
    }

    return {
      provider: 'openai',
      providerModel: responseBody?.model || model,
      fields: parseProviderJson(responseBody),
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createTranslationProviderError('OpenAI translation request timed out.', 504);
    }

    if (error.statusCode) {
      throw error;
    }

    throw createTranslationProviderError('OpenAI translation request failed.');
  } finally {
    clearTimeout(timeoutId);
  }
}
