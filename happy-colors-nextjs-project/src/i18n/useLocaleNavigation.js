'use client';

import { usePathname } from 'next/navigation';
import useTranslations from './useTranslations';
import {
  LOCALE_DETAILS,
  getEnabledPublicLocales,
  isLocaleRoutingEnabled,
} from './config';
import { getPathLocale, localizePublicHref, switchPublicLocaleHref } from './routing';

export default function useLocaleNavigation() {
  const { locale: contextLocale } = useTranslations();
  const pathname = usePathname();
  const localeRoutingEnabled = isLocaleRoutingEnabled();
  const enabledLocales = getEnabledPublicLocales();
  const pathLocale = getPathLocale(pathname || '/');
  const locale = localeRoutingEnabled && enabledLocales.includes(pathLocale)
    ? pathLocale
    : contextLocale;

  return {
    enabledLocales,
    locale,
    localeDetails: LOCALE_DETAILS,
    localeRoutingEnabled,
    publicHref: (href, options) => (
      localeRoutingEnabled ? localizePublicHref(href, locale, options) : href
    ),
    switchLocaleHref: (href, nextLocale, options) => (
      localeRoutingEnabled ? switchPublicLocaleHref(href, nextLocale, options) : href
    ),
  };
}
