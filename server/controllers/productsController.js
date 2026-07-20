import express from 'express';
import {
  approveProduct,
  archiveProduct,
  createProduct,
  getAllProducts,
  getCartoonGalleryProducts,
  getManagedProductById,
  getMyProducts,
  getHomepageFeaturedProducts,
  getProductReviewQueue,
  updateHomepageFeaturedProducts,
  getProductById,
  deleteProduct,
  editProduct,
  rejectProduct,
  restoreProduct,
  submitProductForReview,
  withdrawProductReview,
} from '../services/productsServices.js';
import { deleteProductImage } from '../services/productImagesService.js';
import { deleteProductVideo } from '../services/productVideosService.js';
import {
  loadOptionalAuthenticatedUserFromRequest,
  requireActiveArtistOrFullAdmin,
  requireAuth,
  requireFullAdmin,
} from '../middlewares/auth.js';
import { requireTrustedOrigin } from '../middlewares/trustedOrigin.js';
import { getRequestPublicLocale } from '../services/localization/publicProjection.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const category = req.query.category;
    const locale = getRequestPublicLocale(req);
    const products = await getAllProducts(category, { locale });
    res.json(products);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: 'Грешка при зареждане на продуктите' });
  }
});

router.get('/homepage-featured', async (req, res) => {
  try {
    const locale = getRequestPublicLocale(req);
    const products = await getHomepageFeaturedProducts({ locale });
    res.json(products);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: 'Грешка при зареждане на продуктите за началната страница.' });
  }
});

router.get('/cartoon-gallery', async (req, res) => {
  try {
    const locale = getRequestPublicLocale(req);
    const products = await getCartoonGalleryProducts({ locale });
    res.json(products);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: 'Грешка при зареждане на шарж галерията.' });
  }
});

router.put('/homepage-featured', requireAuth, requireFullAdmin, requireTrustedOrigin, async (req, res) => {
  try {
    const products = await updateHomepageFeaturedProducts(req.body?.productIds);
    res.status(200).json(products);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.get('/mine', requireAuth, requireActiveArtistOrFullAdmin, async (req, res) => {
  try {
    const products = await getMyProducts(req.user, req.query);
    res.json(products);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.get('/mine/:productId', requireAuth, requireActiveArtistOrFullAdmin, async (req, res) => {
  try {
    const product = await getManagedProductById(req.params.productId, req.user);

    if (!product) {
      return res.status(404).json({ message: 'РџСЂРѕРґСѓРєС‚СЉС‚ РЅРµ Р±РµС€Рµ РЅР°РјРµСЂРµРЅ' });
    }

    res.status(200).json(product);
  } catch (error) {
    const statusCode = error.statusCode || 400;
    res.status(statusCode).json({ message: error.message });
  }
});

router.get('/review-queue', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const products = await getProductReviewQueue(req.user, req.query);
    res.json(products);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.get('/:productId', async (req, res) => {
  try {
    const viewer = await loadOptionalAuthenticatedUserFromRequest(req);
    const locale = getRequestPublicLocale(req);
    const product = await getProductById(req.params.productId, viewer, { locale });

    if (!product) {
      return res.status(404).json({ message: 'Продуктът не беше намерен' });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Невалиден ID или грешка при заявката' });
  }
});

router.post('/', requireAuth, requireActiveArtistOrFullAdmin, requireTrustedOrigin, async (req, res) => {
  try {
    const product = await createProduct(req.body, req.user);
    res.status(201).json(product);
  } catch (error) {
    let message = error.message;
    let statusCode = error.statusCode || 400;

    if (error.name === 'ValidationError') {
      const firstError = Object.values(error.errors)[0];
      message = firstError?.message || 'Invalid input';
    }

    res.status(statusCode).json({ message });
  }
});

router.delete('/:productId', requireAuth, requireTrustedOrigin, async (req, res) => {
  try {
    await deleteProduct(req.params.productId, req.user);
    res.status(204).end();
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.put('/:productId', requireAuth, requireTrustedOrigin, async (req, res) => {
  try {
    const updatedProduct = await editProduct(
      req.params.productId,
      req.body,
      req.user
    );

    res.status(200).json(updatedProduct);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.delete('/:productId/image', requireAuth, requireTrustedOrigin, async (req, res) => {
  try {
    const { imageUrl } = req.body;

    const result = await deleteProductImage(
      req.params.productId,
      imageUrl,
      req.user
    );

    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.delete('/:productId/video', requireAuth, requireTrustedOrigin, async (req, res) => {
  try {
    const { videoUrl } = req.body;

    const result = await deleteProductVideo(
      req.params.productId,
      videoUrl,
      req.user
    );

    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.patch('/:productId/submit-review', requireAuth, requireActiveArtistOrFullAdmin, requireTrustedOrigin, async (req, res) => {
  try {
    const product = await submitProductForReview(req.params.productId, req.user);
    res.status(200).json(product);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.patch('/:productId/withdraw-review', requireAuth, requireActiveArtistOrFullAdmin, requireTrustedOrigin, async (req, res) => {
  try {
    const product = await withdrawProductReview(req.params.productId, req.user);
    res.status(200).json(product);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.patch('/:productId/approve', requireAuth, requireFullAdmin, requireTrustedOrigin, async (req, res) => {
  try {
    const product = await approveProduct(req.params.productId, req.user);
    res.status(200).json(product);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.patch('/:productId/reject', requireAuth, requireFullAdmin, requireTrustedOrigin, async (req, res) => {
  try {
    const product = await rejectProduct(req.params.productId, req.user, req.body?.reviewNote);
    res.status(200).json(product);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.patch('/:productId/archive', requireAuth, requireFullAdmin, requireTrustedOrigin, async (req, res) => {
  try {
    const product = await archiveProduct(req.params.productId, req.user);
    res.status(200).json(product);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.patch('/:productId/restore', requireAuth, requireFullAdmin, requireTrustedOrigin, async (req, res) => {
  try {
    const product = await restoreProduct(req.params.productId, req.user);
    res.status(200).json(product);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

export default router;
