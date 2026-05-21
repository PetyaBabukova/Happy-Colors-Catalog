import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { requireTrustedOrigin } from '../middlewares/trustedOrigin.js';
import {
  getNewsletterSendStatus,
  buildBlogNewsletterPrefill,
  buildProductNewsletterPrefill,
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

router.get('/status', requireAuth, async (req, res) => {
  try {
    const result = await getNewsletterSendStatus();

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/prefill/product/:productId', requireAuth, async (req, res) => {
  try {
    const result = await buildProductNewsletterPrefill(req.params.productId);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/prefill/blog/:articleId', requireAuth, async (req, res) => {
  try {
    const result = await buildBlogNewsletterPrefill(req.params.articleId);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/test', requireAuth, requireTrustedOrigin, testSendLimiter, requireJson, async (req, res) => {
  try {
    const result = await sendNewsletterTest(req.body);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/', requireAuth, requireTrustedOrigin, broadcastLimiter, requireJson, async (req, res) => {
  try {
    const result = await sendNewsletterToSubscribers(req.body);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
