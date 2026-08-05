'use client';

import { usePathname } from 'next/navigation';
import { PublicStatusPageView } from '@/components/ui/PublicStatusPage';
import styles from '@/components/ui/PublicStatusPage.module.css';
import {
  DEFAULT_LOCALE,
  LOCALE_DETAILS,
  isEnabledPublicLocale,
  isLocaleRoutingEnabled,
} from '@/i18n/config';
import { formatMessage, getDictionary } from '@/i18n/getDictionary';
import { getPathLocale, localizePath } from '@/i18n/routing';

export function resolveGlobalErrorLocale(pathname) {
  const pathLocale = getPathLocale(pathname || '/');

  return isEnabledPublicLocale(pathLocale) ? pathLocale : DEFAULT_LOCALE;
}

export default function GlobalError({ reset }) {
  const pathname = usePathname();
  const locale = resolveGlobalErrorLocale(pathname);
  const dictionary = getDictionary(locale);
  const homeHref = isLocaleRoutingEnabled() ? localizePath('/', locale) : '/';
  const t = (key) => formatMessage(dictionary, key);

  return (
    <html lang={LOCALE_DETAILS[locale].htmlLang}>
      <body className={styles.globalBody}>
        <main className={styles.globalMain}>
          <PublicStatusPageView
            title={t('errors.genericTitle')}
            description={t('errors.genericDescription')}
            homeHref={homeHref}
            homeLabel={t('navigation.home')}
            retryLabel={t('common.retry')}
            onRetry={reset}
          />
        </main>
      </body>
    </html>
  );
}
