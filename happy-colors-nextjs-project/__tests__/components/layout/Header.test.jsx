import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from '@/components/header/header';
import { useProducts } from '@/context/ProductContext';
import { fireEvent, render, screen } from '../test-utils.jsx';

const catalogModeState = vi.hoisted(() => ({
  value: false,
}));

vi.mock('@/context/ProductContext', () => ({
  useProducts: vi.fn(),
}));

vi.mock('@/utils/catalogMode', () => ({
  get isCatalogMode() {
    return catalogModeState.value;
  },
}));

describe('Header', () => {
  beforeEach(() => {
    catalogModeState.value = false;
    useProducts.mockReturnValue({
      visibleCategories: [
        { _id: 'cat-1', name: 'Candles' },
        { _id: 'cat-2', name: 'Декор' },
      ],
    });
  });

  it('renders category links, cart count, and owner navigation for authenticated users', () => {
    const { container } = render(<Header />, {
      user: { username: 'Petya' },
      cartItems: [
        { _id: 'product-1', price: 10, quantity: 2 },
        { _id: 'product-2', price: 5, quantity: 1 },
      ],
    });

    expect(screen.getByRole('link', { name: /logo/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Candles' })).toHaveAttribute('href', '/products?category=Candles');
    expect(screen.getByRole('link', { name: 'Декор' })).toHaveAttribute(
      'href',
      `/products?category=${encodeURIComponent('Декор')}`
    );
    expect(screen.getByText(/Petya/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(container.querySelector('ul[class*="userNav"]').className).toContain('userNavVisible');
    expect(screen.getByRole('link', { name: /Създай продукт/ })).toHaveAttribute(
      'href',
      '/products/create'
    );
    expect(screen.getByRole('link', { name: 'Блог' })).toHaveAttribute('href', '/blog');
    expect(screen.getByRole('link', { name: 'Създай хоум банер' })).toHaveAttribute(
      'href',
      '/home-banners/create'
    );
    expect(screen.getByRole('link', { name: 'Избери любими продукти' })).toHaveAttribute(
      'href',
      '/homepage-featured'
    );
    expect(screen.getByRole('link', { name: 'Създай блог статия' })).toHaveAttribute(
      'href',
      '/blog/create'
    );
    expect(screen.getByRole('link', { name: 'Изпрати къстъм мейл до абонатите' })).toHaveAttribute(
      'href',
      '/newsletter/send'
    );
  });

  it('hides owner navigation and greeting for anonymous users', () => {
    const { container } = render(<Header />);

    expect(screen.queryByText(/Petya/)).not.toBeInTheDocument();
    expect(container.querySelector('ul[class*="userNav"]')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /РЎСЉР·РґР°Р№ РїСЂРѕРґСѓРєС‚/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /РР·РїСЂР°С‚Рё РєСЉСЃС‚СЉРј РјРµР№Р»/ })).not.toBeInTheDocument();
  });

  it('hides the cart link in catalog mode', () => {
    catalogModeState.value = true;

    render(<Header />, {
      cartItems: [{ _id: 'product-1', price: 10, quantity: 2 }],
    });

    expect(screen.queryByRole('link', { name: /Количка/ })).not.toBeInTheDocument();
  });

  it('opens the mobile menu from the hamburger button', () => {
    const { container } = render(<Header />);
    const navList = container.querySelector('nav > ul');

    expect(navList.className).not.toContain('showMenu');

    fireEvent.click(screen.getByRole('button', { name: /Отвори/ }));

    expect(navList.className).toContain('showMenu');
  });
});
