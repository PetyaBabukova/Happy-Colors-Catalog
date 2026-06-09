const stores = new Map();

export function resetRateLimiterState() {
  stores.clear();
}

function getClientIp(req) {
  if (typeof req.ip === 'string' && req.ip.trim()) {
    return req.ip.trim();
  }

  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    const forwardedChain = forwardedFor.split(',').map((value) => value.trim()).filter(Boolean);

    return forwardedChain[0] || 'unknown';
  }

  return req.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter({
  keyPrefix = 'global',
  windowMs = 15 * 60 * 1000,
  max = 10,
  message = 'Твърде много заявки. Моля, опитайте отново по-късно.',
  keyGenerator,
} = {}) {
  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const clientIp = getClientIp(req);
    const keyValue = typeof keyGenerator === 'function' ? keyGenerator(req, clientIp) : clientIp;
    const key = `${keyPrefix}:${keyValue || clientIp}`;

    const existing = stores.get(key);

    if (!existing || now > existing.resetAt) {
      stores.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });

      return next();
    }

    existing.count += 1;

    if (existing.count > max) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);

      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ message });
    }

    return next();
  };
}
