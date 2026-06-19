import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import CartoonOrder from '../../models/CartoonOrder.js';
import CartoonUploadCleanupRun from '../../models/CartoonUploadCleanupRun.js';
import CartoonUploadQuotaCounter from '../../models/CartoonUploadQuotaCounter.js';
import CartoonUploadSession from '../../models/CartoonUploadSession.js';
import {
  deleteGcsObjectByName,
  listCartoonOrderPhotoObjects,
} from '../../helpers/gcsImageHelper.js';
import {
  cleanupUnclaimedCartoonOrderUploads,
  reconcileUploadByteGaugeCounters,
  reapClaimedOrphanCartoonOrderUploads,
  sweepRecordlessCartoonOrderPhotoObjects,
} from '../../services/cartoonOrdersService.js';

describe('CartoonUploadSession shared collection contract', () => {
  it('reads Next-created cartoon_upload_sessions records through the Express model', async () => {
    await mongoose.connection.db.collection('cartoon_upload_sessions').insertOne({
      sessionId: 'next-session-1',
      createdAt: new Date('2026-06-05T10:00:00Z'),
      expiresAt: new Date('2026-06-05T10:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/photo.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'photo.webp',
          uploadedAt: new Date('2026-06-05T10:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
      ],
    });

    const session = await CartoonUploadSession.findOne({ sessionId: 'next-session-1' }).lean();

    expect(session).toMatchObject({
      sessionId: 'next-session-1',
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/photo.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'photo.webp',
        },
      ],
    });
    expect(session.createdAt).toBeInstanceOf(Date);
    expect(session.expiresAt).toBeInstanceOf(Date);
    expect(session.uploadedObjects[0].uploadedAt).toBeInstanceOf(Date);
    expect(session.uploadedObjects[0].claimedAt).toBeNull();
    expect(session.uploadedObjects[0].cleanupLockedAt).toBeNull();
  });

  it('persists Express-created records with the Next upload helper field contract', async () => {
    await CartoonUploadSession.create({
      sessionId: 'express-session-1',
      createdAt: new Date('2026-06-05T11:00:00Z'),
      expiresAt: new Date('2026-06-05T11:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/express-photo.png',
          contentType: 'image/png',
          size: 4321,
          originalName: 'express-photo.png',
          uploadedAt: new Date('2026-06-05T11:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
      ],
    });

    const rawRecord = await mongoose.connection.db
      .collection('cartoon_upload_sessions')
      .findOne({ sessionId: 'express-session-1' });

    expect(rawRecord).toMatchObject({
      sessionId: 'express-session-1',
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/express-photo.png',
          contentType: 'image/png',
          size: 4321,
          originalName: 'express-photo.png',
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
      ],
    });
    expect(rawRecord.createdAt).toBeInstanceOf(Date);
    expect(rawRecord.expiresAt).toBeInstanceOf(Date);
    expect(rawRecord.uploadedObjects[0].uploadedAt).toBeInstanceOf(Date);
  });

  it('defines the required collection indexes for Phase 6 order validation', () => {
    const indexes = CartoonUploadSession.schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ sessionId: 1 }, { unique: true, background: true }],
        [{ expiresAt: 1 }, { background: true }],
        [
          { 'uploadedObjects.objectName': 1 },
          {
            unique: true,
            partialFilterExpression: {
              'uploadedObjects.objectName': { $exists: true, $type: 'string' },
            },
            background: true,
          },
        ],
      ])
    );
  });

  it('cleans up only old unclaimed cartoon upload objects', async () => {
    const productId = new mongoose.Types.ObjectId();

    await CartoonUploadSession.create({
      sessionId: 'cleanup-session-1',
      createdAt: new Date('2026-05-01T10:00:00Z'),
      expiresAt: new Date('2026-05-01T10:20:00Z'),
      uploadCount: 5,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/delete-me.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'delete-me.webp',
          uploadedAt: new Date('2026-05-01T10:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
        {
          objectName: 'cartoon-orders/reference-photos/order-linked.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'order-linked.webp',
          uploadedAt: new Date('2026-05-01T10:02:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
        {
          objectName: 'cartoon-orders/reference-photos/claimed.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'claimed.webp',
          uploadedAt: new Date('2026-05-01T10:03:00Z'),
          claimedAt: new Date('2026-05-01T10:04:00Z'),
          claimedOrderId: new mongoose.Types.ObjectId(),
          cleanupLockedAt: null,
        },
        {
          objectName: 'cartoon-orders/reference-photos/new.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'new.webp',
          uploadedAt: new Date('2026-06-02T10:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
        {
          objectName: 'products/not-a-cartoon-photo.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'unsafe.webp',
          uploadedAt: new Date('2026-05-01T10:05:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
      ],
    });
    await CartoonOrder.create({
      customer: {
        name: 'Petya Babukova',
        email: 'petya@example.com',
        phone: '',
        message: 'Please make a cartoon.',
      },
      productSnapshot: {
        productId,
        title: 'Cartoon Portrait',
        price: 35,
        imageUrl: '',
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/order-linked.webp',
          originalName: 'order-linked.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cleanup-session-1',
        },
      ],
      consentAccepted: true,
      consentAcceptedAt: new Date('2026-05-01T10:10:00Z'),
    });

    const result = await cleanupUnclaimedCartoonOrderUploads({
      olderThan: new Date('2026-06-01T00:00:00Z'),
    });
    const session = await CartoonUploadSession.findOne({ sessionId: 'cleanup-session-1' }).lean();
    const remainingObjectNames = session.uploadedObjects.map((uploadedObject) => uploadedObject.objectName);

    expect(deleteGcsObjectByName).toHaveBeenCalledTimes(1);
    expect(deleteGcsObjectByName).toHaveBeenCalledWith(
      'cartoon-orders/reference-photos/delete-me.webp',
      { throwOnError: true }
    );
    expect(result).toMatchObject({
      scannedSessions: 1,
      candidateCount: 2,
      deletedCount: 1,
      preservedOrderLinkedCount: 1,
      skippedUnsafeCount: 1,
      failedCount: 0,
    });
    expect(JSON.stringify(result)).not.toContain('delete-me.webp');
    expect(JSON.stringify(result)).not.toContain('cleanup-session-1');
    expect(remainingObjectNames).toEqual([
      'cartoon-orders/reference-photos/order-linked.webp',
      'cartoon-orders/reference-photos/claimed.webp',
      'cartoon-orders/reference-photos/new.webp',
      'products/not-a-cartoon-photo.webp',
    ]);
    expect(session.uploadCount).toBe(4);
  });

  it('keeps unclaimed upload records when storage deletion fails', async () => {
    await CartoonUploadSession.create({
      sessionId: 'cleanup-session-failure',
      createdAt: new Date('2026-05-01T10:00:00Z'),
      expiresAt: new Date('2026-05-01T10:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/storage-down.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'storage-down.webp',
          uploadedAt: new Date('2026-05-01T10:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
      ],
    });
    deleteGcsObjectByName.mockRejectedValueOnce(new Error('storage down'));

    const result = await cleanupUnclaimedCartoonOrderUploads({
      olderThan: new Date('2026-06-01T00:00:00Z'),
    });
    const session = await CartoonUploadSession.findOne({ sessionId: 'cleanup-session-failure' }).lean();

    expect(result).toMatchObject({
      deletedCount: 0,
      failedCount: 1,
    });
    expect(JSON.stringify(result)).not.toContain('storage-down.webp');
    expect(session.uploadedObjects).toHaveLength(1);
    expect(session.uploadCount).toBe(1);
    expect(session.uploadedObjects[0].cleanupLockedAt).toBeNull();
  });

  it('keeps unclaimed upload records retryable when session removal fails after storage deletion', async () => {
    await CartoonUploadSession.create({
      sessionId: 'cleanup-session-pull-failure',
      createdAt: new Date('2026-05-01T10:00:00Z'),
      expiresAt: new Date('2026-05-01T10:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/pull-failure.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'pull-failure.webp',
          uploadedAt: new Date('2026-05-01T10:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
      ],
    });
    const originalUpdateOne = CartoonUploadSession.updateOne.bind(CartoonUploadSession);
    const updateSpy = vi.spyOn(CartoonUploadSession, 'updateOne').mockImplementation(async (filter, update, options) => {
      if (update?.$pull?.uploadedObjects) {
        return { acknowledged: true, matchedCount: 1, modifiedCount: 0 };
      }

      return originalUpdateOne(filter, update, options);
    });

    const result = await cleanupUnclaimedCartoonOrderUploads({
      olderThan: new Date('2026-06-01T00:00:00Z'),
    });
    const session = await CartoonUploadSession.findOne({
      sessionId: 'cleanup-session-pull-failure',
    }).lean();

    expect(deleteGcsObjectByName).toHaveBeenCalledWith(
      'cartoon-orders/reference-photos/pull-failure.webp',
      { throwOnError: true }
    );
    expect(result).toMatchObject({
      deletedCount: 0,
      failedCount: 1,
    });
    expect(JSON.stringify(result)).not.toContain('pull-failure.webp');
    expect(session.uploadedObjects).toHaveLength(1);
    expect(session.uploadCount).toBe(1);
    expect(session.uploadedObjects[0].cleanupLockedAt).toBeInstanceOf(Date);
    updateSpy.mockRestore();
  });

  it('recovers stale cleanup locks on old unclaimed uploads', async () => {
    await CartoonUploadSession.create({
      sessionId: 'cleanup-session-stale-lock',
      createdAt: new Date('2026-05-01T10:00:00Z'),
      expiresAt: new Date('2026-05-01T10:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/stale-lock.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'stale-lock.webp',
          uploadedAt: new Date('2026-05-01T10:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: new Date('2026-05-01T11:00:00Z'),
        },
      ],
    });

    const result = await cleanupUnclaimedCartoonOrderUploads({
      olderThan: new Date('2026-06-01T00:00:00Z'),
      now: new Date('2026-06-02T00:00:00Z'),
    });
    const session = await CartoonUploadSession.findOne({
      sessionId: 'cleanup-session-stale-lock',
    }).lean();

    expect(deleteGcsObjectByName).toHaveBeenCalledWith(
      'cartoon-orders/reference-photos/stale-lock.webp',
      { throwOnError: true }
    );
    expect(result).toMatchObject({
      candidateCount: 1,
      deletedCount: 1,
      skippedLockedCount: 0,
      failedCount: 0,
    });
    expect(session.uploadedObjects).toHaveLength(0);
    expect(session.uploadCount).toBe(0);
  });

  it('does not delete storage when an unclaimed object is claimed before cleanup can lock it', async () => {
    await CartoonUploadSession.create({
      sessionId: 'cleanup-session-race',
      createdAt: new Date('2026-05-01T10:00:00Z'),
      expiresAt: new Date('2026-05-01T10:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/raced.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'raced.webp',
          uploadedAt: new Date('2026-05-01T10:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
      ],
    });
    const originalUpdateOne = CartoonUploadSession.updateOne.bind(CartoonUploadSession);
    const updateSpy = vi.spyOn(CartoonUploadSession, 'updateOne').mockImplementation(async (filter, update, options) => {
      if (update?.$set?.['uploadedObjects.$.cleanupLockedAt']) {
        await originalUpdateOne(
          {
            sessionId: 'cleanup-session-race',
            'uploadedObjects.objectName': 'cartoon-orders/reference-photos/raced.webp',
          },
          {
            $set: {
              'uploadedObjects.$.claimedAt': new Date('2026-05-01T10:02:00Z'),
              'uploadedObjects.$.claimedOrderId': new mongoose.Types.ObjectId(),
            },
          }
        );

        return { acknowledged: true, matchedCount: 1, modifiedCount: 0 };
      }

      return originalUpdateOne(filter, update, options);
    });

    const result = await cleanupUnclaimedCartoonOrderUploads({
      olderThan: new Date('2026-06-01T00:00:00Z'),
    });
    const session = await CartoonUploadSession.findOne({ sessionId: 'cleanup-session-race' }).lean();

    expect(deleteGcsObjectByName).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      candidateCount: 1,
      deletedCount: 0,
      skippedLockedCount: 1,
      failedCount: 0,
    });
    expect(session.uploadedObjects[0].objectName).toBe('cartoon-orders/reference-photos/raced.webp');
    expect(session.uploadedObjects[0].claimedAt).toBeInstanceOf(Date);
    updateSpy.mockRestore();
  });

  it('persists aggregate cleanup-run metrics without private object details', async () => {
    await CartoonUploadSession.create({
      sessionId: 'cleanup-session-metrics',
      createdAt: new Date('2026-06-16T10:00:00Z'),
      expiresAt: new Date('2026-06-16T10:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/metrics.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'metrics.webp',
          uploadedAt: new Date('2026-06-16T10:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
      ],
    });

    const result = await cleanupUnclaimedCartoonOrderUploads({
      now: new Date('2026-06-18T10:00:00Z'),
      retentionDays: 1,
    });
    const cleanupRun = await CartoonUploadCleanupRun.findOne().lean();

    expect(result).toMatchObject({
      candidateCount: 1,
      deletedCount: 1,
      failedCount: 0,
    });
    expect(cleanupRun).toMatchObject({
      status: 'success',
      retentionHours: 24,
      scannedSessionCount: 1,
      candidateUploadCount: 1,
      deletedUploadCount: 1,
      failedUploadCount: 0,
      errorCategory: 'none',
    });
    expect(cleanupRun.oldestDeletedAgeHours).toBeGreaterThan(24);
    expect(cleanupRun.expiresAt).toEqual(new Date('2026-09-16T10:00:00.000Z'));
    expect(JSON.stringify(cleanupRun)).not.toContain('metrics.webp');
    expect(JSON.stringify(cleanupRun)).not.toContain('cleanup-session-metrics');
  });

  it('reaps old claimed uploads with no durable order after acquiring an orphan marker', async () => {
    const claimedOrderId = new mongoose.Types.ObjectId();
    await CartoonUploadSession.create({
      sessionId: 'claimed-orphan-session',
      createdAt: new Date('2026-06-18T07:00:00Z'),
      expiresAt: new Date('2026-06-18T07:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/claimed-orphan.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'claimed-orphan.webp',
          uploadedAt: new Date('2026-06-18T07:01:00Z'),
          claimedAt: new Date('2026-06-18T07:02:00Z'),
          claimedOrderId,
          cleanupLockedAt: null,
        },
      ],
    });
    const updateSpy = vi.spyOn(CartoonUploadSession, 'updateOne');

    const result = await reapClaimedOrphanCartoonOrderUploads({
      now: new Date('2026-06-18T10:00:00Z'),
      graceMinutes: 60,
    });
    const session = await CartoonUploadSession.findOne({ sessionId: 'claimed-orphan-session' }).lean();

    expect(result).toMatchObject({
      candidateCount: 1,
      deletedCount: 1,
      preservedOrderLinkedCount: 0,
      failedCount: 0,
    });
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'claimed-orphan-session',
        uploadedObjects: {
          $elemMatch: expect.objectContaining({
            objectName: 'cartoon-orders/reference-photos/claimed-orphan.webp',
            claimedOrderId,
          }),
        },
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          'uploadedObjects.$.orphanReapingAt': expect.any(Date),
        }),
      })
    );
    expect(deleteGcsObjectByName).toHaveBeenCalledWith(
      'cartoon-orders/reference-photos/claimed-orphan.webp',
      { throwOnError: true }
    );
    expect(session.uploadedObjects).toHaveLength(0);
    expect(session.uploadCount).toBe(0);
    expect(JSON.stringify(result)).not.toContain('claimed-orphan.webp');
    updateSpy.mockRestore();
  });

  it('preserves claimed uploads that have a matching durable order', async () => {
    const claimedOrderId = new mongoose.Types.ObjectId();
    await CartoonUploadSession.create({
      sessionId: 'claimed-preserved-session',
      createdAt: new Date('2026-06-18T07:00:00Z'),
      expiresAt: new Date('2026-06-18T07:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/claimed-preserved.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'claimed-preserved.webp',
          uploadedAt: new Date('2026-06-18T07:01:00Z'),
          claimedAt: new Date('2026-06-18T07:02:00Z'),
          claimedOrderId,
          cleanupLockedAt: null,
        },
      ],
    });
    await CartoonOrder.create({
      _id: claimedOrderId,
      customer: {
        name: 'Petya Babukova',
        email: 'petya@example.com',
        phone: '',
        message: 'Please make a cartoon.',
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/claimed-preserved.webp',
          originalName: 'claimed-preserved.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'claimed-preserved-session',
        },
      ],
      consentAccepted: true,
      consentAcceptedAt: new Date('2026-06-18T07:03:00Z'),
    });

    const result = await reapClaimedOrphanCartoonOrderUploads({
      now: new Date('2026-06-18T10:00:00Z'),
      graceMinutes: 60,
    });
    const session = await CartoonUploadSession.findOne({ sessionId: 'claimed-preserved-session' }).lean();

    expect(result).toMatchObject({
      candidateCount: 1,
      deletedCount: 0,
      preservedOrderLinkedCount: 1,
      failedCount: 0,
    });
    expect(deleteGcsObjectByName).not.toHaveBeenCalled();
    expect(session.uploadedObjects).toHaveLength(1);
  });

  it('does not reap claimed uploads while an order persistence marker is active', async () => {
    const claimedOrderId = new mongoose.Types.ObjectId();
    await CartoonUploadSession.create({
      sessionId: 'claimed-active-persist-session',
      createdAt: new Date('2026-06-18T07:00:00Z'),
      expiresAt: new Date('2026-06-18T07:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/active-persist.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'active-persist.webp',
          uploadedAt: new Date('2026-06-18T07:01:00Z'),
          claimedAt: new Date('2026-06-18T07:02:00Z'),
          claimedOrderId,
          cleanupLockedAt: null,
          orderPersistingAt: new Date('2026-06-18T09:55:00Z'),
        },
      ],
    });

    const result = await reapClaimedOrphanCartoonOrderUploads({
      now: new Date('2026-06-18T10:00:00Z'),
      graceMinutes: 60,
    });
    const session = await CartoonUploadSession.findOne({
      sessionId: 'claimed-active-persist-session',
    }).lean();

    expect(result).toMatchObject({
      candidateCount: 1,
      deletedCount: 0,
      skippedLockedCount: 1,
      failedCount: 0,
    });
    expect(deleteGcsObjectByName).not.toHaveBeenCalled();
    expect(session.uploadedObjects[0].orderPersistingAt).toBeInstanceOf(Date);
  });

  it('deletes old recordless prefix-valid storage objects only when unreferenced', async () => {
    await CartoonUploadSession.create({
      sessionId: 'recordless-referenced-session',
      createdAt: new Date('2026-06-18T07:00:00Z'),
      expiresAt: new Date('2026-06-18T07:20:00Z'),
      uploadCount: 1,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/session-ref.webp',
          contentType: 'image/webp',
          size: 1234,
          originalName: 'session-ref.webp',
          uploadedAt: new Date('2026-06-18T07:01:00Z'),
          claimedAt: null,
          claimedOrderId: null,
          cleanupLockedAt: null,
        },
      ],
    });
    await CartoonOrder.create({
      customer: {
        name: 'Petya Babukova',
        email: 'petya@example.com',
        phone: '',
        message: 'Please make a cartoon.',
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/order-ref.webp',
          originalName: 'order-ref.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'recordless-order-session',
        },
      ],
      consentAccepted: true,
      consentAcceptedAt: new Date('2026-06-18T07:03:00Z'),
    });
    listCartoonOrderPhotoObjects.mockResolvedValueOnce({
      ok: true,
      errorCategory: 'none',
      objects: [
        {
          objectName: 'cartoon-orders/reference-photos/recordless.webp',
          updatedAt: new Date('2026-06-16T07:00:00Z'),
        },
        {
          objectName: 'cartoon-orders/reference-photos/session-ref.webp',
          updatedAt: new Date('2026-06-16T07:00:00Z'),
        },
        {
          objectName: 'cartoon-orders/reference-photos/order-ref.webp',
          updatedAt: new Date('2026-06-16T07:00:00Z'),
        },
        {
          objectName: 'cartoon-orders/reference-photos/new-storage.webp',
          updatedAt: new Date('2026-06-18T09:30:00Z'),
        },
        {
          objectName: 'products/not-cartoon.webp',
          updatedAt: new Date('2026-06-16T07:00:00Z'),
        },
      ],
    });

    const result = await sweepRecordlessCartoonOrderPhotoObjects({
      now: new Date('2026-06-18T10:00:00Z'),
      retentionDays: 1,
    });

    expect(result).toMatchObject({
      scannedObjectCount: 5,
      candidateCount: 3,
      deletedCount: 1,
      skippedReferencedCount: 2,
      skippedUnsafeCount: 1,
      failedCount: 0,
      errorCategory: 'none',
    });
    expect(deleteGcsObjectByName).toHaveBeenCalledTimes(1);
    expect(deleteGcsObjectByName).toHaveBeenCalledWith(
      'cartoon-orders/reference-photos/recordless.webp',
      { throwOnError: true }
    );
    expect(JSON.stringify(result)).not.toContain('recordless.webp');
  });

  it('records aggregate recordless sweep listing failures without provider details', async () => {
    listCartoonOrderPhotoObjects.mockResolvedValueOnce({
      ok: false,
      objects: [],
      errorCategory: 'recordless_sweep_unavailable',
    });

    const result = await sweepRecordlessCartoonOrderPhotoObjects({
      now: new Date('2026-06-18T10:00:00Z'),
      retentionDays: 1,
    });
    const cleanupRun = await CartoonUploadCleanupRun.findOne().lean();

    expect(result).toMatchObject({
      scannedObjectCount: 0,
      candidateCount: 0,
      deletedCount: 0,
      failedCount: 1,
      errorCategory: 'recordless_sweep_unavailable',
    });
    expect(cleanupRun).toMatchObject({
      status: 'failed',
      failedUploadCount: 1,
      errorCategory: 'recordless_sweep_unavailable',
    });
    expect(deleteGcsObjectByName).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('test-bucket');
  });

  it('reconciles claimed byte gauges only when the durable order contains the same photo', async () => {
    const claimedOrderId = new mongoose.Types.ObjectId();
    await CartoonUploadSession.create({
      sessionId: 'reconcile-claimed-session',
      createdAt: new Date('2026-06-18T07:00:00Z'),
      expiresAt: new Date('2026-06-18T07:20:00Z'),
      uploadCount: 2,
      uploadedObjects: [
        {
          objectName: 'cartoon-orders/reference-photos/orphan-claimed.webp',
          contentType: 'image/webp',
          size: 10,
          originalName: 'orphan-claimed.webp',
          uploadedAt: new Date('2026-06-18T07:01:00Z'),
          claimedAt: new Date('2026-06-18T07:02:00Z'),
          claimedOrderId,
          guard: {
            browserHmac: 'browser-reconcile-hmac',
            ipHmac: 'ip-reconcile-hmac',
          },
        },
        {
          objectName: 'cartoon-orders/reference-photos/matched-claimed.webp',
          contentType: 'image/webp',
          size: 20,
          originalName: 'matched-claimed.webp',
          uploadedAt: new Date('2026-06-18T07:01:00Z'),
          claimedAt: new Date('2026-06-18T07:02:00Z'),
          claimedOrderId,
          guard: {
            browserHmac: 'browser-reconcile-hmac',
            ipHmac: 'ip-reconcile-hmac',
          },
        },
      ],
    });
    await CartoonOrder.create({
      _id: claimedOrderId,
      customer: {
        name: 'Petya Babukova',
        email: 'petya@example.com',
        phone: '',
        message: 'Please make a cartoon.',
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/matched-claimed.webp',
          originalName: 'matched-claimed.webp',
          contentType: 'image/webp',
          size: 20,
          uploadSessionId: 'reconcile-claimed-session',
        },
      ],
      consentAccepted: true,
      consentAcceptedAt: new Date('2026-06-18T07:03:00Z'),
    });
    await CartoonUploadQuotaCounter.create([
      {
        keyType: 'browser',
        keyHmac: 'browser-reconcile-hmac',
        confirmedOutstandingBytes: 0,
        reservedBytes: 0,
        updatedAt: new Date('2026-06-18T07:04:00Z'),
        zeroedAt: new Date('2026-06-18T07:04:00Z'),
      },
      {
        keyType: 'ip',
        keyHmac: 'ip-reconcile-hmac',
        confirmedOutstandingBytes: 0,
        reservedBytes: 0,
        updatedAt: new Date('2026-06-18T07:04:00Z'),
        zeroedAt: new Date('2026-06-18T07:04:00Z'),
      },
    ]);

    const result = await reconcileUploadByteGaugeCounters({
      now: new Date('2026-06-18T10:00:00Z'),
    });
    const counters = await CartoonUploadQuotaCounter.find({
      keyHmac: { $in: ['browser-reconcile-hmac', 'ip-reconcile-hmac'] },
    }).lean();
    const cleanupRun = await CartoonUploadCleanupRun.findOne({
      reconciliationStatus: 'success',
    }).lean();

    expect(result).toMatchObject({
      repairedCounterCount: 2,
      repairedBytes: 20,
      expectedCounterCount: 2,
    });
    expect(counters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          keyType: 'browser',
          confirmedOutstandingBytes: 10,
          zeroedAt: null,
        }),
        expect.objectContaining({
          keyType: 'ip',
          confirmedOutstandingBytes: 10,
          zeroedAt: null,
        }),
      ])
    );
    expect(cleanupRun).toMatchObject({
      status: 'success',
      reconciliationStatus: 'success',
      reconciliationRepairedCounterCount: 2,
      reconciliationRepairedBytes: 20,
    });
  });
});
