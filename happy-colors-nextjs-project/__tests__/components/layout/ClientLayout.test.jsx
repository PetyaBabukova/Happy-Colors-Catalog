import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ClientLayout from '@/app/ClientLayout';

const mocks = vi.hoisted(() => ({
  authWrapper: vi.fn(),
  cartProvider: vi.fn(),
  cookieConsentProvider: vi.fn(),
  googleAnalyticsConsent: vi.fn(),
  i18nProvider: vi.fn(),
  productProvider: vi.fn(),
}));

vi.mock('@/components/header/header', () => ({
  default: () => <header data-testid="header">Header</header>,
}));

vi.mock('@/components/layout/Footer', () => ({
  default: () => <footer data-testid="footer">Footer</footer>,
}));

vi.mock('@/context/AuthWrapper', () => ({
  default: ({ children, hasSessionHint = false }) => {
    mocks.authWrapper({ hasSessionHint });
    return <section data-testid="auth-wrapper">{children}</section>;
  },
}));

vi.mock('@/context/ProductContext', () => ({
  ProductProvider: ({ children, ...props }) => {
    mocks.productProvider(props);
    return <section data-testid="product-provider">{children}</section>;
  },
}));

vi.mock('@/context/CartContext', () => ({
  CartProvider: ({ children }) => {
    mocks.cartProvider();
    return <section data-testid="cart-provider">{children}</section>;
  },
}));

vi.mock('@/components/privacy/CookieConsentContext', () => ({
  CookieConsentProvider: ({ children }) => {
    mocks.cookieConsentProvider();
    return <section data-testid="cookie-provider">{children}</section>;
  },
}));

vi.mock('@/components/privacy/CookieConsentBanner', () => ({
  default: () => <div data-testid="cookie-banner" />,
}));

vi.mock('@/components/analytics/GoogleAnalyticsConsent', () => ({
  default: (props) => {
    mocks.googleAnalyticsConsent(props);
    return <div data-testid="analytics-consent" />;
  },
}));

vi.mock('@/i18n/I18nProvider', () => ({
  default: ({ children, ...props }) => {
    mocks.i18nProvider(props);
    return <section data-testid="i18n-provider">{children}</section>;
  },
}));

vi.mock('@/i18n/useLocaleNavigation', () => ({
  default: () => ({ locale: 'en' }),
}));

describe('ClientLayout', () => {
  it('wires analytics, auth session hints, visible category seeds, and locale into providers', async () => {
    const dictionary = { navigation: { home: 'Home' } };
    const initialVisibleCategories = [{ _id: 'cat-1', name: 'Animals' }];

    render(
      <ClientLayout
        dictionary={dictionary}
        enableAnalytics
        hasSessionHint
        initialVisibleCategories={initialVisibleCategories}
        initialVisibleCategoriesLoaded={false}
        locale="en"
      >
        <p>Page body</p>
      </ClientLayout>
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByText('Page body')).toBeInTheDocument();
    expect(mocks.i18nProvider).toHaveBeenCalledWith({ locale: 'en', dictionary });
    expect(mocks.googleAnalyticsConsent).toHaveBeenCalledWith({ enableAnalytics: true });
    expect(mocks.authWrapper).toHaveBeenCalledWith({ hasSessionHint: true });
    expect(mocks.productProvider).toHaveBeenCalledWith({
      initialVisibleCategories,
      initialVisibleCategoriesLoaded: false,
      initialVisibleCategoriesLocale: 'en',
    });
    expect(mocks.cartProvider).toHaveBeenCalled();
    expect(mocks.cookieConsentProvider).toHaveBeenCalled();

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
    });
  });
});
