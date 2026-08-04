import express from 'express';
import userController from './controllers/userController.js';
import productsController from './controllers/productsController.js';
import categoryController from './controllers/categoryController.js';
import searchController from './controllers/searchController.js';
import contactsController from './controllers/contactsController.js';
import ordersController from './controllers/ordersController.js';
import cartoonOrdersController from './controllers/cartoonOrdersController.js';
import paymentsController from './controllers/paymentsController.js';
import deliveryController from './controllers/deliveryController.js';
import homeBannersController from './controllers/homeBannersController.js';
import blogArticlesController from './controllers/blogArticlesController.js';
import newsletterController from './controllers/newsletterController.js';
import newsletterSendController from './controllers/newsletterSendController.js';
import newsletterSubscribersController from './controllers/newsletterSubscribersController.js';
import translationsController from './controllers/translationsController.js';
import { createRateLimiter } from './middlewares/rateLimit.js';

const router = express.Router();

const contactsLimiter = createRateLimiter({
  keyPrefix: 'contacts',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Твърде много изпратени съобщения. Моля, опитайте отново след малко.',
});

const ordersLimiter = createRateLimiter({
  keyPrefix: 'orders',
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Твърде много опити за създаване на поръчка. Моля, опитайте отново след малко.',
});

const paymentsLimiter = createRateLimiter({
  keyPrefix: 'payments',
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: 'Твърде много опити за плащане. Моля, опитайте отново след малко.',
});

const isCatalogMode = process.env.CATALOG_MODE === 'true';

function catalogModeGuard(req, res, next) {
  if (isCatalogMode) {
    return res.status(403).json({ message: 'Магазинът е в каталожен режим.' });
  }
  next();
}

router.use('/users', userController);
router.use('/products', productsController);
router.use('/home-banners', homeBannersController);
router.use('/blog-articles', blogArticlesController);
router.use('/newsletter/send', newsletterSendController);
router.use('/newsletter/subscribers', newsletterSubscribersController);
// Newsletter applies endpoint-specific rate limiters in its controller.
router.use('/newsletter', newsletterController);
router.use('/translations', translationsController);
router.use('/categories', categoryController);
router.use('/search', searchController);
router.use('/contacts', contactsLimiter, contactsController);
router.use('/cartoon-orders', cartoonOrdersController);
router.use('/orders', catalogModeGuard, ordersLimiter, ordersController);
router.use('/payments', catalogModeGuard, paymentsLimiter, paymentsController);
router.use('/delivery', catalogModeGuard, deliveryController);

export default router;
