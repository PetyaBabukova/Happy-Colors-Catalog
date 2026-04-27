import Product from '../models/Product.js';
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

function buildCreateProductData(data, ownerId) {
  const sanitizedFields = pickAllowedProductFields(data);

  return {
    ...normalizeImageFields(sanitizedFields),
    videos: validateAndNormalizeVideos(sanitizedFields.videos),
    owner: ownerId,
  };
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

async function deleteAssetsFromStorage(assetUrls) {
  try {
    await Promise.all(assetUrls.map((assetUrl) => deleteImageFromGCS(assetUrl)));
  } catch (error) {
    console.error('Error while deleting product assets from storage:', error);
  }
}

export async function getAllProducts(categoryName) {
  const products = await Product.find()
    .populate('category', 'name')
    .lean();

  const normalizedProducts = products.map(normalizeProductMedia);

  if (categoryName) {
    return normalizedProducts.filter((product) => product.category?.name === categoryName);
  }

  return normalizedProducts;
}

export async function createProduct(data, ownerId) {
  const productData = buildCreateProductData(data, ownerId);

  await assertVideoAssetsNotAttachedToOtherProduct(productData.videos);

  const product = new Product(productData);
  const savedProduct = await product.save();

  return normalizeProductMedia(savedProduct.toObject());
}

export async function getProductById(productId) {
  const product = await Product.findById(productId)
    .populate('category', 'name')
    .lean();

  if (!product) {
    return null;
  }

  return normalizeProductMedia(product);
}

export async function editProduct(productId, productData, userId) {
  const product = await Product.findById(productId);

  if (!product) {
    throw createNotFoundError('Продуктът не съществува.');
  }

  if (product.owner.toString() !== userId) {
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

  await product.save();
  await deleteAssetsFromStorage(videoAssetsToDelete);

  return normalizeProductMedia(product.toObject());
}

export async function deleteProduct(productId, userId) {
  const product = await Product.findById(productId);

  if (!product) {
    throw createNotFoundError('Продуктът не беше намерен');
  }

  if (product.owner.toString() !== userId) {
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
  await deleteAssetsFromStorage([...imageUrlsToDelete, ...videoAssetUrls]);

  return { message: 'Продуктът беше изтрит успешно.' };
}
