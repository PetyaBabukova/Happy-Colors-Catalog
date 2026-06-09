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
