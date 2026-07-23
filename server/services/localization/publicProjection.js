const PUBLIC_LOCALES = new Set(['bg', 'en']);
const SOURCE_LOCALE = 'bg';
const TARGET_LOCALE = 'en';

export function createPublicLocaleError(message = 'Invalid locale.') {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function normalizePublicLocale(value, { defaultLocale = 'bg' } = {}) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return defaultLocale;
  }

  if (Array.isArray(value)) {
    throw createPublicLocaleError();
  }

  const locale = String(value).trim().toLowerCase();

  if (!PUBLIC_LOCALES.has(locale)) {
    throw createPublicLocaleError();
  }

  return locale;
}

export function getRequestPublicLocale(req) {
  return normalizePublicLocale(req?.query?.locale);
}

function getMapValue(value, key) {
  if (!value) {
    return null;
  }

  if (value instanceof Map || typeof value.get === 'function') {
    return value.get(key) || null;
  }

  if (typeof value === 'object') {
    return value[key] || null;
  }

  return null;
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function readTranslation(entity) {
  return getMapValue(entity?.translations, TARGET_LOCALE);
}

export function getSourceRevision(value) {
  const revision = Number(value);

  return Number.isFinite(revision) && revision >= 1 ? revision : 1;
}

function hasFreshSourceRevision(entity, translation) {
  if (!translation) {
    return false;
  }

  return getSourceRevision(translation.sourceRevision) === getSourceRevision(entity?.sourceRevision);
}

function stripLocalizationInternals(entity) {
  if (!entity || typeof entity !== 'object') {
    return entity;
  }

  const {
    deletedAt,
    deletedBy,
    draftContent,
    draftRevision,
    draftSubmittedAt,
    draftSubmittedBy,
    draftUpdatedAt,
    reviewNote,
    reviewNotes,
    reviewStatus,
    reviewedAt,
    reviewedBy,
    slug,
    translations,
    translationDrafts,
    sourceRevision,
    canonicalSlug,
    canonicalSlugReviewed,
    slugAliases,
    ...publicEntity
  } = entity;

  return publicEntity;
}

function getPublicCategoryFilterSlug(category) {
  const canonicalSlug = String(category?.canonicalSlug || '').trim();

  if (canonicalSlug) {
    return canonicalSlug;
  }

  return String(category?.slug || '').trim();
}

function markFallback(entity) {
  return {
    ...entity,
    contentLocale: 'bg',
    translationPending: true,
  };
}

function markTranslated(entity) {
  return {
    ...entity,
    contentLocale: TARGET_LOCALE,
    translationPending: false,
  };
}

function getEntityAvailableLocales(entity, hasValidTargetTranslation) {
  return hasValidTargetTranslation(entity)
    ? [SOURCE_LOCALE, TARGET_LOCALE]
    : [SOURCE_LOCALE];
}

export function hasValidProductTranslation(product) {
  const translation = readTranslation(product);

  return (
    hasFreshSourceRevision(product, translation) &&
    hasText(translation?.title) &&
    hasText(translation?.description)
  );
}

export function hasValidCategoryTranslation(category) {
  const translation = readTranslation(category);

  return hasFreshSourceRevision(category, translation) && hasText(translation?.name);
}

export function hasValidHomeBannerTranslation(banner) {
  const translation = readTranslation(banner);

  return (
    hasFreshSourceRevision(banner, translation) &&
    hasText(translation?.title) &&
    hasText(translation?.ctaLabel)
  );
}

export function hasValidBlogArticleTranslation(article) {
  const translation = readTranslation(article);

  return (
    hasFreshSourceRevision(article, translation) &&
    hasText(translation?.title) &&
    hasText(translation?.contentHtml) &&
    hasText(translation?.heroImageAlt)
  );
}

export function projectPublicCategory(category, locale = 'bg') {
  const publicCategory = stripLocalizationInternals(category);

  if (!publicCategory) {
    return publicCategory;
  }

  if (locale !== TARGET_LOCALE) {
    return {
      ...publicCategory,
      filterSlug: getPublicCategoryFilterSlug(category),
    };
  }

  const translation = readTranslation(category);
  const filterSlug = getPublicCategoryFilterSlug(category);

  if (!hasValidCategoryTranslation(category)) {
    return markFallback({
      ...publicCategory,
      filterSlug,
    });
  }

  return markTranslated({
    ...publicCategory,
    filterSlug,
    name: translation.name,
  });
}

export function projectPublicProduct(product, locale = 'bg') {
  const publicProduct = stripLocalizationInternals(product);
  const availableLocales = getEntityAvailableLocales(product, hasValidProductTranslation);

  if (!publicProduct || locale !== TARGET_LOCALE) {
    return {
      ...publicProduct,
      availableLocales,
      category: projectPublicCategory(product?.category, locale),
    };
  }

  const category = projectPublicCategory(product?.category, locale);
  const translation = readTranslation(product);
  const baseProduct = {
    ...publicProduct,
    availableLocales,
    category,
  };

  if (!hasValidProductTranslation(product)) {
    return markFallback(baseProduct);
  }

  return markTranslated({
    ...baseProduct,
    title: translation.title,
    description: translation.description,
  });
}

export function projectPublicHomeBanner(banner, locale = 'bg') {
  const publicBanner = stripLocalizationInternals(banner);

  if (!publicBanner || locale !== TARGET_LOCALE) {
    return publicBanner;
  }

  if (!hasValidHomeBannerTranslation(banner)) {
    return null;
  }

  const translation = readTranslation(banner);

  return markTranslated({
    ...publicBanner,
    title: translation.title,
    description: translation.description || '',
    ctaLabel: translation.ctaLabel,
  });
}

export function projectPublicBlogArticle(article, locale = 'bg', { includeContent = true } = {}) {
  const publicArticle = stripLocalizationInternals(article);
  const availableLocales = getEntityAvailableLocales(article, hasValidBlogArticleTranslation);

  if (!publicArticle || locale !== TARGET_LOCALE) {
    return publicArticle
      ? {
          ...publicArticle,
          availableLocales,
        }
      : publicArticle;
  }

  if (!hasValidBlogArticleTranslation(article)) {
    return null;
  }

  const translation = readTranslation(article);

  const translatedArticle = {
    ...publicArticle,
    availableLocales,
    title: translation.title,
    excerpt: translation.excerpt || '',
    heroImageAlt: translation.heroImageAlt,
    seoTitle: translation.seoTitle || '',
    seoDescription: translation.seoDescription || '',
  };

  if (includeContent || Object.prototype.hasOwnProperty.call(publicArticle, 'contentHtml')) {
    translatedArticle.contentHtml = translation.contentHtml;
  }

  if (includeContent || Object.prototype.hasOwnProperty.call(publicArticle, 'contentText')) {
    translatedArticle.contentText = translation.contentText || '';
  }

  return markTranslated(translatedArticle);
}
