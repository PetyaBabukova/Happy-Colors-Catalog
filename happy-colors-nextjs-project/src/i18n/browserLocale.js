import { LOCALE_COOKIE_NAME, assertSupportedLocale } from './config';

export const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

export function buildLocalePreferenceCookie(locale, { secure = false } = {}) {
  const supportedLocale = assertSupportedLocale(locale);
  const secureAttribute = secure ? '; Secure' : '';

  return [
    `${LOCALE_COOKIE_NAME}=${encodeURIComponent(supportedLocale)}`,
    'Path=/',
    `Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ].join('; ') + secureAttribute;
}

export function persistLocalePreference(
  locale,
  {
    documentRef = globalThis.document,
    locationRef = globalThis.location,
  } = {}
) {
  if (!documentRef) {
    return false;
  }

  documentRef.cookie = buildLocalePreferenceCookie(locale, {
    secure: locationRef?.protocol === 'https:',
  });

  return true;
}
