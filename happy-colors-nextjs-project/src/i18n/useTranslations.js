'use client';

import { useContext, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { I18nContext } from './I18nProvider';
import {
  getEnabledPublicLocales,
  isLocaleRoutingEnabled,
} from './config';
import { formatCount } from './formatters';
import { formatMessage, getDictionary } from './getDictionary';
import { getPathLocale } from './routing';

function getActiveLocale(contextLocale, pathname) {
  if (!isLocaleRoutingEnabled()) {
    return contextLocale;
  }

  const pathLocale = getPathLocale(pathname || '/');

  return getEnabledPublicLocales().includes(pathLocale) ? pathLocale : contextLocale;
}

export default function useTranslations(namespace = '') {
  const context = useContext(I18nContext);
  const pathname = usePathname();

  if (!context) {
    throw new Error('useTranslations must be used within I18nProvider.');
  }

  return useMemo(() => {
    const prefix = namespace ? `${namespace}.` : '';
    const activeLocale = getActiveLocale(context.locale, pathname);
    const activeDictionary = activeLocale === context.locale
      ? context.dictionary
      : getDictionary(activeLocale);

    return {
      ...context,
      locale: activeLocale,
      dictionary: activeDictionary,
      t: (key, values) => formatMessage(activeDictionary, `${prefix}${key}`, values),
      formatCount: (count, labels) => formatCount(count, activeLocale, labels),
    };
  }, [context, namespace, pathname]);
}
