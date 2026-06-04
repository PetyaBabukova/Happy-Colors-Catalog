import HomeBanner from '../models/HomeBanner.js';
import Product from '../models/Product.js';
import BlogArticle from '../models/BlogArticle.js';
import mongoose from 'mongoose';
import {
  deleteImageFromGCS,
  extractObjectNameFromGcsUrl,
  getBucketName,
} from '../helpers/gcsImageHelper.js';

const ALLOWED_HOME_BANNER_FIELDS = new Set([
  'title',
  'description',
  'ctaLabel',
  'ctaHref',
  'imageUrl',
  'mobileImageUrl',
  'sortOrder',
  'isActive',
]);
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

function validateTextLength(fieldName, value, maxLength) {
  if (String(value || '').length > maxLength) {
    throw createError(`${fieldName} cannot be longer than ${maxLength} characters.`);
  }
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function normalizeHomeBannerResponse(banner) {
  if (!banner) {
    return banner;
  }

  return {
    ...banner,
    mobileImageUrl: String(banner.mobileImageUrl || ''),
  };
}

function normalizeHomeBannerFields(data = {}, { requireAll = false } = {}) {
  const sanitized = pickAllowedHomeBannerFields(data);
  const normalized = {};

  if (requireAll || hasOwn(sanitized, 'title')) {
    const title = String(sanitized.title || '').trim();

    if (!title) {
      throw createError('Title is required.');
    }

    validateTextLength('Title', title, HOME_BANNER_FIELD_LIMITS.title);
    normalized.title = title;
  }

  if (hasOwn(sanitized, 'description')) {
    const description = String(sanitized.description || '').trim();

    validateTextLength('Description', description, HOME_BANNER_FIELD_LIMITS.description);
    normalized.description = description;
  } else if (requireAll) {
    normalized.description = '';
  }

  if (requireAll || hasOwn(sanitized, 'ctaLabel')) {
    const ctaLabel = String(sanitized.ctaLabel || '').trim();

    if (!ctaLabel) {
      throw createError('CTA label is required.');
    }

    validateTextLength('CTA label', ctaLabel, HOME_BANNER_FIELD_LIMITS.ctaLabel);
    normalized.ctaLabel = ctaLabel;
  }

  if (requireAll || hasOwn(sanitized, 'ctaHref')) {
    const ctaHref = validateInternalCtaHref(sanitized.ctaHref);

    validateTextLength('CTA link', ctaHref, HOME_BANNER_FIELD_LIMITS.ctaHref);
    normalized.ctaHref = ctaHref;
  }

  if (requireAll || hasOwn(sanitized, 'imageUrl')) {
    normalized.imageUrl = validateHomeBannerImageUrl(sanitized.imageUrl);
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

export async function getActiveHomeBanners() {
  const banners = await HomeBanner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();

  return banners.map(normalizeHomeBannerResponse);
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
  const nextData = normalizeHomeBannerFields(data, { requireAll: false });

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
