//import { CartProvider } from '@/context/CartContext';

'use client';

import Header from '@/components/header/header';
import AuthWrapper from '@/context/AuthWrapper';
import { ProductProvider } from '@/context/ProductContext';
import { CartProvider } from '@/context/CartContext';
import { CookieConsentProvider } from '@/components/privacy/CookieConsentContext';
import CookieConsentBanner from '@/components/privacy/CookieConsentBanner';
import CookieFooterLink from '@/components/privacy/CookieFooterLink';
import privacyStyles from '@/components/privacy/CookieConsent.module.css';

export default function ClientLayout({ children }) {
  return (
    <CookieConsentProvider>
      <AuthWrapper>
        <ProductProvider>
          <CartProvider>
            <Header />
            <main>{children}</main>
            <footer>
              <div className={privacyStyles.footerLeftBlock}>
                <p>© 2026 Happy Colors. Всички права запазени.</p>
                <CookieFooterLink />
              </div>
              <p>
                <a
                  href="https://webcreativeteam.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Онлайн каталог от <b>webcreativeteam.com</b>
                </a>
              </p>
            </footer>
            <CookieConsentBanner />
          </CartProvider>
        </ProductProvider>
      </AuthWrapper>
    </CookieConsentProvider>
  );
}
