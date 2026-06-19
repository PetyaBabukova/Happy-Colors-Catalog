import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it('uses generic noindex metadata while the release gate is off', async () => {
    const { importPage } = setupCartoonsPage({ enabled: false });
    const { generateMetadata } = await importPage();

    expect(generateMetadata()).toMatchObject({
      title: 'Страницата не е намерена',
      description: 'Тази страница не е достъпна.',
      robots: {
        index: false,
        follow: false,
      },
    });
  });

  it('renders hero, CTA, and service-context gallery when the release gate is on', async () => {
    const galleryProduct = { _id: 'product-1', title: 'Cartoon Sample' };
    const { importPage, productCard } = setupCartoonsPage({
      enabled: true,
      banners: [{ _id: 'banner-1', imageUrl: '/banner.webp' }],
      galleryProducts: [galleryProduct],
    });
    const { default: CartoonsPage } = await importPage();
    const element = await CartoonsPage();

    render(element);

    expect(screen.getByTestId('cartoons-hero')).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: 'Шарж по снимка за подарък с усмивка' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'контактната форма' })).toHaveAttribute(
      'href',
      '/contacts'
    );
    expect(screen.getByRole('link', { name: 'Изпрати запитване и снимки' })).toHaveAttribute(
      'href',
      '/contacts?service=cartoons'
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

  it('renders the draft page without a gallery when no configured products load', async () => {
    const { importPage } = setupCartoonsPage({ enabled: true, galleryProducts: [] });
    const { default: CartoonsPage } = await importPage();
    const element = await CartoonsPage();

    render(element);

    expect(screen.getByRole('heading', { name: 'Шарж по снимка за подарък с усмивка' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Примери и варианти за шарж' })).not.toBeInTheDocument();
  });
});
