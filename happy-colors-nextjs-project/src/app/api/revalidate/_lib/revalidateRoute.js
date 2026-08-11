import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';

import { requireApiAuth, requireApiFullAdmin } from '../../_lib/auth';

export const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

export function isValidObjectId(value) {
  return OBJECT_ID_RE.test(String(value || '').trim());
}

export function hasValidRevalidateSecret(request, secretEnvNames = []) {
  const provided = String(request.headers.get('x-revalidate-secret') || '').trim();

  if (!provided) {
    return false;
  }

  return secretEnvNames.some((envName) => {
    const secret = String(process.env[envName] || '').trim();

    if (!secret) {
      return false;
    }

    const providedBuffer = Buffer.from(provided);
    const secretBuffer = Buffer.from(secret);

    return providedBuffer.length === secretBuffer.length &&
      timingSafeEqual(providedBuffer, secretBuffer);
  });
}

export function createMemoryRateLimiter({
  keyPrefix,
  windowMs = 10 * 60 * 1000,
  max = 60,
} = {}) {
  const store = new Map();

  function reset() {
    store.clear();
  }

  function getClientIp(request) {
    const forwardedFor = request.headers?.get?.('x-forwarded-for');

    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
      return forwardedFor.split(',')[0].trim();
    }

    return request.headers?.get?.('x-real-ip') || 'unknown';
  }

  function check(request, auth) {
    const now = Date.now();

    for (const [storedKey, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(storedKey);
      }
    }

    const key = `${keyPrefix}:${auth.user?._id || getClientIp(request)}`;
    const existing = store.get(key);

    if (!existing || now > existing.resetAt) {
      store.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });

      return { ok: true };
    }

    existing.count += 1;

    if (existing.count > max) {
      return {
        ok: false,
        retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
      };
    }

    return { ok: true };
  }

  return { check, reset };
}

async function authenticateRevalidateRequest(
  request,
  { secretEnvNames, rateLimiter, rateLimitMessage, authorizeAuthenticatedRequest }
) {
  const hasInternalSecret = hasValidRevalidateSecret(request, secretEnvNames);

  if (hasInternalSecret) {
    return { ok: true, hasInternalSecret, auth: { ok: true, user: null } };
  }

  const authorize = authorizeAuthenticatedRequest || requireApiFullAdmin;
  const auth = authorize(await requireApiAuth(request));

  if (!auth.ok) {
    return { ok: false, response: NextResponse.json({ message: auth.message }, { status: auth.status }) };
  }

  if (rateLimiter) {
    const rateLimit = rateLimiter.check(request, auth);

    if (!rateLimit.ok) {
      return {
        ok: false,
        response: NextResponse.json(
          { message: rateLimitMessage },
          {
            status: 429,
            headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
          }
        ),
      };
    }
  }

  return { ok: true, hasInternalSecret, auth };
}

export function createRevalidatePostHandler({
  routeLabel,
  secretEnvNames = [],
  allowInvalidJson = false,
  invalidJsonMessage = 'Invalid request body.',
  validatePayload = () => ({ ok: true, value: {} }),
  rateLimiter = null,
  rateLimitMessage = 'Too many revalidation requests. Please try again later.',
  authorizeAuthenticatedRequest = requireApiFullAdmin,
  revalidate,
  errorMessage,
} = {}) {
  return async function POST(request) {
    try {
      const authResult = await authenticateRevalidateRequest(request, {
        secretEnvNames,
        rateLimiter,
        rateLimitMessage,
        authorizeAuthenticatedRequest,
      });

      if (!authResult.ok) {
        return authResult.response;
      }

      let payload;

      try {
        payload = await request.json();
      } catch {
        if (!allowInvalidJson) {
          return NextResponse.json({ message: invalidJsonMessage }, { status: 400 });
        }

        payload = {};
      }

      const validation = validatePayload(payload || {});

      if (!validation.ok) {
        return NextResponse.json({ message: validation.message }, { status: 400 });
      }

      await revalidate(validation.value || {});

      return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
      console.error(`Error in ${routeLabel}:`, error);

      return NextResponse.json({ message: errorMessage }, { status: 500 });
    }
  };
}
