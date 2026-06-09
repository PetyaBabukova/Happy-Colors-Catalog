import { randomUUID } from 'crypto';

import { connectToMongo } from './mongo';
import { MAX_CARTOON_ORDER_PHOTOS } from '@/config/productLimits';

export const CARTOON_UPLOAD_SESSIONS_COLLECTION = 'cartoon_upload_sessions';

const UPLOAD_SESSION_TTL_MS = 20 * 60 * 1000;
let indexesEnsured = false;

async function getCollection() {
  const mongoose = await connectToMongo();

  return mongoose.connection.db.collection(CARTOON_UPLOAD_SESSIONS_COLLECTION);
}

async function ensureUploadSessionIndexes(collection) {
  if (indexesEnsured) {
    return;
  }

  await collection.createIndex({ sessionId: 1 }, { unique: true, background: true });
  await collection.createIndex({ expiresAt: 1 }, { background: true });
  await collection.createIndex(
    { 'uploadedObjects.objectName': 1 },
    {
      unique: true,
      partialFilterExpression: {
        'uploadedObjects.objectName': { $exists: true, $type: 'string' },
      },
      background: true,
    }
  );
  indexesEnsured = true;
}

export async function createCartoonUploadSession({
  sessionId = randomUUID(),
  now = new Date(),
  expiresAt = new Date(now.getTime() + UPLOAD_SESSION_TTL_MS),
} = {}) {
  const collection = await getCollection();
  await ensureUploadSessionIndexes(collection);

  const record = {
    sessionId,
    createdAt: now,
    expiresAt,
    uploadCount: 0,
    uploadedObjects: [],
  };

  await collection.insertOne(record);

  return record;
}

export async function getCartoonUploadSession(sessionId) {
  const collection = await getCollection();

  return collection.findOne({ sessionId });
}

export async function appendCartoonUploadedObject({
  sessionId,
  objectName,
  contentType,
  size,
  originalName,
  uploadedAt = new Date(),
} = {}) {
  const collection = await getCollection();
  await ensureUploadSessionIndexes(collection);

  const uploadedObject = {
    objectName,
    contentType,
    size: Number(size),
    originalName: String(originalName || ''),
    uploadedAt,
    claimedAt: null,
    claimedOrderId: null,
    cleanupLockedAt: null,
  };

  const result = await collection.updateOne(
    {
      sessionId,
      expiresAt: { $gt: uploadedAt },
      uploadCount: { $lt: MAX_CARTOON_ORDER_PHOTOS },
      'uploadedObjects.objectName': { $ne: objectName },
    },
    {
      $push: { uploadedObjects: uploadedObject },
      $inc: { uploadCount: 1 },
    }
  );

  if (result.modifiedCount !== 1) {
    const session = await collection.findOne({ sessionId });

    if (!session || session.expiresAt <= uploadedAt) {
      return { ok: false, reason: 'expired' };
    }

    if (Number(session.uploadCount) >= MAX_CARTOON_ORDER_PHOTOS) {
      return { ok: false, reason: 'full' };
    }

    if (
      Array.isArray(session.uploadedObjects) &&
      session.uploadedObjects.some((uploadedObject) => uploadedObject.objectName === objectName)
    ) {
      return { ok: false, reason: 'duplicate' };
    }

    return { ok: false, reason: 'unknown' };
  }

  return { ok: true, uploadedObject };
}

export function resetCartoonUploadSessionIndexCacheForTests() {
  indexesEnsured = false;
}
