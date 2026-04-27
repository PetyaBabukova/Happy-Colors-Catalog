import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { Storage } from '@google-cloud/storage';
import { ensureServerEnvLoaded } from './env';

let storageInstance = null;
let keyFilenameCache = null;

const DEFAULT_EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
};

function resolveGoogleCredentialsPath() {
  ensureServerEnvLoaded();
  const candidates = [
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
    '/etc/secrets/gcp-service-account.json',
    path.join(process.cwd(), 'gcp-service-account.json'),
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

export function getBucketName() {
  ensureServerEnvLoaded();
  return process.env.GCS_BUCKET_NAME || '';
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

export function createPublicUrl(bucketName, objectName) {
  return `https://storage.googleapis.com/${bucketName}/${objectName}`;
}

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
