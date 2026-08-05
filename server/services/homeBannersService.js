import HomeBanner from '../models/HomeBanner.js';
import Product from '../models/Product.js';
import BlogArticle from '../models/BlogArticle.js';
import mongoose from 'mongoose';
import {
  deleteImageFromGCS,
  extractObjectNameFromGcsUrl,
  getBucketName,
} from '../helpers/gcsImageHelper.js';
import { projectPublicHomeBanner } from './localization/publicProjection.js';

const ALLOWED_HOME_BANNER_FIELDS = new Set([
  'title',
  'description',
  'ctaLabel',
  'ctaHref',
  'imageUrl',
  'mobileImageUrl',
  'sortOrder',
  'isActive',
  'placement',
]);
const HOME_BANNER_PLACEMENTS = new Set(['home', 'cartoons']);
const HOME_BANNER_FIELD_LIMITS = {
  title: 120,
  description: 600,
  ctaLabel: 60,
  ctaHref: 300,
};

function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function hasUnsafeScheme(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) && !value.toLowerCase().startsWith('https:');
}

export function validateInternalCtaHref(ctaHref) {
  const href = String(ctaHref || '').trim();

  if (!href) {
    throw createError('CTA link is required.');
  }

  if (
    !href.startsWith('/') ||
    href.startsWith('//') ||
    href.includes('\\') ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  ) {
    throw createError('CTA link must be an internal path.');
  }

  return href;
}

function hasUnsafePathParts(parts) {
  try {
    return parts.some((part) => {
      const decodedPart = decodeURIComponent(part);

      return (
        decodedPart === '.' ||
        decodedPart === '..' ||
        decodedPart.includes('/') ||
        decodedPart.includes('\\')
      );
    });
  } catch {
    return true;
  }
}

export function validateHomeBannerImageUrl(imageUrl) {
  const urlValue = String(imageUrl || '').trim();

  if (!urlValue) {
    throw createError('Image URL is required.');
  }

  if (hasUnsafeScheme(urlValue)) {
    throw createError('Image URL must be a safe storage URL.');
  }

  const decodedUrlValue = (() => {
    try {
      return decodeURIComponent(urlValue);
    } catch {
      return urlValue;
    }
  })();

  if (/(^|\/)(\.{1,2})(\/|$)/.test(urlValue) || /(^|\/)(\.{1,2})(\/|$)/.test(decodedUrlValue)) {
    throw createError('Image URL must point to a valid storage object.');
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(urlValue);
  } catch {
    throw createError('Image URL is invalid.');
  }

  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'storage.googleapis.com') {
    throw createError('Image URL must be a Google Cloud Storage URL.');
  }

  const parts = parsedUrl.pathname.split('/').filter(Boolean);

  if (parts.length < 2 || hasUnsafePathParts(parts)) {
    throw createError('Image URL must point to a valid storage object.');
  }

  if (!getBucketName()) {
    throw createError('Storage bucket is not configured.', 500);
  }

  if (!extractObjectNameFromGcsUrl(urlValue)) {
    throw createError('Image URL must point to the configured storage bucket.');
  }

  return urlValue;
}

export function validateOptionalHomeBannerImageUrl(imageUrl) {
  const value = String(imageUrl || '').trim();

  return value ? validateHomeBannerImageUrl(value) : '';
}

function assertValidBannerId(bannerId) {
  if (!mongoose.Types.ObjectId.isValid(bannerId)) {
    throw createError('Home banner was not found.', 404);
  }
}

function pickAllowedHomeBannerFields(source = {}) {
  const sanitized = {};

  for (const [key, value] of Object.entries(source || {})) {
    if (ALLOWED_HOME_BANNER_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.toLowerCase() === 'true';
  }

  return Boolean(value);
}

function normalizeSortOrder(value) {
  if (typeof value === 'undefined' || value === null || value === '') {
    return 0;
  }

  const sortOrder = Number(value);

  if (!Number.isFinite(sortOrder)) {
    throw createError('Sort order must be a valid number.');
  }

  return sortOrder;
}

export function normalizeHomeBannerPlacement(
  value,
  { allowLegacyBlank = false, defaultOnUndefined = true } = {}
) {
  if (typeof value === 'undefined') {
    if (defaultOnUndefined) {
      return 'home';
    }

    throw createError('Invalid banner placement.');
  }

  const placement = String(value ?? '').trim().toLowerCase();

  if (!placement && allowLegacyBlank) {
    return 'home';
  }

  if (!HOME_BANNER_PLACEMENTS.has(placement)) {
    throw createError('Invalid banner placement.');
  }

  return placement;
}

function validateTextLength(fieldName, value, maxLength) {
  if (String(value || '').length > maxLength) {
    throw createError(`${fieldName} cannot be longer than ${maxLength} characters.`);
  }
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function hasChangedField(target, updates, field) {
  if (!hasOwn(updates, field)) {
    return false;
  }

  return String(target?.[field] ?? '').trim() !== String(updates[field] ?? '').trim();
}

function hasHomeBannerSourceCopyChange(target, updates = {}) {
  return (
    hasChangedField(target, updates, 'title') ||
    hasChangedField(target, updates, 'description') ||
    hasChangedField(target, updates, 'ctaLabel')
  );
}

function normalizeHomeBannerResponse(banner) {
  if (!banner) {
    return banner;
  }

  return {
    ...banner,
    placement: normalizeHomeBannerPlacement(banner.placement, { allowLegacyBlank: true }),
    mobileImageUrl: String(banner.mobileImageUrl || ''),
  };
}

function normalizeHomeBannerFields(data = {}, { currentBanner = null, requireAll = false } = {}) {
  const sanitized = pickAllowedHomeBannerFields(data);
  const normalized = {};
  const hasPlacement = hasOwn(sanitized, 'placement');
  const currentPlacement = hasPlacement
    ? null
    : normalizeHomeBannerPlacement(currentBanner?.placement, { allowLegacyBlank: true });
  const placement = hasPlacement
    ? normalizeHomeBannerPlacement(sanitized.placement)
    : requireAll
      ? 'home'
      : currentPlacement;
  const isHomePlacement = placement === 'home';
  const isCartoonPlacement = placement === 'cartoons';

  if (requireAll || hasPlacement) {
    normalized.placement = placement;
  }

  if (requireAll || hasOwn(sanitized, 'title') || (hasPlacement && isHomePlacement)) {
    const title = String(
      hasOwn(sanitized, 'title') ? sanitized.title : currentBanner?.title || ''
    ).trim();

    if (!title && isHomePlacement) {
      throw createError('Title is required.');
    }

    validateTextLength('Title', title, HOME_BANNER_FIELD_LIMITS.title);
    if (requireAll || hasOwn(sanitized, 'title')) {
      normalized.title = title;
    }
  }

  if (hasOwn(sanitized, 'description')) {
    const description = String(sanitized.description || '').trim();

    validateTextLength('Description', description, HOME_BANNER_FIELD_LIMITS.description);
    normalized.description = description;
  } else if (requireAll) {
    normalized.description = '';
  }

  if (requireAll || hasOwn(sanitized, 'ctaLabel') || (hasPlacement && isHomePlacement)) {
    const ctaLabel = String(
      hasOwn(sanitized, 'ctaLabel') ? sanitized.ctaLabel : currentBanner?.ctaLabel || ''
    ).trim();

    if (!ctaLabel && isHomePlacement) {
      throw createError('CTA label is required.');
    }

    validateTextLength('CTA label', ctaLabel, HOME_BANNER_FIELD_LIMITS.ctaLabel);
    if (requireAll || hasOwn(sanitized, 'ctaLabel')) {
      normalized.ctaLabel = ctaLabel;
    }
  }

  if (requireAll || hasOwn(sanitized, 'ctaHref') || (hasPlacement && isHomePlacement)) {
    const rawCtaHref = hasOwn(sanitized, 'ctaHref')
      ? sanitized.ctaHref
      : currentBanner?.ctaHref || '';
    const rawCtaHrefValue = String(rawCtaHref || '').trim();
    const ctaHref = isHomePlacement || rawCtaHrefValue
      ? validateInternalCtaHref(rawCtaHref)
      : '';

    validateTextLength('CTA link', ctaHref, HOME_BANNER_FIELD_LIMITS.ctaHref);
    if (requireAll || hasOwn(sanitized, 'ctaHref')) {
      normalized.ctaHref = ctaHref;
    }
  }

  if (requireAll || hasOwn(sanitized, 'imageUrl') || (hasPlacement && !currentBanner?.imageUrl)) {
    normalized.imageUrl = validateHomeBannerImageUrl(
      hasOwn(sanitized, 'imageUrl') ? sanitized.imageUrl : currentBanner?.imageUrl
    );
  }

  if (requireAll || hasOwn(sanitized, 'mobileImageUrl')) {
    normalized.mobileImageUrl = validateOptionalHomeBannerImageUrl(sanitized.mobileImageUrl);
  }

  if (hasOwn(sanitized, 'sortOrder')) {
    normalized.sortOrder = normalizeSortOrder(sanitized.sortOrder);
  } else if (requireAll) {
    normalized.sortOrder = 0;
  }

  if (hasOwn(sanitized, 'isActive')) {
    normalized.isActive = normalizeBoolean(sanitized.isActive);
  } else if (requireAll) {
    normalized.isActive = true;
  }

  if (isCartoonPlacement) {
    normalized.isActive = true;
  }

  return normalized;
}

async function isAssetUrlReferenced(assetUrl, { excludeBannerId = null } = {}) {
  if (!assetUrl) {
    return false;
  }

  const bannerQuery = {
    $or: [{ imageUrl: assetUrl }, { mobileImageUrl: assetUrl }],
    ...(excludeBannerId ? { _id: { $ne: excludeBannerId } } : {}),
  };

  const [bannerExists, productExists, blogArticleExists] = await Promise.all([
    HomeBanner.exists(bannerQuery),
    Product.exists({
      $or: [
        { imageUrl: assetUrl },
        { imageUrls: assetUrl },
        { 'videos.posterUrl': assetUrl },
        { 'videos.url': assetUrl },
        { 'draftContent.imageUrl': assetUrl },
        { 'draftContent.imageUrls': assetUrl },
        { 'draftContent.videos.posterUrl': assetUrl },
        { 'draftContent.videos.url': assetUrl },
      ],
    }),
    BlogArticle.exists({
      $or: [{ heroImageUrl: assetUrl }, { thumbnailImageUrl: assetUrl }],
    }),
  ]);

  return Boolean(bannerExists || productExists || blogArticleExists);
}

export async function shouldDeleteHomeBannerAsset(assetUrl, options = {}) {
  return !(await isAssetUrlReferenced(assetUrl, options));
}

async function deleteAssetIfUnreferenced(assetUrl, options = {}) {
  if (!assetUrl) {
    return;
  }

  if (await shouldDeleteHomeBannerAsset(assetUrl, options)) {
    await deleteImageFromGCS(assetUrl, { throwOnError: options.throwOnError === true });
  }
}

function buildActiveBannersQuery(placement) {
  if (placement === 'home') {
    return {
      isActive: true,
      $or: [
        { placement: 'home' },
        { placement: { $exists: false } },
        { placement: null },
        { placement: '' },
      ],
    };
  }

  return {
    isActive: true,
    placement,
  };
}

export async function getActiveHomeBanners({ placement = 'home', locale = 'bg' } = {}) {
  const normalizedPlacement = normalizeHomeBannerPlacement(placement);
  const banners = await HomeBanner.find(buildActiveBannersQuery(normalizedPlacement))
    .sort({ sortOrder: 1, createdAt: 1 })
    .lean();

  return banners
    .map((banner) => projectPublicHomeBanner(normalizeHomeBannerResponse(banner), locale))
    .filter(Boolean);
}

export async function getHomeBannerById(bannerId) {
  assertValidBannerId(bannerId);

  const banner = await HomeBanner.findById(bannerId).lean();

  if (!banner) {
    throw createError('Home banner was not found.', 404);
  }

  return normalizeHomeBannerResponse(banner);
}

export async function createHomeBanner(data, userId) {
  if (!userId) {
    throw createError('Authentication is required.', 401);
  }

  const banner = new HomeBanner({
    ...normalizeHomeBannerFields(data, { requireAll: true }),
    owner: userId,
  });
  const savedBanner = await banner.save();

  return normalizeHomeBannerResponse(savedBanner.toObject());
}

export async function editHomeBanner(bannerId, data, userId) {
  if (!userId) {
    throw createError('Authentication is required.', 401);
  }

  assertValidBannerId(bannerId);

  const banner = await HomeBanner.findById(bannerId);

  if (!banner) {
    throw createError('Home banner was not found.', 404);
  }

  const previousUrls = new Set([banner.imageUrl, banner.mobileImageUrl].filter(Boolean));
  const nextData = normalizeHomeBannerFields(data, {
    currentBanner: banner,
    requireAll: false,
  });
  const hasSourceCopyChange = hasHomeBannerSourceCopyChange(banner, nextData);

  if (hasSourceCopyChange) {
    banner.sourceRevision = (Number(banner.sourceRevision) || 1) + 1;
  }

  for (const [key, value] of Object.entries(nextData)) {
    banner[key] = value;
  }

  await banner.save();

  const nextUrls = new Set([banner.imageUrl, banner.mobileImageUrl].filter(Boolean));
  const deletionCandidates = [...previousUrls].filter((url) => !nextUrls.has(url));

  for (const assetUrl of deletionCandidates) {
    await deleteAssetIfUnreferenced(assetUrl, { excludeBannerId: banner._id });
  }

  return normalizeHomeBannerResponse(banner.toObject());
}

export async function deleteHomeBanner(bannerId, userId) {
  if (!userId) {
    throw createError('Authentication is required.', 401);
  }

  assertValidBannerId(bannerId);

  const banner = await HomeBanner.findById(bannerId);

  if (!banner) {
    throw createError('Home banner was not found.', 404);
  }

  const deletionCandidates = [...new Set([banner.imageUrl, banner.mobileImageUrl].filter(Boolean))];
  const deletionFailures = [];

  for (const assetUrl of deletionCandidates) {
    try {
      await deleteAssetIfUnreferenced(assetUrl, {
        excludeBannerId: banner._id,
        throwOnError: true,
      });
    } catch (error) {
      deletionFailures.push({ assetUrl, error });
    }
  }

  if (deletionFailures.length > 0) {
    const error = createError(
      `Failed to delete ${deletionFailures.length} home banner asset(s) from storage.`,
      500
    );
    error.cause = deletionFailures;
    throw error;
  }

  await HomeBanner.findByIdAndDelete(bannerId);

  return { message: 'Home banner was deleted successfully.' };
}
