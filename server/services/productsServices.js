import Product from '../models/Product.js';
import HomeBanner from '../models/HomeBanner.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { sendEmail } from '../helpers/sendEmail.js';
import { deleteImageFromGCS, getBucketName } from '../helpers/gcsImageHelper.js';
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
  };
}

async function notifyFullAdminsForProductReview(product, artist) {
  if (isFullAdmin(artist) || product.publicationStatus !== PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW) {
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
  const normalizedFields = normalizeImageFields(sanitizedFields);

  if (Object.prototype.hasOwnProperty.call(sanitizedFields, 'videos')) {
    normalizedFields.videos = validateAndNormalizeVideos(sanitizedFields.videos, {
      allowMissing: true,
    });
  }

  return normalizedFields;
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

async function deleteAssetsFromStorage(assetUrls, { excludeProductId = null } = {}) {
  try {
    const uniqueAssetUrls = [...new Set(assetUrls.filter(Boolean))];

    if (uniqueAssetUrls.length === 0) {
      return;
    }

    const [homeBannerRefs, productRefs] = await Promise.all([
      HomeBanner.find({ imageUrl: { $in: uniqueAssetUrls } }, { imageUrl: 1 }).lean(),
      Product.find(
        {
          ...(excludeProductId ? { _id: { $ne: excludeProductId } } : {}),
          $or: [
            { imageUrl: { $in: uniqueAssetUrls } },
            { imageUrls: { $in: uniqueAssetUrls } },
            { 'videos.url': { $in: uniqueAssetUrls } },
            { 'videos.posterUrl': { $in: uniqueAssetUrls } },
          ],
        },
        { imageUrl: 1, imageUrls: 1, videos: 1 }
      ).lean(),
    ]);
    const referencedAssetUrls = new Set(homeBannerRefs.map((banner) => banner.imageUrl));

    for (const product of productRefs) {
      if (uniqueAssetUrls.includes(product.imageUrl)) {
        referencedAssetUrls.add(product.imageUrl);
      }

      for (const imageUrl of product.imageUrls || []) {
        if (uniqueAssetUrls.includes(imageUrl)) {
          referencedAssetUrls.add(imageUrl);
        }

      }

      for (const video of normalizeStoredVideos(product.videos)) {
        if (uniqueAssetUrls.includes(video.url)) {
          referencedAssetUrls.add(video.url);
        }

        if (uniqueAssetUrls.includes(video.posterUrl)) {
          referencedAssetUrls.add(video.posterUrl);
        }
      }
    }

    const deletionCandidates = uniqueAssetUrls.filter((assetUrl) => !referencedAssetUrls.has(assetUrl));

    await Promise.all(deletionCandidates.map((assetUrl) => deleteImageFromGCS(assetUrl)));
  } catch (error) {
    console.error('Error while deleting product assets from storage:', error);
  }
}

export async function getAllProducts(categoryName) {
  const products = await Product.find(buildPublicProductFilter())
    .populate('category', 'name')
    .lean();

  const normalizedProducts = products.map(normalizeProductMedia);

  if (categoryName) {
    return normalizedProducts.filter((product) => product.category?.name === categoryName);
  }

  return normalizedProducts;
}

export async function getHomepageFeaturedProducts() {
  const products = await Product.find({
    ...buildPublicProductFilter(),
    isHomepageFeatured: true,
    availability: { $ne: 'unavailable' },
  })
    .sort({ homepageFeaturedOrder: 1, _id: 1 })
    .limit(HOMEPAGE_FEATURED_PRODUCTS_LIMIT)
    .populate('category', 'name')
    .lean();

  return products.map(normalizeProductMedia);
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

  return getHomepageFeaturedProducts();
}

export async function createProduct(data, user) {
  if (!canCreateProduct(user)) {
    throw createForbiddenError('РќСЏРјР°С‚Рµ РїСЂР°РІР° РґР° СЃСЉР·РґР°РІР°С‚Рµ РїСЂРѕРґСѓРєС‚.');
  }

  const productData = buildCreateProductData(data, user);

  await assertVideoAssetsNotAttachedToOtherProduct(productData.videos);

  const product = new Product(productData);
  const savedProduct = await product.save();
  await notifyFullAdminsForProductReview(savedProduct, user);

  return normalizeProductMedia(savedProduct.toObject());
}

export async function getProductById(productId, viewer = null) {
  const product = await Product.findById(productId)
    .populate('category', 'name')
    .lean();

  if (!canViewProduct(product, viewer)) {
    return null;
  }

  return normalizeProductMedia(product);
}

export async function getManagedProductById(productId, user) {
  const product = await Product.findById(productId)
    .populate('category', 'name')
    .lean();

  if (!canViewProduct(product, user)) {
    return null;
  }

  return normalizeProductMedia(product);
}

export async function getMyProducts(user, { page = 1, limit = 50 } = {}) {
  const safePage = Math.max(Number(page) || 1, 1);
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

  if (isFullAdmin(user)) {
    const products = await Product.find()
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

  const products = await Product.find({ owner: user._id })
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
    publicationStatus: PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW,
  })
    .sort({ updatedAt: 1, _id: 1 })
    .skip((safePage - 1) * safeLimit)
    .limit(safeLimit)
    .populate('category', 'name')
    .lean();

  return products.map(normalizeProductMedia);
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

  if (Object.prototype.hasOwnProperty.call(sanitizedProductData, 'videos')) {
    await assertVideoAssetsNotAttachedToOtherProduct(sanitizedProductData.videos, product._id);
  }

  const incomingImageUrls = Array.isArray(sanitizedProductData.imageUrls)
    ? sanitizedProductData.imageUrls.filter(Boolean)
    : sanitizedProductData.imageUrl
      ? [sanitizedProductData.imageUrl]
      : [];
  const mergedImageUrls = [...new Set([...currentImageUrls, ...incomingImageUrls])];

  for (const [key, value] of Object.entries(sanitizedProductData)) {
    if (key === 'imageUrl' || key === 'imageUrls' || key === 'videos') {
      continue;
    }

    product[key] = value;
  }

  product.imageUrls = mergedImageUrls;
  product.imageUrl = mergedImageUrls[0] || '';

  const videoAssetsToDelete = Object.prototype.hasOwnProperty.call(sanitizedProductData, 'videos')
    ? collectVideoAssetsForCleanup(currentVideos, sanitizedProductData.videos)
    : [];

  if (Object.prototype.hasOwnProperty.call(sanitizedProductData, 'videos')) {
    product.videos = sanitizedProductData.videos;
  }

  if (isFullAdmin(user)) {
    if (product.publicationStatus !== PRODUCT_PUBLICATION_STATUSES.PUBLISHED) {
      product.publicationStatus = PRODUCT_PUBLICATION_STATUSES.PUBLISHED;
      product.reviewedBy = user._id;
      product.reviewedAt = new Date();
      product.reviewNote = undefined;
    }
  } else if (product.publicationStatus === PRODUCT_PUBLICATION_STATUSES.REJECTED) {
    product.publicationStatus = PRODUCT_PUBLICATION_STATUSES.DRAFT;
  }

  await product.save();
  await deleteAssetsFromStorage(videoAssetsToDelete, { excludeProductId: product._id });

  return normalizeProductMedia(product.toObject());
}

export async function deleteProduct(productId, user) {
  const product = await Product.findById(productId);

  if (!product) {
    throw createNotFoundError('Продуктът не беше намерен');
  }

  if (!canHardDeleteProduct(product, user)) {
    throw createForbiddenError('Нямате права да изтриете този продукт.');
  }

  const imageUrlsToDelete =
    Array.isArray(product.imageUrls) && product.imageUrls.length > 0
      ? product.imageUrls.filter(Boolean)
      : product.imageUrl
        ? [product.imageUrl]
        : [];
  const videosToDelete = normalizeStoredVideos(product.videos);
  const videoAssetUrls = videosToDelete.flatMap((video) => [video.url, video.posterUrl]);

  await Product.findByIdAndDelete(productId);
  await deleteAssetsFromStorage([...imageUrlsToDelete, ...videoAssetUrls], { excludeProductId: product._id });

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
  await product.save();

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
    assertProductStatus(
      product,
      [PRODUCT_PUBLICATION_STATUSES.PENDING_REVIEW],
      'Only products pending review can be approved or rejected.'
    );
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
      [PRODUCT_PUBLICATION_STATUSES.ARCHIVED],
      'Only archived products can be restored to draft.'
    );
  }

  product.publicationStatus = nextStatus;
  product.reviewedBy = user._id;
  product.reviewedAt = new Date();

  if (nextStatus === PRODUCT_PUBLICATION_STATUSES.REJECTED) {
    product.reviewNote = normalizeReviewNote(reviewNote, { required: true });
  }

  await product.save();

  return normalizeProductMedia(product.toObject());
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
