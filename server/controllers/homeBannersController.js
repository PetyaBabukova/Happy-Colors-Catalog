import express from 'express';
import { requireAuth, requireFullAdmin } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import {
  createHomeBanner,
  deleteHomeBanner,
  editHomeBanner,
  getActiveHomeBanners,
  getHomeBannerById,
} from '../services/homeBannersService.js';

const router = express.Router();

const homeBannersMutationLimiter = createRateLimiter({
  keyPrefix: 'home-banners',
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Too many homepage banner management requests. Please try again later.',
});

function sendError(res, error, fallbackStatus = 500) {
  if (error.name === 'ValidationError') {
    const firstValidationError = Object.values(error.errors || {})[0];

    return res.status(400).json({
      message: firstValidationError?.message || 'Invalid home banner data.',
    });
  }

  const statusCode = error.statusCode || fallbackStatus;

  if (statusCode >= 500) {
    console.error('Home banners controller error:', error);
    return res.status(statusCode).json({ message: 'Internal server error.' });
  }

  return res.status(statusCode).json({ message: error.message });
}

function getPlacementQuery(req) {
  if (
    typeof req.query.placement === 'undefined' &&
    Object.keys(req.query || {}).some((key) => key.startsWith('placement['))
  ) {
    const error = new Error('Invalid banner placement.');
    error.statusCode = 400;
    throw error;
  }

  return req.query.placement;
}

router.get('/', async (req, res) => {
  try {
    const banners = await getActiveHomeBanners({ placement: getPlacementQuery(req) });

    res.json(banners);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:bannerId', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const banner = await getHomeBannerById(req.params.bannerId);

    res.json(banner);
  } catch (error) {
    sendError(res, error);
  }
});

// V1 treats every authenticated user as a trusted admin for homepage content.
// If public registration is enabled later, replace this with an explicit admin role check.
router.post('/', homeBannersMutationLimiter, requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const banner = await createHomeBanner(req.body, req.user._id);

    res.status(201).json(banner);
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.put('/:bannerId', homeBannersMutationLimiter, requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const banner = await editHomeBanner(req.params.bannerId, req.body, req.user._id);

    res.json(banner);
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.delete('/:bannerId', homeBannersMutationLimiter, requireAuth, requireFullAdmin, async (req, res) => {
  try {
    await deleteHomeBanner(req.params.bannerId, req.user._id);

    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
