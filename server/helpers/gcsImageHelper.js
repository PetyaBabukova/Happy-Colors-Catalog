import { Storage } from '@google-cloud/storage';

const storage = new Storage();

export function getBucketName() {
  return process.env.GCS_BUCKET_NAME || '';
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
    const url = new URL(assetUrl);
    const parts = url.pathname.split('/').filter(Boolean);

    if (url.protocol !== 'https:' || url.hostname !== 'storage.googleapis.com') {
      return null;
    }

    if (parts.includes('..') || parts.includes('.')) {
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

export async function deleteImageFromGCS(imageUrl) {
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
  }
}
