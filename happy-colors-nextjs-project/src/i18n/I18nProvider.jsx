'use client';

import { createContext, useMemo } from 'react';
import { assertSupportedLocale } from './config';
import { formatCount, formatMachineDateIso, formatVisibleDate } from './formatters';
import { formatMessage, getDictionary } from './getDictionary';

export const I18nContext = createContext(null);

export default function I18nProvider({ locale, dictionary, children }) {
  const supportedLocale = assertSupportedLocale(locale);
  const resolvedDictionary = dictionary || getDictionary(supportedLocale);
  const value = useMemo(
    () => ({
      locale: supportedLocale,
      dictionary: resolvedDictionary,
      t: (key, values) => formatMessage(resolvedDictionary, key, values),
      formatCount: (count, labels) => formatCount(count, supportedLocale, labels),
      formatVisibleDate,
      formatMachineDateIso,
    }),
    [resolvedDictionary, supportedLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
