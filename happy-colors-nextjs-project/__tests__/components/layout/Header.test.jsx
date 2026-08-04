import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Header from '@/components/header/header';
import { useProducts } from '@/context/ProductContext';
import { LOCALE_COOKIE_NAME } from '@/i18n/config';
import { getDictionary } from '@/i18n/getDictionary';
import { fetchAdminUsers } from '@/managers/usersAdminManager';
import { fireEvent, render, screen } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

const catalogModeState = vi.hoisted(() => ({
  value: false,
}));
const cartoonsFeatureState = vi.hoisted(() => ({
  enabled: false,
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

vi.mock('@/config/cartoonsFeature', () => ({
  get isCartoonsServiceEnabled() {
    return cartoonsFeatureState.enabled;
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
    cartoonsFeatureState.enabled = false;
    useProducts.mockReturnValue({
      visibleCategories: [
        { _id: 'cat-1', name: 'Candles', filterSlug: 'candles' },
        { _id: 'cat-2', name: 'Decor', filterSlug: 'decor' },
      ],
    });
    fetchAdminUsers.mockResolvedValue([]);
  });

  afterEach(() => {
    document.cookie = `${LOCALE_COOKIE_NAME}=; Path=/; Max-Age=0`;
    vi.unstubAllEnvs();
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
    expect(screen.getByRole('link', { name: 'Candles' })).toHaveAttribute('href', '/products?category=candles');
    expect(screen.getByRole('link', { name: 'Decor' })).toHaveAttribute('href', '/products?category=decor');
    expect(screen.getByText(/Petya/)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(container.querySelector('ul[class*="userNav"]').className).toContain('userNavVisible');
    expect(container.querySelector('header ul[class*="userNav"]')).toBeInTheDocument();
    expect(getUserNavLinks(container)).toEqual([
      '/products/create',
      '/translations',
      '/homepage-featured',
      '/categories/create',
      '/categories',
      '/home-banners/create',
      '/cartoon-orders',
      '/blog/create',
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

  it('hides the cartoons public link until the release gate is enabled', () => {
    const hiddenRender = render(<Header />);

    expect(hiddenRender.container.querySelector('a[href="/cartoons"]')).not.toBeInTheDocument();

    hiddenRender.unmount();
    cartoonsFeatureState.enabled = true;

    render(<Header />);

    expect(screen.getByRole('link', { name: 'Шаржове' })).toHaveAttribute('href', '/cartoons');
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

  it('renders locale switch links when English public routing is enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({
      pathname: '/bg/products',
      searchParams: new URLSearchParams('category=Toys&utm_source=drop'),
    });

    render(<Header />);

    expect(screen.getByLabelText('Език: BG')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'BG — Български' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('link', { name: 'EN — English' })).toHaveAttribute(
      'href',
      '/en/products?category=Toys'
    );

    const englishLocaleLink = screen.getByRole('link', { name: /^EN/ });
    englishLocaleLink.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(englishLocaleLink);
    expect(document.cookie).toContain(`${LOCALE_COOKIE_NAME}=en`);
  });

  it('does not render the locale switcher until two public locales are enabled', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'false');
    setMockNavigation({ pathname: '/bg/products' });

    render(<Header />);

    expect(screen.queryByLabelText('Език: BG')).not.toBeInTheDocument();
  });

  it('does not render the locale switcher when locale routing is disabled', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'false');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/products' });

    render(<Header />);

    expect(screen.queryByLabelText('Език: BG')).not.toBeInTheDocument();
  });

  it('strips token query params from header locale switch links', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({
      pathname: '/bg/newsletter/unsubscribe',
      searchParams: new URLSearchParams('token=secret-token&utm_source=drop'),
    });

    render(<Header />);

    expect(screen.getByRole('link', { name: 'EN — English' })).toHaveAttribute(
      'href',
      '/en/newsletter/unsubscribe'
    );
  });

  it('renders Bulgarian navigation on Bulgarian routes even after an English client context', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/bg' });

    render(<Header />, { locale: 'en' });

    expect(screen.getByRole('link', { name: getDictionary('bg').navigation.home })).toHaveAttribute('href', '/bg');
    expect(screen.getByRole('link', { name: getDictionary('bg').navigation.catalog })).toHaveAttribute(
      'href',
      '/bg/products'
    );
    expect(screen.queryByRole('link', { name: getDictionary('en').navigation.home })).not.toBeInTheDocument();
  });

  it('renders English navigation on English routes even after a Bulgarian client context', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en' });

    render(<Header />);

    expect(screen.getByRole('link', { name: getDictionary('en').navigation.home })).toHaveAttribute('href', '/en');
    expect(screen.getByRole('link', { name: getDictionary('en').navigation.catalog })).toHaveAttribute(
      'href',
      '/en/products'
    );
    expect(screen.queryByRole('link', { name: getDictionary('bg').navigation.home })).not.toBeInTheDocument();
  });

  it('marks a Bulgarian category fallback in the English navigation', () => {
    useProducts.mockReturnValue({
      visibleCategories: [
        {
          _id: 'cat-bg',
          name: 'Приказни герои',
          filterSlug: 'prikazni-geroi',
          contentLocale: 'bg',
          translationPending: true,
        },
      ],
    });

    render(<Header />, { locale: 'en' });

    const categoryLink = screen.getByRole('link', {
      name: 'Приказни герои Translation pending',
    });

    expect(categoryLink).toHaveAttribute('href', '/products?category=prikazni-geroi');
    expect(categoryLink.querySelector('[lang="bg"]')).toHaveTextContent('Приказни герои');
  });
});
