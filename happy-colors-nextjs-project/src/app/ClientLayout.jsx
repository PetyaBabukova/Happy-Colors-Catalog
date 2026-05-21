//import { CartProvider } from '@/context/CartContext';

'use client';

import Header from '@/components/header/header';
import Footer from '@/components/layout/Footer';
import AuthWrapper from '@/context/AuthWrapper';
import { ProductProvider } from '@/context/ProductContext';
import { CartProvider } from '@/context/CartContext';
import { CookieConsentProvider } from '@/components/privacy/CookieConsentContext';
import CookieConsentBanner from '@/components/privacy/CookieConsentBanner';

export default function ClientLayout({ children }) {
  return (
    <CookieConsentProvider>
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
