// server/controllers/categoryController.js

import express from 'express';
import {
  createCategory,
  getAllCategories,
  getVisibleCategories,
  deleteCategory, 
  getCategoryById,
  updateCategory 
} from '../services/categoryServices.js';
import { requireAuth, requireFullAdmin } from '../middlewares/auth.js';
import { getRequestPublicLocale } from '../services/localization/publicProjection.js';

const router = express.Router();

// 🟢 Всички категории (за create/edit форми)
router.get('/', async (req, res) => {
  try {
    const locale = getRequestPublicLocale(req);
    const categories = await getAllCategories({ locale });
    res.json(categories);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: 'Грешка при зареждане на категориите.' });
  }
});

// 🟢 Само категории с продукти (за хедъра и shop страницата)
router.get('/visible', async (req, res) => {
  try {
    const locale = getRequestPublicLocale(req);
    const visibleCategories = await getVisibleCategories({ locale });
    res.json(visibleCategories);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: 'Грешка при зареждане на видимите категории.' });
  }
});

// 🟢 Създаване на категория
router.post('/', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const created = await createCategory(req.body);
    res.status(201).json(created);
  } catch (err) {
    let message = err.message;

    if (err.name === 'ValidationError') {
      const first = Object.values(err.errors)[0];
      message = first?.message || 'Невалиден вход';
    }

    res.status(err.statusCode || 400).json({ message, field: err.field });
  }
});

router.delete('/:id', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const result = await deleteCategory(req.params.id);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ message: err.message || 'Неуспешно изтриване на категория.' });
  }
});

router.get('/:categoryId', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const category = await getCategoryById(req.params.categoryId);

    if (!category) {
      return res.status(404).json({ message: 'Категорията не беше намерена.' });
    }

    res.json(category);
  } catch (err) {
    console.error('Грешка при зареждане на категорията:', err);
    res.status(err.statusCode || 500).json({ message: 'Грешка при зареждане на категорията.' });
  }
});

router.put('/:categoryId', requireAuth, requireFullAdmin, async (req, res) => {
  try {
    const updated = await updateCategory(req.params.categoryId, req.body);

    if (!updated) {
      return res.status(404).json({ message: 'Категорията не беше намерена.' });
    }

    res.json(updated);
  } catch (err) {
    let message = err.message;

    if (err.name === 'ValidationError') {
      const first = Object.values(err.errors)[0];
      message = first?.message || 'Невалидни данни.';
    }

    res.status(err.statusCode || 400).json({ message, field: err.field });
  }
});


export default router;
