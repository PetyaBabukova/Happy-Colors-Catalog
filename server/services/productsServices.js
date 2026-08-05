import Product from '../models/Product.js';
import HomeBanner from '../models/HomeBanner.js';
import BlogArticle from '../models/BlogArticle.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { sendEmail } from '../helpers/sendEmail.js';
import { deleteImageFromGCS, getBucketName } from '../helpers/gcsImageHelper.js';
import { revalidateProductSurfaces } from '../helpers/revalidateProducts.js';
import {
  isAllowedPosterStorageUrl,
  isAllowedVideoStorageUrl,
  normalizeStoredVideos,
} from '../helpers/productVideoHelper.js';
import {
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_VIDEOS_PER_PRODUCT,
} from '../config/productLimits.js';
import { HOMEPAGE_FEATURED_PRODUCTS_LIMIT } from '../config/homepageFeaturedProducts.js';
import { isFullAdmin, USER_ROLES } from '../utils/userRoles.js';
import {
  buildPublicProductFilter,
  isPublicProduct,
  normalizeReviewNote,
  PRODUCT_PUBLICATION_STATUSES,
  PRODUCT_REVIEW_STATUSES,
} from '../utils/productPublication.js';
import {
  canCreateProduct,
  canHardDeleteProduct,
  canManageProduct,
  canReviewProduct,
  canSubmitProductForReview,
  canViewProduct,
  canWithdrawProductReview,
} from '../utils/productPermissions.js';
import { getSourceRevision, projectPublicProduct } from './localization/publicProjection.js';

const ALLOWED_PRODUCT_FIELDS = new Set([
  'title',
  'description',
  'price',
  'imageUrl',
  'imageUrls',
  'videos',
  'category',
  'availability',
]);

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createForbiddenError(message) {
  const error = new Error(message);
  error.statusCode = 403;
  return error;
}

function buildClientUrl(path) {
  const baseUrl = String(process.env.CLIENT_URL || '').replace(/\/$/, '');
  return baseUrl ? `${baseUrl}${path}` : path;
}

function toEmailLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function assertProductStatus(product, allowedStatuses, message) {
  if (!allowedStatuses.includes(product.publicationStatus)) {
    throw createValidationError(message);
  }
}

function normalizeProductId(value) {
  return String(value || '').trim();
}

function normalizeProductImages(product) {
  const normalizedImageUrls = Array.isArray(product.imageUrls)
    ? product.imageUrls.filter(Boolean)
    : [];

  if (normalizedImageUrls.length === 0 && product.imageUrl) {
    normalizedImageUrls.push(product.imageUrl);
  }

  return {
    ...product,
    imageUrls: normalizedImageUrls,
    imageUrl: normalizedImageUrls[0] || product.imageUrl || '',
  };
}

function normalizeProductMedia(product) {
  const normalizedImages = normalizeProductImages(product);

  return {
    ...normalizedImages,
    videos: normalizeStoredVideos(normalizedImages.videos),
  };
}

function getTranslationEntry(translations, locale) {
  if (!translations) {
    return null;
  }

  if (typeof translations.get === 'function') {
    return translations.get(locale) || null;
  }

  return translations[locale] || null;
}

function getTranslationDecision(product, { changedPublicSource = false } = {}) {
  const englishTranslation = getTranslationEntry(product?.translations, 'en');
  const sourceRevision = getSourceRevision(product?.sourceRevision);
  const translationSourceRevision = getSourceRevision(englishTranslation?.sourceRevision);
  const translationRevision = Number(englishTranslation?.translationRevision) || 0;

  if (!changedPublicSource || !englishTranslation || translationSourceRevision === sourceRevision) {
    return null;
  }

  return {
    locale: 'en',
    status: 'needs_decision',
    sourceRevision,
    translationRevision,
    translationSourceRevision,
  };
}

function withTranslationDecision(product, options) {
  const normalized = normalizeProductMedia(product);
  const decision = getTranslationDecision(normalized, options);

  return decision
    ? {
        ...normalized,
        englishTranslationDecision: decision,
      }
    : normalized;
}

function hasDraftContent(product) {
  return Boolean(product?.draftContent && typeof product.draftContent === 'object');
}

function normalizeDraftContent(product) {
  if (!hasDraftContent(product)) {
    return null;
  }

  return normalizeProductMedia({
    ...product.draftContent,
    _id: product._id,
    owner: product.owner,
    publicationStatus: product.publicationStatus,
    reviewStatus: product.reviewStatus,
    reviewNote: product.reviewNote,
    draftRevision: product.draftRevision,
    draftUpdatedAt: product.draftUpdatedAt,
    draftSubmittedAt: product.draftSubmittedAt,
    draftSubmittedBy: product.draftSubmittedBy,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    isHomepageFeatured: product.isHomepageFeatured,
    homepageFeaturedOrder: product.homepageFeaturedOrder,
  });
}

function shouldExposeDraftContent(product, viewer) {
  if (!hasDraftContent(product)) {
    return false;
  }

  return canManageProduct(product, viewer) || canReviewProduct(viewer);
}

function normalizeProductForViewer(product, viewer = null) {
  if (shouldExposeDraftContent(product, viewer)) {
    return normalizeDraftContent(product);
  }

  return normalizeProductMedia(product);
}

function pickAllowedProductFields(source = {}) {
  const sanitized = {};

  for (const [key, value] of Object.entries(source)) {
    if (ALLOWED_PRODUCT_FIELDS.has(key)) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function normalizeImageFields(data = {}) {
  const normalizedImageUrls = Array.isArray(data.imageUrls)
    ? data.imageUrls.filter(Boolean)
    : data.imageUrl
      ? [data.imageUrl]
      : [];

  const fallbackImageUrl = data.imageUrl || normalizedImageUrls[0] || '';

  return {
    ...data,
    imageUrl: fallbackImageUrl,
    imageUrls:
      normalizedImageUrls.length > 0
        ? normalizedImageUrls
        : fallbackImageUrl
          ? [fallbackImageUrl]
          : [],
  };
}

function validateVideoOrigins(url, posterUrl, index) {
  if (!getBucketName()) {
    throw createValidationError('GCS_BUCKET_NAME не е конфигуриран за video validation.');
  }

  if (!isAllowedVideoStorageUrl(url)) {
    throw createValidationError(
      `Видео #${index + 1} трябва да бъде качено в разрешения video storage path.`
    );
  }

  if (!isAllowedPosterStorageUrl(posterUrl)) {
    throw createValidationError(
      `Poster image за видео #${index + 1} трябва да бъде качен в разрешения poster storage path.`
    );
  }
}

function normalizeIncomingVideo(video, index) {
  if (!video || typeof video !== 'object' || Array.isArray(video)) {
    throw createValidationError(`Видео #${index + 1} е невалидно.`);
  }

  const url = String(video.url || '').trim();
  const posterUrl = String(video.posterUrl || '').trim();
  const mimeType = String(video.mimeType || '').trim().toLowerCase();
  const durationSeconds = Number(video.durationSeconds);
  const uploadDateValue = video.uploadDate ? new Date(video.uploadDate) : new Date();

  if (!url) {
    throw createValidationError(`Видео #${index + 1} няма url.`);
  }

  if (!posterUrl) {
    throw createValidationError(`Видео #${index + 1} няма poster image.`);
  }

  validateVideoOrigins(url, posterUrl, index);

  if (!ALLOWED_VIDEO_MIME_TYPES.includes(mimeType)) {
    throw createValidationError('Поддържа се само MP4 видео формат.');
  }

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw createValidationError(`Видео #${index + 1} има невалидна продължителност.`);
  }

  if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    throw createValidationError(
      `Видео #${index + 1} надвишава максималната продължителност от ${MAX_VIDEO_DURATION_SECONDS} секунди.`
    );
  }

  if (Number.isNaN(uploadDateValue.getTime())) {
    throw createValidationError(`Видео #${index + 1} има невалидна upload дата.`);
  }

  return {
    url,
    posterUrl,
    mimeType,
    durationSeconds,
    uploadDate: uploadDateValue,
  };
}

function validateAndNormalizeVideos(videos, { allowMissing = false } = {}) {
  if (typeof videos === 'undefined') {
    return allowMissing ? undefined : [];
  }

  if (!Array.isArray(videos)) {
    throw createValidationError('Полето videos трябва да бъде масив.');
  }

  if (videos.length > MAX_VIDEOS_PER_PRODUCT) {
    throw createValidationError(
      `Продуктът може да има най-много ${MAX_VIDEOS_PER_PRODUCT} видеа.`
    );
  }

  const normalizedVideos = videos.map(normalizeIncomingVideo);
  const seenUrls = new Set();
  const seenPosterUrls = new Set();

  for (const video of normalizedVideos) {
    if (seenUrls.has(video.url)) {
      throw createValidationError('Едно и също видео е добавено повече от веднъж.');
    }

    if (seenPosterUrls.has(video.posterUrl)) {
      throw createValidationError('Един и същ poster image е добавен към повече от едно видео.');
    }

    seenUrls.add(video.url);
    seenPosterUrls.add(video.posterUrl);
  }

  return normalizedVideos;
}

async function assertVideoAssetsNotAttachedToOtherProduct(videos, currentProductId = null) {
  const assetUrls = [
    ...new Set(
      normalizeStoredVideos(videos).flatMap((video) => [video.url, video.posterUrl]).filter(Boolean)
    ),
  ];

  if (assetUrls.length === 0) {
    return;
  }

  const query = {
    ...(currentProductId ? { _id: { $ne: currentProductId } } : {}),
    $or: assetUrls.flatMap((assetUrl) => [
      { imageUrl: assetUrl },
      { imageUrls: assetUrl },
      { 'videos.url': assetUrl },
      { 'videos.posterUrl': assetUrl },
    ]),
  };
  const existingProduct = await Product.exists(query);

  if (existingProduct) {
    throw createValidationError('Един от video assets вече е записан към друг продукт.');
  }
}

function buildCreateProductData(data, user) {
  const sanitizedFields = pickAllowedProductFields(data);

  return {
    ...normalizeImageFields(sanitizedFields),
    videos: validateAndNormalizeVideos(sanitizedFields.videos),
    owner: user._id,
    publicationStatus: isFullAdmin(user)
      ? PRODUCT_PUBLICATION_STATUSES.PUBLISHED
      : PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW,
    reviewStatus: isFullAdmin(user)
      ? PRODUCT_REVIEW_STATUSES.NONE
      : PRODUCT_REVIEW_STATUSES.PENDING_REVIEW,
  };
}

async function notifyFullAdminsForProductReview(product, artist) {
  const isPendingReview =
    product.publicationStatus === PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW ||
    product.reviewStatus === PRODUCT_REVIEW_STATUSES.PENDING_REVIEW;

  if (isFullAdmin(artist) || !isPendingReview) {
    return { sent: false, recipients: 0 };
  }

  const admins = await User.find({ role: USER_ROLES.FULL_ADMIN }, { email: 1 }).lean();
  const adminEmails = [...new Set(admins.map((admin) => admin.email).filter(Boolean))];

  if (adminEmails.length === 0) {
    return { sent: false, recipients: 0 };
  }

  const productId = String(product._id);
  const reviewUrl = buildClientUrl(`/users/admin?reviewProduct=${productId}`);
  const approveUrl = buildClientUrl(`/users/admin?reviewProduct=${productId}&reviewAction=approve`);
  const postponeUrl = buildClientUrl(`/users/admin?reviewProduct=${productId}&reviewAction=postpone`);
  const rejectUrl = buildClientUrl(`/users/admin?reviewProduct=${productId}&reviewAction=reject`);

  try {
    await sendEmail({
      to: adminEmails,
      subject: `Product pending approval: ${toEmailLine(product.title)}`,
      text: [
        `Artist: ${toEmailLine(artist.username)} <${artist.email}>`,
        `Product: ${toEmailLine(product.title)}`,
        '',
        'A new artist product is waiting for admin review.',
        '',
        `Review: ${reviewUrl}`,
        `Approve: ${approveUrl}`,
        `Postpone: ${postponeUrl}`,
        `Reject: ${rejectUrl}`,
      ].join('\n'),
    });

    return { sent: true, recipients: adminEmails.length };
  } catch (error) {
    console.error('Failed to send product review notification:', error?.message || error);
    return { sent: false, recipients: adminEmails.length, error: true };
  }
}

function buildEditProductData(data) {
  const sanitizedFields = pickAllowedProductFields(data);
  const hasImageFields =
    Object.prototype.hasOwnProperty.call(sanitizedFields, 'imageUrl') ||
    Object.prototype.hasOwnProperty.call(sanitizedFields, 'imageUrls');
  const normalizedFields = hasImageFields ? normalizeImageFields(sanitizedFields) : { ...sanitizedFields };

  if (Object.prototype.hasOwnProperty.call(sanitizedFields, 'videos')) {
    normalizedFields.videos = validateAndNormalizeVideos(sanitizedFields.videos, {
      allowMissing: true,
    });
  }

  return normalizedFields;
}

function hasChangedField(target, updates, field) {
  if (!Object.prototype.hasOwnProperty.call(updates, field)) {
    return false;
  }

  return String(target?.[field] ?? '').trim() !== String(updates[field] ?? '').trim();
}

function hasProductSourceCopyChange(target, updates = {}) {
  return (
    hasChangedField(target, updates, 'title') ||
    hasChangedField(target, updates, 'description')
  );
}

function toStrictBoolean(value) {
  return value === true || value === 'true';
}

function normalizeCategoryFilterValue(value) {
  return String(value || '').trim().toLowerCase();
}

function categoryMatchesPublicFilter(category, filterValue) {
  const normalizedFilter = normalizeCategoryFilterValue(filterValue);

  if (!normalizedFilter) {
    return true;
  }

  const englishTranslation = getTranslationEntry(category?.translations, 'en');
  const candidates = [
    category?.canonicalSlug,
    category?.slug,
    category?.name,
    englishTranslation?.name,
    ...(Array.isArray(category?.slugAliases) ? category.slugAliases : []),
  ];

  return candidates.some((candidate) => normalizeCategoryFilterValue(candidate) === normalizedFilter);
}

// Прилага галерийните флагове само по admin път.
// Artist create → форсира каталог; artist edit → не пипа флаговете.
// mode: 'create' | 'edit'
function applyGalleryFlags(target, data = {}, user, mode) {
  if (isFullAdmin(user)) {
    target.isInCatalog = toStrictBoolean(data.isInCatalog);
    target.isCartoonGallery = toStrictBoolean(data.isCartoonGallery);
    return;
  }

  if (mode === 'create') {
    target.isInCatalog = true;
    target.isCartoonGallery = false;
  }
}

function collectVideoAssetsForCleanup(currentVideos, nextVideos) {
  if (!Array.isArray(nextVideos)) {
    return [];
  }

  const nextVideosByUrl = new Map(nextVideos.map((video) => [video.url, video]));
  const nextPosterUrls = new Set(nextVideos.map((video) => video.posterUrl));
  const assetsToDelete = new Set();

  for (const currentVideo of currentVideos) {
    const nextVideo = nextVideosByUrl.get(currentVideo.url);

    if (!nextVideo) {
      assetsToDelete.add(currentVideo.url);
      if (!nextPosterUrls.has(currentVideo.posterUrl)) {
        assetsToDelete.add(currentVideo.posterUrl);
      }
      continue;
    }

    if (
      currentVideo.posterUrl !== nextVideo.posterUrl &&
      !nextPosterUrls.has(currentVideo.posterUrl)
    ) {
      assetsToDelete.add(currentVideo.posterUrl);
    }
  }

  return [...assetsToDelete].filter(Boolean);
}

function addProductAssetUrls(assetUrls, source = {}) {
  if (!source) {
    return;
  }

  if (source.imageUrl) {
    assetUrls.add(source.imageUrl);
  }

  for (const imageUrl of source.imageUrls || []) {
    if (imageUrl) {
      assetUrls.add(imageUrl);
    }
  }

  for (const video of normalizeStoredVideos(source.videos)) {
    if (video.url) {
      assetUrls.add(video.url);
    }

    if (video.posterUrl) {
      assetUrls.add(video.posterUrl);
    }
  }
}

function collectProductAssetUrls(product = {}) {
  const assetUrls = new Set();

  addProductAssetUrls(assetUrls, product);
  addProductAssetUrls(assetUrls, product.draftContent);

  return [...assetUrls].filter(Boolean);
}

async function deleteAssetsFromStorage(
  assetUrls,
  { excludeProductId = null, throwOnError = false } = {}
) {
  try {
    const uniqueAssetUrls = [...new Set(assetUrls.filter(Boolean))];

    if (uniqueAssetUrls.length === 0) {
      return;
    }

    const [homeBannerRefs, productRefs, blogArticleRefs] = await Promise.all([
      HomeBanner.find(
        {
          $or: [
            { imageUrl: { $in: uniqueAssetUrls } },
            { mobileImageUrl: { $in: uniqueAssetUrls } },
          ],
        },
        { imageUrl: 1, mobileImageUrl: 1 }
      ).lean(),
      Product.find(
        {
          ...(excludeProductId ? { _id: { $ne: excludeProductId } } : {}),
          $or: [
            { imageUrl: { $in: uniqueAssetUrls } },
            { imageUrls: { $in: uniqueAssetUrls } },
            { 'videos.url': { $in: uniqueAssetUrls } },
            { 'videos.posterUrl': { $in: uniqueAssetUrls } },
            { 'draftContent.imageUrl': { $in: uniqueAssetUrls } },
            { 'draftContent.imageUrls': { $in: uniqueAssetUrls } },
            { 'draftContent.videos.url': { $in: uniqueAssetUrls } },
            { 'draftContent.videos.posterUrl': { $in: uniqueAssetUrls } },
          ],
        },
        { imageUrl: 1, imageUrls: 1, videos: 1, draftContent: 1 }
      ).lean(),
      BlogArticle.find(
        {
          $or: [
            { heroImageUrl: { $in: uniqueAssetUrls } },
            { thumbnailImageUrl: { $in: uniqueAssetUrls } },
          ],
        },
        { heroImageUrl: 1, thumbnailImageUrl: 1 }
      ).lean(),
    ]);
    const referencedAssetUrls = new Set(
      homeBannerRefs.flatMap((banner) => [banner.imageUrl, banner.mobileImageUrl].filter(Boolean))
    );

    for (const product of productRefs) {
      for (const assetUrl of collectProductAssetUrls(product)) {
        if (uniqueAssetUrls.includes(assetUrl)) {
          referencedAssetUrls.add(assetUrl);
        }
      }
    }

    for (const article of blogArticleRefs) {
      if (uniqueAssetUrls.includes(article.heroImageUrl)) {
        referencedAssetUrls.add(article.heroImageUrl);
      }

      if (uniqueAssetUrls.includes(article.thumbnailImageUrl)) {
        referencedAssetUrls.add(article.thumbnailImageUrl);
      }
    }

    const deletionCandidates = uniqueAssetUrls.filter((assetUrl) => !referencedAssetUrls.has(assetUrl));

    await Promise.all(
      deletionCandidates.map((assetUrl) => deleteImageFromGCS(assetUrl, { throwOnError }))
    );
  } catch (error) {
    console.error('Error while deleting product assets from storage:', error);
    if (throwOnError) {
      throw error;
    }
  }
}

export async function getAllProducts(categoryName, { locale = 'bg' } = {}) {
  const products = await Product.find({
    // $and, защото buildPublicProductFilter() сам ползва $or за publicationStatus.
    // Legacy handling: продукти без isInCatalog се третират като каталожни.
    // Вторият клон се маха в cleanup deploy след migration.
    $and: [
      buildPublicProductFilter(),
      { $or: [{ isInCatalog: true }, { isInCatalog: { $exists: false } }] },
    ],
  })
    .populate('category', 'name slug canonicalSlug slugAliases translations sourceRevision')
    .lean();

  return products
    .filter((product) => categoryMatchesPublicFilter(product.category, categoryName))
    .map((product) => projectPublicProduct(normalizeProductMedia(product), locale));
}

export async function getHomepageFeaturedProducts({ locale = 'bg' } = {}) {
  const products = await Product.find({
    ...buildPublicProductFilter(),
    isHomepageFeatured: true,
    availability: { $ne: 'unavailable' },
  })
    .sort({ homepageFeaturedOrder: 1, _id: 1 })
    .limit(HOMEPAGE_FEATURED_PRODUCTS_LIMIT)
    .populate('category', 'name slug canonicalSlug slugAliases translations sourceRevision')
    .lean();

  return products.map((product) => projectPublicProduct(normalizeProductMedia(product), locale));
}

export async function getCartoonGalleryProducts({ locale = 'bg' } = {}) {
  const products = await Product.find({
    ...buildPublicProductFilter(),
    isCartoonGallery: true,
    availability: { $ne: 'unavailable' },
  })
    .populate('category', 'name slug canonicalSlug slugAliases translations sourceRevision')
    .lean();

  return products.map((product) => projectPublicProduct(normalizeProductMedia(product), locale));
}

function validateHomepageFeaturedProductIds(productIds) {
  if (!Array.isArray(productIds)) {
    throw createValidationError('Списъкът с продукти трябва да бъде масив.');
  }

  if (productIds.length > HOMEPAGE_FEATURED_PRODUCTS_LIMIT) {
    throw createValidationError(
      `Можете да изберете най-много ${HOMEPAGE_FEATURED_PRODUCTS_LIMIT} продукта за началната страница.`
    );
  }

  const normalizedProductIds = productIds.map(normalizeProductId);

  if (normalizedProductIds.some((productId) => !mongoose.Types.ObjectId.isValid(productId))) {
    throw createValidationError('Списъкът съдържа невалиден продукт.');
  }

  if (new Set(normalizedProductIds).size !== normalizedProductIds.length) {
    throw createValidationError('Един продукт е избран повече от веднъж.');
  }

  return normalizedProductIds;
}

export async function updateHomepageFeaturedProducts(productIds) {
  const normalizedProductIds = validateHomepageFeaturedProductIds(productIds);
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      if (normalizedProductIds.length > 0) {
        const selectedProducts = await Product.find({
          _id: { $in: normalizedProductIds },
        })
          .session(session)
          .lean();

        if (selectedProducts.length !== normalizedProductIds.length) {
          throw createNotFoundError('Един или повече от избраните продукти не съществуват.');
        }

        const unavailableProduct = selectedProducts.find(
          (product) => product.availability === 'unavailable'
        );

        const nonPublicProduct = selectedProducts.find((product) => !isPublicProduct(product));

        if (unavailableProduct) {
          throw createValidationError('Неналичен продукт не може да бъде избран за началната страница.');
        }
        if (nonPublicProduct) {
          throw createValidationError('Only published products can be selected for the homepage.');
        }
      }

      await Product.updateMany(
        { isHomepageFeatured: true, _id: { $nin: normalizedProductIds } },
        { $set: { isHomepageFeatured: false, homepageFeaturedOrder: 0 } },
        { session }
      );

      await Promise.all(
        normalizedProductIds.map((productId, index) =>
          Product.updateOne(
            { _id: productId },
            { $set: { isHomepageFeatured: true, homepageFeaturedOrder: index } },
            { session }
          )
        )
      );
    });
  } catch (error) {
    if (!error.statusCode) {
      error.statusCode = 500;
      error.message = error.message || 'Неуспешно обновяване на продуктите за началната страница.';
    }

    throw error;
  } finally {
    await session.endSession();
  }

  await revalidateProductSurfaces();

  return getHomepageFeaturedProducts();
}

export async function createProduct(data, user) {
  if (!canCreateProduct(user)) {
    throw createForbiddenError('РќСЏРјР°С‚Рµ РїСЂР°РІР° РґР° СЃСЉР·РґР°РІР°С‚Рµ РїСЂРѕРґСѓРєС‚.');
  }

  const productData = buildCreateProductData(data, user);

  applyGalleryFlags(productData, data, user, 'create');

  await assertVideoAssetsNotAttachedToOtherProduct(productData.videos);

  const product = new Product(productData);
  const savedProduct = await product.save();
  await notifyFullAdminsForProductReview(savedProduct, user);
  if (savedProduct.publicationStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED) {
    await revalidateProductSurfaces({ productId: savedProduct._id });
  }

  return normalizeProductMedia(savedProduct.toObject());
}

export async function getProductById(productId, viewer = null, { locale = 'bg' } = {}) {
  const product = await Product.findById(productId)
    .populate('category', 'name slug canonicalSlug slugAliases translations sourceRevision')
    .lean();

  if (!canViewProduct(product, viewer)) {
    return null;
  }

  if (shouldExposeDraftContent(product, viewer)) {
    return normalizeProductForViewer(product, viewer);
  }

  return projectPublicProduct(normalizeProductMedia(product), locale);
}

export async function getManagedProductById(productId, user) {
  const product = await Product.findById(productId)
    .populate('category', 'name')
    .lean();

  if (!canViewProduct(product, user)) {
    return null;
  }

  const normalized = normalizeProductMedia(product);

  // Гарантира boolean стойности за edit формата (стари продукти без полетата).
  normalized.isInCatalog = Boolean(normalized.isInCatalog);
  normalized.isCartoonGallery = Boolean(normalized.isCartoonGallery);

  return normalized;
}

export async function getMyProducts(user, { page = 1, limit = 50 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const activeProductFilter = {
    publicationStatus: { $ne: PRODUCT_PUBLICATION_STATUSES.DELETED },
  };

  if (isFullAdmin(user)) {
    const products = await Product.find(activeProductFilter)
      .sort({ updatedAt: -1, _id: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('category', 'name')
      .lean();

    return products.map(normalizeProductMedia);
  }

  if (!canCreateProduct(user)) {
    throw createForbiddenError('Forbidden');
  }

  const products = await Product.find({ owner: user._id, ...activeProductFilter })
    .sort({ updatedAt: -1, _id: -1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .populate('category', 'name')
    .lean();

  return products.map(normalizeProductMedia);
}

export async function getProductReviewQueue(user, { page = 1, limit = 50 } = {}) {
  if (!canReviewProduct(user)) {
    throw createForbiddenError('Forbidden');
  }

  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const products = await Product.find({
    $or: [
      { publicationStatus: PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW },
      { reviewStatus: PRODUCT_REVIEW_STATUSES.PENDING_REVIEW },
    ],
    publicationStatus: { $ne: PRODUCT_PUBLICATION_STATUSES.DELETED },
  })
    .sort({ updatedAt: 1, _id: 1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .populate('category', 'name')
    .lean();

  return products.map((product) => normalizeProductForViewer(product, user));
}

export async function editProduct(productId, productData, user) {
  const product = await Product.findById(productId);

  if (!product) {
    throw createNotFoundError('Продуктът не съществува.');
  }

  if (!canManageProduct(product, user)) {
    throw createForbiddenError('Нямате права да редактирате този продукт.');
  }

  const currentImageUrls = Array.isArray(product.imageUrls)
    ? product.imageUrls.filter(Boolean)
    : product.imageUrl
      ? [product.imageUrl]
      : [];
  const currentVideos = normalizeStoredVideos(product.videos);
  const sanitizedProductData = buildEditProductData(productData);
  const wasPublic = isPublicProduct(product);
  const isAdminEdit = isFullAdmin(user);
  const isArtistEditingPublishedProduct =
    !isAdminEdit && product.publicationStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED;
  const editSource = isArtistEditingPublishedProduct && hasDraftContent(product)
    ? product.draftContent
    : product;
  const hasSourceCopyChange = hasProductSourceCopyChange(editSource, sanitizedProductData);
  const sourceImageUrls = Array.isArray(editSource.imageUrls)
    ? editSource.imageUrls.filter(Boolean)
    : editSource.imageUrl
      ? [editSource.imageUrl]
      : [];
  const sourceVideos = normalizeStoredVideos(editSource.videos);

  if (Object.prototype.hasOwnProperty.call(sanitizedProductData, 'videos')) {
    await assertVideoAssetsNotAttachedToOtherProduct(sanitizedProductData.videos, product._id);
  }

  const incomingImageUrls = Array.isArray(sanitizedProductData.imageUrls)
    ? sanitizedProductData.imageUrls.filter(Boolean)
    : sanitizedProductData.imageUrl
      ? [sanitizedProductData.imageUrl]
      : [];
  const hasIncomingImageFields =
    Object.prototype.hasOwnProperty.call(sanitizedProductData, 'imageUrl') ||
    Object.prototype.hasOwnProperty.call(sanitizedProductData, 'imageUrls');
  const nextImageUrls = hasIncomingImageFields
    ? [...new Set(incomingImageUrls)]
    : sourceImageUrls;

  if (isArtistEditingPublishedProduct) {
    product.draftContent = {
      title: sanitizedProductData.title ?? editSource.title,
      description: sanitizedProductData.description ?? editSource.description,
      price: sanitizedProductData.price ?? editSource.price,
      category: sanitizedProductData.category ?? editSource.category,
      availability: sanitizedProductData.availability || editSource.availability || 'available',
      imageUrls: nextImageUrls,
      imageUrl: nextImageUrls[0] || '',
      videos: Object.prototype.hasOwnProperty.call(sanitizedProductData, 'videos')
        ? sanitizedProductData.videos
        : sourceVideos,
    };
    product.reviewStatus = PRODUCT_REVIEW_STATUSES.PENDING_REVIEW;
    product.reviewNote = '';
    product.draftRevision = (product.draftRevision || 0) + 1;
    product.draftUpdatedAt = new Date();
    product.draftSubmittedAt = new Date();
    product.draftSubmittedBy = user._id;

    await product.save();
    await notifyFullAdminsForProductReview(product, user);

    return normalizeProductForViewer(product.toObject(), user);
  }

  if (hasSourceCopyChange) {
    product.sourceRevision = (Number(product.sourceRevision) || 1) + 1;
  }

  for (const [key, value] of Object.entries(sanitizedProductData)) {
    if (key === 'imageUrl' || key === 'imageUrls' || key === 'videos') {
      continue;
    }

    product[key] = value;
  }

  product.imageUrls = nextImageUrls;
  product.imageUrl = nextImageUrls[0] || '';

  const videoAssetsToDelete = Object.prototype.hasOwnProperty.call(sanitizedProductData, 'videos')
    ? collectVideoAssetsForCleanup(currentVideos, sanitizedProductData.videos)
    : [];

  if (Object.prototype.hasOwnProperty.call(sanitizedProductData, 'videos')) {
    product.videos = sanitizedProductData.videos;
  }

  if (isAdminEdit) {
    if (product.publicationStatus !== PRODUCT_PUBLICATION_STATUSES.PUBLISHED) {
      product.publicationStatus = PRODUCT_PUBLICATION_STATUSES.PUBLISHED;
      product.reviewedBy = user._id;
      product.reviewedAt = new Date();
      product.reviewNote = undefined;
    }
  } else {
    product.publicationStatus = PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW;
    product.reviewStatus = PRODUCT_REVIEW_STATUSES.PENDING_REVIEW;
    product.reviewNote = '';
    product.draftRevision = (product.draftRevision || 0) + 1;
    product.draftUpdatedAt = new Date();
    product.draftSubmittedAt = new Date();
    product.draftSubmittedBy = user._id;
  }

  applyGalleryFlags(product, productData, user, 'edit');

  await product.save();
  await deleteAssetsFromStorage(videoAssetsToDelete, { excludeProductId: product._id });
  if (!isAdminEdit) {
    await notifyFullAdminsForProductReview(product, user);
  }
  if (wasPublic || product.publicationStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED) {
    await revalidateProductSurfaces({ productId: product._id });
  }

  return withTranslationDecision(product.toObject(), {
    changedPublicSource:
      isAdminEdit &&
      product.publicationStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED &&
      hasSourceCopyChange,
  });
}

export async function deleteProduct(productId, user) {
  const product = await Product.findById(productId);

  if (!product) {
    throw createNotFoundError('Продуктът не беше намерен');
  }

  if (!canHardDeleteProduct(product, user)) {
    throw createForbiddenError('Нямате права да изтриете този продукт.');
  }

  const wasPublic = isPublicProduct(product);
  const assetUrls = collectProductAssetUrls(product);

  await deleteAssetsFromStorage(assetUrls, { excludeProductId: product._id, throwOnError: true });
  await Product.findByIdAndDelete(product._id);

  if (wasPublic) {
    await revalidateProductSurfaces({ productId: product._id });
  }

  return { message: 'Продуктът беше изтрит успешно.' };
}

export async function submitProductForReview(productId, user) {
  const product = await Product.findById(productId);

  if (!product) {
    throw createNotFoundError('Product does not exist.');
  }

  if (!canSubmitProductForReview(product, user)) {
    throw createForbiddenError('Forbidden');
  }

  product.publicationStatus = PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW;
  product.reviewStatus = PRODUCT_REVIEW_STATUSES.PENDING_REVIEW;
  product.draftSubmittedAt = new Date();
  product.draftSubmittedBy = user._id;
  await product.save();
  await notifyFullAdminsForProductReview(product, user);

  return normalizeProductMedia(product.toObject());
}

export async function withdrawProductReview(productId, user) {
  const product = await Product.findById(productId);

  if (!product) {
    throw createNotFoundError('Product does not exist.');
  }

  if (!canWithdrawProductReview(product, user)) {
    throw createForbiddenError('Forbidden');
  }

  product.publicationStatus = PRODUCT_PUBLICATION_STATUSES.DRAFT;
  product.reviewStatus = PRODUCT_REVIEW_STATUSES.DRAFT;
  await product.save();

  return normalizeProductMedia(product.toObject());
}

async function setReviewedProductStatus(productId, user, nextStatus, reviewNote = '') {
  if (!canReviewProduct(user)) {
    throw createForbiddenError('Forbidden');
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw createNotFoundError('Product does not exist.');
  }

  if (
    [
      PRODUCT_PUBLICATION_STATUSES.PUBLISHED,
      PRODUCT_PUBLICATION_STATUSES.REJECTED,
    ].includes(nextStatus)
  ) {
    const isPendingReview =
      product.publicationStatus === PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW ||
      product.reviewStatus === PRODUCT_REVIEW_STATUSES.PENDING_REVIEW;

    if (!isPendingReview) {
      throw createValidationError('Only products pending review can be approved or rejected.');
    }
  }

  if (nextStatus === PRODUCT_PUBLICATION_STATUSES.ARCHIVED) {
    assertProductStatus(
      product,
      [
        PRODUCT_PUBLICATION_STATUSES.PUBLISHED,
        PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW,
      ],
      'Only published products or products pending review can be archived.'
    );
  }

  if (nextStatus === PRODUCT_PUBLICATION_STATUSES.DRAFT) {
    assertProductStatus(
      product,
      [
        PRODUCT_PUBLICATION_STATUSES.ARCHIVED,
      ],
      'Only archived products can be restored to draft.'
    );
  }

  const wasPublic = isPublicProduct(product);
  let approvedDraftAssetsToDelete = [];
  let approvedDraftChangedPublicSource = false;
  product.reviewedBy = user._id;
  product.reviewedAt = new Date();

  if (nextStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED && hasDraftContent(product)) {
    const draftContent = typeof product.draftContent.toObject === 'function'
      ? product.draftContent.toObject()
      : product.draftContent;
    const previousPublicAssetUrls = collectProductAssetUrls(product.toObject());
    const nextPublicAssetUrls = new Set(collectProductAssetUrls(draftContent));
    const hasSourceCopyChange = hasProductSourceCopyChange(product, draftContent);

    approvedDraftAssetsToDelete = previousPublicAssetUrls.filter(
      (assetUrl) => !nextPublicAssetUrls.has(assetUrl)
    );

    if (hasSourceCopyChange) {
      product.sourceRevision = (Number(product.sourceRevision) || 1) + 1;
      approvedDraftChangedPublicSource = true;
    }

    product.title = draftContent.title;
    product.description = draftContent.description;
    product.price = draftContent.price;
    product.category = draftContent.category;
    product.availability = draftContent.availability || 'available';
    product.imageUrl = draftContent.imageUrl || '';
    product.imageUrls = Array.isArray(draftContent.imageUrls) ? draftContent.imageUrls.filter(Boolean) : [];
    product.videos = normalizeStoredVideos(draftContent.videos);
    product.draftContent = null;
  }

  if (
    nextStatus === PRODUCT_PUBLICATION_STATUSES.REJECTED &&
    product.publicationStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED
  ) {
    product.reviewStatus = PRODUCT_REVIEW_STATUSES.REJECTED;
  } else {
    product.publicationStatus = nextStatus;
  }

  if (nextStatus === PRODUCT_PUBLICATION_STATUSES.REJECTED) {
    product.reviewStatus = PRODUCT_REVIEW_STATUSES.REJECTED;
    product.reviewNote = normalizeReviewNote(reviewNote, { required: true });
  } else if (nextStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED) {
    product.reviewStatus = PRODUCT_REVIEW_STATUSES.NONE;
    product.reviewNote = '';
    product.draftContent = null;
    product.draftSubmittedAt = null;
    product.draftSubmittedBy = null;
  }

  if (nextStatus === PRODUCT_PUBLICATION_STATUSES.ARCHIVED) {
    product.isHomepageFeatured = false;
    product.homepageFeaturedOrder = 0;
  }

  if (nextStatus === PRODUCT_PUBLICATION_STATUSES.DRAFT) {
    product.isHomepageFeatured = false;
    product.homepageFeaturedOrder = 0;
  }

  await product.save();
  await deleteAssetsFromStorage(approvedDraftAssetsToDelete, { excludeProductId: product._id });

  if (wasPublic || nextStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED) {
    await revalidateProductSurfaces({ productId: product._id });
  }

  return withTranslationDecision(product.toObject(), {
    changedPublicSource:
      nextStatus === PRODUCT_PUBLICATION_STATUSES.PUBLISHED &&
      approvedDraftChangedPublicSource,
  });
}

export function approveProduct(productId, user) {
  return setReviewedProductStatus(productId, user, PRODUCT_PUBLICATION_STATUSES.PUBLISHED);
}

export function rejectProduct(productId, user, reviewNote) {
  return setReviewedProductStatus(
    productId,
    user,
    PRODUCT_PUBLICATION_STATUSES.REJECTED,
    reviewNote
  );
}

export function archiveProduct(productId, user) {
  return setReviewedProductStatus(productId, user, PRODUCT_PUBLICATION_STATUSES.ARCHIVED);
}

export function restoreProduct(productId, user) {
  return setReviewedProductStatus(productId, user, PRODUCT_PUBLICATION_STATUSES.DRAFT);
}
