import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test-utils.jsx';

function setupCartoonsOfferPage({ enabled = false } = {}) {
  vi.resetModules();

  vi.doMock('@/config/cartoonsFeature', () => ({
    CARTOONS_SERVICE_QUERY_VALUE: 'cartoons',
    isCartoonsServiceEnabled: enabled,
    isCartoonsServiceContext: (value) => value === 'cartoons',
  }));

  return {
    importPage: () => import('@/app/cartoons/offer/page.jsx'),
  };
}

describe('CartoonsOfferPage', () => {
  afterEach(() => {
    vi.doUnmock('@/config/cartoonsFeature');
    vi.resetModules();
  });

  it('does not expose the offer page while the release gate is off', async () => {
    const { importPage } = setupCartoonsOfferPage({ enabled: false });
    const { default: CartoonsOfferPage } = await importPage();

    expect(() => CartoonsOfferPage()).toThrow('NEXT_NOT_FOUND');
  });

  it('uses generic noindex metadata while the release gate is off', async () => {
    const { importPage } = setupCartoonsOfferPage({ enabled: false });
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

  it('renders the draft offer, logo, prices, timelines, and CTA links', async () => {
    const { importPage } = setupCartoonsOfferPage({ enabled: true });
    const { default: CartoonsOfferPage } = await importPage();

    const { container } = render(<CartoonsOfferPage />);

    expect(screen.getByRole('img', { name: 'Шарж Арт студио' })).toHaveAttribute('src', '/LOGO.webp');
    expect(container.querySelector('img[src="/Offer_page_hero_banner.webp"]')).toBeInTheDocument();
    expect(container.querySelector('source[media="(max-width: 640px)"]')).toHaveAttribute(
      'srcset',
      '/Offer_page_hero_banner_MOBILE.webp'
    );
    expect(screen.getByRole('img', { name: 'Ръчно изработен подарък в ателие' })).toHaveAttribute(
      'src',
      '/Offer_page__bdy_image.webp'
    );
    expect(screen.getByRole('heading', { name: 'Варианти и ориентировъчни цени' })).toBeInTheDocument();
    expect(screen.getByText('от 39 €')).toBeInTheDocument();
    expect(screen.getByText('от 49 €')).toBeInTheDocument();
    expect(screen.getByText('до 7 работни дни')).toBeInTheDocument();
    screen.getAllByRole('link', { name: 'Изпрати запитване и снимки' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/contacts?service=cartoons');
    });
    expect(screen.getByRole('link', { name: 'контактната форма.' })).toHaveAttribute('href', '/contacts');
    expect(screen.getByRole('link', { name: 'Виж галерията' })).toHaveAttribute('href', '/cartoons');
  });
});
