import express from 'express';
import { requireAuth, requireFullAdmin } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { requireTrustedOrigin } from '../middlewares/trustedOrigin.js';
import {
  getNewsletterSendStatus,
  buildBlogNewsletterPrefill,
  buildProductNewsletterPrefill,
  retryNewsletterCampaignFailedDeliveries,
  sendNewsletterTest,
  sendNewsletterToSubscribers,
} from '../services/newsletterSendService.js';

const router = express.Router();

const authenticatedRateLimitKey = (req, clientIp) => `user:${req.user?._id || clientIp}`;

const testSendLimiter = createRateLimiter({
  keyPrefix: 'newsletter-send-test',
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Твърде много тестови имейли. Моля, опитайте отново по-късно.',
  keyGenerator: authenticatedRateLimitKey,
});

const broadcastLimiter = createRateLimiter({
  keyPrefix: 'newsletter-send-broadcast',
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Твърде много опити за изпращане до абонати. Моля, опитайте отново по-късно.',
  keyGenerator: authenticatedRateLimitKey,
});

const manualRetryLimiter = createRateLimiter({
  keyPrefix: 'newsletter-send-manual-retry',
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Твърде много опити за повторно изпращане на бюлетин. Моля, опитайте отново по-късно.',
  keyGenerator: authenticatedRateLimitKey,
});

function requireJson(req, res, next) {
  if (!req.is('application/json')) {
    return res.status(415).json({ message: 'Заявката трябва да бъде в JSON формат.' });
  }

  return next();
}

function sendError(res, error) {
  const statusCode = error.statusCode || 500;

  if (statusCode >= 500) {
    console.error('Newsletter send controller error:', {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
    });

    return res.status(500).json({ message: 'Възникна грешка. Моля, опитайте отново.' });
  }

  return res.status(statusCode).json({ message: error.message });
}

router.get('/status', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const result = await getNewsletterSendStatus();

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/prefill/product/:productId', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const result = await buildProductNewsletterPrefill(req.params.productId);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/prefill/blog/:articleId', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const result = await buildBlogNewsletterPrefill(req.params.articleId);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/test', requireAuth, requireFullAdmin, requireTrustedOrigin, testSendLimiter, requireJson, async (req, res) => {
  try {
    const result = await sendNewsletterTest(req.body);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post(
  '/campaigns/:campaignId/retry-failed',
  requireAuth,
  requireFullAdmin,
  requireTrustedOrigin,
  manualRetryLimiter,
  requireJson,
  async (req, res) => {
    try {
      const result = await retryNewsletterCampaignFailedDeliveries(req.params.campaignId);
      const { failures, ...safeResult } = result;

      return res.status(200).json(safeResult);
    } catch (error) {
      return sendError(res, error);
    }
  }
);

router.post('/', requireAuth, requireFullAdmin, requireTrustedOrigin, broadcastLimiter, requireJson, async (req, res) => {
  try {
    const result = await sendNewsletterToSubscribers(req.body);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
