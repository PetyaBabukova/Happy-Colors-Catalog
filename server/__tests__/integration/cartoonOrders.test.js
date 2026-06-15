import request from 'supertest';
import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CartoonOrder from '../../models/CartoonOrder.js';
import CartoonUploadSession from '../../models/CartoonUploadSession.js';
import { sendEmail } from '../../helpers/sendEmail.js';
import {
  checkCartoonOrderPhotoExists,
  createCartoonOrderPhotoDiagnosticSignedReadProbe,
  createCartoonOrderPhotoReadStream,
  createCartoonOrderPhotoSignedReadUrl,
  deleteGcsObjectByName,
} from '../../helpers/gcsImageHelper.js';
import { createUploadConfirmationToken } from '../../helpers/cartoonOrderUploadToken.js';
import { createExpressApp } from '../../server.js';
import { authCookie, createFullAdmin, createProduct, createUser } from './factories.js';

function buildPhoto({
  sessionId = 'cartoon-session-1',
  objectName = 'cartoon-orders/reference-photos/photo-1.webp',
  contentType = 'image/webp',
  size = 1234,
  originalName = 'photo-1.webp',
  expiresAt = Date.now() + 60 * 60 * 1000,
} = {}) {
  return {
    objectName,
    originalName,
    contentType,
    size,
    uploadConfirmationToken: createUploadConfirmationToken({
      sessionId,
      objectName,
      contentType,
      size,
      expiresAt,
    }),
  };
}

async function createUploadSession({
  sessionId = 'cartoon-session-1',
  photos = [buildPhoto({ sessionId })],
  expiresAt = new Date(Date.now() + 20 * 60 * 1000),
  uploadedObjectOverrides = {},
} = {}) {
  return CartoonUploadSession.create({
    sessionId,
    createdAt: new Date(),
    expiresAt,
    uploadCount: photos.length,
    uploadedObjects: photos.map((photo) => ({
      objectName: photo.objectName,
      contentType: photo.contentType,
      size: photo.size,
      originalName: photo.originalName,
      uploadedAt: new Date(),
      claimedAt: null,
      claimedOrderId: null,
      ...uploadedObjectOverrides,
    })),
  });
}

function buildCartoonOrderPayload({ product, photos = [buildPhoto()] } = {}) {
  return {
    name: 'Petya Babukova',
    email: 'PETYA@example.com',
    phone: '+359888123456',
    message: 'Please make a cheerful cartoon portrait.',
    productId: String(product?._id || product),
    photos,
    consentAccepted: true,
    productTitle: 'Client supplied title',
    productUrl: 'https://evil.example/product',
  };
}

async function createStoredCartoonOrder(overrides = {}) {
  const product = overrides.product || (await createProduct());
  const {
    customer: customerOverrides,
    productSnapshot: productSnapshotOverrides,
    photos,
    statuses,
    product: _product,
    ...rootOverrides
  } = overrides;

  return CartoonOrder.create({
    customer: {
      name: 'Petya Babukova',
      email: 'petya@example.com',
      phone: '+359888123456',
      message: 'Please make a cheerful cartoon portrait.',
      ...customerOverrides,
    },
    productSnapshot: {
      productId: product._id,
      title: product.title,
      price: product.price,
      imageUrl: product.imageUrl,
      ...productSnapshotOverrides,
    },
    photos: photos || [
      {
        objectName: 'cartoon-orders/reference-photos/admin-photo.webp',
        originalName: 'admin-photo.webp',
        contentType: 'image/webp',
        size: 1234,
        uploadSessionId: 'cartoon-session-admin',
      },
    ],
    statuses: {
      ordered: true,
      designApproved: false,
      paid: false,
      ...statuses,
    },
    consentAccepted: true,
    consentAcceptedAt: new Date(),
    notificationStatus: 'sent',
    claimStatus: 'claimed',
    ...rootOverrides,
  });
}

describe('cartoon orders integration', () => {
  afterEach(() => {
    delete process.env.CARTOONS_SERVICE_ENABLED;
    delete process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED;
    delete process.env.CARTOON_ORDER_PHOTO_DIAGNOSTICS_ENABLED;
    process.env.NODE_ENV = 'test';
    vi.restoreAllMocks();
  });

  it('keeps cartoon order creation behind the release gate', async () => {
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.100')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(404);

    expect(await CartoonOrder.countDocuments()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not enable public cartoon order creation with the server-only flag', async () => {
    process.env.CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.121')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(404);

    expect(await CartoonOrder.countDocuments()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not spend cartoon order limiter budget while the release gate is disabled', async () => {
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });

    for (let index = 0; index < 6; index += 1) {
      await request(app)
        .post('/cartoon-orders')
        .set('x-forwarded-for', '203.0.113.120')
        .send(buildCartoonOrderPayload({ product, photos: [photo] }))
        .expect(404);
    }

    expect(await CartoonOrder.countDocuments()).toBe(0);
  });

  it('lets full admins list open cartoon orders without enabling the public release gate', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    await createStoredCartoonOrder({
      customer: { name: 'Open Customer' },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/open-photo.webp',
          originalName: 'open-photo.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-open',
        },
      ],
    });
    await createStoredCartoonOrder({
      archivedAt: new Date(),
      completedAt: new Date(),
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/archived-photo.webp',
          originalName: 'archived-photo.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-archived',
          deletedAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .get('/cartoon-orders')
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body).toHaveLength(2);
    const openOrder = res.body.find((item) => item.customer.name === 'Open Customer');
    const completedOrder = res.body.find((item) => item.customer.name !== 'Open Customer');

    expect(openOrder.photos[0]).toEqual(
      expect.objectContaining({
        photoId: expect.any(String),
        displayName: 'open-photo.webp',
        originalName: 'open-photo.webp',
        readUrlError: '',
        photoAccessStatus: 'available',
      })
    );
    expect(openOrder.photos[0]).not.toHaveProperty('objectName');
    expect(openOrder.photos[0]).not.toHaveProperty('uploadSessionId');
    expect(openOrder.photos[0].readUrl).toContain('open-photo.webp');
    expect(completedOrder.workflowStatus).toBe('completed');
    expect(completedOrder.archivedAt).toBeTruthy();
    expect(createCartoonOrderPhotoSignedReadUrl).toHaveBeenCalledWith({
      objectName: 'cartoon-orders/reference-photos/open-photo.webp',
      expiresInMs: 30 * 60 * 1000,
    });
  });

  it('normalizes legacy active records as inquiries without trusting ordered flags', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      statuses: { ordered: true },
    });
    await CartoonOrder.collection.updateOne(
      { _id: order._id },
      { $unset: { workflowStatus: '', inquiryAt: '' } }
    );

    const res = await request(app)
      .get(`/cartoon-orders/${order._id}`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body.workflowStatus).toBe('inquiry');
    expect(res.body.statuses.ordered).toBe(false);
  });

  it('lets full admins list orders when signed photo links fail', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    await createStoredCartoonOrder({
      customer: { name: 'Visible Customer' },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/private-photo.webp',
          originalName: '',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-private',
        },
      ],
    });
    createCartoonOrderPhotoSignedReadUrl.mockRejectedValueOnce(
      new Error('GCS_CARTOON_ORDERS_BUCKET_NAME is not configured.')
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get('/cartoon-orders')
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].customer.name).toBe('Visible Customer');
    expect(res.body[0].requiresAdminAttention).toBe(true);
    expect(res.body[0].photos[0]).toMatchObject({
      photoId: expect.any(String),
      displayName: 'Photo 1',
      originalName: '',
      readUrlError: 'Signed photo link unavailable. Admin session required.',
      photoAccessStatus: 'available',
    });
    expect(res.body[0].photos[0].readUrl).toMatch(
      new RegExp(`/api/cartoon-orders/${res.body[0]._id}/photos/[A-Za-z0-9_-]+`)
    );
    expect(res.body[0].photos[0]).not.toHaveProperty('objectName');
    expect(res.body[0].photos[0]).not.toHaveProperty('uploadSessionId');
    expect(console.error).toHaveBeenCalledWith(
      'Cartoon order photo signed-read failed.',
      expect.objectContaining({
        operation: 'signed-read',
        runtimeSurface: 'express-admin',
        errorCategory: 'bucket_not_configured',
        code: 'unknown',
        name: 'unknown',
      })
    );
  });

  it('lets full admins read order detail when signed photo links fail', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/detail-private-photo.webp',
          originalName: '',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-detail-private',
        },
      ],
    });
    createCartoonOrderPhotoSignedReadUrl.mockRejectedValueOnce(new Error('storage unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .get(`/cartoon-orders/${order._id}`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body._id).toBe(String(order._id));
    expect(res.body.requiresAdminAttention).toBe(true);
    expect(res.body.photos[0]).toMatchObject({
      displayName: 'Photo 1',
      readUrlError: 'Signed photo link unavailable. Admin session required.',
      photoAccessStatus: 'available',
    });
    expect(res.body.photos[0].readUrl).toMatch(
      new RegExp(`/api/cartoon-orders/${order._id}/photos/[A-Za-z0-9_-]+`)
    );
    expect(res.body.photos[0]).not.toHaveProperty('objectName');
    expect(res.body.photos[0]).not.toHaveProperty('uploadSessionId');
  });

  it('derives stable safe photo ids for legacy photos without stored photo ids', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/legacy-photo-id.webp',
          originalName: '',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-legacy-photo-id',
        },
        {
          objectName: 'cartoon-orders/reference-photos/legacy-photo-id-2.webp',
          originalName: '',
          contentType: 'image/webp',
          size: 2345,
          uploadSessionId: 'cartoon-session-legacy-photo-id',
        },
      ],
    });
    await CartoonOrder.updateOne(
      { _id: order._id },
      {
        $unset: {
          'photos.0.photoId': '',
          'photos.0.objectName': '',
          'photos.1.photoId': '',
          'photos.1.objectName': '',
        },
      }
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const [firstRes, secondRes] = await Promise.all([
      request(app).get('/cartoon-orders').set('Cookie', authCookie(admin)),
      request(app).get('/cartoon-orders').set('Cookie', authCookie(admin)),
    ]);

    expect(firstRes.status).toBe(200);
    expect(secondRes.status).toBe(200);
    expect(firstRes.body[0].photos[0]).toMatchObject({
      photoId: expect.stringMatching(/^photo_/),
      displayName: 'Photo 1',
    });
    expect(firstRes.body[0].photos[1]).toMatchObject({
      photoId: expect.stringMatching(/^photo_/),
      displayName: 'Photo 2',
    });
    expect(firstRes.body[0].photos[1].photoId).not.toBe(firstRes.body[0].photos[0].photoId);
    expect(secondRes.body[0].photos[0].photoId).toBe(firstRes.body[0].photos[0].photoId);
    expect(secondRes.body[0].photos[1].photoId).toBe(firstRes.body[0].photos[1].photoId);
    expect(firstRes.body[0].photos[0]).not.toHaveProperty('objectName');
    expect(firstRes.body[0].photos[0]).not.toHaveProperty('uploadSessionId');
    expect(firstRes.body[0].photos[1]).not.toHaveProperty('objectName');
    expect(firstRes.body[0].photos[1]).not.toHaveProperty('uploadSessionId');
  });

  it('rejects cartoon order admin endpoints for anonymous and non-admin users', async () => {
    const app = createExpressApp();
    const user = await createUser({ role: 'customer' });
    const order = await createStoredCartoonOrder();

    await request(app).get('/cartoon-orders').expect(401);
    await request(app)
      .get('/cartoon-orders')
      .set('Cookie', authCookie(user))
      .expect(403);
    await request(app)
      .patch(`/cartoon-orders/${order._id}/statuses`)
      .set('Cookie', authCookie(user))
      .send({ statuses: { paid: true } })
      .expect(403);
    await request(app)
      .patch(`/cartoon-orders/${order._id}/workflow`)
      .set('Cookie', authCookie(user))
      .send({ workflowStatus: 'waiting' })
      .expect(403);
    await request(app)
      .post(`/cartoon-orders/${order._id}/reject`)
      .set('Cookie', authCookie(user))
      .expect(403);
    await request(app)
      .post('/cartoon-orders/purge-old-completed')
      .set('Cookie', authCookie(user))
      .expect(403);
  });

  it('keeps photo diagnostics full-admin only and disabled by default', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const user = await createUser({ role: 'customer' });
    const order = await createStoredCartoonOrder();

    await request(app)
      .get(`/cartoon-orders/${order._id}/photo-diagnostics`)
      .expect(401);
    await request(app)
      .get(`/cartoon-orders/${order._id}/photo-diagnostics`)
      .set('Cookie', authCookie(user))
      .expect(403);

    const disabledRes = await request(app)
      .get(`/cartoon-orders/${order._id}/photo-diagnostics`)
      .set('Cookie', authCookie(admin))
      .expect(404);

    expect(disabledRes.headers['cache-control']).toBe('no-store');
    expect(createCartoonOrderPhotoDiagnosticSignedReadProbe).not.toHaveBeenCalled();
    expect(checkCartoonOrderPhotoExists).not.toHaveBeenCalled();
  });

  it('streams cartoon order photos only for full admins through auth-gated links', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const user = await createUser({ role: 'customer' });
    const order = await createStoredCartoonOrder({
      photos: [
        {
          photoId: 'photo-stream-id',
          objectName: 'cartoon-orders/reference-photos/stream-photo.webp',
          originalName: 'stream-photo.webp',
          contentType: 'image/webp',
          size: 16,
          uploadSessionId: 'cartoon-session-stream',
        },
      ],
    });

    await request(app)
      .get(`/cartoon-orders/${order._id}/photos/photo-stream-id`)
      .expect(401);
    await request(app)
      .get(`/cartoon-orders/${order._id}/photos/photo-stream-id`)
      .set('Cookie', authCookie(user))
      .expect(403);

    const res = await request(app)
      .get(`/cartoon-orders/${order._id}/photos/photo-stream-id`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-type']).toContain('image/webp');
    expect(res.text || res.body.toString()).toContain('mock-photo-bytes');
    expect(createCartoonOrderPhotoReadStream).toHaveBeenCalledWith(
      'cartoon-orders/reference-photos/stream-photo.webp'
    );
  });

  it('does not stream deleted or unknown cartoon order photos', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      photos: [
        {
          photoId: 'photo-deleted-id',
          objectName: 'cartoon-orders/reference-photos/deleted-stream-photo.webp',
          originalName: 'deleted-stream-photo.webp',
          contentType: 'image/webp',
          size: 16,
          uploadSessionId: 'cartoon-session-deleted-stream',
          deletedAt: new Date(),
        },
      ],
    });

    await request(app)
      .get(`/cartoon-orders/${order._id}/photos/photo-deleted-id`)
      .set('Cookie', authCookie(admin))
      .expect(404);
    await request(app)
      .get(`/cartoon-orders/${order._id}/photos/photo-missing-id`)
      .set('Cookie', authCookie(admin))
      .expect(404);
    expect(createCartoonOrderPhotoReadStream).not.toHaveBeenCalled();
  });

  it('returns safe no-store photo diagnostics without storage internals when enabled', async () => {
    process.env.CARTOON_ORDER_PHOTO_DIAGNOSTICS_ENABLED = 'true';
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/diagnostic-active.webp',
          originalName: 'diagnostic-active.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-diagnostic',
        },
        {
          objectName: 'cartoon-orders/reference-photos/diagnostic-deleted.webp',
          originalName: 'diagnostic-deleted.webp',
          contentType: 'image/webp',
          size: 2345,
          uploadSessionId: 'cartoon-session-diagnostic',
          deletedAt: new Date(),
        },
      ],
    });

    const res = await request(app)
      .get(`/cartoon-orders/${order._id}/photo-diagnostics`)
      .set('Cookie', authCookie(admin))
      .expect(200);
    const serialized = JSON.stringify(res.body);

    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toMatchObject({
      orderId: String(order._id),
      runtimeSurface: 'express-admin',
      storageContext: {
        runtimeSurface: 'express-admin',
        runtimeEnvClass: 'test',
        publicBucketFallbackActive: true,
      },
      signGeneration: {
        ok: true,
        errorCategory: '',
        code: '',
        name: '',
      },
      driftComparison: {
        available: false,
        status: 'unavailable',
        reason: 'missing_upload_snapshot',
      },
    });
    expect(res.body.photos).toHaveLength(2);
    expect(res.body.photos[0]).toMatchObject({
      photoId: expect.any(String),
      deleted: false,
      checks: {
        photoMetadataRead: { status: 'ok' },
        photoExists: { status: 'exists' },
        deleteAccess: { status: 'not_checked' },
      },
    });
    expect(res.body.photos[1]).toMatchObject({
      deleted: true,
      checks: {
        photoMetadataRead: { status: 'skipped_expected_absent' },
        photoExists: { status: 'skipped_expected_absent' },
      },
    });
    expect(createCartoonOrderPhotoDiagnosticSignedReadProbe).toHaveBeenCalledWith({
      expiresInMs: 1000,
    });
    expect(checkCartoonOrderPhotoExists).toHaveBeenCalledTimes(1);
    expect(serialized).not.toContain('cartoon-orders/reference-photos');
    expect(serialized).not.toContain('cartoon-session-diagnostic');
    expect(serialized).not.toContain('signed.example.com');
    expect(serialized).not.toContain('diagnostic-active.webp');
  });

  it('classifies photo diagnostics sign and existence failures safely', async () => {
    process.env.CARTOON_ORDER_PHOTO_DIAGNOSTICS_ENABLED = 'true';
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/diagnostic-fails.webp',
          originalName: '',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-diagnostic-fails',
        },
      ],
    });

    createCartoonOrderPhotoDiagnosticSignedReadProbe.mockRejectedValueOnce(
      Object.assign(new Error('Forbidden for private bucket and principal'), {
        code: '403',
        name: 'ApiError',
      })
    );
    checkCartoonOrderPhotoExists.mockResolvedValueOnce({
      status: 'permission_denied',
      errorCategory: 'permission_denied',
      code: 'permission_denied',
      name: 'provider_api_error',
    });

    const res = await request(app)
      .get(`/cartoon-orders/${order._id}/photo-diagnostics`)
      .set('Cookie', authCookie(admin))
      .expect(200);
    const serialized = JSON.stringify(res.body);

    expect(res.body.signGeneration).toEqual({
      ok: false,
      errorCategory: 'permission_denied',
      code: 'permission_denied',
      name: 'provider_api_error',
    });
    expect(res.body.photos[0].checks.photoExists).toEqual({
      status: 'permission_denied',
      errorCategory: 'permission_denied',
      code: 'permission_denied',
      name: 'provider_api_error',
    });
    expect(serialized).not.toContain('Forbidden for private bucket and principal');
    expect(serialized).not.toContain('cartoon-orders/reference-photos');
    expect(serialized).not.toContain('cartoon-session-diagnostic-fails');
  });

  it('lets full admins read, update statuses, and update admin notes', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder();

    const readRes = await request(app)
      .get(`/cartoon-orders/${order._id}`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(readRes.body.photos[0].readUrl).toContain('admin-photo.webp');
    expect(createCartoonOrderPhotoSignedReadUrl).toHaveBeenCalledWith({
      objectName: 'cartoon-orders/reference-photos/admin-photo.webp',
      expiresInMs: 30 * 60 * 1000,
    });

    const statusRes = await request(app)
      .patch(`/cartoon-orders/${order._id}/statuses`)
      .set('Cookie', authCookie(admin))
      .send({ statuses: { designApproved: true, paid: true } })
      .expect(200);

    expect(statusRes.body.statuses).toMatchObject({
      ordered: false,
      designApproved: true,
      paid: true,
    });

    const notesRes = await request(app)
      .patch(`/cartoon-orders/${order._id}/admin-notes`)
      .set('Cookie', authCookie(admin))
      .send({ adminNotes: 'Customer wants warm colors.' })
      .expect(200);

    expect(notesRes.body.adminNotes).toBe('Customer wants warm colors.');
  });

  it('applies allowed workflow transitions and timestamps', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      workflowStatus: 'inquiry',
      statuses: { ordered: false },
    });

    const waitingRes = await request(app)
      .patch(`/cartoon-orders/${order._id}/workflow`)
      .set('Cookie', authCookie(admin))
      .send({ workflowStatus: 'waiting' })
      .expect(200);

    expect(waitingRes.body.workflowStatus).toBe('waiting');
    expect(waitingRes.body.waitingAt).toBeTruthy();
    expect(waitingRes.body.waitingBy).toBe(String(admin._id));
    expect(waitingRes.body.statuses.ordered).toBe(false);

    const inquiryRes = await request(app)
      .patch(`/cartoon-orders/${order._id}/workflow`)
      .set('Cookie', authCookie(admin))
      .send({ workflowStatus: 'inquiry' })
      .expect(200);

    expect(inquiryRes.body.workflowStatus).toBe('inquiry');
    expect(inquiryRes.body.waitingAt).toBeNull();
    expect(inquiryRes.body.waitingBy).toBeNull();

    const orderedRes = await request(app)
      .patch(`/cartoon-orders/${order._id}/workflow`)
      .set('Cookie', authCookie(admin))
      .send({ workflowStatus: 'ordered' })
      .expect(200);

    expect(orderedRes.body.workflowStatus).toBe('ordered');
    expect(orderedRes.body.orderedAt).toBeTruthy();
    expect(orderedRes.body.orderedBy).toBe(String(admin._id));
    expect(orderedRes.body.statuses.ordered).toBe(true);
  });

  it('rejects invalid and completion workflow transitions', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      workflowStatus: 'ordered',
    });

    await request(app)
      .patch(`/cartoon-orders/${order._id}/workflow`)
      .set('Cookie', authCookie(admin))
      .send({ workflowStatus: 'completed' })
      .expect(409);

    await request(app)
      .patch(`/cartoon-orders/${order._id}/workflow`)
      .set('Cookie', authCookie(admin))
      .send({ workflowStatus: 'waiting' })
      .expect(409);

    await request(app)
      .patch(`/cartoon-orders/${order._id}/workflow`)
      .set('Cookie', authCookie(admin))
      .send({ workflowStatus: 'rejected' })
      .expect(409);
  });

  it('rejects unknown cartoon order status keys', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder();

    await request(app)
      .patch(`/cartoon-orders/${order._id}/statuses`)
      .set('Cookie', authCookie(admin))
      .send({ statuses: { completedAt: true } })
      .expect(400);
  });

  it('completes cartoon orders by deleting active photos without hiding the order', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      workflowStatus: 'inquiry',
      statuses: { ordered: false },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/complete-1.webp',
          originalName: 'complete-1.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-complete',
        },
        {
          objectName: 'cartoon-orders/reference-photos/complete-2.webp',
          originalName: 'complete-2.webp',
          contentType: 'image/webp',
          size: 2345,
          uploadSessionId: 'cartoon-session-complete',
        },
      ],
    });

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(deleteGcsObjectByName).toHaveBeenCalledTimes(2);
    expect(deleteGcsObjectByName).toHaveBeenCalledWith(
      'cartoon-orders/reference-photos/complete-1.webp',
      { throwOnError: true }
    );
    expect(res.body.completedAt).toBeTruthy();
    expect(res.body.archivedAt).toBeNull();
    expect(res.body.workflowStatus).toBe('completed');
    expect(res.body.statuses.ordered).toBe(true);
    expect(res.body.completedBy).toBe(String(admin._id));
    expect(res.body.photos.every((photo) => photo.deletedAt && !photo.readUrl)).toBe(true);
    expect(res.body.photos.every((photo) => photo.photoAccessStatus === 'deleted')).toBe(true);

    const listRes = await request(app)
      .get('/cartoon-orders')
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(listRes.body.some((item) => item._id === String(order._id))).toBe(true);
  });

  it('keeps completed cartoon order completion idempotent', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const completedAt = new Date();
    const order = await createStoredCartoonOrder({
      completedAt,
      archivedAt: completedAt,
      workflowStatus: 'inquiry',
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/already-deleted.webp',
          originalName: 'already-deleted.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-deleted',
          deletedAt: completedAt,
        },
      ],
    });

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(deleteGcsObjectByName).not.toHaveBeenCalled();
    expect(res.body.workflowStatus).toBe('completed');
  });

  it('does not mark an order complete when photo deletion fails after partial progress', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/deleted.webp',
          originalName: 'deleted.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-partial',
        },
        {
          objectName: 'cartoon-orders/reference-photos/fails.webp',
          originalName: 'fails.webp',
          contentType: 'image/webp',
          size: 2345,
          uploadSessionId: 'cartoon-session-partial',
        },
      ],
    });
    deleteGcsObjectByName
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const failedRes = await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(500);

    const updated = await CartoonOrder.findById(order._id).lean();

    expect(failedRes.body).toMatchObject({
      partial: true,
      requiresAdminAttention: true,
      retryable: true,
      orderId: String(order._id),
    });
    expect(updated.completedAt).toBeNull();
    expect(updated.archivedAt).toBeNull();
    expect(updated.requiresAdminAttention).toBe(true);
    expect(updated.photos[0].deletedAt).toBeInstanceOf(Date);
    expect(updated.photos[1].deletedAt).toBeNull();

    const retryRes = await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(deleteGcsObjectByName).toHaveBeenCalledTimes(3);
    expect(retryRes.body.completedAt).toBeTruthy();
    expect(retryRes.body.requiresAdminAttention).toBe(false);
  });

  it('does not mark an order complete when photo deletion reports ambiguous not found', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      workflowStatus: 'ordered',
      statuses: { ordered: true },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/missing-on-delete.webp',
          originalName: 'missing-on-delete.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-missing-delete',
        },
      ],
    });
    deleteGcsObjectByName.mockRejectedValueOnce(
      Object.assign(new Error('No such object'), { code: '404', name: 'ApiError' })
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(500);
    const updated = await CartoonOrder.findById(order._id).lean();

    expect(res.body).toMatchObject({
      partial: true,
      requiresAdminAttention: true,
      retryable: true,
      orderId: String(order._id),
    });
    expect(updated.completedAt).toBeNull();
    expect(updated.photos[0].deletedAt).toBeNull();
    expect(updated.requiresAdminAttention).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      'Cartoon order photo cleanup failed.',
      expect.objectContaining({
        operation: 'delete',
        runtimeSurface: 'express-admin',
        errorCategory: 'photo_not_found',
        code: 'not_found',
        name: 'provider_api_error',
      })
    );
  });

  it('does not expose storage object names in completion errors', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/already-deleted-before-failure.webp',
          originalName: '',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-safe-error',
          deletedAt: new Date(),
        },
        {
          objectName: 'cartoon-orders/reference-photos/fails-without-original.webp',
          originalName: '',
          contentType: 'image/webp',
          size: 2345,
          uploadSessionId: 'cartoon-session-safe-error',
        },
      ],
    });
    deleteGcsObjectByName.mockRejectedValueOnce(new Error('storage down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(500);

    expect(res.body.message).toBe('Could not delete reference photo Photo 2.');
    expect(res.body.message).not.toContain('fails-without-original');
    expect(res.body.message).not.toContain('cartoon-orders/reference-photos');
  });

  it('validates all active photo references before deleting any during completion', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/valid-before-invalid.webp',
          originalName: 'valid-before-invalid.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-invalid-complete',
        },
        {
          objectName: 'products/images/not-a-cartoon-photo.webp',
          originalName: 'invalid.webp',
          contentType: 'image/webp',
          size: 2345,
          uploadSessionId: 'cartoon-session-invalid-complete',
        },
      ],
    });

    await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(500);

    const updated = await CartoonOrder.findById(order._id).lean();

    expect(deleteGcsObjectByName).not.toHaveBeenCalled();
    expect(updated.photos.every((photo) => photo.deletedAt === null)).toBe(true);
    expect(updated.requiresAdminAttention).toBe(true);
  });

  it('keeps admin attention after completion when notifications still need review', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      notifications: {
        admin: { status: 'failed', error: 'delivery failed', sentAt: null },
        customer: { status: 'sent', error: '', sentAt: new Date() },
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/complete-with-warning.webp',
          originalName: 'complete-with-warning.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-complete-warning',
        },
      ],
    });

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body.completedAt).toBeTruthy();
    expect(res.body.requiresAdminAttention).toBe(true);
  });

  it('clears stale photo-link notification warnings after completing and deleting photos', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      requiresAdminAttention: true,
      notifications: {
        admin: { status: 'sent', error: 'Photo links unavailable.', sentAt: new Date() },
        customer: { status: 'sent', error: '', sentAt: new Date() },
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/complete-clears-warning.webp',
          originalName: 'complete-clears-warning.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-complete-clears-warning',
        },
      ],
    });

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body.completedAt).toBeTruthy();
    expect(res.body.requiresAdminAttention).toBe(false);
    expect(res.body.notifications.admin.error).toBe('');
    expect(res.body.notificationError).toBe('');
  });

  it('rejects inquiry records only after all photos are deleted', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      workflowStatus: 'waiting',
      statuses: { ordered: false },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/reject.webp',
          originalName: 'reject.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-reject',
        },
      ],
    });

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/reject`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body).toEqual({ deleted: true });
    expect(deleteGcsObjectByName).toHaveBeenCalledWith(
      'cartoon-orders/reference-photos/reject.webp',
      { throwOnError: true }
    );
    expect(await CartoonOrder.findById(order._id)).toBeNull();
  });

  it('does not reject ordered records', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({ workflowStatus: 'ordered' });

    await request(app)
      .post(`/cartoon-orders/${order._id}/reject`)
      .set('Cookie', authCookie(admin))
      .expect(409);

    expect(deleteGcsObjectByName).not.toHaveBeenCalled();
    expect(await CartoonOrder.findById(order._id)).not.toBeNull();
  });

  it('does not hard-delete an inquiry when photo deletion reports ambiguous not found', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      workflowStatus: 'inquiry',
      statuses: { ordered: false },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/reject-missing.webp',
          originalName: 'reject-missing.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-reject-missing',
        },
      ],
    });
    deleteGcsObjectByName.mockRejectedValueOnce(
      Object.assign(new Error('No such object'), { code: '404', name: 'ApiError' })
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/reject`)
      .set('Cookie', authCookie(admin))
      .expect(500);
    const updated = await CartoonOrder.findById(order._id).lean();

    expect(res.body).toMatchObject({
      partial: true,
      requiresAdminAttention: true,
      retryable: true,
      orderId: String(order._id),
    });
    expect(updated).toBeTruthy();
    expect(updated.photos[0].deletedAt).toBeNull();
    expect(updated.requiresAdminAttention).toBe(true);
    expect(console.error).toHaveBeenCalledWith(
      'Cartoon order photo cleanup failed.',
      expect.objectContaining({
        operation: 'delete',
        errorCategory: 'photo_not_found',
        code: 'not_found',
        name: 'provider_api_error',
      })
    );
  });

  it('keeps rejected records retryable after partial photo cleanup', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      workflowStatus: 'inquiry',
      statuses: { ordered: false },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/reject-first.webp',
          originalName: 'reject-first.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-reject-retry',
        },
        {
          objectName: 'cartoon-orders/reference-photos/reject-second.webp',
          originalName: 'reject-second.webp',
          contentType: 'image/webp',
          size: 2345,
          uploadSessionId: 'cartoon-session-reject-retry',
        },
      ],
    });
    deleteGcsObjectByName
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('storage down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const failedRes = await request(app)
      .post(`/cartoon-orders/${order._id}/reject`)
      .set('Cookie', authCookie(admin))
      .expect(500);

    expect(failedRes.body).toMatchObject({
      partial: true,
      requiresAdminAttention: true,
      retryable: true,
      orderId: String(order._id),
    });
    expect(await CartoonOrder.findById(order._id)).not.toBeNull();

    await request(app)
      .post(`/cartoon-orders/${order._id}/reject`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(deleteGcsObjectByName).toHaveBeenCalledTimes(3);
    expect(await CartoonOrder.findById(order._id)).toBeNull();
  });

  it('purges only old completed and legacy archived records', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const oldDate = new Date('2025-01-01T00:00:00.000Z');
    const recentDate = new Date();
    const oldCompleted = await createStoredCartoonOrder({
      workflowStatus: 'completed',
      completedAt: oldDate,
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/purge-completed.webp',
          originalName: 'purge-completed.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-purge-completed',
          deletedAt: oldDate,
        },
      ],
    });
    const oldArchived = await createStoredCartoonOrder({
      archivedAt: oldDate,
      workflowStatus: 'completed',
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/purge-archived.webp',
          originalName: 'purge-archived.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-purge-archived',
          deletedAt: oldDate,
        },
      ],
    });
    const archivedNeedsReview = await createStoredCartoonOrder({
      archivedAt: oldDate,
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/purge-needs-review.webp',
          originalName: 'purge-needs-review.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-purge-needs-review',
          deletedAt: oldDate,
        },
      ],
    });
    await CartoonOrder.collection.updateOne(
      { _id: archivedNeedsReview._id },
      { $unset: { workflowStatus: '' } }
    );
    const recentCompleted = await createStoredCartoonOrder({
      workflowStatus: 'completed',
      completedAt: recentDate,
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/purge-recent.webp',
          originalName: 'purge-recent.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-purge-recent',
          deletedAt: recentDate,
        },
      ],
    });
    const oldInquiry = await createStoredCartoonOrder({
      workflowStatus: 'inquiry',
      createdAt: oldDate,
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/purge-inquiry.webp',
          originalName: 'purge-inquiry.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-purge-inquiry',
        },
      ],
    });

    const res = await request(app)
      .post('/cartoon-orders/purge-old-completed')
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body).toEqual({
      matchedCount: 2,
      deletedCount: 2,
      failedCount: 0,
    });
    expect(res.body).not.toHaveProperty('photos');
    expect(await CartoonOrder.findById(oldCompleted._id)).toBeNull();
    expect(await CartoonOrder.findById(oldArchived._id)).toBeNull();
    expect(await CartoonOrder.findById(recentCompleted._id)).not.toBeNull();
    expect(await CartoonOrder.findById(oldInquiry._id)).not.toBeNull();
    expect(await CartoonOrder.findById(archivedNeedsReview._id)).not.toBeNull();
  });

  it('bounds each completed-order purge batch', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const oldDate = new Date('2025-01-01T00:00:00.000Z');
    const orders = Array.from({ length: 51 }, (_, index) => ({
      customer: {
        name: `Purge Customer ${index}`,
        email: `purge-${index}@example.com`,
        phone: '',
        message: 'Old completed request.',
      },
      photos: [
        {
          objectName: `cartoon-orders/reference-photos/purge-batch-${index}.webp`,
          originalName: `purge-batch-${index}.webp`,
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: `cartoon-session-purge-batch-${index}`,
          deletedAt: oldDate,
        },
      ],
      statuses: { ordered: true },
      workflowStatus: 'completed',
      completedAt: oldDate,
      consentAccepted: true,
      consentAcceptedAt: oldDate,
      notificationStatus: 'sent',
      claimStatus: 'claimed',
    }));
    await CartoonOrder.insertMany(orders);

    const res = await request(app)
      .post('/cartoon-orders/purge-old-completed')
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body).toEqual({
      matchedCount: 50,
      deletedCount: 50,
      failedCount: 0,
    });
    expect(await CartoonOrder.countDocuments()).toBe(1);
  });

  it('returns aggregate retryable counts when purge cleanup is partial', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const oldDate = new Date('2025-01-01T00:00:00.000Z');
    const failedOrder = await createStoredCartoonOrder({
      workflowStatus: 'completed',
      completedAt: oldDate,
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/purge-fails.webp',
          originalName: '',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-purge-fails',
        },
      ],
    });
    const deletedOrder = await createStoredCartoonOrder({
      workflowStatus: 'completed',
      completedAt: oldDate,
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/purge-deletes.webp',
          originalName: 'purge-deletes.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-purge-deletes',
          deletedAt: oldDate,
        },
      ],
    });
    deleteGcsObjectByName.mockRejectedValueOnce(new Error('storage down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post('/cartoon-orders/purge-old-completed')
      .set('Cookie', authCookie(admin))
      .expect(500);

    expect(res.body).toMatchObject({
      partial: true,
      requiresAdminAttention: true,
      retryable: true,
      matchedCount: 2,
      deletedCount: 1,
      failedCount: 1,
    });
    expect(JSON.stringify(res.body)).not.toContain('purge-fails');
    expect(JSON.stringify(res.body)).not.toContain('cartoon-session');
    expect((await CartoonOrder.findById(failedOrder._id)).requiresAdminAttention).toBe(true);
    expect(await CartoonOrder.findById(deletedOrder._id)).toBeNull();
  });

  it('rejects new admin workflow mutations without a trusted production origin', async () => {
    process.env.NODE_ENV = 'production';
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      workflowStatus: 'inquiry',
      statuses: { ordered: false },
    });

    await request(app)
      .patch(`/cartoon-orders/${order._id}/workflow`)
      .set('Cookie', authCookie(admin))
      .send({ workflowStatus: 'waiting' })
      .expect(403);
    await request(app)
      .post(`/cartoon-orders/${order._id}/reject`)
      .set('Cookie', authCookie(admin))
      .expect(403);
    await request(app)
      .post('/cartoon-orders/purge-old-completed')
      .set('Cookie', authCookie(admin))
      .expect(403);

    expect(deleteGcsObjectByName).not.toHaveBeenCalled();
  });

  it('rate limits new admin workflow mutations', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();

    for (let index = 0; index < 30; index += 1) {
      await request(app)
        .patch('/cartoon-orders/not-an-object-id/workflow')
        .set('Cookie', authCookie(admin))
        .send({ workflowStatus: 'waiting' })
        .expect(404);
    }

    await request(app)
      .patch('/cartoon-orders/not-an-object-id/workflow')
      .set('Cookie', authCookie(admin))
      .send({ workflowStatus: 'waiting' })
      .expect(429);
  });

  it('creates a cartoon order from uploaded photos and server-side product data', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct({
      title: 'Cartoon Portrait',
      price: 35,
      imageUrl: 'https://cdn.example.com/cartoon.webp',
    });
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });

    const res = await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.101')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(201);
    const order = await CartoonOrder.findById(res.body.orderId).lean();
    const session = await CartoonUploadSession.findOne({ sessionId: 'cartoon-session-1' }).lean();

    expect(order.customer).toMatchObject({
      name: 'Petya Babukova',
      email: 'petya@example.com',
      phone: '+359888123456',
    });
    expect(order.productSnapshot).toMatchObject({
      title: 'Cartoon Portrait',
      price: 35,
      imageUrl: 'https://cdn.example.com/cartoon.webp',
    });
    expect(order.productSnapshot.title).not.toBe('Client supplied title');
    expect(order.photos).toEqual([
      expect.objectContaining({
        objectName: photo.objectName,
        originalName: photo.originalName,
        uploadSessionId: 'cartoon-session-1',
      }),
    ]);
    expect(order.statuses.ordered).toBe(false);
    expect(order.workflowStatus).toBe('inquiry');
    expect(order.inquiryAt).toBeInstanceOf(Date);
    expect(order.claimStatus).toBe('claimed');
    expect(order.notificationStatus).toBe('sent');
    expect(order.notificationError).toBe('');
    expect(order.notifications.admin).toMatchObject({ status: 'sent', error: '' });
    expect(order.notifications.admin.sentAt).toBeInstanceOf(Date);
    expect(order.notifications.customer).toMatchObject({ status: 'sent', error: '' });
    expect(order.notifications.customer.sentAt).toBeInstanceOf(Date);
    expect(order.consentAcceptedAt).toBeInstanceOf(Date);
    expect(String(session.uploadedObjects[0].claimedOrderId)).toBe(String(order._id));
    expect(session.uploadedObjects[0].claimedAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: 'cartoon-admin@example.com',
        subject: 'New cartoon order from Petya Babukova',
        text: expect.stringContaining('Cartoon Portrait'),
        html: expect.stringContaining('Cartoon Portrait'),
      })
    );
    expect(sendEmail.mock.calls[0][0].text).toContain(
      `https://signed.example.com/${encodeURIComponent(photo.objectName)}`
    );
    expect(sendEmail.mock.calls[0][0].text).toContain('photo-1.webp');
    expect(sendEmail.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        to: 'petya@example.com',
        subject: 'Получихме запитването ви за шарж',
        text: expect.not.stringContaining('https://signed.example.com'),
        html: expect.not.stringContaining('https://signed.example.com'),
      })
    );
    expect(sendEmail.mock.calls[1][0].text).not.toContain('Име:');
    expect(sendEmail.mock.calls[1][0].text).not.toContain('Съобщение:');
    expect(sendEmail.mock.calls[1][0].text).not.toContain('Petya Babukova');
    expect(sendEmail.mock.calls[1][0].text).not.toContain('Please make a cheerful cartoon portrait.');
    expect(sendEmail.mock.calls[1][0].text).toBe(
      'Получихме запитването ви за шарж, благодарим! Ще се свържем с вас при първа възможност.\n' +
        '\n' +
        'Поздрави,\n' +
        'Екипът на Happy Colors'
    );
    expect(sendEmail.mock.calls[1][0].html).not.toContain('Име:');
    expect(sendEmail.mock.calls[1][0].html).not.toContain('Съобщение:');
    expect(sendEmail.mock.calls[1][0].html).not.toContain('Petya Babukova');
    expect(sendEmail.mock.calls[1][0].html).not.toContain('Please make a cheerful cartoon portrait.');
    expect(sendEmail.mock.calls[1][0].html).toContain(
      'Получихме запитването ви за шарж, благодарим!'
    );
    expect(sendEmail.mock.calls[1][0].html).toContain('Екипът на Happy Colors');
    expect(createCartoonOrderPhotoSignedReadUrl).toHaveBeenCalledWith({
      objectName: photo.objectName,
      expiresInMs: 30 * 60 * 1000,
    });
  });

  it('creates a cartoon order without a specific product', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });

    const res = await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.111')
      .send({ ...buildCartoonOrderPayload({ photos: [photo] }), productId: null })
      .expect(201);
    const order = await CartoonOrder.findById(res.body.orderId).lean();

    expect(order.customer).toMatchObject({ name: 'Petya Babukova', email: 'petya@example.com' });
    expect(order.productSnapshot?.productId ?? null).toBeNull();
    expect(order.photos).toHaveLength(1);
    expect(order.claimStatus).toBe('claimed');
    expect(order.notificationStatus).toBe('sent');
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'New cartoon order from Petya Babukova',
        text: expect.stringContaining('General inquiry'),
      })
    );
  });

  it('sends admin notification without photo links when signed read URLs fail', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto({ originalName: '' });
    await createUploadSession({ photos: [photo] });
    createCartoonOrderPhotoSignedReadUrl.mockRejectedValueOnce(new Error('storage unavailable'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.122')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(201);
    const order = await CartoonOrder.findById(res.body.orderId).lean();

    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        to: 'cartoon-admin@example.com',
        text: expect.stringContaining('/api/cartoon-orders/'),
        html: expect.stringContaining('/api/cartoon-orders/'),
      })
    );
    expect(sendEmail.mock.calls[0][0].text).toContain('Photo 1');
    expect(sendEmail.mock.calls[0][0].text).toContain('Some photo links could not be generated');
    expect(sendEmail.mock.calls[0][0].text).toContain('http://localhost:3000/api/cartoon-orders/');
    expect(sendEmail.mock.calls[1][0].text).not.toContain('https://signed.example.com');
    expect(order.notificationStatus).toBe('sent');
    expect(order.requiresAdminAttention).toBe(true);
    expect(order.notifications.admin.status).toBe('sent');
    expect(order.notifications.admin.error).toBe('Photo links unavailable.');
    expect(order.notifications.customer.status).toBe('sent');
  });

  it('records admin notification failure in production when admin recipient is missing', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    process.env.NODE_ENV = 'production';
    delete process.env.CARTOON_ORDER_ADMIN_EMAIL;
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });

    try {
      const res = await request(app)
        .post('/cartoon-orders')
        .set('Origin', 'https://happycolors.eu')
        .set('x-forwarded-for', '203.0.113.123')
        .send(buildCartoonOrderPayload({ product, photos: [photo] }))
        .expect(202);
      const order = await CartoonOrder.findById(res.body.orderId).lean();

      expect(order).toBeTruthy();
      expect(order.notificationStatus).toBe('failed');
      expect(order.requiresAdminAttention).toBe(true);
      expect(order.notifications.admin.status).toBe('failed');
      expect(order.notifications.admin.error).toContain('CARTOON_ORDER_ADMIN_EMAIL');
      expect(order.notifications.customer.status).toBe('sent');
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail.mock.calls[0][0].to).toBe('petya@example.com');
    } finally {
      process.env.CARTOON_ORDER_ADMIN_EMAIL = 'cartoon-admin@example.com';
    }
  });

  it('records admin notification failure when configured admin recipient is malformed', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    process.env.CARTOON_ORDER_ADMIN_EMAIL = 'not-an-email';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });

    try {
      const res = await request(app)
        .post('/cartoon-orders')
        .set('x-forwarded-for', '203.0.113.124')
        .send(buildCartoonOrderPayload({ product, photos: [photo] }))
        .expect(202);
      const order = await CartoonOrder.findById(res.body.orderId).lean();

      expect(order).toBeTruthy();
      expect(order.notificationStatus).toBe('failed');
      expect(order.requiresAdminAttention).toBe(true);
      expect(order.notifications.admin.status).toBe('failed');
      expect(order.notifications.admin.error).toContain('CARTOON_ORDER_ADMIN_EMAIL');
      expect(order.notifications.customer.status).toBe('sent');
      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail.mock.calls[0][0].to).toBe('petya@example.com');
    } finally {
      process.env.CARTOON_ORDER_ADMIN_EMAIL = 'cartoon-admin@example.com';
    }
  });

  it('rejects untrusted production origins before creating an order', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    process.env.NODE_ENV = 'production';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.102')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(403);

    expect(await CartoonOrder.countDocuments()).toBe(0);
  });

  it('returns a quiet success for honeypot submissions without saving or emailing', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.103')
      .send({
        website: 'filled-by-bot',
        name: 'Bot',
        email: 'bot@example.com',
      })
      .expect(200);

    expect(await CartoonOrder.countDocuments()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it.each([
    ['short name', { name: 'Pe' }, 400],
    ['invalid email', { email: 'bad-email' }, 400],
    ['long phone', { phone: '1'.repeat(31) }, 400],
    ['long message', { message: 'x'.repeat(1501) }, 400],
    ['missing consent', { consentAccepted: false }, 400],
    ['invalid product id', { productId: 'not-an-id' }, 404],
    ['markup', { message: '<script>alert(1)</script>' }, 400],
  ])('rejects %s before saving', async (_label, overrides, expectedStatus) => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.104')
      .send({ ...buildCartoonOrderPayload({ product, photos: [photo] }), ...overrides })
      .expect(expectedStatus);

    expect(await CartoonOrder.countDocuments()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('rejects unpublished products', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct({ publicationStatus: 'draft' });
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.105')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(404);

    expect(await CartoonOrder.countDocuments()).toBe(0);
  });

  it('rejects invalid upload tokens, mismatched metadata, and mixed sessions', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.106')
      .send(
        buildCartoonOrderPayload({
          product,
          photos: [{ ...photo, uploadConfirmationToken: 'bad-token' }],
        })
      )
      .expect(401);

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.107')
      .send(
        buildCartoonOrderPayload({
          product,
          photos: [{ ...photo, size: 9999 }],
        })
      )
      .expect(401);

    const otherSessionPhoto = buildPhoto({
      sessionId: 'cartoon-session-2',
      objectName: 'cartoon-orders/reference-photos/photo-2.webp',
      originalName: 'photo-2.webp',
    });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.108')
      .send(buildCartoonOrderPayload({ product, photos: [photo, otherSessionPhoto] }))
      .expect(400);

    expect(await CartoonOrder.countDocuments()).toBe(0);
  });

  it('rejects expired, missing, already claimed, and duplicate photo session state', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await createUploadSession({
      photos: [photo],
      expiresAt: new Date(Date.now() - 1000),
    });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.109')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(409);

    await CartoonUploadSession.deleteMany({});
    await createUploadSession({
      photos: [photo],
      uploadedObjectOverrides: {
        claimedAt: new Date(),
        claimedOrderId: new mongoose.Types.ObjectId(),
      },
    });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.110')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(409);

    await CartoonUploadSession.deleteMany({});
    await createUploadSession({ photos: [photo] });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.111')
      .send(buildCartoonOrderPayload({ product, photos: [photo, photo] }))
      .expect(400);

    expect(await CartoonOrder.countDocuments()).toBe(0);
  });

  it('prevents the same uploaded photo from creating a second order', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.112')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(201);

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.113')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(409);

    expect(await CartoonOrder.countDocuments()).toBe(1);
  });

  it('keeps the order when admin notification fails', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });
    sendEmail.mockRejectedValueOnce(new Error('smtp down'));

    const res = await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.114')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(202);
    const order = await CartoonOrder.findById(res.body.orderId).lean();

    expect(order).toBeTruthy();
    expect(order.notificationStatus).toBe('failed');
    expect(order.requiresAdminAttention).toBe(true);
    expect(order.claimStatus).toBe('claimed');
    expect(order.notificationError).toContain('smtp down');
    expect(order.notifications.admin.status).toBe('failed');
    expect(order.notifications.admin.error).toContain('smtp down');
    expect(order.notifications.customer.status).toBe('sent');
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it('retries failed notification channels only for full admins', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const user = await createUser({ role: 'customer' });
    const order = await createStoredCartoonOrder({
      notificationStatus: 'failed',
      notificationError: 'smtp down',
      requiresAdminAttention: true,
      notifications: {
        admin: { status: 'failed', error: 'smtp down', sentAt: null },
        customer: { status: 'sent', error: '', sentAt: new Date() },
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/retry-photo.webp',
          originalName: 'retry-photo.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-retry',
        },
      ],
    });

    await request(app)
      .post(`/cartoon-orders/${order._id}/notifications/retry`)
      .set('Cookie', authCookie(user))
      .expect(403);

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/notifications/retry`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cartoon-admin@example.com',
        subject: 'New cartoon order from Petya Babukova',
      })
    );
    expect(res.body.notificationStatus).toBe('sent');
    expect(res.body.requiresAdminAttention).toBe(false);
    expect(res.body.notifications.admin.status).toBe('sent');
    expect(res.body.notifications.customer.status).toBe('sent');

    const updated = await CartoonOrder.findById(order._id).lean();

    expect(updated.notificationStatus).toBe('sent');
    expect(updated.requiresAdminAttention).toBe(false);
    expect(updated.notifications.admin.status).toBe('sent');
    expect(updated.notifications.customer.status).toBe('sent');
  });

  it('keeps partial photo cleanup attention after a successful notification retry', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      requiresAdminAttention: true,
      notificationStatus: 'failed',
      notificationError: 'smtp down',
      notifications: {
        admin: { status: 'failed', error: 'smtp down', sentAt: null },
        customer: { status: 'sent', error: '', sentAt: new Date() },
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/retry-partial-deleted.webp',
          originalName: 'retry-partial-deleted.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-retry-partial',
          deletedAt: new Date(),
        },
        {
          objectName: 'cartoon-orders/reference-photos/retry-partial-active.webp',
          originalName: 'retry-partial-active.webp',
          contentType: 'image/webp',
          size: 2345,
          uploadSessionId: 'cartoon-session-retry-partial',
        },
      ],
    });

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/notifications/retry`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body.notifications.admin.status).toBe('sent');
    expect(res.body.notifications.admin.error).toBe('');
    expect(res.body.requiresAdminAttention).toBe(true);
  });

  it('does not resend notifications when retry finds no failed channels', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const sentAt = new Date();
    const order = await createStoredCartoonOrder({
      notificationStatus: 'sent',
      notificationError: '',
      notifications: {
        admin: { status: 'sent', error: '', sentAt },
        customer: { status: 'sent', error: '', sentAt },
      },
    });

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/notifications/retry`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(sendEmail).not.toHaveBeenCalled();
    expect(res.body.notificationStatus).toBe('sent');
    expect(res.body.notifications.admin.status).toBe('sent');
    expect(res.body.notifications.customer.status).toBe('sent');
  });

  it('retries admin notifications that were sent with photo-link warnings', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const sentAt = new Date();
    const order = await createStoredCartoonOrder({
      notificationStatus: 'sent',
      notificationError: '',
      notifications: {
        admin: { status: 'sent', error: 'Photo links unavailable.', sentAt },
        customer: { status: 'sent', error: '', sentAt },
      },
      photos: [
        {
          objectName: 'cartoon-orders/reference-photos/retry-warning-photo.webp',
          originalName: 'retry-warning-photo.webp',
          contentType: 'image/webp',
          size: 1234,
          uploadSessionId: 'cartoon-session-retry-warning',
        },
      ],
    });

    const res = await request(app)
      .post(`/cartoon-orders/${order._id}/notifications/retry`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'cartoon-admin@example.com',
        text: expect.stringContaining('retry-warning-photo.webp'),
      })
    );
    expect(res.body.notificationStatus).toBe('sent');
    expect(res.body.notifications.admin.status).toBe('sent');
    expect(res.body.notifications.admin.error).toBe('');
    expect(res.body.notifications.customer.status).toBe('sent');
  });

  it('rejects notification retry without a trusted production origin', async () => {
    process.env.NODE_ENV = 'production';
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
      notificationStatus: 'failed',
      notifications: {
        admin: { status: 'failed', error: 'smtp down', sentAt: null },
        customer: { status: 'sent', error: '', sentAt: new Date() },
      },
    });

    await request(app)
      .post(`/cartoon-orders/${order._id}/notifications/retry`)
      .set('Cookie', authCookie(admin))
      .expect(403);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not create an order when session claim bookkeeping fails', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });
    vi.spyOn(CartoonUploadSession, 'updateOne').mockResolvedValueOnce({
      acknowledged: true,
      matchedCount: 1,
      modifiedCount: 0,
    });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.115')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(409);

    expect(await CartoonOrder.countDocuments()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('does not create an order when cleanup locks a photo between validation and claim', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });
    const originalUpdateOne = CartoonUploadSession.updateOne.bind(CartoonUploadSession);
    const updateSpy = vi.spyOn(CartoonUploadSession, 'updateOne').mockImplementation(async (filter, update, options) => {
      if (update?.$set?.['uploadedObjects.$[photo].claimedAt']) {
        await originalUpdateOne(
          {
            sessionId: 'cartoon-session-1',
            'uploadedObjects.objectName': photo.objectName,
          },
          {
            $set: {
              'uploadedObjects.$.cleanupLockedAt': new Date(),
            },
          }
        );
      }

      return originalUpdateOne(filter, update, options);
    });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.116')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(409);
    const session = await CartoonUploadSession.findOne({ sessionId: 'cartoon-session-1' }).lean();

    expect(await CartoonOrder.countDocuments()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(session.uploadedObjects[0].claimedAt).toBeNull();
    expect(session.uploadedObjects[0].claimedOrderId).toBeNull();
    expect(session.uploadedObjects[0].cleanupLockedAt).toBeInstanceOf(Date);
    updateSpy.mockRestore();
  });

  it('rolls back partially claimed photos when another photo loses the cleanup race', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const firstPhoto = buildPhoto();
    const secondPhoto = buildPhoto({
      objectName: 'cartoon-orders/reference-photos/photo-2.webp',
      originalName: 'photo-2.webp',
    });
    await createUploadSession({ photos: [firstPhoto, secondPhoto] });
    const originalUpdateOne = CartoonUploadSession.updateOne.bind(CartoonUploadSession);
    const updateSpy = vi.spyOn(CartoonUploadSession, 'updateOne').mockImplementation(async (filter, update, options) => {
      if (update?.$set?.['uploadedObjects.$[photo].claimedAt']) {
        await originalUpdateOne(
          {
            sessionId: 'cartoon-session-1',
            'uploadedObjects.objectName': secondPhoto.objectName,
          },
          {
            $set: {
              'uploadedObjects.$.cleanupLockedAt': new Date(),
            },
          }
        );
      }

      return originalUpdateOne(filter, update, options);
    });

    await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.117')
      .send(buildCartoonOrderPayload({ product, photos: [firstPhoto, secondPhoto] }))
      .expect(409);
    const session = await CartoonUploadSession.findOne({ sessionId: 'cartoon-session-1' }).lean();

    expect(await CartoonOrder.countDocuments()).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(session.uploadedObjects[0].claimedAt).toBeNull();
    expect(session.uploadedObjects[0].claimedOrderId).toBeNull();
    expect(session.uploadedObjects[1].claimedAt).toBeNull();
    expect(session.uploadedObjects[1].claimedOrderId).toBeNull();
    expect(session.uploadedObjects[1].cleanupLockedAt).toBeInstanceOf(Date);
    updateSpy.mockRestore();
  });

  it('does not expose unexpected internal errors to public clients', async () => {
    process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED = 'true';
    const app = createExpressApp();
    const product = await createProduct();
    const photo = buildPhoto();
    await createUploadSession({ photos: [photo] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(CartoonOrder, 'create').mockRejectedValueOnce(new Error('database secret detail'));

    const res = await request(app)
      .post('/cartoon-orders')
      .set('x-forwarded-for', '203.0.113.118')
      .send(buildCartoonOrderPayload({ product, photos: [photo] }))
      .expect(500);
    const session = await CartoonUploadSession.findOne({ sessionId: 'cartoon-session-1' }).lean();

    expect(res.body.message).toBe('Cartoon order could not be created.');
    expect(res.body.message).not.toContain('database secret detail');
    expect(sendEmail).not.toHaveBeenCalled();
    expect(session.uploadedObjects[0].claimedAt).toBeNull();
    expect(session.uploadedObjects[0].claimedOrderId).toBeNull();
  });

  it('defines the required query and uniqueness indexes', () => {
    const indexes = CartoonOrder.schema.indexes();

    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ archivedAt: 1, createdAt: -1 }, { background: true }],
        [{ completedAt: 1, createdAt: -1 }, { background: true }],
        [{ 'customer.email': 1, createdAt: -1 }, { background: true }],
        [
          { 'photos.objectName': 1 },
          {
            unique: true,
            background: true,
            partialFilterExpression: {
              'photos.objectName': { $exists: true, $type: 'string' },
            },
          },
        ],
      ])
    );
  });
});
