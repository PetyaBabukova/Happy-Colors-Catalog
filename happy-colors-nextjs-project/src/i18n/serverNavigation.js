import { isLocaleRoutingEnabled, isSupportedLocale } from './config';
import { localizeInternalHref, localizePublicHref } from './routing';

export function getServerPublicHref(href, locale) {
  if (!locale || !isSupportedLocale(locale) || !isLocaleRoutingEnabled()) {
    return href;
  }

  return localizePublicHref(href, locale);
}

export function getServerRedirectHref(href, locale) {
  if (!locale || !isSupportedLocale(locale) || !isLocaleRoutingEnabled()) {
    return href;
  }

  // The category redirect resolver has already allowlisted and bounded this target query.
  return localizeInternalHref(href, locale);
}
