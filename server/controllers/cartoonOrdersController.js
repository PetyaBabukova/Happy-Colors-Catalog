import express from 'express';
import { requireAuth, requireFullAdmin } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { requireTrustedOrigin } from '../middlewares/trustedOrigin.js';
import {
  completeCartoonOrder,
  createCartoonOrder,
  getCartoonOrderById,
  getCartoonOrderPhotoAccess,
  getCartoonOrderPhotoDiagnostics,
  listCartoonOrders,
  purgeOldCompletedCartoonOrders,
  rejectCartoonOrder,
  retryCartoonOrderNotifications,
  updateCartoonOrderAdminNotes,
  updateCartoonOrderStatuses,
  updateCartoonOrderWorkflow,
} from '../services/cartoonOrdersService.js';

const router = express.Router();

const cartoonOrdersCreateLimiter = createRateLimiter({
  keyPrefix: 'cartoon-orders',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Too many cartoon order attempts. Please try again later.',
});

const cartoonOrdersAdminMutationLimiter = createRateLimiter({
  keyPrefix: 'cartoon-orders-admin',
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many cartoon order management requests. Please try again later.',
});

const cartoonOrdersDiagnosticsLimiter = createRateLimiter({
  keyPrefix: 'cartoon-orders-photo-diagnostics',
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many cartoon order diagnostics requests. Please try again later.',
  keyGenerator: (req, clientIp) => req.user?._id || clientIp,
});

const cartoonOrdersPhotoAccessLimiter = createRateLimiter({
  keyPrefix: 'cartoon-orders-photo-access',
  windowMs: 10 * 60 * 1000,
  max: 120,
  message: 'Too many cartoon order photo access requests. Please try again later.',
  keyGenerator: (req, clientIp) => req.user?._id || clientIp,
});

function isCartoonOrdersEnabled() {
  return process.env.NEXT_PUBLIC_CARTOONS_SERVICE_ENABLED === 'true';
}

function requireCartoonOrdersEnabled(req, res, next) {
  if (!isCartoonOrdersEnabled()) {
    return res.status(404).json({ message: 'Cartoon orders are not available.' });
  }

  return next();
}

function sendError(res, error, fallbackMessage = 'Cartoon order request failed.') {
  const statusCode = error.statusCode || 500;
  const body = {
    message:
      statusCode >= 500 && !error.isCartoonOrderError
        ? fallbackMessage
        : error.message || fallbackMessage,
  };

  if (statusCode >= 500) {
    console.error('Cartoon orders controller error:', error);
  }

  if (error.partial === true) {
    body.partial = true;
    body.requiresAdminAttention = error.requiresAdminAttention === true;
    body.retryable = error.retryable === true;
  }

  if (error.orderId) {
    body.orderId = String(error.orderId);
  }

  if (error.counts) {
    Object.assign(body, error.counts);
  }

  return res.status(statusCode).json(body);
}

router.get('/', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const includeArchived =
      req.query.includeArchived === 'true' || req.query.status === 'archived';
    const orders = await listCartoonOrders({ includeArchived });

    return res.json(orders);
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/:orderId', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const order = await getCartoonOrderById(req.params.orderId);

    return res.json(order);
  } catch (err) {
    return sendError(res, err);
  }
});

router.get(
  '/:orderId/photo-diagnostics',
  requireAuth,
  requireFullAdmin,
  cartoonOrdersDiagnosticsLimiter,
  async (req, res) => {
    try {
      const diagnostics = await getCartoonOrderPhotoDiagnostics(req.params.orderId);

      res.setHeader('Cache-Control', 'no-store');
      return res.json(diagnostics);
    } catch (err) {
      res.setHeader('Cache-Control', 'no-store');
      return sendError(res, err);
    }
  }
);

router.get(
  '/:orderId/photos/:photoId',
  requireAuth,
  requireFullAdmin,
  cartoonOrdersPhotoAccessLimiter,
  async (req, res) => {
    try {
      const photoAccess = await getCartoonOrderPhotoAccess(req.params.orderId, req.params.photoId);

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', photoAccess.contentType);

      photoAccess.stream.on('error', () => {
        if (!res.headersSent) {
          res.status(502).json({ message: 'Cartoon order photo could not be loaded.' });
          return;
        }

        res.destroy();
      });

      return photoAccess.stream.pipe(res);
    } catch (err) {
      res.setHeader('Cache-Control', 'no-store');
      return sendError(res, err);
    }
  }
);

router.patch(
  '/:orderId/workflow',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  cartoonOrdersAdminMutationLimiter,
  async (req, res) => {
    try {
      const order = await updateCartoonOrderWorkflow(
        req.params.orderId,
        req.body?.workflowStatus,
        req.user?._id
      );

      return res.json(order);
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.patch(
  '/:orderId/statuses',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  cartoonOrdersAdminMutationLimiter,
  async (req, res) => {
    try {
      const order = await updateCartoonOrderStatuses(req.params.orderId, req.body?.statuses);

      return res.json(order);
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.patch(
  '/:orderId/admin-notes',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  cartoonOrdersAdminMutationLimiter,
  async (req, res) => {
    try {
      const order = await updateCartoonOrderAdminNotes(req.params.orderId, req.body?.adminNotes);

      return res.json(order);
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.post(
  '/purge-old-completed',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  cartoonOrdersAdminMutationLimiter,
  async (req, res) => {
    try {
      const result = await purgeOldCompletedCartoonOrders();

      return res.json(result);
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.post(
  '/:orderId/reject',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  cartoonOrdersAdminMutationLimiter,
  async (req, res) => {
    try {
      const result = await rejectCartoonOrder(req.params.orderId);

      return res.json(result);
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.post(
  '/:orderId/notifications/retry',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  cartoonOrdersAdminMutationLimiter,
  async (req, res) => {
    try {
      const order = await retryCartoonOrderNotifications(req.params.orderId);

      return res.json(order);
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.post(
  '/:orderId/complete',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  cartoonOrdersAdminMutationLimiter,
  async (req, res) => {
    try {
      const order = await completeCartoonOrder(req.params.orderId, req.user?._id);

      return res.json(order);
    } catch (err) {
      return sendError(res, err);
    }
  }
);

router.post(
  '/',
  requireCartoonOrdersEnabled,
  requireTrustedOrigin,
  cartoonOrdersCreateLimiter,
  async (req, res) => {
    try {
      const result = await createCartoonOrder(req.body);

      return res.status(result.statusCode).json(result.body);
    } catch (err) {
      return sendError(res, err, 'Cartoon order could not be created.');
    }
  }
);

export default router;
