import { notFound } from 'next/navigation';
import { createElement } from 'react';
import {
  isEnabledPublicLocale,
  isLocaleRoutingEnabled,
  normalizeLocale,
} from '@/i18n/config';
import I18nProvider from '@/i18n/I18nProvider';
import { getDictionary } from '@/i18n/getDictionary';

export default async function LocalizedLayout({ children, params }) {
  const resolvedParams = await params;
  const locale = normalizeLocale(resolvedParams?.locale);

  if (!isLocaleRoutingEnabled() || !isEnabledPublicLocale(locale)) {
    notFound();
  }

  return createElement(
    I18nProvider,
    { locale, dictionary: getDictionary(locale) },
    children
  );
}
