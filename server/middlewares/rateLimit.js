const stores = new Map();

export function resetRateLimiterState() {
  stores.clear();
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
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
