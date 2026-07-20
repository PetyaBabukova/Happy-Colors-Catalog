import { assertSupportedLocale, SUPPORTED_LOCALES } from './config';
import bg from './dictionaries/bg.json';
import en from './dictionaries/en.json';

const DICTIONARIES = Object.freeze({
  bg,
  en,
});

const PLACEHOLDER_PATTERN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getDictionary(locale) {
  return DICTIONARIES[assertSupportedLocale(locale)];
}

export function getDictionaryValue(dictionary, key) {
  return String(key)
    .split('.')
    .reduce((current, part) => (isPlainObject(current) ? current[part] : undefined), dictionary);
}

export function extractPlaceholders(value) {
  if (typeof value !== 'string') {
    return [];
  }

  const placeholders = new Set(
    [...value.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1])
  );

  return [...placeholders].sort();
}

export function flattenDictionary(dictionary, prefix = '') {
  if (!isPlainObject(dictionary)) {
    return {};
  }

  return Object.entries(dictionary).reduce((items, [key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      return {
        ...items,
        ...flattenDictionary(value, fullKey),
      };
    }

    return {
      ...items,
      [fullKey]: value,
    };
  }, {});
}

export function collectDictionaryIssues(dictionaries = DICTIONARIES) {
  const locales = Object.keys(dictionaries);
  const baselineLocale = locales[0] || SUPPORTED_LOCALES[0];
  const baseline = flattenDictionary(dictionaries[baselineLocale]);
  const baselineKeys = Object.keys(baseline).sort();
  const issues = [];

  for (const locale of locales) {
    const flattened = flattenDictionary(dictionaries[locale]);
    const keys = Object.keys(flattened).sort();
    const missingKeys = baselineKeys.filter((key) => !keys.includes(key));
    const extraKeys = keys.filter((key) => !baselineKeys.includes(key));

    for (const key of missingKeys) {
      issues.push(`${locale} is missing dictionary key "${key}".`);
    }

    for (const key of extraKeys) {
      issues.push(`${locale} has extra dictionary key "${key}".`);
    }

    for (const key of baselineKeys.filter((item) => keys.includes(item))) {
      const baselinePlaceholders = extractPlaceholders(baseline[key]);
      const localePlaceholders = extractPlaceholders(flattened[key]);

      if (baselinePlaceholders.join('|') !== localePlaceholders.join('|')) {
        issues.push(`${locale}.${key} placeholder mismatch.`);
      }
    }
  }

  return issues;
}

export function validateDictionaryParity(dictionaries = DICTIONARIES) {
  const issues = collectDictionaryIssues(dictionaries);

  if (issues.length > 0) {
    throw new Error(issues.join('\n'));
  }

  return true;
}

export function formatMessage(dictionary, key, values = {}) {
  const template = getDictionaryValue(dictionary, key);

  if (typeof template !== 'string') {
    throw new Error(`Missing dictionary key: ${key}`);
  }

  const expectedPlaceholders = extractPlaceholders(template);
  const providedKeys = Object.keys(values).sort();
  const missingValues = expectedPlaceholders.filter((name) => !(name in values));
  const extraValues = providedKeys.filter((name) => !expectedPlaceholders.includes(name));

  if (missingValues.length > 0) {
    throw new Error(`Missing placeholder values for ${key}: ${missingValues.join(', ')}`);
  }

  if (extraValues.length > 0) {
    throw new Error(`Unexpected placeholder values for ${key}: ${extraValues.join(', ')}`);
  }

  return template.replace(PLACEHOLDER_PATTERN, (_, name) => String(values[name]));
}
