import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { canArtistManageProducts, isFullAdmin, serializeUser } from '../utils/userRoles.js';

export const AUTH_COOKIE_NAME = 'token';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || String(secret).trim() === '') {
    throw new Error('JWT_SECRET липсва в environment variables.');
  }

  return secret;
}

export function signAuthToken(payload, options) {
  return jwt.sign(payload, getJwtSecret(), options);
}

export async function loadAuthenticatedUser(decoded) {
  if (!decoded?._id) {
    return null;
  }

  return User.findById(decoded._id).lean();
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await loadAuthenticatedUser(decoded);

    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    req.user = serializeUser(user);
    next();
  } catch (err) {
    if (err.message === 'JWT_SECRET липсва в environment variables.') {
      return res.status(500).json({ message: 'Проблем в конфигурацията на сървъра.' });
    }

    return res.status(401).json({ message: 'Invalid token' });
  }
}

export async function loadOptionalAuthenticatedUserFromRequest(req) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const user = await loadAuthenticatedUser(decoded);
    return serializeUser(user);
  } catch {
    return null;
  }
}

export function requireFullAdmin(req, res, next) {
  if (!isFullAdmin(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  next();
}

export function requireAnyRole(roles) {
  const allowedRoles = new Set(roles);

  return (req, res, next) => {
    if (!allowedRoles.has(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    next();
  };
}

export function requireActiveArtistOrFullAdmin(req, res, next) {
  if (!isFullAdmin(req.user) && !canArtistManageProducts(req.user)) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  next();
}
