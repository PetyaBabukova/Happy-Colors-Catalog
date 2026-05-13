import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { vi } from 'vitest';

import { AuthContext } from '@/context/AuthContext';
import { CartContext } from '@/context/CartContext';
import { setMockRouter } from './setup.js';

export * from '@testing-library/react';

export function render(
  ui,
  {
    user = null,
    cartItems = [],
    authOverrides = {},
    cartOverrides = {},
    routerOverrides = {},
    mockRouterPush = vi.fn(),
    ...renderOptions
  } = {}
) {
  const authValue = {
    user,
    loading: false,
    setUser: vi.fn(),
    refreshUser: vi.fn(),
    ...authOverrides,
  };

  const resolvedCartItems = cartOverrides.cartItems ?? cartItems;
  const cartValue = {
    cartItems: resolvedCartItems,
    addToCart: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
    increaseQuantity: vi.fn(),
    decreaseQuantity: vi.fn(),
    ...cartOverrides,
  };

  cartValue.getTotalItems ??= () => cartValue.cartItems.reduce((sum, item) => sum + item.quantity, 0);
  cartValue.getTotalPrice ??= () => cartValue.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  setMockRouter({
    push: mockRouterPush,
    ...routerOverrides,
  });

  function Wrapper({ children }) {
    return (
      <AuthContext.Provider value={authValue}>
        <CartContext.Provider value={cartValue}>{children}</CartContext.Provider>
      </AuthContext.Provider>
    );
  }

  return {
    ...rtlRender(ui, { wrapper: Wrapper, ...renderOptions }),
    authValue,
    cartValue,
    mockRouterPush,
  };
}
