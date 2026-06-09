import mongoose from 'mongoose';
import CartoonOrder from '../models/CartoonOrder.js';
import CartoonUploadSession from '../models/CartoonUploadSession.js';
import Product from '../models/Product.js';
import { sendEmail } from '../helpers/sendEmail.js';
import {
  CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
  verifyCartoonOrderUploadToken,
} from '../helpers/cartoonOrderUploadToken.js';
import {
  createCartoonOrderPhotoSignedReadUrl,
  deleteGcsObjectByName,
  isCartoonOrderPhotoObjectName,
} from '../helpers/gcsImageHelper.js';
import {
  ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES,
  MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES,
  MAX_CARTOON_ORDER_PHOTOS,
} from '../config/productLimits.js';
import { buildPublicProductFilter } from '../utils/productPublication.js';

class CartoonOrderError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isCartoonOrderError = true;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HTML_RE = /<[^>]*>/;
const ADMIN_PHOTO_READ_URL_TTL_MS = 30 * 60 * 1000;
const ADMIN_ORDER_PHOTO_READ_URL_TTL_MS = 30 * 60 * 1000;
const DEFAULT_UNCLAIMED_UPLOAD_RETENTION_DAYS = 14;
const MIN_UNCLAIMED_UPLOAD_RETENTION_DAYS = 1;
const CLEANUP_LOCK_LEASE_MS = 60 * 60 * 1000;
const STATUS_KEYS = new Set(['ordered', 'designApproved', 'paid']);

function createValidationError(message, statusCode = 400) {
  return new CartoonOrderError(message, statusCode);
}

function sanitizeText(value) {
  return String(value ?? '').replace(/<\/?[^>]+(>|$)/g, '').trim();
}

function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

function hasMarkup(values) {
  return values.some((value) => HTML_RE.test(String(value ?? '').trim()));
}

function isDuplicatePhotoOrderError(error) {
  return (
    error?.code === 11000 &&
    (error?.keyPattern?.['photos.objectName'] ||
      String(error?.message || '').includes('photos.objectName'))
  );
}

function toSafeErrorMessage(error) {
  return String(error?.message || 'Unknown error').slice(0, 300);
}

function normalizeCleanupCutoff({
  olderThan = null,
  now = new Date(),
  retentionDays = DEFAULT_UNCLAIMED_UPLOAD_RETENTION_DAYS,
} = {}) {
  if (olderThan) {
    const cutoff = new Date(olderThan);

    if (Number.isNaN(cutoff.getTime())) {
      throw createValidationError('Invalid cleanup cutoff.');
    }

    return cutoff;
  }

  const parsedRetentionDays = Number(retentionDays);

  if (!Number.isFinite(parsedRetentionDays) || parsedRetentionDays <= 0) {
    throw createValidationError('Invalid cleanup retention.');
  }

  const safeRetentionDays = Math.max(parsedRetentionDays, MIN_UNCLAIMED_UPLOAD_RETENTION_DAYS);

  return new Date(new Date(now).getTime() - safeRetentionDays * 24 * 60 * 60 * 1000);
}

function validateOrderId(orderId) {
  if (!mongoose.Types.ObjectId.isValid(String(orderId || ''))) {
    throw createValidationError('Cartoon order was not found.', 404);
  }

  return orderId;
}

function serializeDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function serializePhoto(photo, photoReadUrls = new Map()) {
  const objectName = String(photo.objectName || '');

  return {
    objectName,
    originalName: String(photo.originalName || ''),
    contentType: String(photo.contentType || ''),
    size: Number(photo.size) || 0,
    uploadSessionId: String(photo.uploadSessionId || ''),
    deletedAt: serializeDate(photo.deletedAt),
    readUrl: photo.deletedAt ? '' : String(photoReadUrls.get(objectName) || ''),
  };
}

async function buildPhotoReadUrls(order) {
  const entries = await Promise.all(
    (order.photos || [])
      .filter((photo) => !photo.deletedAt)
      .map(async (photo) => [
        String(photo.objectName || ''),
        await createCartoonOrderPhotoSignedReadUrl({
          objectName: photo.objectName,
          expiresInMs: ADMIN_ORDER_PHOTO_READ_URL_TTL_MS,
        }),
      ])
  );

  return new Map(entries);
}

async function serializeCartoonOrder(order, { includePhotoReadUrls = false } = {}) {
  const rawOrder = typeof order.toObject === 'function' ? order.toObject() : order;
  const photoReadUrls = includePhotoReadUrls ? await buildPhotoReadUrls(rawOrder) : new Map();

  return {
    _id: String(rawOrder._id || ''),
    customer: {
      name: String(rawOrder.customer?.name || ''),
      email: String(rawOrder.customer?.email || ''),
      phone: String(rawOrder.customer?.phone || ''),
      message: String(rawOrder.customer?.message || ''),
    },
    productSnapshot: {
      productId: String(rawOrder.productSnapshot?.productId || ''),
      title: String(rawOrder.productSnapshot?.title || ''),
      price: Number(rawOrder.productSnapshot?.price) || 0,
      imageUrl: String(rawOrder.productSnapshot?.imageUrl || ''),
    },
    photos: (rawOrder.photos || []).map((photo) => serializePhoto(photo, photoReadUrls)),
    statuses: {
      ordered: rawOrder.statuses?.ordered !== false,
      designApproved: rawOrder.statuses?.designApproved === true,
      paid: rawOrder.statuses?.paid === true,
    },
    adminNotes: String(rawOrder.adminNotes || ''),
    notificationStatus: String(rawOrder.notificationStatus || 'pending'),
    notificationError: String(rawOrder.notificationError || ''),
    claimStatus: String(rawOrder.claimStatus || 'pending'),
    claimFailureReason: String(rawOrder.claimFailureReason || ''),
    requiresAdminAttention: rawOrder.requiresAdminAttention === true,
    consentAccepted: rawOrder.consentAccepted === true,
    consentAcceptedAt: serializeDate(rawOrder.consentAcceptedAt),
    completedAt: serializeDate(rawOrder.completedAt),
    archivedAt: serializeDate(rawOrder.archivedAt),
    completedBy: rawOrder.completedBy ? String(rawOrder.completedBy) : null,
    createdAt: serializeDate(rawOrder.createdAt),
    updatedAt: serializeDate(rawOrder.updatedAt),
  };
}

async function findOrderOrThrow(orderId) {
  validateOrderId(orderId);
  const order = await CartoonOrder.findById(orderId);

  if (!order) {
    throw createValidationError('Cartoon order was not found.', 404);
  }

  return order;
}

function normalizePhotoPayload(rawPhoto) {
  if (!rawPhoto || typeof rawPhoto !== 'object' || Array.isArray(rawPhoto)) {
    throw createValidationError('Invalid reference photo.');
  }

  const objectName = String(rawPhoto.objectName || '').trim();
  const uploadConfirmationToken = String(rawPhoto.uploadConfirmationToken || '').trim();
  const originalName = String(rawPhoto.originalName || '').trim();
  const contentType = String(rawPhoto.contentType || '').trim().toLowerCase();
  const size = Number(rawPhoto.size);

  if (!objectName || !uploadConfirmationToken || !contentType || !Number.isFinite(size)) {
    throw createValidationError('Invalid reference photo.');
  }

  if (!isCartoonOrderPhotoObjectName(objectName)) {
    throw createValidationError('Invalid reference photo path.');
  }

  if (!ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES.includes(contentType)) {
    throw createValidationError('Unsupported reference photo type.');
  }

  if (!Number.isInteger(size) || size <= 0 || size > MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES) {
    throw createValidationError('Invalid reference photo size.');
  }

  return {
    objectName,
    uploadConfirmationToken,
    originalName,
    contentType,
    size,
  };
}

function validateBasicPayload(rawData = {}) {
  const name = String(rawData.name ?? '').trim();
  const email = normalizeEmail(rawData.email);
  const phone = String(rawData.phone ?? '').trim();
  const message = String(rawData.message ?? '').trim();
  const productId = String(rawData.productId ?? '').trim();
  const consentAccepted = rawData.consentAccepted === true;
  const website = String(rawData.website ?? '').trim();

  if (website) {
    return { honeypot: true };
  }

  if (!name || !email || !message || !productId) {
    throw createValidationError('Missing required fields.');
  }

  if (name.length < 3 || name.length > 80) {
    throw createValidationError('Name must be between 3 and 80 characters.');
  }

  if (!EMAIL_RE.test(email)) {
    throw createValidationError('Invalid email format.');
  }

  if (phone.length > 30) {
    throw createValidationError('Phone is too long.');
  }

  if (message.length > 1500) {
    throw createValidationError('Message is too long.');
  }

  if (!consentAccepted) {
    throw createValidationError('Consent is required.');
  }

  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw createValidationError('Invalid product.', 404);
  }

  if (hasMarkup([name, email, phone, message, productId])) {
    throw createValidationError('Forbidden characters in form fields.');
  }

  return {
    customer: {
      name: sanitizeText(name),
      email,
      phone: sanitizeText(phone),
      message: sanitizeText(message),
    },
    productId,
    consentAccepted,
  };
}

function validateAndNormalizePhotos(rawPhotos) {
  if (!Array.isArray(rawPhotos) || rawPhotos.length === 0) {
    throw createValidationError('At least one reference photo is required.');
  }

  if (rawPhotos.length > MAX_CARTOON_ORDER_PHOTOS) {
    throw createValidationError(`You can attach up to ${MAX_CARTOON_ORDER_PHOTOS} photos.`);
  }

  const photos = rawPhotos.map(normalizePhotoPayload);
  const objectNames = photos.map((photo) => photo.objectName);

  if (new Set(objectNames).size !== objectNames.length) {
    throw createValidationError('A reference photo was attached more than once.');
  }

  return photos;
}

function verifyPhotoTokens(photos, now = Date.now()) {
  let sessionId = '';

  return photos.map((photo) => {
    const verification = verifyCartoonOrderUploadToken({
      token: photo.uploadConfirmationToken,
      purpose: CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
      objectName: photo.objectName,
      contentType: photo.contentType,
      size: photo.size,
      now,
    });

    if (!verification.ok) {
      throw createValidationError(verification.message, 401);
    }

    const tokenSessionId = String(verification.payload?.sessionId || '');

    if (!tokenSessionId) {
      throw createValidationError('Upload token session is missing.', 401);
    }

    if (!sessionId) {
      sessionId = tokenSessionId;
    } else if (sessionId !== tokenSessionId) {
      throw createValidationError('All reference photos must come from the same upload session.');
    }

    return {
      ...photo,
      sessionId,
    };
  });
}

async function getPublishedProductSnapshot(productId) {
  const product = await Product.findOne({
    ...buildPublicProductFilter(),
    _id: productId,
  }).lean();

  if (!product) {
    throw createValidationError('Product was not found.', 404);
  }

  const price = Number(product.price);

  if (!Number.isFinite(price) || price < 0) {
    throw createValidationError('Product price is invalid.', 400);
  }

  return {
    productId: product._id,
    title: String(product.title || ''),
    price,
    imageUrl: String(product.imageUrl || product.imageUrls?.[0] || ''),
  };
}

async function validateUploadSessionPhotos(photos, now = new Date()) {
  const sessionId = photos[0]?.sessionId;
  const session = await CartoonUploadSession.findOne({
    sessionId,
    expiresAt: { $gt: now },
  }).lean();

  if (!session) {
    throw createValidationError('Upload session is expired or missing.', 409);
  }

  const uploadedObjects = new Map(
    (session.uploadedObjects || []).map((uploadedObject) => [
      uploadedObject.objectName,
      uploadedObject,
    ])
  );

  return photos.map((photo) => {
    const uploadedObject = uploadedObjects.get(photo.objectName);

    if (!uploadedObject) {
      throw createValidationError('Reference photo was not found in the upload session.', 409);
    }

    if (uploadedObject.claimedAt || uploadedObject.claimedOrderId || uploadedObject.cleanupLockedAt) {
      throw createValidationError('Reference photo has already been used in an order.', 409);
    }

    if (
      uploadedObject.contentType !== photo.contentType ||
      Number(uploadedObject.size) !== Number(photo.size)
    ) {
      throw createValidationError('Reference photo metadata does not match the upload session.', 409);
    }

    return {
      objectName: photo.objectName,
      originalName: String(uploadedObject.originalName || photo.originalName || '').slice(0, 255),
      contentType: photo.contentType,
      size: photo.size,
      uploadSessionId: sessionId,
    };
  });
}

async function markSessionPhotosClaimed({ sessionId, objectNames, orderId, now }) {
  await CartoonUploadSession.updateOne(
    {
      sessionId,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        'uploadedObjects.$[photo].claimedAt': now,
        'uploadedObjects.$[photo].claimedOrderId': orderId,
      },
    },
    {
      arrayFilters: [
        {
          'photo.objectName': { $in: objectNames },
          'photo.claimedAt': null,
          'photo.claimedOrderId': null,
          'photo.cleanupLockedAt': null,
        },
      ],
    }
  );

  const session = await CartoonUploadSession.findOne({ sessionId }).lean();
  const uploadedObjects = new Map(
    (session?.uploadedObjects || []).map((uploadedObject) => [
      uploadedObject.objectName,
      uploadedObject,
    ])
  );

  return objectNames.every((objectName) => {
    const uploadedObject = uploadedObjects.get(objectName);

    return String(uploadedObject?.claimedOrderId || '') === String(orderId);
  });
}

async function releaseSessionPhotoClaims({ sessionId, objectNames, orderId }) {
  await CartoonUploadSession.updateOne(
    {
      sessionId,
    },
    {
      $set: {
        'uploadedObjects.$[photo].claimedAt': null,
        'uploadedObjects.$[photo].claimedOrderId': null,
      },
    },
    {
      arrayFilters: [
        {
          'photo.objectName': { $in: objectNames },
          'photo.claimedOrderId': orderId,
        },
      ],
    }
  ).catch(() => {});
}

function buildAdminEmailText(order, photoReadUrls = new Map()) {
  const product = order.productSnapshot;
  const photos = order.photos
    .map((photo) => {
      const readUrl = photoReadUrls.get(photo.objectName);

      return [
        `- ${photo.originalName || photo.objectName} (${photo.contentType}, ${photo.size} bytes)`,
        readUrl ? `  View: ${readUrl}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return [
    'New cartoon order',
    '',
    `Order ID: ${order._id}`,
    `Customer: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Phone: ${order.customer.phone || '-'}`,
    '',
    `Product: ${product.title}`,
    `Product ID: ${product.productId}`,
    `Price snapshot: ${Number(product.price).toFixed(2)}`,
    '',
    'Message:',
    order.customer.message,
    '',
    'Reference photos:',
    photos,
    '',
    `Claim status: ${order.claimStatus}`,
    order.requiresAdminAttention ? 'Admin attention required: yes' : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

async function notifyAdmin(order) {
  const photoReadUrlEntries = await Promise.all(
    order.photos.map(async (photo) => [
      photo.objectName,
      await createCartoonOrderPhotoSignedReadUrl({
        objectName: photo.objectName,
        expiresInMs: ADMIN_PHOTO_READ_URL_TTL_MS,
      }),
    ])
  );
  const photoReadUrls = new Map(photoReadUrlEntries);

  await sendEmail({
    subject: `New cartoon order from ${order.customer.name}`,
    text: buildAdminEmailText(order, photoReadUrls),
  });
}

export async function createCartoonOrder(rawData) {
  const basicPayload = validateBasicPayload(rawData);

  if (basicPayload.honeypot) {
    return {
      statusCode: 200,
      body: { message: 'Order request received.' },
    };
  }

  const now = new Date();
  const photosWithTokens = verifyPhotoTokens(validateAndNormalizePhotos(rawData.photos), now.getTime());
  const sessionId = photosWithTokens[0]?.sessionId;
  const [productSnapshot, photos] = await Promise.all([
    getPublishedProductSnapshot(basicPayload.productId),
    validateUploadSessionPhotos(photosWithTokens, now),
  ]);
  const objectNames = photos.map((photo) => photo.objectName);
  const orderId = new mongoose.Types.ObjectId();

  let order;

  try {
    const claimSucceeded = await markSessionPhotosClaimed({
      sessionId,
      objectNames,
      orderId,
      now,
    });

    if (!claimSucceeded) {
      throw createValidationError('Reference photo has already been used in an order.', 409);
    }

    order = await CartoonOrder.create({
      _id: orderId,
      customer: basicPayload.customer,
      productSnapshot,
      photos,
      statuses: { ordered: true },
      consentAccepted: true,
      consentAcceptedAt: now,
      notificationStatus: 'pending',
      claimStatus: 'claimed',
    });
  } catch (error) {
    await releaseSessionPhotoClaims({ sessionId, objectNames, orderId });

    if (isDuplicatePhotoOrderError(error)) {
      throw createValidationError('Reference photo has already been used in an order.', 409);
    }

    throw error;
  }

  try {
    await notifyAdmin(order);
    order.notificationStatus = 'sent';
    order.notificationError = '';
    await order.save();

    return {
      statusCode: 201,
      body: {
        message: 'Order request received.',
        orderId: order._id,
      },
    };
  } catch (error) {
    order.notificationStatus = 'failed';
    order.notificationError = toSafeErrorMessage(error);
    await order.save();

    return {
      statusCode: 202,
      body: {
        message: 'Order request received, but notification delivery failed.',
        orderId: order._id,
      },
    };
  }
}

export async function listCartoonOrders({ includeArchived = false } = {}) {
  const query = includeArchived ? {} : { archivedAt: null };
  const orders = await CartoonOrder.find(query).sort({ createdAt: -1 }).lean();

  return Promise.all(
    orders.map((order) => serializeCartoonOrder(order, { includePhotoReadUrls: true }))
  );
}

export async function getCartoonOrderById(orderId) {
  const order = await findOrderOrThrow(orderId);

  return serializeCartoonOrder(order, { includePhotoReadUrls: true });
}

export async function updateCartoonOrderStatuses(orderId, rawStatuses = {}) {
  const order = await findOrderOrThrow(orderId);
  const statuses = rawStatuses && typeof rawStatuses === 'object' ? rawStatuses : {};
  const unknownKeys = Object.keys(statuses).filter((key) => !STATUS_KEYS.has(key));

  if (unknownKeys.length > 0) {
    throw createValidationError('Unknown cartoon order status.');
  }

  for (const key of STATUS_KEYS) {
    if (Object.prototype.hasOwnProperty.call(statuses, key)) {
      order.statuses[key] = statuses[key] === true;
    }
  }

  await order.save();

  return serializeCartoonOrder(order, { includePhotoReadUrls: true });
}

export async function updateCartoonOrderAdminNotes(orderId, rawAdminNotes = '') {
  const order = await findOrderOrThrow(orderId);
  const adminNotes = String(rawAdminNotes ?? '').trim();

  if (adminNotes.length > 2000) {
    throw createValidationError('Admin notes are too long.');
  }

  order.adminNotes = adminNotes;
  await order.save();

  return serializeCartoonOrder(order, { includePhotoReadUrls: true });
}

export async function completeCartoonOrder(orderId, adminUserId) {
  const order = await findOrderOrThrow(orderId);

  if (order.completedAt) {
    return serializeCartoonOrder(order, { includePhotoReadUrls: true });
  }

  const now = new Date();
  const activePhotos = order.photos.filter((photo) => !photo.deletedAt);
  const invalidPhoto = activePhotos.find((photo) => !isCartoonOrderPhotoObjectName(photo.objectName));

  if (invalidPhoto) {
    throw createValidationError('Cartoon order contains an invalid photo path.');
  }

  for (const photo of activePhotos) {
    try {
      await deleteGcsObjectByName(photo.objectName, { throwOnError: true });
      photo.deletedAt = now;
      await order.save();
    } catch (error) {
      throw createValidationError(
        `Could not delete reference photo ${photo.originalName || photo.objectName}.`,
        500
      );
    }
  }

  order.completedAt = now;
  order.archivedAt = now;
  order.completedBy = adminUserId || null;
  await order.save();

  return serializeCartoonOrder(order, { includePhotoReadUrls: true });
}

export async function cleanupUnclaimedCartoonOrderUploads({
  olderThan = null,
  now = new Date(),
  retentionDays = DEFAULT_UNCLAIMED_UPLOAD_RETENTION_DAYS,
  limit = 200,
} = {}) {
  const cutoff = normalizeCleanupCutoff({ olderThan, now, retentionDays });
  const cleanupLockLeaseCutoff = new Date(new Date(now).getTime() - CLEANUP_LOCK_LEASE_MS);
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);
  const sessions = await CartoonUploadSession.find({
    uploadedObjects: {
      $elemMatch: {
        uploadedAt: { $lt: cutoff },
        claimedAt: null,
        claimedOrderId: null,
      },
    },
  })
    .sort({ createdAt: 1 })
    .limit(safeLimit)
    .lean();
  const candidates = [];
  const unsafeObjectNames = [];

  for (const session of sessions) {
    for (const uploadedObject of session.uploadedObjects || []) {
      if (
        uploadedObject.claimedAt ||
        uploadedObject.claimedOrderId ||
        !uploadedObject.uploadedAt ||
        uploadedObject.uploadedAt >= cutoff
      ) {
        continue;
      }

      const objectName = String(uploadedObject.objectName || '').trim();

      if (!isCartoonOrderPhotoObjectName(objectName)) {
        unsafeObjectNames.push(objectName);
        continue;
      }

      candidates.push({
        sessionId: session.sessionId,
        objectName,
      });
    }
  }

  const uniqueObjectNames = [...new Set(candidates.map((candidate) => candidate.objectName))];
  const linkedOrders = uniqueObjectNames.length
    ? await CartoonOrder.find(
        { 'photos.objectName': { $in: uniqueObjectNames } },
        { 'photos.objectName': 1 }
      ).lean()
    : [];
  const orderLinkedObjectNames = new Set(
    linkedOrders.flatMap((order) => (order.photos || []).map((photo) => photo.objectName))
  );
  const orderLinkedCandidateObjectNames = new Set(
    uniqueObjectNames.filter((objectName) => orderLinkedObjectNames.has(objectName))
  );
  const deletedObjectNames = [];
  const failedObjectNames = [];
  let skippedLockedCount = 0;

  for (const candidate of candidates) {
    if (orderLinkedCandidateObjectNames.has(candidate.objectName)) {
      continue;
    }

    const cleanupLockedAt = new Date();

    try {
      const lockResult = await CartoonUploadSession.updateOne(
        {
          sessionId: candidate.sessionId,
          uploadedObjects: {
            $elemMatch: {
              objectName: candidate.objectName,
              uploadedAt: { $lt: cutoff },
              claimedAt: null,
              claimedOrderId: null,
              $or: [
                { cleanupLockedAt: null },
                { cleanupLockedAt: { $lt: cleanupLockLeaseCutoff } },
              ],
            },
          },
        },
        {
          $set: {
            'uploadedObjects.$.cleanupLockedAt': cleanupLockedAt,
          },
        }
      );

      if (lockResult.modifiedCount !== 1) {
        skippedLockedCount += 1;
        continue;
      }

      await deleteGcsObjectByName(candidate.objectName, { throwOnError: true });
      const pullResult = await CartoonUploadSession.updateOne(
        {
          sessionId: candidate.sessionId,
          'uploadedObjects.objectName': candidate.objectName,
          'uploadedObjects.cleanupLockedAt': cleanupLockedAt,
        },
        {
          $pull: {
            uploadedObjects: {
              objectName: candidate.objectName,
              cleanupLockedAt,
            },
          },
          $inc: { uploadCount: -1 },
        }
      );

      if (pullResult.modifiedCount !== 1) {
        throw new Error('Cleaned storage object could not be removed from upload session.');
      }

      deletedObjectNames.push(candidate.objectName);
    } catch (error) {
      failedObjectNames.push(candidate.objectName);
      await CartoonUploadSession.updateOne(
        {
          sessionId: candidate.sessionId,
          'uploadedObjects.objectName': candidate.objectName,
          'uploadedObjects.cleanupLockedAt': cleanupLockedAt,
        },
        {
          $set: {
            'uploadedObjects.$[photo].cleanupLockedAt': null,
          },
        },
        {
          arrayFilters: [
            {
              'photo.objectName': candidate.objectName,
              'photo.cleanupLockedAt': cleanupLockedAt,
              'photo.claimedAt': null,
              'photo.claimedOrderId': null,
            },
          ],
        }
      ).catch(() => {});
    }
  }

  return {
    cutoff,
    scannedSessions: sessions.length,
    candidateCount: candidates.length,
    deletedCount: deletedObjectNames.length,
    preservedOrderLinkedCount: orderLinkedCandidateObjectNames.size,
    skippedLockedCount,
    skippedUnsafeCount: unsafeObjectNames.length,
    failedCount: failedObjectNames.length,
    deletedObjectNames,
    failedObjectNames,
  };
}
