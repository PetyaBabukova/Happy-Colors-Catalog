import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test-utils.jsx';

vi.hoisted(() => {
  vi.stubEnv('RENDER_GIT_BRANCH', 'main');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
});

import HomePage, { generateMetadata } from '@/app/page';
import { generateMetadata as generateLocalizedMetadata } from '@/app/(localized)/[locale]/page';
import { getHomeBanners } from '@/managers/homeBannersManager';
import { getHomepageFeaturedProducts } from '@/managers/productsManager';

vi.mock('@/components/home-banners/HomeHeroCarousel', () => ({
  default: ({ banners }) => <div data-testid="home-hero" data-banner-count={banners.length} />,
}));

vi.mock('@/app/products/ProductCard', () => ({
  default: ({ product }) => <article>{product.title}</article>,
}));

vi.mock('@/managers/homeBannersManager', () => ({
  getHomeBanners: vi.fn(),
}));

vi.mock('@/managers/productsManager', () => ({
  getHomepageFeaturedProducts: vi.fn(),
}));

describe('HomePage', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders localized English intro and locale-aware links', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    getHomeBanners.mockResolvedValue([{ _id: 'banner-1' }]);
    getHomepageFeaturedProducts.mockResolvedValue([{ _id: 'product-1', title: 'Featured crochet toy' }]);

    const element = await HomePage({ params: Promise.resolve({ locale: 'en' }) });

    render(element, { locale: 'en' });

    expect(getHomeBanners).toHaveBeenCalledWith({ locale: 'en' });
    expect(getHomepageFeaturedProducts).toHaveBeenCalledWith({ locale: 'en' });
    expect(screen.getByTestId('home-hero')).toHaveAttribute('data-banner-count', '1');
    expect(
      screen.getByRole('heading', {
        name: 'Handmade crochet toys, accessories, and home decor',
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/At Happy Colors, you’ll find unique handmade gifts/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your favorite products' })).toBeInTheDocument();
    expect(screen.getByText('Featured crochet toy')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Gift ideas' })).toBeInTheDocument();
    expect(screen.getByText('Gifts for children image slot - 800 x 600 px')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gifts for children/ })).toHaveAttribute(
      'href',
      '/en/gifts/gifts-for-children'
    );
    expect(screen.getByRole('link', { name: /All gift ideas/ })).toHaveAttribute('href', '/en/gifts');
    expect(screen.getByRole('link', { name: /Frequently asked questions/ })).toHaveAttribute(
      'href',
      '/en/faq'
    );
  });

  it('generates English metadata for localized home routes', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata.title.absolute).toBe('Handmade Crochet Toys, Gifts & Home Decor | Happy Colors');
    expect(metadata.description).toMatch(/Unique handmade gifts/);
    expect(metadata.alternates.canonical).toBe('/en');
  });

  it('generates Bulgarian metadata for the default home route', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title.absolute).toBe('Ръчно изработени подаръци, плетени играчки и декорация | Happy Colors');
    expect(metadata.description).toBe(
      'Ръчно изработени подаръци от Happy Colors - плетени играчки, handmade изделия, аксесоари и декорация за дома с характер.'
    );
    expect(metadata.alternates.canonical).toBe('/');
  });

  it('re-exports metadata generation from the localized home wrapper', async () => {
    const metadata = await generateLocalizedMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata.title.absolute).toBe('Handmade Crochet Toys, Gifts & Home Decor | Happy Colors');
  });
});
