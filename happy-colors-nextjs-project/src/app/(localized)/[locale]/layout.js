import { notFound } from 'next/navigation';
import { createElement } from 'react';
import {
  isEnabledPublicLocale,
  isLocaleRoutingEnabled,
  normalizeLocale,
} from '@/i18n/config';
import { getHomePageContent } from '@/content/publicPages/home';
import I18nProvider from '@/i18n/I18nProvider';
import { getDictionary } from '@/i18n/getDictionary';

function resolveLocalizedRouteLocale(params) {
  const locale = normalizeLocale(params?.locale);

  return isLocaleRoutingEnabled() && isEnabledPublicLocale(locale) ? locale : '';
}

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const locale = resolveLocalizedRouteLocale(resolvedParams);

  if (!locale) {
    return {};
  }

  const homeMetadata = getHomePageContent(locale).metadata;

  return {
    title: {
      default: homeMetadata.title.absolute,
      template: locale === 'en'
        ? '%s | Happy Colors'
        : '%s | Happy Colors | Хепи Колорс',
    },
    description: homeMetadata.description,
  };
}

export default async function LocalizedLayout({ children, params }) {
  const resolvedParams = await params;
  const locale = resolveLocalizedRouteLocale(resolvedParams);

  if (!locale) {
    notFound();
  }

  return createElement(
    I18nProvider,
    { locale, dictionary: getDictionary(locale) },
    children
  );
}
