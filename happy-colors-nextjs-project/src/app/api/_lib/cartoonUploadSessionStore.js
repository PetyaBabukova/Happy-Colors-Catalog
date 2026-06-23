import { randomUUID } from 'crypto';

import { connectToMongo } from './mongo';
import { MAX_CARTOON_ORDER_PHOTOS } from '@/config/productLimits';

export const CARTOON_UPLOAD_SESSIONS_COLLECTION = 'cartoon_upload_sessions';

const UPLOAD_SESSION_TTL_MS = 20 * 60 * 1000;
const DEFAULT_CLEANUP_LOCK_LEASE_MINUTES = 15;
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
  guard = {},
} = {}) {
  const collection = await getCollection();
  await ensureUploadSessionIndexes(collection);
  const guardRefs = guard || {};

  const uploadedObject = {
    objectName,
    contentType,
    size: Number(size),
    originalName: String(originalName || ''),
    uploadedAt,
    claimedAt: null,
    claimedOrderId: null,
    cleanupLockedAt: null,
    cleanupRequestedAt: null,
    cleanupFailedAt: null,
    cleanupFailureCategory: 'none',
    byteGaugeReleasedAt: null,
    orphanReapingAt: null,
    orderPersistingAt: null,
    guard: {
      browserHmac: String(guardRefs.browserHmac || ''),
      ipHmac: String(guardRefs.ipHmac || ''),
    },
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

function getCleanupLockLeaseMs() {
  const minutes = Number.parseInt(process.env.CARTOON_UPLOAD_CLEANUP_LOCK_LEASE_MINUTES, 10);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0
    ? minutes
    : DEFAULT_CLEANUP_LOCK_LEASE_MINUTES;

  return safeMinutes * 60 * 1000;
}

export async function acquireCartoonUploadCleanupLock({
  sessionId,
  objectName,
  now = new Date(),
} = {}) {
  const collection = await getCollection();
  const cleanupLockedAt = new Date(now);
  const staleLockCutoff = new Date(cleanupLockedAt.getTime() - getCleanupLockLeaseMs());
  const result = await collection.updateOne(
    {
      sessionId,
      uploadedObjects: {
        $elemMatch: {
          objectName,
          claimedAt: null,
          claimedOrderId: null,
          $or: [
            { cleanupLockedAt: null },
            { cleanupLockedAt: { $lt: staleLockCutoff } },
          ],
        },
      },
    },
    {
      $set: {
        'uploadedObjects.$.cleanupLockedAt': cleanupLockedAt,
        'uploadedObjects.$.cleanupRequestedAt': cleanupLockedAt,
        'uploadedObjects.$.cleanupFailedAt': null,
        'uploadedObjects.$.cleanupFailureCategory': 'none',
      },
    }
  );

  return {
    ok: result.modifiedCount === 1,
    cleanupLockedAt,
  };
}

export async function removeCartoonUploadedObjectAfterCleanup({
  sessionId,
  objectName,
  cleanupLockedAt,
} = {}) {
  const collection = await getCollection();
  const result = await collection.updateOne(
    {
      sessionId,
      uploadedObjects: {
        $elemMatch: {
          objectName,
          cleanupLockedAt,
          claimedAt: null,
          claimedOrderId: null,
        },
      },
    },
    {
      $pull: {
        uploadedObjects: {
          objectName,
          cleanupLockedAt,
        },
      },
      $inc: { uploadCount: -1 },
    }
  );

  return { ok: result.modifiedCount === 1 };
}

export async function markCartoonUploadedObjectByteGaugeReleased({
  sessionId,
  objectName,
  cleanupLockedAt,
  now = new Date(),
} = {}) {
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    {
      sessionId,
      uploadedObjects: {
        $elemMatch: {
          objectName,
          cleanupLockedAt,
          claimedAt: null,
          claimedOrderId: null,
          byteGaugeReleasedAt: null,
        },
      },
    },
    {
      $set: {
        'uploadedObjects.$.byteGaugeReleasedAt': now,
      },
    },
    {
      returnDocument: 'before',
      projection: {
        uploadedObjects: 1,
      },
    }
  );
  const record = result?.value || result;
  const uploadedObject = (record?.uploadedObjects || [])
    .find((photo) => photo.objectName === objectName && !photo.byteGaugeReleasedAt);

  return {
    ok: Boolean(uploadedObject),
    uploadedObject,
  };
}

export async function releaseCartoonUploadCleanupLock({
  sessionId,
  objectName,
  cleanupLockedAt,
  failureCategory = 'unknown_cleanup_error',
  now = new Date(),
} = {}) {
  const collection = await getCollection();
  await collection.updateOne(
    {
      sessionId,
      uploadedObjects: {
        $elemMatch: {
          objectName,
          cleanupLockedAt,
          claimedAt: null,
          claimedOrderId: null,
        },
      },
    },
    {
      $set: {
        'uploadedObjects.$[photo].cleanupLockedAt': null,
        'uploadedObjects.$[photo].cleanupFailedAt': now,
        'uploadedObjects.$[photo].cleanupFailureCategory': failureCategory,
      },
    },
    {
      arrayFilters: [
        {
          'photo.objectName': objectName,
          'photo.cleanupLockedAt': cleanupLockedAt,
          'photo.claimedAt': null,
          'photo.claimedOrderId': null,
        },
      ],
    }
  );
}

export function resetCartoonUploadSessionIndexCacheForTests() {
  indexesEnsured = false;
}
