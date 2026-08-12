import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Storage } from '@google-cloud/storage';
import {
  extractObjectNameFromGcsUrl as extractGcsObjectName,
  isCartoonOrderPhotoObjectName,
} from '../../shared/gcsCore.js';
import { CARTOON_ORDER_PHOTO_PREFIX } from '../../shared/config/productLimits.js';
import { classifyStorageError } from './storageErrorClassifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(serverRoot, '..');

let storageInstance = null;
let cartoonOrdersStorageInstance = null;
let keyFilenameCache;
const DIAGNOSTIC_SIGN_PROBE_OBJECT_NAME = 'diagnostics/sign-probe/non-customer-placeholder';

export { isCartoonOrderPhotoObjectName };

function resolveGoogleCredentialsPath() {
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    '/etc/secrets/gcp-service-account.json',
    path.join(process.cwd(), 'gcp-service-account.json'),
    path.join(process.cwd(), '..', 'gcp-service-account.json'),
    path.join(serverRoot, 'gcp-service-account.json'),
    path.join(repoRoot, 'gcp-service-account.json'),
    path.join(repoRoot, '..', 'Happy-Colors-SECRETS', 'gcp-service-account.json'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function isNotFoundStorageError(error) {
  const code = String(error?.code || error?.statusCode || '').trim();
  const message = String(error?.message || '').toLowerCase();

  return code === '404' || message.includes('no such object') || message.includes('not found');
}

export function getKeyFilename() {
  if (keyFilenameCache === undefined) {
    keyFilenameCache = resolveGoogleCredentialsPath();
  }

  return keyFilenameCache;
}

export function getStorage() {
  if (!storageInstance) {
    storageInstance = new Storage();
  }

  return storageInstance;
}

function getRuntimeEnvClass() {
  const env = String(process.env.NODE_ENV || '').trim();

  return ['production', 'development', 'test'].includes(env) ? env : 'unknown';
}

function getCredentialSource(keyFilename) {
  if (!keyFilename) {
    return 'application_default_credentials';
  }

  const normalized = String(keyFilename).replace(/\\/g, '/');

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && keyFilename === process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return 'env_path';
  }

  if (normalized.includes('/etc/secrets/')) {
    return 'mounted_secret_file';
  }

  if (normalized.endsWith('/gcp-service-account.json')) {
    return 'repo_local_file';
  }

  return 'unknown';
}

export function getSafeCartoonPhotoStorageContext() {
  const privateBucketName = process.env.GCS_CARTOON_ORDERS_BUCKET_NAME || '';
  const publicBucketName = getBucketName();
  const keyFilename = getKeyFilename();
  const runtimeEnvClass = getRuntimeEnvClass();

  return {
    runtimeSurface: 'express-admin',
    runtimeEnvClass,
    privateBucketConfigured: Boolean(privateBucketName),
    privateDiffersFromPublic: Boolean(privateBucketName && publicBucketName && privateBucketName !== publicBucketName),
    publicBucketFallbackActive: !privateBucketName && Boolean(publicBucketName) && ['development', 'test'].includes(runtimeEnvClass),
    credentialSource: getCredentialSource(keyFilename),
    credentialFileResolved: Boolean(keyFilename),
    usingApplicationDefaultCredentials: !keyFilename,
  };
}

function getCartoonOrdersStorage() {
  if (!cartoonOrdersStorageInstance) {
    const keyFilename = getKeyFilename();

    cartoonOrdersStorageInstance = keyFilename
      ? new Storage({ keyFilename })
      : new Storage();
  }

  return cartoonOrdersStorageInstance;
}

export function getBucketName() {
  return process.env.GCS_BUCKET_NAME || '';
}

export function getCartoonOrdersBucketName() {
  const privateBucketName = process.env.GCS_CARTOON_ORDERS_BUCKET_NAME || '';

  if (privateBucketName) {
    return privateBucketName;
  }

  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    ? getBucketName()
    : '';
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

  const [signedUrl] = await getCartoonOrdersStorage()
    .bucket(bucketName)
    .file(objectName)
    .getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMs,
      version: 'v4',
    });

  return signedUrl;
}

export async function createCartoonOrderPhotoDiagnosticSignedReadProbe({
  expiresInMs = 1000,
} = {}) {
  const bucketName = getCartoonOrdersBucketName();

  if (!bucketName) {
    throw new Error('GCS_CARTOON_ORDERS_BUCKET_NAME is not configured.');
  }

  const [signedUrl] = await getCartoonOrdersStorage()
    .bucket(bucketName)
    .file(DIAGNOSTIC_SIGN_PROBE_OBJECT_NAME)
    .getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMs,
      version: 'v4',
    });

  return signedUrl;
}

export async function checkCartoonOrderPhotoExists(objectName) {
  if (!isCartoonOrderPhotoObjectName(objectName)) {
    return {
      status: 'not_checked',
      errorCategory: 'invalid_photo_reference',
      code: 'unknown',
      name: 'unknown',
    };
  }

  const bucketName = getCartoonOrdersBucketName();

  if (!bucketName) {
    return {
      status: 'not_checked',
      errorCategory: 'bucket_not_configured',
      code: 'unknown',
      name: 'unknown',
    };
  }

  try {
    const [exists] = await getCartoonOrdersStorage().bucket(bucketName).file(objectName).exists();

    return {
      status: exists ? 'exists' : 'not_found',
      errorCategory: '',
      code: '',
      name: '',
    };
  } catch (error) {
    const classified = classifyStorageError(error);
    const status = classified.errorCategory === 'permission_denied'
      ? 'permission_denied'
      : 'network_or_provider_error';

    return {
      status,
      ...classified,
    };
  }
}

export function createCartoonOrderPhotoReadStream(objectName) {
  if (!isCartoonOrderPhotoObjectName(objectName)) {
    throw new Error('Invalid cartoon order photo object name.');
  }

  const bucketName = getCartoonOrdersBucketName();

  if (!bucketName) {
    throw new Error('GCS_CARTOON_ORDERS_BUCKET_NAME is not configured.');
  }

  return getCartoonOrdersStorage().bucket(bucketName).file(objectName).createReadStream();
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
    await getCartoonOrdersStorage().bucket(bucketName).file(objectName).delete({ ignoreNotFound: false });
  } catch (error) {
    if (throwOnError) {
      throw error;
    }

    console.error('Cartoon order photo storage delete failed.', {
      operation: 'delete',
      runtimeSurface: 'express-admin',
      ...classifyStorageError(error),
    });
  }
}

export async function listCartoonOrderPhotoObjects({ limit = 1000 } = {}) {
  const bucketName = getCartoonOrdersBucketName();

  if (!bucketName) {
    return {
      ok: false,
      objects: [],
      errorCategory: 'bucket_not_configured',
    };
  }

  try {
    const totalLimit = Math.max(Math.floor(Number(limit) || 1000), 1);
    const bucket = getCartoonOrdersStorage().bucket(bucketName);
    const files = [];
    let pageToken;

    do {
      const remaining = totalLimit - files.length;
      const pageSize = Math.min(remaining, 1000);
      const [pageFiles, nextQuery] = await bucket.getFiles({
        autoPaginate: false,
        maxResults: pageSize,
        pageToken,
        prefix: `${CARTOON_ORDER_PHOTO_PREFIX}/`,
      });

      files.push(...pageFiles.slice(0, remaining));
      pageToken = nextQuery?.pageToken || null;
    } while (pageToken && files.length < totalLimit);

    return {
      ok: true,
      objects: files
        .map((file) => ({
          objectName: String(file?.name || '').trim(),
          updatedAt: file?.metadata?.updated
            ? new Date(file.metadata.updated)
            : file?.metadata?.timeCreated
              ? new Date(file.metadata.timeCreated)
              : null,
        }))
        .filter((object) => object.objectName),
      errorCategory: 'none',
    };
  } catch (error) {
    const classified = classifyStorageError(error);

    return {
      ok: false,
      objects: [],
      errorCategory: classified.errorCategory === 'permission_denied'
        ? 'storage_permission_denied'
        : 'recordless_sweep_unavailable',
    };
  }
}

export function extractObjectNameFromGcsUrl(assetUrl) {
  return extractGcsObjectName(assetUrl, {
    bucketName: getBucketName(),
    warn: console.warn,
    logError: console.error,
  });
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
    const file = getStorage().bucket(bucketName).file(objectName);
    await file.delete({ ignoreNotFound: true });
    console.log(`GCS: deleted image ${objectName}`);
  } catch (error) {
    if (isNotFoundStorageError(error)) {
      console.log(`GCS: image not found, ignore: ${objectName}`);
      return;
    }

    console.error('Error deleting image from GCS:', error);
    if (throwOnError) {
      throw error;
    }
  }
}
