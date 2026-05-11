import jwt from 'jsonwebtoken';

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

export function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: 'Missing authentication token' });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    req.user = decoded;
    next();
  } catch (err) {
    if (err.message === 'JWT_SECRET липсва в environment variables.') {
      return res.status(500).json({ message: 'Проблем в конфигурацията на сървъра.' });
    }

    return res.status(401).json({ message: 'Invalid token' });
  }
}
