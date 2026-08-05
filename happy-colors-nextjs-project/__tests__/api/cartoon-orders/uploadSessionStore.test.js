import { beforeEach, describe, expect, it, vi } from 'vitest';

let records;
const createIndex = vi.fn();

function matchesFilter(record, filter) {
  const objectName = filter['uploadedObjects.objectName']?.$ne;

  return (
    record.sessionId === filter.sessionId &&
    record.expiresAt > filter.expiresAt.$gt &&
    record.uploadCount < filter.uploadCount.$lt &&
    !record.uploadedObjects.some((uploadedObject) => uploadedObject.objectName === objectName)
  );
}

const collection = {
  createIndex,
  findOne: vi.fn(async ({ sessionId }) => (
    records.find((candidate) => candidate.sessionId === sessionId) || null
  )),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(async (filter, update) => {
    const record = records.find((candidate) => matchesFilter(candidate, filter));

    if (!record) {
      return { modifiedCount: 0 };
    }

    record.uploadedObjects.push(update.$push.uploadedObjects);
    record.uploadCount += update.$inc.uploadCount;

    return { modifiedCount: 1 };
  }),
};

async function loadStore() {
  return import('../../../src/app/api/_lib/cartoonUploadSessionStore.js');
}

describe('cartoonUploadSessionStore append contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    records = [];

    vi.doMock('../../../src/app/api/_lib/mongo.js', () => ({
      connectToMongo: vi.fn(async () => ({
        connection: {
          db: {
            collection: vi.fn(() => collection),
          },
        },
      })),
    }));
  });

  it('appends uploaded objects and increments uploadCount for active sessions below the cap', async () => {
    records.push({
      sessionId: 'session-1',
      expiresAt: new Date('2026-06-05T10:20:00Z'),
      uploadCount: 0,
      uploadedObjects: [],
    });
    const { appendCartoonUploadedObject } = await loadStore();

    const result = await appendCartoonUploadedObject({
      sessionId: 'session-1',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 1234,
      originalName: 'photo.webp',
      uploadedAt: new Date('2026-06-05T10:01:00Z'),
    });

    expect(result).toMatchObject({ ok: true });
    expect(records[0].uploadCount).toBe(1);
    expect(records[0].uploadedObjects[0]).toMatchObject({
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 1234,
      originalName: 'photo.webp',
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
        browserHmac: '',
        ipHmac: '',
      },
    });
    expect(createIndex).toHaveBeenCalledWith(
      { sessionId: 1 },
      { unique: true, background: true }
    );
    expect(createIndex).toHaveBeenCalledWith({ expiresAt: 1 }, { background: true });
    expect(createIndex).toHaveBeenCalledWith(
      { 'uploadedObjects.objectName': 1 },
      {
        unique: true,
        partialFilterExpression: {
          'uploadedObjects.objectName': { $exists: true, $type: 'string' },
        },
        background: true,
      }
    );
  });

  it('stores guard HMAC refs per uploaded object when supplied', async () => {
    records.push({
      sessionId: 'session-with-guard',
      expiresAt: new Date('2026-06-05T10:20:00Z'),
      uploadCount: 0,
      uploadedObjects: [],
    });
    const { appendCartoonUploadedObject } = await loadStore();

    const result = await appendCartoonUploadedObject({
      sessionId: 'session-with-guard',
      objectName: 'cartoon-orders/reference-photos/guarded.webp',
      contentType: 'image/webp',
      size: 1234,
      originalName: 'guarded.webp',
      uploadedAt: new Date('2026-06-05T10:01:00Z'),
      guard: {
        browserHmac: 'browser-hmac',
        ipHmac: 'ip-hmac',
      },
    });

    expect(result).toMatchObject({ ok: true });
    expect(records[0].uploadedObjects[0].guard).toEqual({
      browserHmac: 'browser-hmac',
      ipHmac: 'ip-hmac',
    });
  });

  it('treats an explicit null guard value as missing guard refs', async () => {
    records.push({
      sessionId: 'session-null-guard',
      expiresAt: new Date('2026-06-05T10:20:00Z'),
      uploadCount: 0,
      uploadedObjects: [],
    });
    const { appendCartoonUploadedObject } = await loadStore();

    const result = await appendCartoonUploadedObject({
      sessionId: 'session-null-guard',
      objectName: 'cartoon-orders/reference-photos/null-guard.webp',
      contentType: 'image/webp',
      size: 1234,
      originalName: 'null-guard.webp',
      uploadedAt: new Date('2026-06-05T10:01:00Z'),
      guard: null,
    });

    expect(result).toMatchObject({ ok: true });
    expect(records[0].uploadedObjects[0].guard).toEqual({
      browserHmac: '',
      ipHmac: '',
    });
  });

  it('acquires cleanup locks only for unclaimed objects without active locks', async () => {
    const { acquireCartoonUploadCleanupLock } = await loadStore();
    collection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await expect(acquireCartoonUploadCleanupLock({
      sessionId: 'session-cleanup',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      now: new Date('2026-06-18T10:00:00Z'),
    })).resolves.toMatchObject({ ok: true });

    expect(collection.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-cleanup',
        uploadedObjects: {
          $elemMatch: expect.objectContaining({
            objectName: 'cartoon-orders/reference-photos/photo.webp',
            claimedAt: null,
            claimedOrderId: null,
          }),
        },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          'uploadedObjects.$.cleanupLockedAt': new Date('2026-06-18T10:00:00Z'),
          'uploadedObjects.$.cleanupFailureCategory': 'none',
        }),
      })
    );
  });

  it('removes cleaned upload objects and decrements uploadCount only after cleanup', async () => {
    const { removeCartoonUploadedObjectAfterCleanup } = await loadStore();
    const cleanupLockedAt = new Date('2026-06-18T10:00:00Z');
    collection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await expect(removeCartoonUploadedObjectAfterCleanup({
      sessionId: 'session-cleanup',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      cleanupLockedAt,
    })).resolves.toEqual({ ok: true });

    expect(collection.updateOne).toHaveBeenCalledWith(
      {
        sessionId: 'session-cleanup',
        uploadedObjects: {
          $elemMatch: {
            objectName: 'cartoon-orders/reference-photos/photo.webp',
            cleanupLockedAt,
            claimedAt: null,
            claimedOrderId: null,
          },
        },
      },
      {
        $pull: {
          uploadedObjects: {
            objectName: 'cartoon-orders/reference-photos/photo.webp',
            cleanupLockedAt,
          },
        },
        $inc: { uploadCount: -1 },
      }
    );
  });

  it('marks byte-gauge release once and returns the pre-update uploaded object', async () => {
    const { markCartoonUploadedObjectByteGaugeReleased } = await loadStore();
    const cleanupLockedAt = new Date('2026-06-18T10:00:00Z');
    const releasedAt = new Date('2026-06-18T10:02:00Z');
    const uploadedObject = {
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      cleanupLockedAt,
      claimedAt: null,
      claimedOrderId: null,
      byteGaugeReleasedAt: null,
      size: 1234,
      guard: {
        browserHmac: 'browser-hmac',
        ipHmac: 'ip-hmac',
      },
    };
    collection.findOneAndUpdate.mockResolvedValueOnce({
      uploadedObjects: [uploadedObject],
    });

    await expect(markCartoonUploadedObjectByteGaugeReleased({
      sessionId: 'session-cleanup',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      cleanupLockedAt,
      now: releasedAt,
    })).resolves.toEqual({
      ok: true,
      uploadedObject,
    });

    expect(collection.findOneAndUpdate).toHaveBeenCalledWith(
      {
        sessionId: 'session-cleanup',
        uploadedObjects: {
          $elemMatch: {
            objectName: 'cartoon-orders/reference-photos/photo.webp',
            cleanupLockedAt,
            claimedAt: null,
            claimedOrderId: null,
            byteGaugeReleasedAt: null,
          },
        },
      },
      {
        $set: {
          'uploadedObjects.$.byteGaugeReleasedAt': releasedAt,
        },
      },
      {
        returnDocument: 'before',
        projection: {
          uploadedObjects: 1,
        },
      }
    );
  });

  it('releases cleanup locks with bounded failure categories when storage deletion fails', async () => {
    const { releaseCartoonUploadCleanupLock } = await loadStore();
    const cleanupLockedAt = new Date('2026-06-18T10:00:00Z');
    const failedAt = new Date('2026-06-18T10:01:00Z');
    collection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

    await releaseCartoonUploadCleanupLock({
      sessionId: 'session-cleanup',
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      cleanupLockedAt,
      failureCategory: 'storage_delete_failed',
      now: failedAt,
    });

    expect(collection.updateOne).toHaveBeenCalledWith(
      {
        sessionId: 'session-cleanup',
        uploadedObjects: {
          $elemMatch: {
            objectName: 'cartoon-orders/reference-photos/photo.webp',
            cleanupLockedAt,
            claimedAt: null,
            claimedOrderId: null,
          },
        },
      },
      {
        $set: {
          'uploadedObjects.$[photo].cleanupLockedAt': null,
          'uploadedObjects.$[photo].cleanupFailedAt': failedAt,
          'uploadedObjects.$[photo].cleanupFailureCategory': 'storage_delete_failed',
        },
      },
      {
        arrayFilters: [
          {
            'photo.objectName': 'cartoon-orders/reference-photos/photo.webp',
            'photo.cleanupLockedAt': cleanupLockedAt,
            'photo.claimedAt': null,
            'photo.claimedOrderId': null,
          },
        ],
      }
    );
  });

  it('rejects expired, full, and duplicate-object sessions with reasons', async () => {
    records.push(
      {
        sessionId: 'expired-session',
        expiresAt: new Date('2026-06-05T10:00:00Z'),
        uploadCount: 0,
        uploadedObjects: [],
      },
      {
        sessionId: 'full-session',
        expiresAt: new Date('2026-06-05T10:20:00Z'),
        uploadCount: 5,
        uploadedObjects: [],
      },
      {
        sessionId: 'duplicate-session',
        expiresAt: new Date('2026-06-05T10:20:00Z'),
        uploadCount: 1,
        uploadedObjects: [
          {
            objectName: 'cartoon-orders/reference-photos/photo.webp',
          },
        ],
      }
    );
    const { appendCartoonUploadedObject } = await loadStore();
    const baseUpload = {
      objectName: 'cartoon-orders/reference-photos/photo.webp',
      contentType: 'image/webp',
      size: 1234,
      originalName: 'photo.webp',
      uploadedAt: new Date('2026-06-05T10:01:00Z'),
    };

    await expect(
      appendCartoonUploadedObject({ sessionId: 'expired-session', ...baseUpload })
    ).resolves.toEqual({ ok: false, reason: 'expired' });
    await expect(
      appendCartoonUploadedObject({ sessionId: 'full-session', ...baseUpload })
    ).resolves.toEqual({ ok: false, reason: 'full' });
    await expect(
      appendCartoonUploadedObject({ sessionId: 'duplicate-session', ...baseUpload })
    ).resolves.toEqual({ ok: false, reason: 'duplicate' });
  });
});
