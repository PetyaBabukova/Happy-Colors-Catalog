import express from 'express';
import { searchProducts } from '../services/searchService.js';
import { getRequestPublicLocale } from '../services/localization/publicProjection.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const query = req.query.q;
    const locale = getRequestPublicLocale(req);
    const results = await searchProducts(query, { locale });
    res.status(200).json(results);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: 'Грешка при търсене' });
  }
});

export default router;
