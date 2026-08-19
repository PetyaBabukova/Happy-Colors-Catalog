import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCartoonsOfferPageContent } from '@/content/publicPages/cartoons';
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
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not expose the offer page while the release gate is off', async () => {
    const { importPage } = setupCartoonsOfferPage({ enabled: false });
    const { default: CartoonsOfferPage } = await importPage();

    await expect(CartoonsOfferPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('uses localized noindex metadata while the release gate is off', async () => {
    const { importPage } = setupCartoonsOfferPage({ enabled: false });
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
    const { importPage } = setupCartoonsOfferPage({ enabled: false });
    const { generateMetadata } = await importPage();
    const content = getCartoonsOfferPageContent('bg');

    await expect(generateMetadata()).resolves.toMatchObject({
      title: content.unavailable.title,
      description: content.unavailable.description,
      robots: {
        index: false,
        follow: false,
      },
    });
  });

  it('renders the localized offer, logo, prices, timelines, and CTA links', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    const { importPage } = setupCartoonsOfferPage({ enabled: true });
    const { default: CartoonsOfferPage } = await importPage();

    const { container } = render(await CartoonsOfferPage({ params: Promise.resolve({ locale: 'en' }) }));

    expect(screen.getByRole('img', { name: 'Caricature Art Studio' })).toHaveAttribute('src', '/LOGO.webp');
    expect(container.querySelector('img[src="/Offer_page_hero_banner.webp"]')).toBeInTheDocument();
    expect(container.querySelector('source[media="(max-width: 640px)"]')).toHaveAttribute(
      'srcset',
      '/Offer_page_hero_banner_MOBILE.webp'
    );
    expect(screen.getByRole('img', { name: 'Handmade gift prepared in a studio' })).toHaveAttribute(
      'src',
      '/Offer_page__bdy_image.webp'
    );
    expect(screen.getByRole('heading', { name: 'Options and guide prices' })).toBeInTheDocument();
    expect(screen.getByText('from 39 €')).toBeInTheDocument();
    expect(screen.getByText('from 49 €')).toBeInTheDocument();
    expect(screen.getByText('up to 7 business days')).toBeInTheDocument();
    screen.getAllByRole('link', { name: 'Send inquiry and photos' }).forEach((link) => {
      expect(link).toHaveAttribute('href', '/en/contacts?service=cartoons');
    });
    expect(screen.getByRole('link', { name: 'contact form' })).toHaveAttribute('href', '/en/contacts');
    expect(screen.getByRole('link', { name: 'View gallery' })).toHaveAttribute('href', '/en/cartoons');

    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent));

    expect(scripts.map((script) => script['@type'])).toEqual(['Service', 'BreadcrumbList']);
    expect(scripts[0]).toMatchObject({
      '@id': 'https://happycolors.eu/en/cartoons/offer#service',
      url: 'https://happycolors.eu/en/cartoons/offer',
      provider: {
        '@id': 'https://happycolors.eu/#organization',
      },
      inLanguage: 'en-US',
    });
    expect(scripts[0]).not.toHaveProperty('offers');
    expect(scripts[1].itemListElement).toHaveLength(3);
    expect(JSON.stringify(scripts)).not.toMatch(/localhost|preview|onrender|vercel|netlify/i);
  });

  it('uses default-locale canonical metadata when no locale params are provided', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    const { importPage } = setupCartoonsOfferPage({ enabled: true });
    const { generateMetadata } = await importPage();
    const content = getCartoonsOfferPageContent('bg');

    await expect(generateMetadata()).resolves.toMatchObject({
      title: content.metadata.title,
      alternates: {
        canonical: '/cartoons/offer',
      },
    });
  });

  it('keeps default-locale links unprefixed when locale routing is off', async () => {
    const { importPage } = setupCartoonsOfferPage({ enabled: true });
    const { default: CartoonsOfferPage } = await importPage();

    const { container } = render(await CartoonsOfferPage());

    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Options and guide prices');
    expect(screen.getByRole('heading', { name: getCartoonsOfferPageContent('bg').hero.title })).toBeInTheDocument();
    expect(container.querySelectorAll('a[href="/contacts?service=cartoons"]')).toHaveLength(2);
    expect(container.querySelector('a[href="/contacts"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/cartoons"]')).toBeInTheDocument();
  });

  it('keeps English-route links unprefixed when locale routing is disabled', async () => {
    const { importPage } = setupCartoonsOfferPage({ enabled: true });
    const { default: CartoonsOfferPage } = await importPage();

    const { container } = render(await CartoonsOfferPage({ params: Promise.resolve({ locale: 'en' }) }));

    expect(screen.getByRole('heading', { name: 'Options and guide prices' })).toBeInTheDocument();
    expect(container.querySelectorAll('a[href="/contacts?service=cartoons"]')).toHaveLength(2);
    expect(container.querySelector('a[href="/contacts"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/cartoons"]')).toBeInTheDocument();
  });

  it('localizes offer CTA links and metadata on English routes', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    const { importPage } = setupCartoonsOfferPage({ enabled: true });
    const { default: CartoonsOfferPage, generateMetadata } = await importPage();

    await expect(generateMetadata({ params: Promise.resolve({ locale: 'en' }) })).resolves.toMatchObject({
      title: 'Options and guide prices',
      alternates: {
        canonical: '/en/cartoons/offer',
      },
    });

    const { container } = render(await CartoonsOfferPage({ params: Promise.resolve({ locale: 'en' }) }));

    expect(container.querySelectorAll('a[href="/en/contacts?service=cartoons"]')).toHaveLength(2);
    expect(container.querySelector('a[href="/en/contacts"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/en/cartoons"]')).toBeInTheDocument();
  });
});
