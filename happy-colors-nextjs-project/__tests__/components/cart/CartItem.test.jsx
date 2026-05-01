import { describe, expect, it, vi } from 'vitest';

import CartItem from '@/components/cart/CartItem';
import { fireEvent, render, screen } from '../test-utils.jsx';

const item = {
  _id: 'product-1',
  image: '/images/candle.webp',
  title: 'Lavender Candle',
  price: 12.5,
  quantity: 2,
};

describe('CartItem', () => {
  it('renders product details and totals', () => {
    render(<CartItem item={item} />);

    expect(screen.getByRole('img', { name: 'Lavender Candle' })).toHaveAttribute('src', '/images/candle.webp');
    expect(screen.getByRole('heading', { name: 'Lavender Candle' })).toBeInTheDocument();
    expect(screen.getByText(/12\.50/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/25\.00/)).toBeInTheDocument();
  });

  it('calls cart quantity handlers with the item id', () => {
    const decreaseQuantity = vi.fn();
    const increaseQuantity = vi.fn();
    render(<CartItem item={item} />, {
      cartOverrides: {
        decreaseQuantity,
        increaseQuantity,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Намали количество' }));
    fireEvent.click(screen.getByRole('button', { name: 'Увеличи количество' }));

    expect(decreaseQuantity).toHaveBeenCalledWith('product-1');
    expect(increaseQuantity).toHaveBeenCalledWith('product-1');
  });

  it('calls removeFromCart when the remove button is clicked', () => {
    const removeFromCart = vi.fn();
    render(<CartItem item={item} />, {
      cartOverrides: {
        removeFromCart,
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Премахни' }));

    expect(removeFromCart).toHaveBeenCalledWith('product-1');
  });
});
