import { Storage } from '@google-cloud/storage';
import { CARTOON_ORDER_PHOTO_PREFIX } from '../config/productLimits.js';

const storage = new Storage();

export function getBucketName() {
  return process.env.GCS_BUCKET_NAME || '';
}

export function getCartoonOrdersBucketName() {
  const privateBucketName = process.env.GCS_CARTOON_ORDERS_BUCKET_NAME || '';

  if (privateBucketName) {
    return privateBucketName;
  }

  // Development/test convenience only; production must use a private cartoon-orders bucket.
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    ? getBucketName()
    : '';
}

export function isCartoonOrderPhotoObjectName(objectName) {
  return (
    typeof objectName === 'string' &&
    objectName.startsWith(`${CARTOON_ORDER_PHOTO_PREFIX}/`) &&
    !objectName.split('/').some((part) => part === '..' || part === '.' || part.includes('\\'))
  );
}

export async function createCartoonOrderPhotoSignedReadUrl({
  objectName,
  expiresInMs = 10 * 60 * 1000,
} = {}) {
  if (!isCartoonOrderPhotoObjectName(objectName)) {
    throw new Error('Invalid cartoon order photo object name.');
  }

  const bucketName = getCartoonOrdersBucketName();

  if (!bucketName) {
    throw new Error('GCS_CARTOON_ORDERS_BUCKET_NAME is not configured.');
  }

  const [signedUrl] = await storage
    .bucket(bucketName)
    .file(objectName)
    .getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMs,
    });

  return signedUrl;
}

export async function deleteGcsObjectByName(objectName, { throwOnError = false } = {}) {
  if (!isCartoonOrderPhotoObjectName(objectName)) {
    throw new Error('Invalid cartoon order photo object name.');
  }

  const bucketName = getCartoonOrdersBucketName();

  if (!bucketName) {
    throw new Error('GCS_CARTOON_ORDERS_BUCKET_NAME is not configured.');
  }

  try {
    await storage.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
  } catch (error) {
    if (error.code === 404) {
      return;
    }

    console.error('Error deleting GCS object by name:', error);
    if (throwOnError) {
      throw error;
    }
  }
}

export function extractObjectNameFromGcsUrl(assetUrl) {
  if (!assetUrl) {
    return null;
  }

  const bucketName = getBucketName();

  if (!bucketName) {
    return null;
  }

  try {
    const rawAssetUrl = String(assetUrl);
    const decodedAssetUrl = decodeURIComponent(rawAssetUrl);

    if (
      /(^|\/)(\.{1,2})(\/|$)/.test(rawAssetUrl) ||
      /(^|\/)(\.{1,2})(\/|$)/.test(decodedAssetUrl)
    ) {
      return null;
    }

    const url = new URL(assetUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const decodedParts = parts.map((part) => decodeURIComponent(part));

    if (url.protocol !== 'https:' || url.hostname !== 'storage.googleapis.com') {
      return null;
    }

    if (
      decodedParts.some(
        (part) => part === '..' || part === '.' || part.includes('/') || part.includes('\\')
      )
    ) {
      return null;
    }

    if (parts.length < 2) {
      return null;
    }

    const bucketFromUrl = parts[0];

    if (bucketFromUrl !== bucketName) {
      console.warn(
        `GCS helper: bucket in URL (${bucketFromUrl}) != env bucket (${bucketName}).`
      );
      return null;
    }

    return parts.slice(1).join('/');
  } catch (error) {
    console.error('GCS helper: invalid asset URL:', assetUrl, error);
    return null;
  }
}

export async function deleteImageFromGCS(imageUrl, { throwOnError = false } = {}) {
  const bucketName = getBucketName();

  if (!bucketName) {
    console.warn('GCS_BUCKET_NAME is not set, skip deleting image from GCS.');
    return;
  }

  const objectName = extractObjectNameFromGcsUrl(imageUrl);

  if (!objectName) {
    console.warn('GCS delete skipped - cannot extract object name from URL:', imageUrl);
    return;
  }

  try {
    const file = storage.bucket(bucketName).file(objectName);
    await file.delete({ ignoreNotFound: true });
    console.log(`GCS: deleted image ${objectName}`);
  } catch (error) {
    if (error.code === 404) {
      console.log(`GCS: image not found, ignore: ${objectName}`);
      return;
    }

    console.error('Error deleting image from GCS:', error);
    if (throwOnError) {
      throw error;
    }
  }
}
