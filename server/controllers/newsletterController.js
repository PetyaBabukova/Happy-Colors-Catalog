import crypto from 'crypto';
import express from 'express';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import {
  confirmNewsletterSubscription,
  createSubscribeFormToken,
  exchangeNewsletterPreferencesToken,
  createUnsubscribePageUrl,
  isHoneypotSubscribePayload,
  requestNewsletterSubscription,
  unsubscribeFromNewsletter,
  updateNewsletterPreferences,
  verifySubscribeFormToken,
} from '../services/newsletterService.js';

const router = express.Router();
const subscribeRateLimitMessage = 'Твърде много опити за абониране. Моля, опитайте отново след малко.';

const subscribeLimiter = createRateLimiter({
  keyPrefix: 'newsletter-subscribe',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: subscribeRateLimitMessage,
});

const subscribeTokenLimiter = createRateLimiter({
  keyPrefix: 'newsletter-subscribe-token',
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: subscribeRateLimitMessage,
});

const confirmLimiter = createRateLimiter({
  keyPrefix: 'newsletter-confirm',
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Твърде много опити за потвърждение. Моля, опитайте отново след малко.',
});

const subscribeEmailLimiter = createRateLimiter({
  keyPrefix: 'newsletter-subscribe-email',
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: subscribeRateLimitMessage,
  keyGenerator(req, clientIp) {
    if (typeof req.body?.email !== 'string') {
      return clientIp;
    }

    const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET || 'newsletter-subscribe-email-rate-limit';
    const normalizedEmail = req.body.email.trim().toLowerCase();

    return crypto.createHmac('sha256', secret).update(normalizedEmail).digest('hex');
  },
});

const unsubscribeLimiter = createRateLimiter({
  keyPrefix: 'newsletter-unsubscribe',
  windowMs: 60 * 1000,
  max: 10,
  message: 'Твърде много опити за отписване. Моля, опитайте отново след малко.',
});

const preferencesLimiter = createRateLimiter({
  keyPrefix: 'newsletter-preferences',
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Твърде много опити за промяна на настройките. Моля, опитайте отново след малко.',
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

  return res.status(statusCode).json({ message: error.message, code: error.code });
}

function logNewsletterSideEffectFailure(event, error) {
  console.error(event, {
    message: error?.message || 'Unknown error',
    name: error?.name || 'Error',
  });
}

router.get('/subscribe-token', subscribeTokenLimiter, (req, res) => {
  try {
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');

    return res.status(200).json({ token: createSubscribeFormToken() });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/subscribe', subscribeLimiter, requireJson, async (req, res) => {
  try {
    if (isHoneypotSubscribePayload(req.body)) {
      const result = await requestNewsletterSubscription(req.body);

      return res.status(200).json({ message: result.message });
    }

    verifySubscribeFormToken(req.body?.formToken);

    return subscribeEmailLimiter(req, res, async () => {
      try {
        const result = await requestNewsletterSubscription(req.body);
        res.status(200).json({ message: result.message });

        if (typeof result.afterResponse === 'function') {
          result.afterResponse().catch((error) => {
            logNewsletterSideEffectFailure('Newsletter subscribe side effect failed.', error);
          });
        }

        return undefined;
      } catch (error) {
        return sendError(res, error);
      }
    });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/confirm', confirmLimiter, requireJson, async (req, res) => {
  try {
    const result = await confirmNewsletterSubscription(req.body);

    return res.status(200).json({ message: result.message });
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/preferences/exchange', preferencesLimiter, requireJson, async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');

  try {
    const result = await exchangeNewsletterPreferencesToken(req.body);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/preferences', preferencesLimiter, requireJson, async (req, res) => {
  res.setHeader('Cache-Control', 'private, max-age=0, no-store');

  try {
    const result = await updateNewsletterPreferences(req.body);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.post('/unsubscribe/one-click', unsubscribeLimiter, async (req, res) => {
  try {
    const token = req.query?.token || req.body?.token;
    const result = await unsubscribeFromNewsletter({ token });

    return res.status(200).type('text/plain').send(result.message);
  } catch (error) {
    return sendError(res, error);
  }
});

router.get('/unsubscribe/one-click', unsubscribeLimiter, (req, res) => {
  const token = String(req.query?.token || '').trim();

  return res.redirect(302, createUnsubscribePageUrl(token));
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
