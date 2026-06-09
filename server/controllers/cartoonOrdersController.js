import express from 'express';
import { requireAuth, requireFullAdmin } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { requireTrustedOrigin } from '../middlewares/trustedOrigin.js';
import {
  completeCartoonOrder,
  createCartoonOrder,
  getCartoonOrderById,
  listCartoonOrders,
  updateCartoonOrderAdminNotes,
  updateCartoonOrderStatuses,
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

  if (statusCode >= 500) {
    console.error('Cartoon orders controller error:', error);
  }

  return res.status(statusCode).json({
    message:
      statusCode >= 500 && !error.isCartoonOrderError
        ? fallbackMessage
        : error.message || fallbackMessage,
  });
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
