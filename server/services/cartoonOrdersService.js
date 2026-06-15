import mongoose from 'mongoose';
import crypto from 'node:crypto';
import CartoonOrder from '../models/CartoonOrder.js';
import CartoonUploadSession from '../models/CartoonUploadSession.js';
import Product from '../models/Product.js';
import { sendEmail } from '../helpers/sendEmail.js';
import {
  CARTOON_ORDER_UPLOAD_CONFIRMATION_PURPOSE,
  verifyCartoonOrderUploadToken,
} from '../helpers/cartoonOrderUploadToken.js';
import {
  checkCartoonOrderPhotoExists,
  createCartoonOrderPhotoDiagnosticSignedReadProbe,
  createCartoonOrderPhotoReadStream,
  createCartoonOrderPhotoSignedReadUrl,
  deleteGcsObjectByName,
  getSafeCartoonPhotoStorageContext,
  isCartoonOrderPhotoObjectName,
} from '../helpers/gcsImageHelper.js';
import {
  ALLOWED_CARTOON_ORDER_PHOTO_MIME_TYPES,
  MAX_CARTOON_ORDER_PHOTO_SIZE_BYTES,
  MAX_CARTOON_ORDER_PHOTOS,
} from '../config/productLimits.js';
import { classifyStorageError } from '../helpers/storageErrorClassifier.js';
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
const ADMIN_ORDER_PHOTO_READ_URL_TTL_MS = 30 * 60 * 1000;
const DEFAULT_UNCLAIMED_UPLOAD_RETENTION_DAYS = 14;
const MIN_UNCLAIMED_UPLOAD_RETENTION_DAYS = 1;
const CLEANUP_LOCK_LEASE_MS = 60 * 60 * 1000;
const STATUS_KEYS = new Set(['ordered', 'designApproved', 'paid']);
const PHOTO_LINK_UNAVAILABLE_MESSAGE = 'Photo links unavailable.';
const CARTOON_ORDER_CUSTOMER_THANK_YOU_BG =
  '\u041f\u043e\u043b\u0443\u0447\u0438\u0445\u043c\u0435 \u0437\u0430\u043f\u0438\u0442\u0432\u0430\u043d\u0435\u0442\u043e \u0432\u0438 \u0437\u0430 \u0448\u0430\u0440\u0436, \u0431\u043b\u0430\u0433\u043e\u0434\u0430\u0440\u0438\u043c! \u0429\u0435 \u0441\u0435 \u0441\u0432\u044a\u0440\u0436\u0435\u043c \u0441 \u0432\u0430\u0441 \u043f\u0440\u0438 \u043f\u044a\u0440\u0432\u0430 \u0432\u044a\u0437\u043c\u043e\u0436\u043d\u043e\u0441\u0442.\n\n\u041f\u043e\u0437\u0434\u0440\u0430\u0432\u0438,\n\u0415\u043a\u0438\u043f\u044a\u0442 \u043d\u0430 Happy Colors';
const NOTIFICATION_STATUSES = new Set(['pending', 'sent', 'failed']);
const WORKFLOW_STATUSES = new Set(['inquiry', 'waiting', 'ordered', 'completed']);
const WORKFLOW_TRANSITIONS = new Map([
  ['inquiry', new Set(['waiting', 'ordered'])],
  ['waiting', new Set(['inquiry', 'ordered'])],
]);
const COMPLETED_ORDER_RETENTION_MONTHS = 6;
const DEFAULT_COMPLETED_ORDER_PURGE_LIMIT = 50;
const MAX_COMPLETED_ORDER_PURGE_LIMIT = 200;
const CARTOON_ORDER_DIAGNOSTIC_PHOTO_PROBE_LIMIT = 10;
const AUTH_GATED_PHOTO_LINK_WARNING = 'Signed photo link unavailable. Admin session required.';

function createValidationError(message, statusCode = 400) {
  return new CartoonOrderError(message, statusCode);
}

function createPartialCleanupError(message, { orderId = null, counts = null } = {}) {
  const error = createValidationError(message, 500);

  error.partial = true;
  error.requiresAdminAttention = true;
  error.retryable = true;

  if (orderId) {
    error.orderId = String(orderId);
  }

  if (counts) {
    error.counts = counts;
  }

  return error;
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

function logPhotoReadUrlFailure(error, { orderId = '', photoId = '' } = {}) {
  console.error('Cartoon order photo signed-read failed.', {
    operation: 'signed-read',
    runtimeSurface: 'express-admin',
    orderId: String(orderId || ''),
    photoId: String(photoId || ''),
    ...classifyStorageError(error),
  });
}

function logPhotoCleanupFailure(error, { orderId = '', photoId = '' } = {}) {
  console.error('Cartoon order photo cleanup failed.', {
    operation: 'delete',
    runtimeSurface: 'express-admin',
    orderId: String(orderId || ''),
    photoId: String(photoId || ''),
    ...classifyStorageError(error),
  });
}

function logNotificationStatusSaveFailure(error) {
  console.error('Cartoon order notification status could not be saved.', {
    code: String(error?.code || 'UNKNOWN').slice(0, 40),
    name: String(error?.name || 'Error').slice(0, 80),
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textToHtml(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br>');
}

function getCartoonOrderAdminRecipient() {
  const configuredRecipient = normalizeEmail(process.env.CARTOON_ORDER_ADMIN_EMAIL);

  if (configuredRecipient) {
    if (!EMAIL_RE.test(configuredRecipient)) {
      throw new Error('CARTOON_ORDER_ADMIN_EMAIL is invalid.');
    }

    return configuredRecipient;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CARTOON_ORDER_ADMIN_EMAIL is not configured.');
  }

  const fallbackRecipient = normalizeEmail(process.env.CONTACT_EMAIL);

  if (!fallbackRecipient || !EMAIL_RE.test(fallbackRecipient)) {
    throw new Error('Cartoon order admin email is not configured.');
  }

  return fallbackRecipient;
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

function normalizeWorkflowStatus(rawOrder = {}) {
  if (rawOrder.completedAt) {
    return 'completed';
  }

  const workflowStatus = String(rawOrder.workflowStatus || '');

  return WORKFLOW_STATUSES.has(workflowStatus) ? workflowStatus : 'inquiry';
}

function normalizeNotificationChannel(channel = {}, legacyStatus = 'pending') {
  const status = NOTIFICATION_STATUSES.has(String(channel?.status || ''))
    ? String(channel.status)
    : NOTIFICATION_STATUSES.has(String(legacyStatus || ''))
      ? String(legacyStatus)
      : 'pending';

  return {
    status,
    error: String(channel?.error || '').slice(0, 300),
    sentAt: serializeDate(channel?.sentAt),
  };
}

function normalizeNotifications(rawOrder = {}) {
  const legacyStatus = String(rawOrder.notificationStatus || 'pending');
  const rawNotifications = rawOrder.notifications || {};

  return {
    admin: normalizeNotificationChannel(rawNotifications.admin, legacyStatus),
    customer: normalizeNotificationChannel(rawNotifications.customer, 'pending'),
  };
}

function deriveLegacyNotificationStatus(notifications) {
  const statuses = [notifications.admin.status, notifications.customer.status];

  if (statuses.every((status) => status === 'sent')) {
    return 'sent';
  }

  if (statuses.some((status) => status === 'failed')) {
    return 'failed';
  }

  return 'pending';
}

function deriveLegacyNotificationError(notifications) {
  const failedErrors = [
    notifications.admin.status === 'failed' ? notifications.admin.error : '',
    notifications.customer.status === 'failed' ? notifications.customer.error : '',
  ].filter(Boolean);

  return failedErrors.join(' | ').slice(0, 300);
}

function applyNotificationSummary(order) {
  const notifications = normalizeNotifications(order);

  order.notificationStatus = deriveLegacyNotificationStatus(notifications);
  order.notificationError = deriveLegacyNotificationError(notifications);
}

function getPhotoDisplayName(photo, index = 0) {
  const originalName = String(photo?.originalName || '').trim();

  return originalName || `Photo ${index + 1}`;
}

function getSafePhotoId(photo, index = 0) {
  const photoId = String(photo?.photoId || '').trim();

  if (photoId) {
    return photoId;
  }

  const source = photo?.objectName
    ? String(photo.objectName)
    : `${String(photo?.uploadSessionId || 'missing-photo-source')}:${index}`;
  const digest = crypto.createHash('sha256').update(source).digest('base64url').slice(0, 24);

  return `photo_${digest}`;
}

function buildAdminPhotoAccessPath(orderId, photoId) {
  return `/api/cartoon-orders/${encodeURIComponent(String(orderId))}/photos/${encodeURIComponent(String(photoId))}`;
}

function getPublicSiteBaseUrl() {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.CLIENT_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
  ];
  const value = candidates.map((candidate) => String(candidate || '').trim()).find(Boolean) || '';

  return value.replace(/\/+$/, '');
}

function buildAdminPhotoAccessUrl(orderId, photoId, { absolute = false } = {}) {
  const path = buildAdminPhotoAccessPath(orderId, photoId);
  const baseUrl = getPublicSiteBaseUrl();

  if (absolute && !baseUrl && process.env.NODE_ENV === 'production') {
    throw new Error('Cartoon order admin photo access URL is not configured.');
  }

  return baseUrl ? `${baseUrl}${path}` : path;
}

function serializePhoto(photo, photoAccess = new Map(), index = 0) {
  const photoId = getSafePhotoId(photo, index);
  const access = photoAccess.get(photoId) || {};
  const deletedAt = serializeDate(photo.deletedAt);

  return {
    photoId,
    displayName: getPhotoDisplayName(photo, index),
    originalName: String(photo.originalName || ''),
    contentType: String(photo.contentType || ''),
    size: Number(photo.size) || 0,
    deletedAt,
    readUrl: deletedAt ? '' : String(access.readUrl || ''),
    readUrlError: deletedAt ? '' : String(access.readUrlError || ''),
    photoAccessStatus: deletedAt
      ? 'deleted'
      : access.readUrl
        ? 'available'
        : access.readUrlError
          ? 'unavailable'
          : 'not_requested',
  };
}

async function buildPhotoReadUrls(order, { absoluteFallback = false } = {}) {
  const entries = await Promise.all(
    (order.photos || [])
      .filter((photo) => !photo.deletedAt)
      .map(async (photo, index) => {
        const photoId = getSafePhotoId(photo, index);

        try {
          const readUrl = await createCartoonOrderPhotoSignedReadUrl({
            objectName: photo.objectName,
            expiresInMs: ADMIN_ORDER_PHOTO_READ_URL_TTL_MS,
          });

          return [photoId, { readUrl, readUrlError: '' }];
        } catch (error) {
          logPhotoReadUrlFailure(error, {
            orderId: order._id,
            photoId,
          });
          return [
            photoId,
            {
              readUrl: buildAdminPhotoAccessUrl(order._id, photoId, {
                absolute: absoluteFallback,
              }),
              readUrlError: AUTH_GATED_PHOTO_LINK_WARNING,
            },
          ];
        }
      })
  );

  return new Map(entries);
}

async function serializeCartoonOrder(order, { includePhotoReadUrls = false } = {}) {
  const rawOrder = typeof order.toObject === 'function' ? order.toObject() : order;
  const photoAccess = includePhotoReadUrls ? await buildPhotoReadUrls(rawOrder) : new Map();
  const hasPhotoAccessError = [...photoAccess.values()].some((access) => access.readUrlError);
  const notifications = normalizeNotifications(rawOrder);
  const workflowStatus = normalizeWorkflowStatus(rawOrder);

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
    photos: (rawOrder.photos || []).map((photo, index) =>
      serializePhoto(photo, photoAccess, index)
    ),
    statuses: {
      ordered:
        workflowStatus === 'ordered' || workflowStatus === 'completed'
          ? rawOrder.statuses?.ordered !== false
          : false,
      designApproved: rawOrder.statuses?.designApproved === true,
      paid: rawOrder.statuses?.paid === true,
    },
    workflowStatus,
    adminNotes: String(rawOrder.adminNotes || ''),
    notifications,
    notificationStatus: deriveLegacyNotificationStatus(notifications),
    notificationError: deriveLegacyNotificationError(notifications),
    claimStatus: String(rawOrder.claimStatus || 'pending'),
    claimFailureReason: String(rawOrder.claimFailureReason || ''),
    requiresAdminAttention: rawOrder.requiresAdminAttention === true || hasPhotoAccessError,
    consentAccepted: rawOrder.consentAccepted === true,
    consentAcceptedAt: serializeDate(rawOrder.consentAcceptedAt),
    inquiryAt: serializeDate(rawOrder.inquiryAt),
    waitingAt: serializeDate(rawOrder.waitingAt),
    waitingBy: rawOrder.waitingBy ? String(rawOrder.waitingBy) : null,
    orderedAt: serializeDate(rawOrder.orderedAt),
    orderedBy: rawOrder.orderedBy ? String(rawOrder.orderedBy) : null,
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

function isCartoonOrderPhotoDiagnosticsEnabled() {
  return process.env.CARTOON_ORDER_PHOTO_DIAGNOSTICS_ENABLED === 'true';
}

function createDisabledDiagnosticsError() {
  return createValidationError('Cartoon order photo diagnostics are not available.', 404);
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

  if (!name || !email || !message) {
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

  // productId е опционален; валидираме формата само ако е подаден.
  if (productId && !mongoose.Types.ObjectId.isValid(productId)) {
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

function getPhotoReadUrl(photoReadAccess, photo, index = 0) {
  const access = photoReadAccess.get(getSafePhotoId(photo, index));

  return access?.readUrl || '';
}

function hasPhotoReadUrlWarnings(photoReadAccess) {
  return [...photoReadAccess.values()].some((access) => access.readUrlError);
}

function buildAdminEmailText(order, photoReadAccess = new Map()) {
  const product = order.productSnapshot;
  const hasProduct = Boolean(product && product.productId);
  const photos = order.photos
    .map((photo, index) => {
      const readUrl = getPhotoReadUrl(photoReadAccess, photo, index);

      return [
        `- ${getPhotoDisplayName(photo, index)} (${photo.contentType}, ${photo.size} bytes)`,
        readUrl ? `  View: ${readUrl}` : null,
        readUrl ? null : '  Photo link unavailable. Open the admin page to try again.',
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
    hasProduct ? `Product: ${product.title}` : 'Product: General inquiry (no specific product)',
    hasProduct ? `Product ID: ${product.productId}` : null,
    hasProduct ? `Price snapshot: ${Number(product.price).toFixed(2)}` : null,
    '',
    'Message:',
    order.customer.message,
    '',
    'Reference photos:',
    photos,
    hasPhotoReadUrlWarnings(photoReadAccess)
      ? 'Some photo links could not be generated. The order remains available in the admin page.'
      : null,
    '',
    `Claim status: ${order.claimStatus}`,
    order.requiresAdminAttention ? 'Admin attention required: yes' : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

function buildAdminEmailHtml(order, photoReadAccess = new Map()) {
  const product = order.productSnapshot;
  const hasProduct = Boolean(product && product.productId);
  const photos = order.photos
    .map((photo, index) => {
      const readUrl = getPhotoReadUrl(photoReadAccess, photo, index);
      const label = getPhotoDisplayName(photo, index);

      return [
        '<li>',
        `<strong>${escapeHtml(label)}</strong> (${escapeHtml(photo.contentType)}, ${Number(photo.size) || 0} bytes)`,
        readUrl
          ? `<br><a href="${escapeHtml(readUrl)}">View photo</a>`
          : '<br><span>Photo link unavailable. Open the admin page to try again.</span>',
        '</li>',
      ].join('');
    })
    .join('');

  return [
    '<h1>New cartoon order</h1>',
    `<p><strong>Order ID:</strong> ${escapeHtml(order._id)}</p>`,
    `<p><strong>Customer:</strong> ${escapeHtml(order.customer.name)}</p>`,
    `<p><strong>Email:</strong> ${escapeHtml(order.customer.email)}</p>`,
    `<p><strong>Phone:</strong> ${escapeHtml(order.customer.phone || '-')}</p>`,
    `<p><strong>Product:</strong> ${escapeHtml(hasProduct ? product.title : 'General inquiry (no specific product)')}</p>`,
    hasProduct ? `<p><strong>Product ID:</strong> ${escapeHtml(product.productId)}</p>` : null,
    hasProduct ? `<p><strong>Price snapshot:</strong> ${Number(product.price).toFixed(2)}</p>` : null,
    `<p><strong>Message:</strong><br>${textToHtml(order.customer.message)}</p>`,
    '<p><strong>Reference photos:</strong></p>',
    `<ul>${photos}</ul>`,
    hasPhotoReadUrlWarnings(photoReadAccess)
      ? '<p>Some photo links could not be generated. The order remains available in the admin page.</p>'
      : null,
    `<p><strong>Claim status:</strong> ${escapeHtml(order.claimStatus)}</p>`,
    order.requiresAdminAttention ? '<p><strong>Admin attention required:</strong> yes</p>' : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildCustomerConfirmationText() {
  return CARTOON_ORDER_CUSTOMER_THANK_YOU_BG;
}

function buildCustomerConfirmationHtml() {
  return `<p>${textToHtml(CARTOON_ORDER_CUSTOMER_THANK_YOU_BG)}</p>`;
}

async function notifyCartoonOrderAdmin(order) {
  const photoReadAccess = await buildPhotoReadUrls(order, { absoluteFallback: true });

  await sendEmail({
    to: getCartoonOrderAdminRecipient(),
    subject: `New cartoon order from ${order.customer.name}`,
    text: buildAdminEmailText(order, photoReadAccess),
    html: buildAdminEmailHtml(order, photoReadAccess),
  });

  return {
    warning: hasPhotoReadUrlWarnings(photoReadAccess) ? PHOTO_LINK_UNAVAILABLE_MESSAGE : '',
  };
}

async function notifyCartoonOrderCustomer(order) {
  await sendEmail({
    to: order.customer.email,
    subject: 'Получихме запитването ви за шарж',
    text: buildCustomerConfirmationText(),
    html: buildCustomerConfirmationHtml(),
  });
}

async function deliverNotificationChannel(order, channel, now = new Date()) {
  try {
    let result = { warning: '' };

    if (channel === 'admin') {
      result = await notifyCartoonOrderAdmin(order);
    } else if (channel === 'customer') {
      await notifyCartoonOrderCustomer(order);
    } else {
      throw new Error('Unknown cartoon order notification channel.');
    }

    order.set(`notifications.${channel}.status`, 'sent');
    order.set(`notifications.${channel}.error`, result.warning || '');
    order.set(`notifications.${channel}.sentAt`, now);
  } catch (error) {
    order.set(`notifications.${channel}.status`, 'failed');
    order.set(`notifications.${channel}.error`, toSafeErrorMessage(error));
    order.set(`notifications.${channel}.sentAt`, null);
  }
}

function shouldRetryNotificationChannel(channel) {
  return channel.status === 'failed' || Boolean(channel.error);
}

function hasNotificationAttention(order) {
  const notifications = normalizeNotifications(order);

  return ['admin', 'customer'].some(
    (channel) =>
      notifications[channel].status === 'failed' || Boolean(notifications[channel].error)
  );
}

function hasPartialPhotoCleanupAttention(order) {
  const photos = Array.isArray(order.photos) ? order.photos : [];

  return (
    !order.completedAt &&
    photos.some((photo) => photo.deletedAt) &&
    photos.some((photo) => !photo.deletedAt)
  );
}

function hasStoredAdminAttention(order) {
  return hasPartialPhotoCleanupAttention(order) || hasNotificationAttention(order);
}

function clearResolvedPhotoLinkNotificationWarnings(order) {
  const notifications = normalizeNotifications(order);

  if (
    notifications.admin.status === 'sent' &&
    notifications.admin.error === PHOTO_LINK_UNAVAILABLE_MESSAGE
  ) {
    order.set('notifications.admin.error', '');
    applyNotificationSummary(order);
  }
}

async function deliverCartoonOrderNotifications(order, { failedOnly = false } = {}) {
  const notifications = normalizeNotifications(order);
  const channels = ['admin', 'customer'].filter(
    (channel) => !failedOnly || shouldRetryNotificationChannel(notifications[channel])
  );

  for (const channel of channels) {
    await deliverNotificationChannel(order, channel);
  }

  applyNotificationSummary(order);
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
    basicPayload.productId
      ? getPublishedProductSnapshot(basicPayload.productId)
      : Promise.resolve(null),
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
      ...(productSnapshot ? { productSnapshot } : {}),
      photos,
      statuses: { ordered: false },
      workflowStatus: 'inquiry',
      inquiryAt: now,
      consentAccepted: true,
      consentAcceptedAt: now,
      notificationStatus: 'pending',
      claimStatus: 'claimed',
      notifications: {
        admin: { status: 'pending', error: '', sentAt: null },
        customer: { status: 'pending', error: '', sentAt: null },
      },
    });
  } catch (error) {
    await releaseSessionPhotoClaims({ sessionId, objectNames, orderId });

    if (isDuplicatePhotoOrderError(error)) {
      throw createValidationError('Reference photo has already been used in an order.', 409);
    }

    throw error;
  }

  await deliverCartoonOrderNotifications(order);
  order.requiresAdminAttention = hasStoredAdminAttention(order);

  try {
    await order.save();
  } catch (error) {
    logNotificationStatusSaveFailure(error);

    return {
      statusCode: 202,
      body: {
        message: 'Order request received, but notification status could not be saved.',
        orderId: order._id,
      },
    };
  }

  const notificationStatus = String(order.notificationStatus || 'pending');

  return {
    statusCode: notificationStatus === 'failed' ? 202 : 201,
    body: {
      message:
        notificationStatus === 'failed'
          ? 'Order request received, but notification delivery failed.'
          : 'Order request received.',
      orderId: order._id,
    },
  };
}

export async function listCartoonOrders({ includeArchived = false } = {}) {
  const query = includeArchived
    ? {}
    : {
        $or: [
          { archivedAt: null },
          { workflowStatus: 'completed' },
          { completedAt: { $type: 'date' } },
        ],
      };
  const orders = await CartoonOrder.find(query).sort({ createdAt: -1 }).lean();

  return Promise.all(
    orders.map((order) => serializeCartoonOrder(order, { includePhotoReadUrls: true }))
  );
}

export async function getCartoonOrderById(orderId) {
  const order = await findOrderOrThrow(orderId);

  return serializeCartoonOrder(order, { includePhotoReadUrls: true });
}

export async function getCartoonOrderPhotoAccess(orderId, rawPhotoId) {
  const order = await findOrderOrThrow(orderId);
  const photoId = String(rawPhotoId || '').trim();
  const photoEntry = (order.photos || [])
    .map((photo, index) => ({ photo, index, photoId: getSafePhotoId(photo, index) }))
    .find((entry) => entry.photoId === photoId);

  if (!photoEntry || photoEntry.photo.deletedAt) {
    throw createValidationError('Cartoon order photo was not found.', 404);
  }

  if (!isCartoonOrderPhotoObjectName(photoEntry.photo.objectName)) {
    throw createValidationError('Cartoon order photo was not found.', 404);
  }

  return {
    photoId,
    contentType: String(photoEntry.photo.contentType || 'application/octet-stream'),
    size: Number(photoEntry.photo.size) || 0,
    stream: createCartoonOrderPhotoReadStream(photoEntry.photo.objectName),
  };
}

async function runDiagnosticSignProbe() {
  try {
    await createCartoonOrderPhotoDiagnosticSignedReadProbe({ expiresInMs: 1000 });

    return {
      ok: true,
      errorCategory: '',
      code: '',
      name: '',
    };
  } catch (error) {
    return {
      ok: false,
      ...classifyStorageError(error),
    };
  }
}

async function buildDiagnosticPhotoChecks(photo) {
  if (photo.deletedAt) {
    return {
      photoMetadataRead: {
        status: 'skipped_expected_absent',
        errorCategory: '',
        code: '',
        name: '',
      },
      photoExists: {
        status: 'skipped_expected_absent',
        errorCategory: '',
        code: '',
        name: '',
      },
      deleteAccess: {
        status: 'not_checked',
        errorCategory: '',
        code: '',
        name: '',
      },
    };
  }

  const existsCheck = await checkCartoonOrderPhotoExists(photo.objectName);
  const metadataStatusByExistsStatus = {
    exists: 'ok',
    not_found: 'not_found',
    permission_denied: 'permission_denied',
    network_or_provider_error: 'network_or_provider_error',
    not_checked: 'not_checked',
  };

  return {
    photoMetadataRead: {
      status: metadataStatusByExistsStatus[existsCheck.status] || 'not_checked',
      errorCategory: existsCheck.errorCategory || '',
      code: existsCheck.code || '',
      name: existsCheck.name || '',
    },
    photoExists: {
      status: existsCheck.status,
      errorCategory: existsCheck.errorCategory || '',
      code: existsCheck.code || '',
      name: existsCheck.name || '',
    },
    deleteAccess: {
      status: 'not_checked',
      errorCategory: '',
      code: '',
      name: '',
    },
  };
}

export async function getCartoonOrderPhotoDiagnostics(orderId) {
  if (!isCartoonOrderPhotoDiagnosticsEnabled()) {
    throw createDisabledDiagnosticsError();
  }

  const order = await findOrderOrThrow(orderId);
  const rawOrder = typeof order.toObject === 'function' ? order.toObject() : order;
  const storageContext = getSafeCartoonPhotoStorageContext();
  const signGeneration = await runDiagnosticSignProbe();
  const photos = [];

  for (const [index, photo] of (rawOrder.photos || []).entries()) {
    if (photos.length >= CARTOON_ORDER_DIAGNOSTIC_PHOTO_PROBE_LIMIT) {
      break;
    }

    photos.push({
      photoId: getSafePhotoId(photo, index),
      deleted: Boolean(photo.deletedAt),
      checks: await buildDiagnosticPhotoChecks(photo),
    });
  }

  return {
    orderId: String(rawOrder._id || ''),
    runtimeSurface: 'express-admin',
    storageContext,
    signGeneration,
    driftComparison: {
      available: false,
      status: 'unavailable',
      reason: 'missing_upload_snapshot',
    },
    photos,
    probeLimits: {
      requestedPhotoCount: (rawOrder.photos || []).length,
      probedPhotoCount: photos.length,
      photoProbeLimit: CARTOON_ORDER_DIAGNOSTIC_PHOTO_PROBE_LIMIT,
    },
  };
}

export async function retryCartoonOrderNotifications(orderId) {
  const order = await findOrderOrThrow(orderId);

  await deliverCartoonOrderNotifications(order, { failedOnly: true });
  order.requiresAdminAttention = hasStoredAdminAttention(order);
  await order.save();

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

export async function updateCartoonOrderWorkflow(orderId, rawWorkflowStatus, adminUserId) {
  const order = await findOrderOrThrow(orderId);
  const currentWorkflowStatus = normalizeWorkflowStatus(order);
  const workflowStatus = String(rawWorkflowStatus || '').trim();
  const allowedTargets = WORKFLOW_TRANSITIONS.get(currentWorkflowStatus);

  if (!WORKFLOW_STATUSES.has(workflowStatus) || !allowedTargets?.has(workflowStatus)) {
    throw createValidationError('Cartoon order workflow transition is not allowed.', 409);
  }

  const now = new Date();

  if (workflowStatus === 'waiting') {
    order.waitingAt = now;
    order.waitingBy = adminUserId || null;
  } else if (workflowStatus === 'inquiry') {
    order.waitingAt = null;
    order.waitingBy = null;
  } else if (workflowStatus === 'ordered') {
    order.orderedAt = now;
    order.orderedBy = adminUserId || null;
    order.statuses.ordered = true;
  }

  order.workflowStatus = workflowStatus;
  await order.save();

  return serializeCartoonOrder(order, { includePhotoReadUrls: true });
}

async function cleanupCartoonOrderPhotos(order, now = new Date()) {
  const activePhotos = order.photos
    .map((photo, index) => ({ photo, index }))
    .filter(({ photo }) => !photo.deletedAt);

  for (const { photo, index } of activePhotos) {
    if (!isCartoonOrderPhotoObjectName(photo.objectName)) {
      order.requiresAdminAttention = true;
      await order.save();

      throw createPartialCleanupError(
        `Could not delete reference photo ${getPhotoDisplayName(photo, index)}.`,
        { orderId: order._id }
      );
    }
  }

  for (const { photo, index } of activePhotos) {
    try {
      await deleteGcsObjectByName(photo.objectName, { throwOnError: true });
      photo.deletedAt = now;
      await order.save();
    } catch (error) {
      logPhotoCleanupFailure(error, {
        orderId: order._id,
        photoId: getSafePhotoId(photo, index),
      });
      order.requiresAdminAttention = true;
      await order.save();

      throw createPartialCleanupError(
        `Could not delete reference photo ${getPhotoDisplayName(photo, index)}.`,
        { orderId: order._id }
      );
    }
  }
}

export async function completeCartoonOrder(orderId, adminUserId) {
  const order = await findOrderOrThrow(orderId);

  if (order.completedAt) {
    if (order.workflowStatus !== 'completed' || order.statuses?.ordered !== true) {
      order.workflowStatus = 'completed';
      order.statuses.ordered = true;
      await order.save();
    }

    return serializeCartoonOrder(order, { includePhotoReadUrls: true });
  }

  const now = new Date();
  await cleanupCartoonOrderPhotos(order, now);

  order.completedAt = now;
  order.workflowStatus = 'completed';
  order.statuses.ordered = true;
  order.completedBy = adminUserId || null;
  clearResolvedPhotoLinkNotificationWarnings(order);
  order.requiresAdminAttention = hasStoredAdminAttention(order);
  await order.save();

  return serializeCartoonOrder(order, { includePhotoReadUrls: true });
}

export async function rejectCartoonOrder(orderId) {
  const order = await findOrderOrThrow(orderId);
  const workflowStatus = normalizeWorkflowStatus(order);

  if (workflowStatus !== 'inquiry' && workflowStatus !== 'waiting') {
    throw createValidationError('Only inquiries and waiting requests can be rejected.', 409);
  }

  await cleanupCartoonOrderPhotos(order);
  await CartoonOrder.deleteOne({ _id: order._id });

  return { deleted: true };
}

export async function purgeOldCompletedCartoonOrders({
  now = new Date(),
  limit = DEFAULT_COMPLETED_ORDER_PURGE_LIMIT,
} = {}) {
  const safeNow = new Date(now);

  if (Number.isNaN(safeNow.getTime())) {
    throw createValidationError('Invalid purge date.');
  }

  const cutoff = new Date(safeNow);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - COMPLETED_ORDER_RETENTION_MONTHS);

  const safeLimit = Math.min(
    Math.max(Number.parseInt(limit, 10) || DEFAULT_COMPLETED_ORDER_PURGE_LIMIT, 1),
    MAX_COMPLETED_ORDER_PURGE_LIMIT
  );
  const orders = await CartoonOrder.find({
    $or: [
      { completedAt: { $lt: cutoff } },
      {
        completedAt: null,
        archivedAt: { $lt: cutoff },
        workflowStatus: 'completed',
      },
    ],
  })
    .sort({ completedAt: 1, archivedAt: 1, createdAt: 1 })
    .limit(safeLimit);
  const counts = {
    matchedCount: orders.length,
    deletedCount: 0,
    failedCount: 0,
  };

  for (const order of orders) {
    try {
      await cleanupCartoonOrderPhotos(order, safeNow);
      await CartoonOrder.deleteOne({ _id: order._id });
      counts.deletedCount += 1;
    } catch {
      order.requiresAdminAttention = true;
      await order.save().catch(() => {});
      counts.failedCount += 1;
    }
  }

  if (counts.failedCount > 0) {
    throw createPartialCleanupError('Some old completed cartoon orders could not be deleted.', {
      counts,
    });
  }

  return counts;
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
