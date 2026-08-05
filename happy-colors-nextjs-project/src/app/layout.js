// src/app/layout.js

import './globals.css';
import ClientLayout from './ClientLayout';
import { Roboto } from 'next/font/google';
import { headers } from 'next/headers';
import {
  metadataBaseUrl,
  currentSiteUrl,
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

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Happy Colors',
  alternateName: ['Хепи Колорс', 'Хепи Калърс'],
  url: currentSiteUrl,
  logo: new URL('/logo_64pxH.svg', currentSiteUrl).toString(),
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
  const dictionary = getDictionary(locale);

  return (
    <html lang={LOCALE_DETAILS[locale].htmlLang}>
      <body className={roboto.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd).replace(/</g, '\\u003c') }}
        />
        <ClientLayout
          dictionary={dictionary}
          enableAnalytics={shouldIndexSite}
          locale={locale}
        >
          {children}
        </ClientLayout>
      </body>

    </html>
  );
}
