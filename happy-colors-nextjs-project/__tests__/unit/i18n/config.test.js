import { describe, expect, it } from 'vitest';
import {
  assertSupportedLocale,
  getEnabledPublicLocales,
  getLocaleConfig,
  isEnabledPublicLocale,
  isSupportedLocale,
} from '../../../src/i18n/config';

describe('i18n locale config', () => {
  it('keeps locale support allowlisted and normalized', () => {
    expect(isSupportedLocale('bg')).toBe(true);
    expect(isSupportedLocale(' EN ')).toBe(true);
    expect(isSupportedLocale('../en')).toBe(false);
    expect(() => assertSupportedLocale('fr')).toThrow(/Unsupported locale/);
  });

  it('keeps English disabled until the launch flag is enabled', () => {
    expect(getEnabledPublicLocales({ englishEnabled: false })).toEqual(['bg']);
    expect(getEnabledPublicLocales({ englishEnabled: true })).toEqual(['bg', 'en']);
    expect(isEnabledPublicLocale('en', { englishEnabled: false })).toBe(false);
    expect(isEnabledPublicLocale('en', { englishEnabled: true })).toBe(true);
  });

  it('builds the shared locale config for routing and metadata', () => {
    expect(getLocaleConfig({ englishEnabled: true })).toMatchObject({
      defaultLocale: 'bg',
      supportedLocales: ['bg', 'en'],
      enabledPublicLocales: ['bg', 'en'],
      localeDetails: {
        bg: { htmlLang: 'bg', intlLocale: 'bg-BG', label: 'Български' },
        en: { htmlLang: 'en', intlLocale: 'en-US', label: 'English' },
      },
    });
  });
});
