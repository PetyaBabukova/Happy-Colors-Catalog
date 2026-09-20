// src/app/layout.js

import './globals.css';
import ClientLayout from './ClientLayout';
import { Roboto } from 'next/font/google';
import { cookies, headers } from 'next/headers';
import {
  buildOrganizationJsonLd,
  buildWebsiteJsonLd,
  metadataBaseUrl,
  shouldIndexSite,
} from '@/config/siteSeo';
import {
  DEFAULT_LOCALE,
  LOCALE_DETAILS,
  LOCALE_REQUEST_HEADER,
  isEnabledPublicLocale,
  isLocaleRoutingEnabled,
  normalizeLocale,
} from '@/i18n/config';
import { getDictionary } from '@/i18n/getDictionary';
import { getVisibleCategoriesSeed } from '@/managers/categoriesManager';
import { hasAuthSessionHint } from '@/context/authSessionHint';
import { stringifyJsonLd } from '@/utils/jsonLd';

const roboto = Roboto({
  subsets: ['latin', 'cyrillic'],
  weight: ['100', '300', '400', '500', '700'],
  display: 'swap',
});

export const metadata = {
  metadataBase: metadataBaseUrl,

  title: {
    default: 'Плетени играчки, аксесоари и декорация за дома | Happy Colors | Хепи Колорс',
    template: '%s | Happy Colors | Хепи Колорс',
  },

  description: 'Ръчно изработени плетени играчки, аксесоари и декорация за дома от Happy Colors (Хепи Колорс) – оригинални идеи за подарък, уют и красиви изделия с характер.',

  robots: {
    index: shouldIndexSite,
    follow: shouldIndexSite,
  },
  ...(shouldIndexSite
    ? {
        alternates: {
          canonical: '/',
        },
      }
    : {}),

  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
    shortcut: '/favicon.ico',
  },
};

async function resolveLayoutLocale() {
  if (!isLocaleRoutingEnabled()) {
    return DEFAULT_LOCALE;
  }

  const requestHeaders = await headers();
  const requestLocale = normalizeLocale(requestHeaders.get(LOCALE_REQUEST_HEADER));

  if (isEnabledPublicLocale(requestLocale)) {
    return requestLocale;
  }

  return DEFAULT_LOCALE;
}

export default async function RootLayout({ children }) {
  const locale = await resolveLayoutLocale();
  const requestCookies = await cookies();
  const dictionary = getDictionary(locale);
  const visibleCategoriesSeed = await getVisibleCategoriesSeed({ locale });
  const hasSessionHint = hasAuthSessionHint(requestCookies);

  return (
    <html lang={LOCALE_DETAILS[locale].htmlLang}>
      <body className={roboto.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(buildOrganizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(buildWebsiteJsonLd(locale)) }}
        />
        <ClientLayout
          dictionary={dictionary}
          enableAnalytics={shouldIndexSite}
          hasSessionHint={hasSessionHint}
          initialVisibleCategories={visibleCategoriesSeed.categories}
          initialVisibleCategoriesLoaded={visibleCategoriesSeed.loaded}
          locale={locale}
        >
          {children}
        </ClientLayout>
      </body>

    </html>
  );
}
