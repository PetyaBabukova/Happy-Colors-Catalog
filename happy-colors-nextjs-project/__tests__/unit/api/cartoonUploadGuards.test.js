import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/app/api/_lib/env.js', () => ({
  ensureServerEnvLoaded: vi.fn(),
}));

async function loadGuards() {
  return import('../../../src/app/api/_lib/cartoonUploadGuards.js');
}

describe('Next cartoonUploadGuards', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', '0123456789abcdef0123456789abcdef');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('derives browser and IP guard keys with HMAC', async () => {
    const { createCartoonGuardHmacKey } = await loadGuards();
    const serverGuards = await import('../../../../server/helpers/cartoonUploadGuards.js');
    const key = createCartoonGuardHmacKey({ keyType: 'browser', value: 'cookie-value' });
    const plainHash = crypto.createHash('sha256').update('browser:cookie-value').digest('base64url');

    expect(key).toHaveLength(43);
    expect(key).not.toBe(plainHash);
    expect(key).not.toBe('cookie-value');
    expect(key).not.toBe(createCartoonGuardHmacKey({ keyType: 'ip', value: 'cookie-value' }));
    expect(key).toBe(
      serverGuards.createCartoonGuardHmacKey({ keyType: 'browser', value: 'cookie-value' })
    );
  });

  it('rejects weak non-empty guard secrets', async () => {
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', 'too-short');
    const { createCartoonGuardHmacKey } = await loadGuards();

    expect(() => createCartoonGuardHmacKey({ keyType: 'browser', value: 'cookie-value' }))
      .toThrow('at least 32 characters');
  });

  it('sets an HttpOnly browser guard cookie with root path and sufficient expiry', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CARTOON_ORDER_SUCCESSFUL_INQUIRY_WINDOW_HOURS', '72');
    vi.stubEnv('CARTOON_BROWSER_GUARD_COOKIE_MAX_AGE_SECONDS', '3600');
    const {
      getBrowserGuardCookieOptions,
      getBrowserGuardCookieName,
      setBrowserGuardCookie,
    } = await loadGuards();
    const response = {
      cookies: {
        set: vi.fn(),
      },
    };

    const cookieValue = setBrowserGuardCookie(response, 'opaque-value');

    expect(cookieValue).toBe('opaque-value');
    expect(getBrowserGuardCookieOptions()).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 72 * 60 * 60,
    });
    expect(response.cookies.set).toHaveBeenCalledWith(
      getBrowserGuardCookieName(),
      'opaque-value',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      })
    );
  });

  it('uses only the configured trusted client-IP header', async () => {
    const { getTrustedClientIpFromNextRequest } = await loadGuards();
    const request = {
      headers: {
        get: (name) => ({
          'x-real-ip': '203.0.113.10',
          'x-forwarded-for': '198.51.100.20',
        })[name] || null,
      },
    };

    expect(getTrustedClientIpFromNextRequest(request)).toBe('203.0.113.10');
    expect(getTrustedClientIpFromNextRequest({
      headers: { get: (name) => (name === 'x-forwarded-for' ? '198.51.100.20' : null) },
    })).toBe('unknown');
  });

  it('fails closed on missing trusted client IP in production with persistent guards enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'true');
    const { getTrustedClientIpFromNextRequest } = await loadGuards();

    expect(() => getTrustedClientIpFromNextRequest({ headers: { get: () => null } }))
      .toThrow('Trusted client IP header is required');
  });
});
