import express from 'express';
import { requireAuth, requireFullAdmin } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { requireTrustedOrigin } from '../middlewares/trustedOrigin.js';
import {
  acceptCurrentTranslation,
  approveTranslationDraft,
  generateTranslation,
  getTranslationQueue,
  rejectTranslationDraft,
  saveManualTranslation,
} from '../services/translation/translationService.js';

const router = express.Router();

const translationMutationLimiter = createRateLimiter({
  keyPrefix: 'translations',
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many translation management requests. Please try again later.',
});

function sendError(res, error, fallbackStatus = 500) {
  if (error.name === 'ValidationError') {
    const firstValidationError = Object.values(error.errors || {})[0];

    return res.status(400).json({
      message: firstValidationError?.message || 'Invalid translation data.',
    });
  }

  const statusCode = error.statusCode || fallbackStatus;

  if (statusCode >= 500 && statusCode !== 501) {
    console.error('Translations controller error:', error);
    return res.status(statusCode).json({ message: 'Internal server error.' });
  }

  return res.status(statusCode).json({ message: error.message });
}

function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ message: 'JSON content is required.' });
  }

  return next();
}

router.get('/queue', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const queue = await getTranslationQueue({ locale: req.query.locale || 'en' });

    res.set('Cache-Control', 'no-store');
    res.json(queue);
  } catch (error) {
    sendError(res, error);
  }
});

router.post(
  '/:entityType/:entityId/:locale/generate',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  translationMutationLimiter,
  requireJson,
  async (req, res) => {
    try {
      const result = await generateTranslation({
        entityType: req.params.entityType,
        entityId: req.params.entityId,
        locale: req.params.locale,
        payload: req.body,
        userId: req.user?._id,
      });

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/:entityType/:entityId/:locale/accept-current',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  translationMutationLimiter,
  requireJson,
  async (req, res) => {
    try {
      const result = await acceptCurrentTranslation({
        entityType: req.params.entityType,
        entityId: req.params.entityId,
        locale: req.params.locale,
        payload: req.body,
        userId: req.user?._id,
      });

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.put(
  '/:entityType/:entityId/:locale',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  translationMutationLimiter,
  requireJson,
  async (req, res) => {
    try {
      const result = await saveManualTranslation({
        entityType: req.params.entityType,
        entityId: req.params.entityId,
        locale: req.params.locale,
        payload: req.body,
        userId: req.user?._id,
      });

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/:entityType/:entityId/:locale/draft/approve',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  translationMutationLimiter,
  requireJson,
  async (req, res) => {
    try {
      const result = await approveTranslationDraft({
        entityType: req.params.entityType,
        entityId: req.params.entityId,
        locale: req.params.locale,
        payload: req.body,
        userId: req.user?._id,
      });

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/:entityType/:entityId/:locale/draft/reject',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  translationMutationLimiter,
  requireJson,
  async (req, res) => {
    try {
      const result = await rejectTranslationDraft({
        entityType: req.params.entityType,
        entityId: req.params.entityId,
        locale: req.params.locale,
        payload: req.body,
      });

      res.json(result);
    } catch (error) {
      sendError(res, error);
    }
  }
);

export default router;
