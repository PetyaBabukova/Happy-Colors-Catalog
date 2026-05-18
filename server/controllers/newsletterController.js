import express from 'express';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import {
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from '../services/newsletterService.js';

const router = express.Router();

const subscribeLimiter = createRateLimiter({
  keyPrefix: 'newsletter-subscribe',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Твърде много опити за абониране. Моля, опитайте отново след малко.',
});

const unsubscribeLimiter = createRateLimiter({
  keyPrefix: 'newsletter-unsubscribe',
  windowMs: 60 * 1000,
  max: 10,
  message: 'Твърде много опити за отписване. Моля, опитайте отново след малко.',
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
    console.error('Newsletter controller error:', {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
    });

    return res.status(500).json({ message: 'Възникна грешка. Моля, опитайте отново.' });
  }

  return res.status(statusCode).json({ message: error.message });
}

router.post('/subscribe', subscribeLimiter, requireJson, async (req, res) => {
  try {
    const result = await subscribeToNewsletter(req.body);

    return res.status(200).json({ message: result.message, status: result.status });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/unsubscribe', unsubscribeLimiter, requireJson, async (req, res) => {
  try {
    const result = await unsubscribeFromNewsletter(req.body);

    return res.status(200).json({ message: result.message });
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
