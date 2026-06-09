import request from 'supertest';
import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CartoonOrder from '../../models/CartoonOrder.js';
import CartoonUploadSession from '../../models/CartoonUploadSession.js';
import { sendEmail } from '../../helpers/sendEmail.js';
import {
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

    expect(res.body).toHaveLength(1);
    expect(res.body[0].customer.name).toBe('Open Customer');
    expect(res.body[0].photos[0].readUrl).toContain('open-photo.webp');
    expect(createCartoonOrderPhotoSignedReadUrl).toHaveBeenCalledWith({
      objectName: 'cartoon-orders/reference-photos/open-photo.webp',
      expiresInMs: 30 * 60 * 1000,
    });
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
      ordered: true,
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

  it('completes cartoon orders by deleting active photos and archiving the order', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const order = await createStoredCartoonOrder({
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
    expect(res.body.archivedAt).toBeTruthy();
    expect(res.body.completedBy).toBe(String(admin._id));
    expect(res.body.photos.every((photo) => photo.deletedAt && !photo.readUrl)).toBe(true);
  });

  it('keeps completed cartoon order completion idempotent', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const completedAt = new Date();
    const order = await createStoredCartoonOrder({
      completedAt,
      archivedAt: completedAt,
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

    await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(deleteGcsObjectByName).not.toHaveBeenCalled();
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

    await request(app)
      .post(`/cartoon-orders/${order._id}/complete`)
      .set('Cookie', authCookie(admin))
      .expect(500);

    const updated = await CartoonOrder.findById(order._id).lean();

    expect(updated.completedAt).toBeNull();
    expect(updated.archivedAt).toBeNull();
    expect(updated.photos[0].deletedAt).toBeInstanceOf(Date);
    expect(updated.photos[1].deletedAt).toBeNull();
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
    expect(order.statuses.ordered).toBe(true);
    expect(order.claimStatus).toBe('claimed');
    expect(order.notificationStatus).toBe('sent');
    expect(order.consentAcceptedAt).toBeInstanceOf(Date);
    expect(String(session.uploadedObjects[0].claimedOrderId)).toBe(String(order._id));
    expect(session.uploadedObjects[0].claimedAt).toBeInstanceOf(Date);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: 'New cartoon order from Petya Babukova',
        text: expect.stringContaining('Cartoon Portrait'),
      })
    );
    expect(sendEmail.mock.calls[0][0].text).toContain(
      `https://signed.example.com/${encodeURIComponent(photo.objectName)}`
    );
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
    expect(order.claimStatus).toBe('claimed');
    expect(order.notificationError).toContain('smtp down');
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
