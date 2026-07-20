import { isLocaleRoutingEnabled, isSupportedLocale } from './config';
import { localizePublicHref } from './routing';

export function getServerPublicHref(href, locale) {
  if (!locale || !isSupportedLocale(locale) || !isLocaleRoutingEnabled()) {
    return href;
  }

  return localizePublicHref(href, locale);
}
