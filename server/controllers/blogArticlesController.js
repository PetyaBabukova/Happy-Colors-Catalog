import express from 'express';
import { requireAuth } from '../middlewares/auth.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import {
  archiveBlogArticle,
  createBlogArticle,
  editBlogArticle,
  getAdminBlogArticleById,
  getAdminBlogArticles,
  getPublicBlogArticleById,
  getPublicBlogArticles,
  restoreBlogArticle,
} from '../services/blogArticlesService.js';

const router = express.Router();

const blogArticlesMutationLimiter = createRateLimiter({
  keyPrefix: 'blog-articles',
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: 'Too many blog article management requests. Please try again later.',
});

function sendError(res, error, fallbackStatus = 500) {
  if (error.name === 'ValidationError') {
    const firstValidationError = Object.values(error.errors || {})[0];

    return res.status(400).json({
      message: firstValidationError?.message || 'Invalid blog article data.',
    });
  }

  const statusCode = error.statusCode || fallbackStatus;

  if (statusCode >= 500) {
    console.error('Blog articles controller error:', error);
    return res.status(statusCode).json({ message: 'Internal server error.' });
  }

  return res.status(statusCode).json({ message: error.message });
}

router.get('/', async (req, res) => {
  try {
    const articles = await getPublicBlogArticles();

    res.json(articles);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin', requireAuth, async (req, res) => {
  try {
    const articles = await getAdminBlogArticles(req.user?._id);

    res.json(articles);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/admin/:articleId', requireAuth, async (req, res) => {
  try {
    const article = await getAdminBlogArticleById(req.params.articleId, req.user?._id);

    res.json(article);
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/:articleId', async (req, res) => {
  try {
    const article = await getPublicBlogArticleById(req.params.articleId);

    res.json(article);
  } catch (error) {
    sendError(res, error);
  }
});

// TODO: V1 treats authenticated users as trusted blog operators. Replace this
// with an explicit admin role check if public registration becomes available.
router.post('/', blogArticlesMutationLimiter, requireAuth, async (req, res) => {
  try {
    const article = await createBlogArticle(req.body, req.user?._id);

    res.status(201).json(article);
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.put('/:articleId', blogArticlesMutationLimiter, requireAuth, async (req, res) => {
  try {
    const article = await editBlogArticle(req.params.articleId, req.body, req.user?._id);

    res.json(article);
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.patch('/:articleId/archive', blogArticlesMutationLimiter, requireAuth, async (req, res) => {
  try {
    const article = await archiveBlogArticle(req.params.articleId, req.user?._id);

    res.json(article);
  } catch (error) {
    sendError(res, error, 400);
  }
});

router.patch('/:articleId/restore', blogArticlesMutationLimiter, requireAuth, async (req, res) => {
  try {
    const article = await restoreBlogArticle(req.params.articleId, req.user?._id);

    res.json(article);
  } catch (error) {
    sendError(res, error, 400);
  }
});

export default router;
