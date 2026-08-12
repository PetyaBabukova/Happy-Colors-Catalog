import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Storage } from '@google-cloud/storage';
import { ensureServerEnvLoaded } from './env';
import {
  createPublicUrl,
  isCartoonOrderPhotoObjectName,
} from '../../../../../shared/gcsCore.js';

let storageInstance = null;
let keyFilenameCache = null;
const projectRoot = process.cwd();
const repoRoot = path.resolve(projectRoot, '..');
const DEFAULT_EXTENSION_BY_MIME_TYPE = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
});

function resolveGoogleCredentialsPath() {
  ensureServerEnvLoaded();
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    '/etc/secrets/gcp-service-account.json',
    path.join(projectRoot, 'gcp-service-account.json'),
    path.join(repoRoot, 'gcp-service-account.json'),
    path.join(repoRoot, 'server', 'gcp-service-account.json'),
    path.join(repoRoot, '..', 'Happy-Colors-SECRETS', 'gcp-service-account.json'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export function getBucketName() {
  ensureServerEnvLoaded();
  return process.env.GCS_BUCKET_NAME || '';
}

export function getCartoonOrdersBucketName() {
  ensureServerEnvLoaded();
  const privateBucketName = process.env.GCS_CARTOON_ORDERS_BUCKET_NAME || '';

  if (privateBucketName) {
    return privateBucketName;
  }

  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    ? getBucketName()
    : '';
}

export function getKeyFilename() {
  if (keyFilenameCache === null) {
    keyFilenameCache = resolveGoogleCredentialsPath();
  }

  return keyFilenameCache;
}

export function getStorage() {
  if (!storageInstance) {
    const keyFilename = getKeyFilename();

    storageInstance = keyFilename
      ? new Storage({ keyFilename })
      : new Storage();
  }

  return storageInstance;
}

export {
  createPublicUrl,
  isCartoonOrderPhotoObjectName,
};

export function resolveUploadExtension(fileName, mimeType) {
  const originalExtension = path.extname(fileName || '').toLowerCase();

  if (originalExtension) {
    return originalExtension;
  }

  return DEFAULT_EXTENSION_BY_MIME_TYPE[mimeType] || '';
}

export function buildStorageObjectName(folder, fileName, mimeType) {
  const safeExtension = resolveUploadExtension(fileName, mimeType);

  return `${folder}/${randomUUID()}${safeExtension}`;
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

  const [signedUrl] = await getStorage()
    .bucket(bucketName)
    .file(objectName)
    .getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInMs,
      version: 'v4',
    });

  return signedUrl;
}
