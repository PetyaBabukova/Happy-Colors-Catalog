import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { sendEmail } from '../helpers/sendEmail.js';
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
  ARTIST_STATUS_VALUES,
  normalizeArtistStatus,
  normalizeRole,
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
  return baseUrl ? `${baseUrl}/products/${productId}/edit` : `/products/${productId}/edit`;
}

function toEmailLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

async function getProductCountsByOwner(userIds) {
  const counts = await Product.aggregate([
    { $match: { owner: { $in: userIds } } },
    { $group: { _id: '$owner', productCount: { $sum: 1 } } },
  ]);

  return new Map(counts.map((item) => [String(item._id), item.productCount]));
}

async function sendSuspendedArtistProductsReminder(user) {
  const products = await Product.find({ owner: user._id }, { title: 1, publicationStatus: 1 })
    .sort({ updatedAt: -1, _id: -1 })
    .lean();

  if (products.length === 0) {
    return { sent: false, productCount: 0 };
  }

  const productLines = products
    .map((product) => `- ${toEmailLine(product.title)} (${product.publicationStatus || 'legacy'}): ${buildProductUrl(product._id)}`)
    .join('\n');

  try {
    await sendEmail({
      subject: `Suspended artist has ${products.length} product(s) to review`,
      text: [
        `Artist: ${user.username} <${user.email}>`,
        '',
        'The artist was suspended. Review whether these products should remain public, be archived, or be removed:',
        '',
        productLines,
      ].join('\n'),
    });

    return { sent: true, productCount: products.length };
  } catch (error) {
    console.error('Failed to send suspended artist product reminder:', error?.message || error);
    return { sent: false, productCount: products.length, error: true };
  }
}

router.get(ROUTES.ADMIN, requireAuth, requireFullAdmin, async (_req, res) => {
  const users = await User.find({}, { password: 0 }).sort({ createdAt: -1, _id: -1 }).lean();
  const productCounts = await getProductCountsByOwner(users.map((user) => user._id));

  res.status(200).json(
    users.map((user) => ({
      ...serializeUser(user),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      productCount: productCounts.get(String(user._id)) || 0,
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

  const products = await Product.find({ owner: user._id })
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
      title: product.title,
      publicationStatus: product.publicationStatus || 'legacy',
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

  if (
    nextRole === USER_ROLES.ARTIST &&
    req.body?.artistStatus !== undefined &&
    !ARTIST_STATUS_VALUES.includes(req.body.artistStatus)
  ) {
    return res.status(400).json({ message: 'Invalid artist status.' });
  }

  const nextArtistStatus = normalizeArtistStatus(nextRole, req.body?.artistStatus);
  const user = await User.findById(req.params.userId);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  if (String(user._id) === String(req.user?._id) && nextRole !== USER_ROLES.FULL_ADMIN) {
    return res.status(400).json({ message: 'You cannot remove your own full admin role.' });
  }

  const wasSuspended = user.role === USER_ROLES.ARTIST && user.artistStatus === ARTIST_STATUSES.SUSPENDED;
  user.role = nextRole;
  user.artistStatus = nextArtistStatus || undefined;
  await user.save();

  const isSuspended = nextRole === USER_ROLES.ARTIST && nextArtistStatus === ARTIST_STATUSES.SUSPENDED;
  const reminder = isSuspended && !wasSuspended
    ? await sendSuspendedArtistProductsReminder(user)
    : null;

  res.status(200).json({
    user: serializeUser(user),
    reminder,
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
