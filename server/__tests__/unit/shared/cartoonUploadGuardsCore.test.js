import { describe, expect, it, vi } from 'vitest';

import { createCartoonUploadGuardTools } from '../../../../shared/cartoonUploadGuardsCore.js';

function createTools(env = {}) {
  const prepareEnv = vi.fn();
  const getEnvValue = vi.fn((name) => env[name]);

  return {
    tools: createCartoonUploadGuardTools({ getEnvValue, prepareEnv }),
    getEnvValue,
    prepareEnv,
  };
}

describe('shared cartoon upload guards core', () => {
  it('uses injected env readers for guard secrets instead of process.env', () => {
    vi.stubEnv('CARTOON_GUARD_HMAC_SECRET', 'process-env-secret-that-should-not-be-used');
    const { tools, getEnvValue, prepareEnv } = createTools({
      CARTOON_GUARD_HMAC_SECRET: '0123456789abcdef0123456789abcdef',
    });

    const browserKey = tools.createCartoonGuardHmacKey({
      keyType: 'browser',
      value: 'opaque-cookie',
    });

    expect(browserKey).toHaveLength(43);
    expect(browserKey).toBe(
      tools.createCartoonGuardHmacKey({ keyType: 'browser', value: 'opaque-cookie' })
    );
    expect(browserKey).not.toBe(
      tools.createCartoonGuardHmacKey({ keyType: 'ip', value: 'opaque-cookie' })
    );
    expect(getEnvValue).toHaveBeenCalledWith('CARTOON_GUARD_HMAC_SECRET');
    expect(prepareEnv).toHaveBeenCalled();

    vi.unstubAllEnvs();
  });

  it('rejects missing, weak, and invalid HMAC inputs', () => {
    expect(() => createTools().tools.createCartoonGuardHmacKey({
      keyType: 'browser',
      value: 'cookie',
    })).toThrow('CARTOON_GUARD_HMAC_SECRET is not configured.');

    expect(() => createTools({
      CARTOON_GUARD_HMAC_SECRET: 'too-short',
    }).tools.createCartoonGuardHmacKey({
      keyType: 'browser',
      value: 'cookie',
    })).toThrow('at least 32 characters');

    expect(() => createTools({
      CARTOON_GUARD_HMAC_SECRET: '0123456789abcdef0123456789abcdef',
    }).tools.createCartoonGuardHmacKey({
      keyType: 'session',
      value: 'cookie',
    })).toThrow('Unsupported cartoon guard key type.');

    expect(() => createTools({
      CARTOON_GUARD_HMAC_SECRET: '0123456789abcdef0123456789abcdef',
    }).tools.createCartoonGuardHmacKey({
      keyType: 'browser',
      value: '',
    })).toThrow('Cartoon guard key input is required.');
  });

  it('derives cookie options from injected runtime env', () => {
    const { tools } = createTools({
      NODE_ENV: 'production',
      CARTOON_BROWSER_GUARD_COOKIE_NAME: 'hc cartoon guard!*',
      CARTOON_BROWSER_GUARD_COOKIE_MAX_AGE_SECONDS: '3600',
      CARTOON_ORDER_SUCCESSFUL_INQUIRY_WINDOW_HOURS: '72',
    });

    expect(tools.getBrowserGuardCookieName()).toBe('hccartoonguard');
    expect(tools.getBrowserGuardCookieMaxAgeSeconds()).toBe(72 * 60 * 60);
    expect(tools.getBrowserGuardCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 72 * 60 * 60,
    });
  });

  it('uses injected guard toggles and trusted IP header policy', () => {
    const { tools } = createTools({
      NODE_ENV: 'production',
      CARTOON_PERSISTENT_ABUSE_GUARDS_ENABLED: 'true',
      CARTOON_TRUSTED_CLIENT_IP_HEADER: 'X-Real-IP',
    });

    expect(tools.arePersistentCartoonGuardsEnabled()).toBe(true);
    expect(tools.getTrustedClientIpHeaderName()).toBe('x-real-ip');
    expect(tools.getTrustedClientIpFromHeaderValue('203.0.113.10, 198.51.100.20')).toBe('203.0.113.10');
    expect(() => tools.getTrustedClientIpFromHeaderValue('')).toThrow(
      'Trusted client IP header is required'
    );
  });
});
