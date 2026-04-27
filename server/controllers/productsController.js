import express from 'express';
import {
  createProduct,
  getAllProducts,
  getProductById,
  deleteProduct,
  editProduct,
} from '../services/productsServices.js';
import { deleteProductImage } from '../services/productImagesService.js';
import { deleteProductVideo } from '../services/productVideosService.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const category = req.query.category;
    const products = await getAllProducts(category);
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: 'Грешка при зареждане на продуктите' });
  }
});

router.get('/:productId', async (req, res) => {
  try {
    const product = await getProductById(req.params.productId);

    if (!product) {
      return res.status(404).json({ message: 'Продуктът не беше намерен' });
    }

    res.status(200).json(product);
  } catch (error) {
    res.status(400).json({ message: 'Невалиден ID или грешка при заявката' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const product = await createProduct(req.body, req.user._id);
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

router.delete('/:productId', requireAuth, async (req, res) => {
  try {
    await deleteProduct(req.params.productId, req.user._id);
    res.status(204).end();
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.put('/:productId', requireAuth, async (req, res) => {
  try {
    const updatedProduct = await editProduct(
      req.params.productId,
      req.body,
      req.user._id
    );

    res.status(200).json(updatedProduct);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.delete('/:productId/image', requireAuth, async (req, res) => {
  try {
    const { imageUrl } = req.body;

    const result = await deleteProductImage(
      req.params.productId,
      imageUrl,
      req.user._id
    );

    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

router.delete('/:productId/video', requireAuth, async (req, res) => {
  try {
    const { videoUrl } = req.body;

    const result = await deleteProductVideo(
      req.params.productId,
      videoUrl,
      req.user._id
    );

    res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ message: error.message });
  }
});

export default router;
