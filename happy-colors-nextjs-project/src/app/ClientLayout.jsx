//import { CartProvider } from '@/context/CartContext';

'use client';

import { Suspense, useEffect } from 'react';
import Header from '@/components/header/header';
import Footer from '@/components/layout/Footer';
import AuthWrapper from '@/context/AuthWrapper';
import { ProductProvider } from '@/context/ProductContext';
import { CartProvider } from '@/context/CartContext';
import { CookieConsentProvider } from '@/components/privacy/CookieConsentContext';
import CookieConsentBanner from '@/components/privacy/CookieConsentBanner';
import GoogleAnalyticsConsent from '@/components/analytics/GoogleAnalyticsConsent';
import I18nProvider from '@/i18n/I18nProvider';
import { DEFAULT_LOCALE, LOCALE_DETAILS } from '@/i18n/config';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';

function HtmlLangSync() {
  const { locale } = useLocaleNavigation();

  useEffect(() => {
    document.documentElement.lang = LOCALE_DETAILS[locale]?.htmlLang || LOCALE_DETAILS[DEFAULT_LOCALE].htmlLang;
  }, [locale]);

  return null;
}

export default function ClientLayout({
  children,
  dictionary,
  enableAnalytics = false,
  locale = DEFAULT_LOCALE,
}) {
  return (
    <I18nProvider locale={locale} dictionary={dictionary}>
      <Suspense fallback={null}>
        <HtmlLangSync />
      </Suspense>
      <CookieConsentProvider>
        <Suspense fallback={null}>
          <GoogleAnalyticsConsent enableAnalytics={enableAnalytics} />
        </Suspense>
        <AuthWrapper>
          <ProductProvider>
            <CartProvider>
              <Header />
              <main>{children}</main>
              <Footer />
              <CookieConsentBanner />
            </CartProvider>
          </ProductProvider>
        </AuthWrapper>
      </CookieConsentProvider>
    </I18nProvider>
  );
}
