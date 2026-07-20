import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCartoonsPageContent } from '@/content/publicPages/cartoons';
import { render, screen } from '../test-utils.jsx';

function setupCartoonsPage({
  enabled = false,
  banners = [],
  galleryProducts = [],
} = {}) {
  vi.resetModules();

  const getCartoonHeroBanners = vi.fn().mockResolvedValue(banners);
  const getCartoonGalleryProducts = vi.fn().mockResolvedValue(galleryProducts);
  const carousel = vi.fn(({ banners: renderedBanners }) => (
    <div data-testid="cartoons-hero">{renderedBanners.length}</div>
  ));
  const productCard = vi.fn(({ product, serviceContext }) => (
    <a href={`/products/${product._id}${serviceContext === 'cartoons' ? '?service=cartoons' : ''}`}>
      {product.title}
    </a>
  ));

  vi.doMock('@/config/cartoonsFeature', () => ({
    CARTOONS_SERVICE_QUERY_VALUE: 'cartoons',
    isCartoonsServiceEnabled: enabled,
  }));
  vi.doMock('@/managers/homeBannersManager', () => ({
    getCartoonHeroBanners,
  }));
  vi.doMock('@/managers/productsManager', () => ({
    getCartoonGalleryProducts,
  }));
  vi.doMock('@/components/home-banners/CartoonsHeroCarousel', () => ({
    default: carousel,
  }));
  vi.doMock('@/app/products/ProductCard', () => ({
    default: productCard,
  }));

  return {
    getCartoonHeroBanners,
    getCartoonGalleryProducts,
    productCard,
    importPage: () => import('@/app/cartoons/page.jsx'),
  };
}

describe('CartoonsPage', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('@/config/cartoonsFeature');
    vi.doUnmock('@/managers/homeBannersManager');
    vi.doUnmock('@/managers/productsManager');
    vi.doUnmock('@/components/home-banners/CartoonsHeroCarousel');
    vi.doUnmock('@/app/products/ProductCard');
    vi.resetModules();
  });

  it('does not expose the draft page while the release gate is off', async () => {
    const { getCartoonHeroBanners, getCartoonGalleryProducts, importPage } = setupCartoonsPage({
      enabled: false,
    });
    const { default: CartoonsPage } = await importPage();

    await expect(CartoonsPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getCartoonHeroBanners).not.toHaveBeenCalled();
    expect(getCartoonGalleryProducts).not.toHaveBeenCalled();
  });

  it('uses localized noindex metadata while the release gate is off', async () => {
    const { importPage } = setupCartoonsPage({ enabled: false });
    const { generateMetadata } = await importPage();

    await expect(generateMetadata({ params: Promise.resolve({ locale: 'en' }) })).resolves.toMatchObject({
      title: 'Page not found',
      description: 'This page is not available.',
      robots: {
        index: false,
        follow: false,
      },
    });
  });

  it('uses default-locale noindex metadata while the release gate is off', async () => {
    const { importPage } = setupCartoonsPage({ enabled: false });
    const { generateMetadata } = await importPage();
    const content = getCartoonsPageContent('bg');

    await expect(generateMetadata()).resolves.toMatchObject({
      title: content.unavailable.title,
      description: content.unavailable.description,
      robots: {
        index: false,
        follow: false,
      },
    });
  });

  it('uses localized canonical metadata while threading locale to gallery reads', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');

    const { importPage, getCartoonHeroBanners, getCartoonGalleryProducts } = setupCartoonsPage({
      enabled: true,
    });
    const { default: CartoonsPage, generateMetadata } = await importPage();

    await expect(generateMetadata({ params: Promise.resolve({ locale: 'en' }) })).resolves.toMatchObject({
      title: 'Custom caricature from a photo for a memorable gift',
      alternates: {
        canonical: '/en/cartoons',
      },
    });
    await CartoonsPage({ params: Promise.resolve({ locale: 'en' }) });

    expect(getCartoonHeroBanners).toHaveBeenCalledWith({ locale: 'en' });
    expect(getCartoonGalleryProducts).toHaveBeenCalledWith({ locale: 'en' });
  });

  it('uses default-locale canonical metadata when no locale params are provided', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    const { importPage } = setupCartoonsPage({
      enabled: true,
    });
    const { generateMetadata } = await importPage();
    const content = getCartoonsPageContent('bg');

    await expect(generateMetadata()).resolves.toMatchObject({
      title: content.metadata.title,
      alternates: {
        canonical: '/cartoons',
      },
    });
  });

  it('renders localized hero, CTA, and service-context gallery when the release gate is on', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    const galleryProduct = { _id: 'product-1', title: 'Cartoon Sample' };
    const { importPage, productCard } = setupCartoonsPage({
      enabled: true,
      banners: [{ _id: 'banner-1', imageUrl: '/banner.webp' }],
      galleryProducts: [galleryProduct],
    });
    const { default: CartoonsPage } = await importPage();
    const element = await CartoonsPage({ params: Promise.resolve({ locale: 'en' }) });

    render(element);

    expect(screen.getByTestId('cartoons-hero')).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: 'Custom caricature from a photo for a memorable gift' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'options and prices' })).toHaveAttribute(
      'href',
      '/en/cartoons/offer'
    );
    expect(screen.getByRole('link', { name: 'contact form' })).toHaveAttribute(
      'href',
      '/en/contacts'
    );
    expect(screen.getByRole('link', { name: 'Send inquiry and photos' })).toHaveAttribute(
      'href',
      '/en/contacts?service=cartoons'
    );
    expect(productCard.mock.calls[0][0]).toMatchObject({
      product: galleryProduct,
      serviceContext: 'cartoons',
    });
    expect(screen.getByRole('link', { name: 'Cartoon Sample' })).toHaveAttribute(
      'href',
      '/products/product-1?service=cartoons'
    );
  });

  it('keeps default-locale links unprefixed when locale routing is off', async () => {
    const { importPage } = setupCartoonsPage({
      enabled: true,
      banners: [],
      galleryProducts: [],
    });
    const { default: CartoonsPage } = await importPage();

    const { container } = render(await CartoonsPage());

    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Custom caricature');
    expect(screen.getByRole('heading', { name: getCartoonsPageContent('bg').intro.title })).toBeInTheDocument();
    expect(container.querySelector('a[href="/cartoons/offer"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/contacts"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/contacts?service=cartoons"]')).toBeInTheDocument();
  });

  it('keeps English-route links unprefixed when locale routing is disabled', async () => {
    const { importPage } = setupCartoonsPage({
      enabled: true,
      banners: [],
      galleryProducts: [],
    });
    const { default: CartoonsPage } = await importPage();

    render(await CartoonsPage({ params: Promise.resolve({ locale: 'en' }) }));

    expect(screen.getByRole('heading', { name: 'Custom caricature from a photo for a memorable gift' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'options and prices' })).toHaveAttribute(
      'href',
      '/cartoons/offer'
    );
    expect(screen.getByRole('link', { name: 'contact form' })).toHaveAttribute(
      'href',
      '/contacts'
    );
    expect(screen.getByRole('link', { name: 'Send inquiry and photos' })).toHaveAttribute(
      'href',
      '/contacts?service=cartoons'
    );
  });

  it('renders the localized page without a gallery when no configured products load', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    const { importPage } = setupCartoonsPage({ enabled: true, galleryProducts: [] });
    const { default: CartoonsPage } = await importPage();
    const element = await CartoonsPage({ params: Promise.resolve({ locale: 'en' }) });

    render(element);

    expect(screen.getByRole('heading', { name: 'Custom caricature from a photo for a memorable gift' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Cartoon Sample' })).not.toBeInTheDocument();
  });
});
