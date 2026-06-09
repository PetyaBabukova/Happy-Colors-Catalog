import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../../middlewares/rateLimit.js';
import { buildNext, buildReq, buildRes } from '../_helpers/httpMocks.js';

describe('createRateLimiter', () => {
  it('allows requests until the configured max and then returns 429', () => {
    const limiter = createRateLimiter({
      keyPrefix: 'unit-rate-limit-max',
      windowMs: 60_000,
      max: 2,
      message: 'Too many requests',
    });
    const req = buildReq({ headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' } });
    const firstRes = buildRes();
    const secondRes = buildRes();
    const thirdRes = buildRes();
    const next = buildNext();

    limiter(req, firstRes, next);
    limiter(req, secondRes, next);
    limiter(req, thirdRes, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(thirdRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(String));
    expect(thirdRes.status).toHaveBeenCalledWith(429);
    expect(thirdRes.json).toHaveBeenCalledWith({ message: 'Too many requests' });
  });

  it('tracks different client IP addresses independently', () => {
    const limiter = createRateLimiter({
      keyPrefix: 'unit-rate-limit-ip',
      windowMs: 60_000,
      max: 1,
    });
    const next = buildNext();

    limiter(buildReq({ ip: '198.51.100.1' }), buildRes(), next);
    limiter(buildReq({ ip: '198.51.100.2' }), buildRes(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('keys by Express req.ip instead of spoofable forwarded header values', () => {
    const limiter = createRateLimiter({
      keyPrefix: 'unit-rate-limit-forwarded-chain',
      windowMs: 60_000,
      max: 2,
      message: 'Too many requests',
    });
    const next = buildNext();
    const firstRes = buildRes();
    const secondRes = buildRes();
    const thirdRes = buildRes();

    limiter(
      buildReq({
        ip: '203.0.113.40',
        headers: {
          'x-forwarded-for': '198.51.100.1, 203.0.113.30',
          'x-real-ip': '203.0.113.40',
        },
      }),
      firstRes,
      next
    );
    limiter(
      buildReq({
        ip: '203.0.113.40',
        headers: {
          'x-forwarded-for': '198.51.100.2, 203.0.113.30',
          'x-real-ip': '203.0.113.40',
        },
      }),
      secondRes,
      next
    );
    limiter(
      buildReq({
        ip: '203.0.113.40',
        headers: {
          'x-forwarded-for': '198.51.100.3, 203.0.113.30',
          'x-real-ip': '203.0.113.40',
        },
      }),
      thirdRes,
      next
    );

    expect(next).toHaveBeenCalledTimes(2);
    expect(thirdRes.status).toHaveBeenCalledWith(429);
  });

  it('uses a custom key generator when provided', () => {
    const limiter = createRateLimiter({
      keyPrefix: 'unit-rate-limit-user',
      windowMs: 60_000,
      max: 1,
      keyGenerator: (req) => `user:${req.user._id}`,
    });
    const next = buildNext();

    limiter(buildReq({ headers: { 'x-forwarded-for': '198.51.100.1' }, user: { _id: 'owner-1' } }), buildRes(), next);
    limiter(buildReq({ headers: { 'x-forwarded-for': '198.51.100.2' }, user: { _id: 'owner-1' } }), buildRes(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
