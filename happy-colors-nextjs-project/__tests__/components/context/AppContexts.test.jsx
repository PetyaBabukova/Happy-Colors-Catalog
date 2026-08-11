import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CartProvider, useCart } from '@/context/CartContext';
import { ProductProvider, useProducts } from '@/context/ProductContext';
import { act, fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';
import { jsonResponse } from '../../api/_helpers.js';

function CartHarness() {
  const { cartItems, addToCart, increaseQuantity, decreaseQuantity, removeFromCart, clearCart, getTotalPrice } = useCart();
  const firstItem = cartItems[0];

  return (
    <div>
      <p data-testid="cart-count">{cartItems.length}</p>
      <p data-testid="first-quantity">{firstItem?.quantity || 0}</p>
      <p data-testid="total">{getTotalPrice().toFixed(2)}</p>
      <button onClick={() => addToCart({ _id: 'p1', title: 'Candle', price: 10 })}>add</button>
      <button onClick={() => increaseQuantity('p1')}>increase</button>
      <button onClick={() => decreaseQuantity('p1')}>decrease</button>
      <button onClick={() => removeFromCart('p1')}>remove</button>
      <button onClick={clearCart}>clear</button>
    </div>
  );
}

function AuthHarness() {
  const { user, loading, refreshUser } = useAuth();

  return (
    <div>
      <p data-testid="auth-loading">{String(loading)}</p>
      <p data-testid="auth-user">{user ? user.email : 'none'}</p>
      <button onClick={refreshUser}>refresh</button>
    </div>
  );
}

function ProductHarness() {
  const { categories, visibleCategories, loading, triggerCategoriesReload } = useProducts();

  return (
    <div>
      <p data-testid="product-loading">{String(loading)}</p>
      <p data-testid="categories">{categories.map((category) => category.name).join(',')}</p>
      <p data-testid="visible-categories">{visibleCategories.map((category) => category.name).join(',')}</p>
      <button onClick={triggerCategoriesReload}>reload</button>
    </div>
  );
}

describe('app context providers', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('CartProvider reads, mutates, persists, and clears cart state', async () => {
    window.localStorage.setItem(
      'happycolors_cart_v2',
      JSON.stringify([{ _id: 'p1', title: 'Candle', price: 10, quantity: 1 }])
    );

    render(
      <CartProvider>
        <CartHarness />
      </CartProvider>
    );

    expect(screen.getByTestId('cart-count')).toHaveTextContent('1');
    expect(screen.getByTestId('first-quantity')).toHaveTextContent('1');
    expect(screen.getByTestId('total')).toHaveTextContent('10.00');

    fireEvent.click(screen.getByText('add'));
    expect(screen.getByTestId('first-quantity')).toHaveTextContent('2');

    fireEvent.click(screen.getByText('increase'));
    expect(screen.getByTestId('first-quantity')).toHaveTextContent('3');

    fireEvent.click(screen.getByText('decrease'));
    expect(screen.getByTestId('first-quantity')).toHaveTextContent('2');

    fireEvent.click(screen.getByText('remove'));
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');

    fireEvent.click(screen.getByText('add'));
    fireEvent.click(screen.getByText('clear'));
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0');

    await waitFor(() => expect(window.localStorage.getItem('happycolors_cart_v2')).toBe('[]'));
  });

  it('AuthProvider skips the initial current-user request without a session hint', async () => {
    render(
      <AuthProvider hasSessionHint={false}>
        <AuthHarness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('auth-user')).toHaveTextContent('none');
    expect(fetch).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByText('refresh'));
    });

    expect(fetch).toHaveBeenCalledWith('/api/users/me', { credentials: 'include' });
  });

  it('AuthProvider loads current user with a session hint and supports explicit refresh', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'u1', email: 'petya@example.com' } }))
      .mockResolvedValueOnce(jsonResponse({ status: 401, ok: false, body: { message: 'unauthorized' } }));

    render(
      <AuthProvider hasSessionHint>
        <AuthHarness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('auth-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('auth-user')).toHaveTextContent('petya@example.com');
    expect(fetch).toHaveBeenCalledWith('/api/users/me', { credentials: 'include' });

    await act(async () => {
      fireEvent.click(screen.getByText('refresh'));
    });

    await waitFor(() => expect(screen.getByTestId('auth-user')).toHaveTextContent('none'));
  });

  it('ProductProvider keeps public pages on the server-rendered visible category seed', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-4', name: 'Visible Decor' }] }));

    render(
      <ProductProvider initialVisibleCategories={[{ _id: 'cat-2', name: 'Visible' }]}>
        <ProductHarness />
      </ProductProvider>
    );

    await waitFor(() => expect(screen.getByTestId('product-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('categories')).toHaveTextContent('');
    expect(screen.getByTestId('visible-categories')).toHaveTextContent('Visible');
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('reload'));

    await waitFor(() => expect(screen.getByTestId('visible-categories')).toHaveTextContent('Visible Decor'));
    expect(screen.getByTestId('categories')).toHaveTextContent('');
    expect(fetch).toHaveBeenCalledWith('/api/categories/visible?locale=bg');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ProductProvider loads full categories only on product form routes', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/products/prod-1/edit' });
    fetch.mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-1', name: 'Form Category' }] }));

    render(
      <ProductProvider
        initialVisibleCategories={[{ _id: 'cat-2', name: 'Visible' }]}
        initialVisibleCategoriesLocale="en"
      >
        <ProductHarness />
      </ProductProvider>,
      { locale: 'en' }
    );

    await waitFor(() => expect(screen.getByTestId('categories')).toHaveTextContent('Form Category'));
    expect(screen.getByTestId('visible-categories')).toHaveTextContent('Visible');
    expect(fetch).toHaveBeenCalledWith('/api/categories?locale=en');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/categories/visible'))).toBe(false);
  });

  it('ProductProvider reloads full and visible categories on product form routes', async () => {
    setMockNavigation({ pathname: '/products/create' });
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-1', name: 'Initial Form Category' }] }))
      .mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-2', name: 'Reloaded Form Category' }] }))
      .mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-visible', name: 'Reloaded Visible' }] }));

    render(
      <ProductProvider initialVisibleCategories={[{ _id: 'cat-seed', name: 'Seed Visible' }]}>
        <ProductHarness />
      </ProductProvider>
    );

    await waitFor(() => expect(screen.getByTestId('categories')).toHaveTextContent('Initial Form Category'));
    expect(screen.getByTestId('visible-categories')).toHaveTextContent('Seed Visible');
    expect(fetch).toHaveBeenCalledWith('/api/categories?locale=bg');

    fireEvent.click(screen.getByText('reload'));

    await waitFor(() => expect(screen.getByTestId('categories')).toHaveTextContent('Reloaded Form Category'));
    expect(screen.getByTestId('visible-categories')).toHaveTextContent('Reloaded Visible');
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/categories?locale=bg');
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/categories/visible?locale=bg');
  });

  it('ProductProvider loads and clears full categories when route requirements change', async () => {
    setMockNavigation({ pathname: '/products' });
    fetch.mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-1', name: 'Form Category' }] }));

    const { rerender } = render(
      <ProductProvider initialVisibleCategories={[{ _id: 'cat-2', name: 'Visible' }]}>
        <ProductHarness />
      </ProductProvider>
    );

    await waitFor(() => expect(screen.getByTestId('product-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('categories')).toHaveTextContent('');
    expect(fetch).not.toHaveBeenCalled();

    setMockNavigation({ pathname: '/products/create' });
    rerender(
      <ProductProvider initialVisibleCategories={[{ _id: 'cat-2', name: 'Visible' }]}>
        <ProductHarness />
      </ProductProvider>
    );

    await waitFor(() => expect(screen.getByTestId('categories')).toHaveTextContent('Form Category'));
    expect(fetch).toHaveBeenCalledWith('/api/categories?locale=bg');
    expect(fetch).toHaveBeenCalledTimes(1);

    setMockNavigation({ pathname: '/products/prod-1/delete' });
    rerender(
      <ProductProvider initialVisibleCategories={[{ _id: 'cat-2', name: 'Visible' }]}>
        <ProductHarness />
      </ProductProvider>
    );

    await waitFor(() => expect(screen.getByTestId('categories')).toHaveTextContent(''));
    expect(screen.getByTestId('visible-categories')).toHaveTextContent('Visible');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ProductProvider refreshes visible categories when locale changes beyond the server seed', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/bg/products' });
    fetch.mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-visible-en', name: 'English Visible' }] }));

    const { rerender } = render(
      <ProductProvider
        initialVisibleCategories={[{ _id: 'cat-visible-bg', name: 'BG Visible' }]}
        initialVisibleCategoriesLocale="bg"
      >
        <ProductHarness />
      </ProductProvider>
    );

    await waitFor(() => expect(screen.getByTestId('visible-categories')).toHaveTextContent('BG Visible'));
    expect(fetch).not.toHaveBeenCalled();
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/categories/visible'))).toBe(false);

    setMockNavigation({ pathname: '/en/products' });
    rerender(
      <ProductProvider
        initialVisibleCategories={[{ _id: 'cat-visible-bg', name: 'BG Visible' }]}
        initialVisibleCategoriesLocale="bg"
      >
        <ProductHarness />
      </ProductProvider>
    );

    await waitFor(() => expect(screen.getByTestId('visible-categories')).toHaveTextContent('English Visible'));
    expect(fetch).toHaveBeenCalledWith('/api/categories/visible?locale=en');

    rerender(
      <ProductProvider
        initialVisibleCategories={[{ _id: 'cat-visible-bg-2', name: 'Fresh BG Seed' }]}
        initialVisibleCategoriesLocale="bg"
      >
        <ProductHarness />
      </ProductProvider>
    );

    expect(screen.getByTestId('visible-categories')).toHaveTextContent('English Visible');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('ProductProvider recovers visible categories when the server seed failed', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-visible', name: 'Recovered Visible' }] }));

    render(
      <ProductProvider
        initialVisibleCategories={[]}
        initialVisibleCategoriesLoaded={false}
        initialVisibleCategoriesLocale="bg"
      >
        <ProductHarness />
      </ProductProvider>
    );

    await waitFor(() => expect(screen.getByTestId('visible-categories')).toHaveTextContent('Recovered Visible'));
    expect(fetch).toHaveBeenCalledWith('/api/categories/visible?locale=bg');
  });
});
