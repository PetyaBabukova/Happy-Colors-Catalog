import express from 'express';
import { requireAuth, requireFullAdmin } from '../middlewares/auth.js';
import {
  deleteNewsletterSubscriber,
  getNewsletterSubscriberAnalytics,
} from '../services/newsletterSubscriberAnalyticsService.js';

const router = express.Router();

function sendError(res, error) {
  const statusCode = Number(error?.statusCode || 500);

  if (statusCode < 500) {
    return res.status(statusCode).json({ message: error.message });
  }

  console.error('Newsletter subscriber analytics controller error:', {
    message: error?.message || 'Unknown error',
    name: error?.name || 'Error',
  });

  return res.status(500).json({ message: 'Възникна грешка. Моля, опитайте отново.' });
}

router.get('/analytics', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const result = await getNewsletterSubscriberAnalytics(req.query);

    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

router.delete('/:subscriberId', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const result = await deleteNewsletterSubscriber(req.params.subscriberId);

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
});

export default router;
