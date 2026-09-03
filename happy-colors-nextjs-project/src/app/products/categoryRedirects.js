export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const MAX_PRESERVED_TRACKING_PARAMS = 12;
export const MAX_PRESERVED_TRACKING_QUERY_LENGTH = 1024;
export const MAX_PRESERVED_TRACKING_VALUE_LENGTH = 256;

const TRACKING_PARAM_NAMES = new Set([
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'ttclid',
  'li_fat_id',
  'mc_eid',
]);

export function readFirstSearchParam(value) {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return String(value || '').trim();
}

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeDisplayName(value) {
  return String(value || '').trim().toLowerCase();
}

function isAllowedTrackingParam(key) {
  return key.startsWith('utm_') || TRACKING_PARAM_NAMES.has(key);
}

function getSearchParamEntries(searchParams = {}) {
  const entries = [];

  for (const [key, value] of Object.entries(searchParams || {})) {
    if (Array.isArray(value)) {
      for (const item of value) {
        entries.push([key, String(item || '')]);
      }
      continue;
    }

    if (typeof value !== 'undefined' && value !== null) {
      entries.push([key, String(value)]);
    }
  }

  return entries;
}

function hasDuplicateCategoryParam(searchParams = {}) {
  return Array.isArray(searchParams?.category) && searchParams.category.length > 1;
}

function hasNonCategoryParams(searchParams = {}) {
  return Object.keys(searchParams || {}).some((key) => key !== 'category');
}

function serializeTrackingParams(params) {
  const serialized = new URLSearchParams(params).toString();

  return serialized ? `?${serialized}` : '';
}

function getEncodedParamValueLength(key, value) {
  const pair = new URLSearchParams([[key, value]]).toString();
  const separatorIndex = pair.indexOf('=');

  return separatorIndex === -1 ? 0 : pair.slice(separatorIndex + 1).length;
}

export function getPreservedTrackingSearch(searchParams = {}) {
  const preserved = [];

  for (const [key, value] of getSearchParamEntries(searchParams)) {
    if (key === 'category' || !isAllowedTrackingParam(key)) {
      continue;
    }

    if (getEncodedParamValueLength(key, value) > MAX_PRESERVED_TRACKING_VALUE_LENGTH) {
      continue;
    }

    if (preserved.length >= MAX_PRESERVED_TRACKING_PARAMS) {
      break;
    }

    const nextPreserved = [...preserved, [key, value]];
    const nextQuery = serializeTrackingParams(nextPreserved).slice(1);

    if (nextQuery.length > MAX_PRESERVED_TRACKING_QUERY_LENGTH) {
      break;
    }

    preserved.push([key, value]);
  }

  return serializeTrackingParams(preserved);
}

function getCategoryKey(category) {
  return String(category?._id || category?.filterSlug || category?.canonicalSlug || category?.slug || '');
}

function getCanonicalSlug(category) {
  return String(category?.canonicalSlug || category?.filterSlug || '').trim();
}

function isLocaleEligibleCategory(category, locale) {
  if (Array.isArray(category?.eligibleLocales)) {
    return category.eligibleLocales.includes(locale || 'bg');
  }

  return locale !== 'en' || category?.translationPending !== true;
}

function isIndexableCategory(category, locale) {
  const canonicalSlug = getCanonicalSlug(category);

  if (!category?.canonicalSlugReviewed || !CATEGORY_SLUG_PATTERN.test(canonicalSlug)) {
    return false;
  }

  return isLocaleEligibleCategory(category, locale);
}

function isBrowsableCategory(category, locale) {
  const filterSlug = getCanonicalSlug(category);

  return CATEGORY_SLUG_PATTERN.test(filterSlug) && isLocaleEligibleCategory(category, locale);
}

function addStableToken(matchesByToken, token, category, source) {
  const normalizedToken = normalizeToken(token);

  if (!normalizedToken) {
    return;
  }

  if (!matchesByToken.has(normalizedToken)) {
    matchesByToken.set(normalizedToken, []);
  }

  matchesByToken.get(normalizedToken).push({ category, source });
}

function addDisplayToken(matchesByToken, token, category) {
  const normalizedToken = normalizeDisplayName(token);

  if (!normalizedToken) {
    return;
  }

  if (!matchesByToken.has(normalizedToken)) {
    matchesByToken.set(normalizedToken, []);
  }

  matchesByToken.get(normalizedToken).push({ category, source: 'displayName' });
}

function uniqueCategoryMatches(matches) {
  const byCategory = new Map();

  for (const match of matches || []) {
    const categoryKey = getCategoryKey(match.category);

    if (!byCategory.has(categoryKey)) {
      byCategory.set(categoryKey, match);
    }
  }

  return [...byCategory.values()];
}

function getMatchResult(matchesByToken, token) {
  const matches = uniqueCategoryMatches(matchesByToken.get(token));

  if (matches.length === 0) {
    return { status: 'none', match: null };
  }

  if (matches.length === 1) {
    return { status: 'matched', match: matches[0] };
  }

  return { status: 'ambiguous', match: null };
}

function pickCategoryMatch(indexes, stableToken, displayToken) {
  for (const [matchesByToken, token] of [
    [indexes.canonical, stableToken],
    [indexes.aliases, stableToken],
    [indexes.legacy, stableToken],
    [indexes.currentLocaleNames, displayToken],
    [indexes.otherLocaleNames, displayToken],
  ]) {
    const result = getMatchResult(matchesByToken, token);

    if (result.status === 'matched') {
      return { match: result.match, ambiguous: false };
    }

    if (result.status === 'ambiguous') {
      return { match: null, ambiguous: true };
    }
  }

  return { match: null, ambiguous: false };
}

function buildMatchIndexes(categories, locale = 'bg') {
  const canonical = new Map();
  const aliases = new Map();
  const legacy = new Map();
  const currentLocaleNames = new Map();
  const otherLocaleNames = new Map();
  const otherLocale = locale === 'en' ? 'bg' : 'en';

  for (const category of categories || []) {
    addStableToken(canonical, category?.canonicalSlug || category?.filterSlug, category, 'canonical');
    addStableToken(legacy, category?.slug, category, 'legacySlug');

    const categoryAliases = Array.isArray(category?.slugAliases) ? category.slugAliases : [];

    for (const alias of categoryAliases) {
      addStableToken(aliases, alias, category, 'alias');
    }

    addDisplayToken(currentLocaleNames, category?.displayNames?.[locale] || category?.name, category);
    addDisplayToken(otherLocaleNames, category?.displayNames?.[otherLocale], category);
  }

  return {
    canonical,
    aliases,
    legacy,
    currentLocaleNames,
    otherLocaleNames,
  };
}

function buildTarget(path, search) {
  if (!search) {
    return path;
  }

  return `${path}${path.includes('?') ? '&' : '?'}${search.replace(/^\?/, '')}`;
}

function buildCategoryTarget(canonicalSlug, trackingSearch) {
  return buildTarget(`/products?category=${encodeURIComponent(canonicalSlug)}`, trackingSearch);
}

export function resolveCategoryRedirect({
  categories = [],
  locale = 'bg',
  searchParams = {},
} = {}) {
  const trackingSearch = getPreservedTrackingSearch(searchParams);

  if (hasDuplicateCategoryParam(searchParams)) {
    return {
      type: 'temporary',
      target: buildTarget('/products', trackingSearch),
    };
  }

  const rawCategory = readFirstSearchParam(searchParams?.category);

  if (!rawCategory) {
    return null;
  }

  const indexes = buildMatchIndexes(categories, locale);
  const normalizedStableToken = normalizeToken(rawCategory);
  const normalizedDisplayToken = normalizeDisplayName(rawCategory);
  const { match } = pickCategoryMatch(indexes, normalizedStableToken, normalizedDisplayToken);

  if (!match) {
    return {
      type: 'temporary',
      target: buildTarget('/products', trackingSearch),
    };
  }

  const canonicalSlug = getCanonicalSlug(match.category);
  const isIndexable = isIndexableCategory(match.category, locale);

  if (!isIndexable) {
    if (match.source === 'canonical' && isBrowsableCategory(match.category, locale)) {
      if (rawCategory === canonicalSlug) {
        return null;
      }

      return {
        type: 'temporary',
        target: buildCategoryTarget(canonicalSlug, trackingSearch),
      };
    }

    return {
      type: 'temporary',
      target: buildTarget('/products', trackingSearch),
    };
  }

  if (match.source === 'canonical') {
    if (rawCategory === canonicalSlug) {
      return null;
    }

    return {
      type: hasNonCategoryParams(searchParams) ? 'temporary' : 'permanent',
      target: buildCategoryTarget(canonicalSlug, trackingSearch),
    };
  }

  return {
    type:
      (match.source === 'alias' || match.source === 'legacySlug') && !hasNonCategoryParams(searchParams)
        ? 'permanent'
        : 'temporary',
    target: buildCategoryTarget(canonicalSlug, trackingSearch),
  };
}

export function findIndexableCategoryByCanonicalSlug({
  categories = [],
  locale = 'bg',
  category,
} = {}) {
  const rawCategory = readFirstSearchParam(category);
  const normalizedCategory = normalizeToken(rawCategory);

  if (!normalizedCategory) {
    return null;
  }

  const indexes = buildMatchIndexes(categories, locale);
  const canonicalResult = getMatchResult(indexes.canonical, normalizedCategory);

  if (canonicalResult.status !== 'matched') {
    return null;
  }

  const matchedCategory = canonicalResult.match.category;
  const canonicalSlug = getCanonicalSlug(matchedCategory);

  if (
    canonicalSlug !== rawCategory ||
    !isIndexableCategory(matchedCategory, locale)
  ) {
    return null;
  }

  return matchedCategory;
}
