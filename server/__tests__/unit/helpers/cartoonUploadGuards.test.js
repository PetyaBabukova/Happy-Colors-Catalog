import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createBrowserGuardCookieValue,
  createCartoonGuardHmacKey,
  getBrowserGuardCookieOptions,
  getTrustedClientIpFromExpressRequest,
  serializeBrowserGuardCookie,
} from '../../../helpers/cartoonUploadGuards.js';

describe('cartoonUploadGuards', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', '0123456789abcdef0123456789abcdef');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('derives guard keys with keyed HMAC instead of plain hashes', () => {
    const value = 'opaque-browser-cookie';
    const key = createCartoonGuardHmacKey({ keyType: 'browser', value });
    const plainHash = crypto.createHash('sha256').update(`browser:${value}`).digest('base64url');

    expect(key).toHaveLength(43);
    expect(key).not.toBe(value);
    expect(key).not.toBe(plainHash);
    expect(key).toBe(createCartoonGuardHmacKey({ keyType: 'browser', value }));
    expect(key).not.toBe(createCartoonGuardHmacKey({ keyType: 'ip', value }));
  });

  it('fails closed in production when persistent guards are enabled without a strong secret', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'true');
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', '');

    expect(() => createCartoonGuardHmacKey({ keyType: 'browser', value: 'cookie' })).toThrow(
      'CARTOON_GUARD_HMAC_SECRET'
    );
  });

  it('rejects weak non-empty guard secrets in every environment', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', 'too-short');

    expect(() => createCartoonGuardHmacKey({ keyType: 'browser', value: 'cookie' })).toThrow(
      'at least 32 characters'
    );
  });

  it('creates an opaque browser cookie with settings covering both runtimes', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CARTOON_ORDER_SUCCESSFUL_INQUIRY_WINDOW_HOURS', '48');
    vi.stubEnv('CARTOON_BROWSER_GUARD_COOKIE_MAX_AGE_SECONDS', '3600');

    const cookieValue = createBrowserGuardCookieValue();
    const options = getBrowserGuardCookieOptions();
    const serialized = serializeBrowserGuardCookie(cookieValue);

    expect(cookieValue).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
    });
    expect(options.maxAge).toBeGreaterThanOrEqual(48 * 60 * 60);
    expect(serialized).toContain('hc_cartoon_guard=');
    expect(serialized).toContain('Path=/');
    expect(serialized).toContain('HttpOnly');
    expect(serialized).toContain('SameSite=Lax');
    expect(serialized).toContain('Secure');
  });

  it('uses only the configured trusted client-IP header', () => {
    vi.stubEnv('CARTOON_TRUSTED_CLIENT_IP_HEADER', 'x-real-ip');
    const req = {
      headers: {
        'x-real-ip': '203.0.113.10',
        'x-forwarded-for': '198.51.100.20',
      },
    };

    expect(getTrustedClientIpFromExpressRequest(req)).toBe('203.0.113.10');
    expect(getTrustedClientIpFromExpressRequest({ headers: { 'x-forwarded-for': '198.51.100.20' } }))
      .toBe('unknown');
  });

  it('fails closed on missing trusted client IP in production with persistent guards enabled', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED', 'true');

    expect(() => getTrustedClientIpFromExpressRequest({ headers: {} })).toThrow(
      'Trusted client IP header is required'
    );
  });
});
