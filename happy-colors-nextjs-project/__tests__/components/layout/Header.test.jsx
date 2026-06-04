import { beforeEach, describe, expect, it, vi } from 'vitest';
import Header from '@/components/header/header';
import { useProducts } from '@/context/ProductContext';
import { fetchAdminUsers } from '@/managers/usersAdminManager';
import { fireEvent, render, screen } from '../test-utils.jsx';

const catalogModeState = vi.hoisted(() => ({
  value: false,
}));

vi.mock('@/context/ProductContext', () => ({
  useProducts: vi.fn(),
}));

vi.mock('@/managers/usersAdminManager', () => ({
  fetchAdminUsers: vi.fn(),
}));

vi.mock('@/utils/catalogMode', () => ({
  get isCatalogMode() {
    return catalogModeState.value;
  },
}));

function getUserNavLinks(container) {
  return [...container.querySelectorAll('ul[class*="userNav"] a')].map((link) =>
    link.getAttribute('href')
  );
}

describe('Header', () => {
  beforeEach(() => {
    catalogModeState.value = false;
    useProducts.mockReturnValue({
      visibleCategories: [
        { _id: 'cat-1', name: 'Candles' },
        { _id: 'cat-2', name: 'Decor' },
      ],
    });
    fetchAdminUsers.mockResolvedValue([]);
  });

  it('renders category links, cart count, and full admin navigation', () => {
    const { container } = render(<Header />, {
      user: { username: 'Petya', role: 'full_admin', artistStatus: null },
      cartItems: [
        { _id: 'product-1', price: 10, quantity: 2 },
        { _id: 'product-2', price: 5, quantity: 1 },
      ],
    });

    expect(screen.getByRole('link', { name: /logo/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Candles' })).toHaveAttribute('href', '/products?category=Candles');
    expect(screen.getByRole('link', { name: 'Decor' })).toHaveAttribute('href', '/products?category=Decor');
    expect(screen.getByText(/Petya/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(container.querySelector('ul[class*="userNav"]').className).toContain('userNavVisible');
    expect(container.querySelector('header ul[class*="userNav"]')).toBeInTheDocument();
    expect(getUserNavLinks(container)).toEqual([
      '/products/create',
      '/home-banners/create',
      '/homepage-featured',
      '/blog/create',
      '/categories/create',
      '/categories',
      '/analytics',
      '/users/admin',
      '/newsletter/send',
    ]);
  });

  it('shows only product creation to artists and no management links to customers', () => {
    const artistRender = render(<Header />, {
      user: { username: 'Artist', role: 'artist', artistStatus: 'pending' },
    });

    expect(getUserNavLinks(artistRender.container)).toEqual(['/products/create']);

    artistRender.unmount();

    const customerRender = render(<Header />, {
      user: { username: 'Customer', role: 'customer', artistStatus: null },
    });

    expect(customerRender.container.querySelector('ul[class*="userNav"]')).not.toBeInTheDocument();
  });

  it('highlights the users admin link when products are waiting for review', async () => {
    fetchAdminUsers.mockResolvedValueOnce([
      { _id: 'user-1', pendingReviewCount: 2 },
      { _id: 'user-2', pendingReviewCount: 0 },
    ]);

    render(<Header />, {
      user: { username: 'Petya', role: 'full_admin', artistStatus: null },
    });

    const usersLink = await screen.findByRole('link', { name: 'Потребители' });
    expect(usersLink.className).toContain('pendingAdminLink');
  });

  it('hides product creation from suspended artists', () => {
    const suspendedRender = render(<Header />, {
      user: { username: 'Suspended', role: 'artist', artistStatus: 'suspended' },
    });

    expect(suspendedRender.container.querySelector('ul[class*="userNav"]')).not.toBeInTheDocument();
  });

  it('hides owner navigation and greeting for anonymous users', () => {
    const { container } = render(<Header />);

    expect(screen.queryByText(/Petya/)).not.toBeInTheDocument();
    expect(container.querySelector('ul[class*="userNav"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/products/create"]')).not.toBeInTheDocument();
    expect(container.querySelector('a[href="/newsletter/send"]')).not.toBeInTheDocument();
  });

  it('hides the cart link in catalog mode', () => {
    catalogModeState.value = true;

    render(<Header />, {
      cartItems: [{ _id: 'product-1', price: 10, quantity: 2 }],
    });

    expect(screen.queryByRole('link', { name: /cart/i })).not.toBeInTheDocument();
  });

  it('opens the mobile menu from the hamburger button', () => {
    const { container } = render(<Header />);
    const navList = container.querySelector('nav > ul');

    expect(navList.className).not.toContain('showMenu');

    fireEvent.click(container.querySelector('button[class*="hamburgerBtn"]'));

    expect(navList.className).toContain('showMenu');
  });

  it('closes the mobile menu from the close button', () => {
    const { container } = render(<Header />);
    const navList = container.querySelector('nav > ul');

    fireEvent.click(container.querySelector('button[class*="hamburgerBtn"]'));
    expect(navList.className).toContain('showMenu');

    fireEvent.click(screen.getByRole('button', { name: 'Затвори менюто' }));

    expect(navList.className).not.toContain('showMenu');
  });

  it('closes the mobile menu when a navigation link is clicked', () => {
    const { container } = render(<Header />);
    const navList = container.querySelector('nav > ul');

    fireEvent.click(container.querySelector('button[class*="hamburgerBtn"]'));
    expect(navList.className).toContain('showMenu');

    const catalogLink = container.querySelector('a[href="/products"]');
    catalogLink.addEventListener('click', (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(catalogLink);

    expect(navList.className).not.toContain('showMenu');
  });
});
