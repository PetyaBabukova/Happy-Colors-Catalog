import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { loginUser, registerUser } from '../services/userService.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { requireTrustedOrigin } from '../middlewares/trustedOrigin.js';
import {
  AUTH_COOKIE_NAME,
  getJwtSecret,
  loadAuthenticatedUser,
  requireAuth,
  requireFullAdmin,
} from '../middlewares/auth.js';
import {
  ARTIST_STATUSES,
  serializeUser,
  USER_ROLES,
  USER_ROLE_VALUES,
} from '../utils/userRoles.js';

const router = express.Router();

const ROUTES = {
  REGISTER: '/register',
  LOGIN: '/login',
  LOGOUT: '/logout',
  ME: '/me',
  ADMIN: '/admin',
};

const loginLimiter = createRateLimiter({
  keyPrefix: 'users-login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Твърде много опити за вход. Моля, опитайте отново след малко.',
});

const registerLimiter = createRateLimiter({
  keyPrefix: 'users-register',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Твърде много опити за регистрация. Моля, опитайте отново след малко.',
});

function getCookieConfig() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: isProduction ? 'None' : 'Lax',
    secure: isProduction,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  };
}

function getClearCookieConfig() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: isProduction ? 'None' : 'Lax',
    secure: isProduction,
    path: '/',
  };
}

function isRegistrationEnabled() {
  return process.env.NODE_ENV !== 'production';
}

function buildProductUrl(productId) {
  const baseUrl = String(process.env.CLIENT_URL || '').replace(/\/$/, '');
  return baseUrl ? `${baseUrl}/products/${productId}` : `/products/${productId}`;
}

async function getProductCountsByOwner(userIds) {
  const counts = await Product.aggregate([
    {
      $match: {
        owner: { $in: userIds },
        publicationStatus: { $ne: 'deleted' },
      },
    },
    {
      $group: {
        _id: '$owner',
        productCount: { $sum: 1 },
        pendingReviewCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$publicationStatus', 'pending_review'] },
                  { $eq: ['$reviewStatus', 'pending_review'] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  return new Map(counts.map((item) => [String(item._id), item]));
}

router.get(ROUTES.ADMIN, requireAuth, requireFullAdmin, async (_req, res) => {
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1, _id: -1 }).lean();
  const productCountsByOwner = await getProductCountsByOwner(users.map((user) => user._id));

  res.status(200).json(
    users.map((user) => ({
      ...serializeUser(user),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      productCount: productCountsByOwner.get(String(user._id))?.productCount || 0,
      pendingReviewCount: productCountsByOwner.get(String(user._id))?.pendingReviewCount || 0,
    }))
  );
});

router.get(`${ROUTES.ADMIN}/:userId`, requireAuth, requireFullAdmin, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const user = await User.findById(req.params.userId, { password: 0 }).lean();

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const products = await Product.find({
    owner: user._id,
    publicationStatus: { $ne: 'deleted' },
  })
    .sort({ updatedAt: -1, _id: -1 })
    .populate('category', 'name')
    .lean();

  res.status(200).json({
    user: {
      ...serializeUser(user),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    products: products.map((product) => ({
      _id: String(product._id),
      title:
        product.reviewStatus === 'pending_review' && product.draftContent?.title
          ? product.draftContent.title
          : product.title,
      publicationStatus: product.publicationStatus || 'legacy',
      reviewStatus: product.reviewStatus || 'none',
      availability: product.availability,
      category: product.category,
      updatedAt: product.updatedAt,
      createdAt: product.createdAt,
      url: buildProductUrl(product._id),
    })),
  });
});

router.patch(`${ROUTES.ADMIN}/:userId`, requireAuth, requireFullAdmin, requireTrustedOrigin, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.userId)) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const nextRole = req.body?.role;

  if (!USER_ROLE_VALUES.includes(nextRole)) {
    return res.status(400).json({ message: 'Invalid user role.' });
  }

  const user = await User.findById(req.params.userId);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (String(user._id) === String(req.user?._id) && nextRole !== USER_ROLES.FULL_ADMIN) {
    return res.status(400).json({ message: 'You cannot remove your own full admin role.' });
  }

  if (user.role === USER_ROLES.FULL_ADMIN && nextRole !== USER_ROLES.FULL_ADMIN) {
    const remainingFullAdmins = await User.countDocuments({
      _id: { $ne: user._id },
      role: USER_ROLES.FULL_ADMIN,
    });

    if (remainingFullAdmins === 0) {
      return res.status(400).json({ message: 'Cannot remove the last full admin.' });
    }
  }

  const currentRole = user.role;
  user.role = nextRole;
  user.artistStatus = nextRole === USER_ROLES.ARTIST
    ? currentRole === USER_ROLES.ARTIST
      ? user.artistStatus || ARTIST_STATUSES.ACTIVE
      : ARTIST_STATUSES.ACTIVE
    : undefined;
  await user.save();

  res.status(200).json({
    user: serializeUser(user),
    reminder: null,
  });
});

router.post(ROUTES.REGISTER, registerLimiter, async (req, res) => {
  if (!isRegistrationEnabled()) {
    return res.status(404).json({ message: 'Registration is disabled.' });
  }

  try {
    const user = await registerUser(req.body);
    res.status(201).json(user);
  } catch (err) {
    let message = err.message;

    if (err.name === 'ValidationError') {
      const firstError = Object.values(err.errors)[0];
      message = firstError?.message || 'Invalid input';
    }

    res.status(400).json({ message });
  }
});

router.post(ROUTES.LOGIN, loginLimiter, async (req, res) => {
  try {
    const { token, user } = await loginUser(req.body.email, req.body.password);

    res.cookie(AUTH_COOKIE_NAME, token, getCookieConfig());
    res.status(200).json(user);
  } catch (err) {
    if (err.message === 'JWT_SECRET липсва в environment variables.') {
      return res.status(500).json({ message: 'Проблем в конфигурацията на сървъра.' });
    }

    res.status(401).json({ message: 'Невалиден e-mail или парола' });
  }
});

router.post(ROUTES.LOGOUT, (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, getClearCookieConfig());
  res.status(204).end();
});

router.get(ROUTES.ME, async (req, res) => {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await loadAuthenticatedUser(decoded);

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    res.status(200).json(serializeUser(user));
  } catch (err) {
    if (err.message === 'JWT_SECRET липсва в environment variables.') {
      return res.status(500).json({ message: 'Проблем в конфигурацията на сървъра.' });
    }

    res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;
