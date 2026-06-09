import mongoose from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import CartoonOrder from '../../models/CartoonOrder.js';
import CartoonUploadSession from '../../models/CartoonUploadSession.js';
import { deleteGcsObjectByName } from '../../helpers/gcsImageHelper.js';
import { cleanupUnclaimedCartoonOrderUploads } from '../../services/cartoonOrdersService.js';

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
      deletedObjectNames: ['cartoon-orders/reference-photos/delete-me.webp'],
    });
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
      failedObjectNames: ['cartoon-orders/reference-photos/storage-down.webp'],
    });
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
      failedObjectNames: ['cartoon-orders/reference-photos/pull-failure.webp'],
    });
    expect(session.uploadedObjects).toHaveLength(1);
    expect(session.uploadCount).toBe(1);
    expect(session.uploadedObjects[0].cleanupLockedAt).toBeNull();
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
});
