import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CartProvider, useCart } from '@/context/CartContext';
import { ProductProvider, useProducts } from '@/context/ProductContext';
import { act, fireEvent, render, screen, waitFor } from '../test-utils.jsx';

function jsonResponse({ ok = true, status = 200, body = {} } = {}) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

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

  it('AuthProvider loads current user and supports explicit refresh', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: { _id: 'u1', email: 'petya@example.com' } }))
      .mockResolvedValueOnce(jsonResponse({ status: 401, ok: false, body: { message: 'unauthorized' } }));

    render(
      <AuthProvider>
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

  it('ProductProvider loads category sets and reloads them on demand', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-1', name: 'Candles' }] }))
      .mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-2', name: 'Visible' }] }))
      .mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-3', name: 'Decor' }] }))
      .mockResolvedValueOnce(jsonResponse({ body: [{ _id: 'cat-4', name: 'Visible Decor' }] }));

    render(
      <ProductProvider>
        <ProductHarness />
      </ProductProvider>
    );

    await waitFor(() => expect(screen.getByTestId('product-loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('categories')).toHaveTextContent('Candles');
    expect(screen.getByTestId('visible-categories')).toHaveTextContent('Visible');

    fireEvent.click(screen.getByText('reload'));

    await waitFor(() => expect(screen.getByTestId('categories')).toHaveTextContent('Decor'));
    expect(screen.getByTestId('visible-categories')).toHaveTextContent('Visible Decor');
  });
});
