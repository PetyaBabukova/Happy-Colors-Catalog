import { describe, expect, it } from 'vitest';
import {
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  buildLocalePreferenceCookie,
  persistLocalePreference,
} from '../../../src/i18n/browserLocale';

describe('browser locale preference', () => {
  it('builds a one-year same-site locale cookie', () => {
    expect(buildLocalePreferenceCookie('en')).toBe(
      `happycolors_locale=en; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
    );
  });

  it('adds Secure on HTTPS and rejects unsupported locales', () => {
    const documentRef = { cookie: '' };

    expect(
      persistLocalePreference('bg', {
        documentRef,
        locationRef: { protocol: 'https:' },
      })
    ).toBe(true);
    expect(documentRef.cookie).toContain('happycolors_locale=bg');
    expect(documentRef.cookie).toContain('; Secure');
    expect(() => buildLocalePreferenceCookie('fr')).toThrow(/Unsupported locale/);
  });

  it('does not fail when no browser document is available', () => {
    expect(persistLocalePreference('en', { documentRef: null })).toBe(false);
  });
});
