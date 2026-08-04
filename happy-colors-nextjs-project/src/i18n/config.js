export const DEFAULT_LOCALE = 'bg';
export const SUPPORTED_LOCALES = Object.freeze(['bg', 'en']);
export const LOCALE_COOKIE_NAME = 'happycolors_locale';
export const LOCALE_REQUEST_HEADER = 'x-happycolors-locale';

export const LOCALE_DETAILS = Object.freeze({
  bg: Object.freeze({
    code: 'bg',
    htmlLang: 'bg',
    intlLocale: 'bg-BG',
    label: 'Български',
  }),
  en: Object.freeze({
    code: 'en',
    htmlLang: 'en',
    intlLocale: 'en-US',
    label: 'English',
  }),
});

export function normalizeLocale(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

export function isSupportedLocale(value) {
  return SUPPORTED_LOCALES.includes(normalizeLocale(value));
}

export function assertSupportedLocale(value) {
  const locale = normalizeLocale(value);

  if (!isSupportedLocale(locale)) {
    throw new Error(`Unsupported locale: ${String(value)}`);
  }

  return locale;
}

export function isEnglishPublicLocaleEnabled(
  value = process.env.NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED
) {
  return value === 'true';
}

export function isLocaleRoutingEnabled(
  value = process.env.NEXT_PUBLIC_LOCALE_ROUTES_ENABLED
) {
  return value === 'true';
}

export function getEnabledPublicLocales({
  englishEnabled = isEnglishPublicLocaleEnabled(),
} = {}) {
  return englishEnabled ? [...SUPPORTED_LOCALES] : [DEFAULT_LOCALE];
}

export function isEnabledPublicLocale(value, options = {}) {
  const locale = normalizeLocale(value);

  return getEnabledPublicLocales(options).includes(locale);
}

export function getLocaleConfig(options = {}) {
  return Object.freeze({
    defaultLocale: DEFAULT_LOCALE,
    supportedLocales: [...SUPPORTED_LOCALES],
    enabledPublicLocales: getEnabledPublicLocales(options),
    localeDetails: LOCALE_DETAILS,
  });
}
