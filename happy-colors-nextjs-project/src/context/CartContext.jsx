'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export const CartContext = createContext();

// Уникален ключ за количката в localStorage
const CART_STORAGE_KEY = 'happycolors_cart_v2';

export function CartProvider({ children }) {
  // 👉 Четем от localStorage директно в useState (само веднъж, при инициализация)
  const [cartItems, setCartItems] = useState(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    try {
      const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);

      if (!storedCart) {
        return [];
      }

      const parsed = JSON.parse(storedCart);

      if (Array.isArray(parsed)) {
        return parsed;
      } else {
        console.warn('Stored cart is not an array, resetting');
        return [];
      }
    } catch (err) {
      console.error('Error reading cart from localStorage', err);
      return [];
    }
  });

  // 👉 Пишем в localStorage при всяка промяна на cartItems
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch (err) {
      console.error('Error saving cart to localStorage', err);
    }
  }, [cartItems]);

  // Добавяне към количката
  function addToCart(product) {
    setCartItems(prev => {
      const existing = prev.find(item => item._id === product._id);

      if (existing) {
        return prev.map(item =>
          item._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prev, { ...product, quantity: 1 }];
    });
  }

  // Премахване на артикул
  function removeFromCart(productId) {
    setCartItems(prev => prev.filter(item => item._id !== productId));
  }

  // Изчистване на количката
  function clearCart() {
    setCartItems([]);
  }

  // Общ брой артикули
  function getTotalItems() {
    return cartItems.reduce((sum, item) => sum + item.quantity, 0);
  }

  // Обща сума
  function getTotalPrice() {
    return cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }

    // Увеличаване на количество
  function increaseQuantity(productId) {
    setCartItems(prev =>
      prev.map(item =>
        item._id === productId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  }

  // Намаляване на количество
  function decreaseQuantity(productId) {
    setCartItems(prev =>
      prev
        .map(item =>
          item._id === productId
            ? { ...item, quantity: Math.max(0, item.quantity - 1) }
            : item
        )
        .filter(item => item.quantity > 0) // Ако стане 0 → махаме артикула
    );
  }


  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        clearCart,
        getTotalItems,
        getTotalPrice,
        decreaseQuantity,
        increaseQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
