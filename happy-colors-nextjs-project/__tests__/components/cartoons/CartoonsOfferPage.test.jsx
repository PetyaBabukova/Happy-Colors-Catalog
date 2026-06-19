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

    render(<CartoonsOfferPage />);

    expect(screen.getByRole('img', { name: 'Шарж Арт студио' })).toHaveAttribute('src', '/LOGO.webp');
    expect(screen.getByRole('heading', { name: 'Условия и цени за персонален шарж' })).toBeInTheDocument();
    expect(screen.getByText('38 евро')).toBeInTheDocument();
    expect(screen.getByText('48 евро')).toBeInTheDocument();
    expect(screen.getByText('до 7 работни дни')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Изпрати запитване и снимки' })).toHaveAttribute(
      'href',
      '/contacts?service=cartoons'
    );
    expect(screen.getByRole('link', { name: 'контактна форма' })).toHaveAttribute('href', '/contacts');
    expect(screen.getByRole('link', { name: 'Виж галерията' })).toHaveAttribute('href', '/cartoons');
  });
});
