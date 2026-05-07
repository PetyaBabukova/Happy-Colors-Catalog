import { describe, expect, it, vi } from 'vitest';
import CartPage from '@/components/cart/CartPage';
import { fireEvent, render, screen } from '../test-utils.jsx';

describe('CartPage', () => {
  it('renders empty cart state with a link back to products', () => {
    render(<CartPage />, {
      cartItems: [],
    });

    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/products');
  });

  it('renders cart items, total price, checkout link, and clear action', () => {
    const clearCart = vi.fn();

    render(<CartPage />, {
      cartOverrides: {
        cartItems: [
          { _id: 'p1', title: 'Lavender Candle', price: 18, quantity: 2, image: '/candle.webp' },
          { _id: 'p2', title: 'Rose Soap', price: 9, quantity: 1, image: '/soap.webp' },
        ],
        clearCart,
      },
    });

    expect(screen.getByText('Lavender Candle')).toBeInTheDocument();
    expect(screen.getByText('Rose Soap')).toBeInTheDocument();
    expect(screen.getByText(/45\.00/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/checkout');

    fireEvent.click(screen.getByText(/Изчисти количката|РР·С‡РёСЃС‚Рё РєРѕР»РёС‡РєР°С‚Р°/));

    expect(clearCart).toHaveBeenCalled();
  });
});
