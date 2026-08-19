import {
  buildBreadcrumbListJsonLd,
  buildStructuredDataId,
  buildStructuredDataUrl,
  getLocalizedCanonicalPath,
  getOrganizationReference,
  getStructuredDataLanguage,
  WEBSITE_SCHEMA_ID,
} from '@/config/siteSeo';
import { getCartoonsPageContent } from '@/content/publicPages/cartoons';
import { DEFAULT_LOCALE } from '@/i18n/config';

export function buildCartoonServiceJsonLd({
  content,
  path = '/cartoons',
  locale = DEFAULT_LOCALE,
} = {}) {
  const canonicalPath = getLocalizedCanonicalPath(path, locale);
  const title = content?.intro?.title || content?.hero?.title || content?.metadata?.title || 'Happy Colors';

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': buildStructuredDataId(canonicalPath, 'service'),
    name: title,
    description: content?.metadata?.description || title,
    serviceType: title,
    url: buildStructuredDataUrl(canonicalPath),
    provider: getOrganizationReference(),
    inLanguage: getStructuredDataLanguage(locale),
    isPartOf: {
      '@id': WEBSITE_SCHEMA_ID,
    },
  };
}

export function buildCartoonsBreadcrumbJsonLd({
  currentName,
  path = '/cartoons',
  locale = DEFAULT_LOCALE,
} = {}) {
  const parentContent = getCartoonsPageContent(locale);
  const normalizedPath = path || '/cartoons';
  const isOfferPath = normalizedPath === '/cartoons/offer';
  const items = [
    {
      name: locale === 'en' ? 'Home' : 'Начало',
      path: getLocalizedCanonicalPath('/', locale),
    },
  ];

  if (isOfferPath) {
    items.push({
      name: parentContent.intro.title,
      path: getLocalizedCanonicalPath('/cartoons', locale),
    });
  }

  items.push({
    name: currentName || parentContent.intro.title,
    path: getLocalizedCanonicalPath(normalizedPath, locale),
  });

  return buildBreadcrumbListJsonLd(items);
}
