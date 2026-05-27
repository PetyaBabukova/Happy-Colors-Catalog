//import { CartProvider } from '@/context/CartContext';

'use client';

import { Suspense } from 'react';
import Header from '@/components/header/header';
import Footer from '@/components/layout/Footer';
import AuthWrapper from '@/context/AuthWrapper';
import { ProductProvider } from '@/context/ProductContext';
import { CartProvider } from '@/context/CartContext';
import { CookieConsentProvider } from '@/components/privacy/CookieConsentContext';
import CookieConsentBanner from '@/components/privacy/CookieConsentBanner';
import GoogleAnalyticsConsent from '@/components/analytics/GoogleAnalyticsConsent';

export default function ClientLayout({ children, enableAnalytics = false }) {
  return (
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
  );
}
