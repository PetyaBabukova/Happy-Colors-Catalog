import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test-utils.jsx';

vi.hoisted(() => {
  vi.stubEnv('RENDER_GIT_BRANCH', 'main');
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
  vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
  vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
});

import GiftsPage, { generateMetadata as generateGiftHubMetadata } from '@/app/gifts/page';
import GiftGuidePage, { generateMetadata as generateGiftGuideMetadata } from '@/app/gifts/[guideSlug]/page';

describe('Gifts pages', () => {
  beforeEach(() => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
  });

  it('renders the localized gift hub with shared English slugs', async () => {
    const element = await GiftsPage({ params: Promise.resolve({ locale: 'en' }) });

    const { container } = render(element, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Gift ideas' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Gift ideas' })).toHaveAttribute(
      'src',
      '/images/gifts/hero_gift_idea.webp'
    );
    expect(container.querySelector('img[src="/images/gifts/podaruci_za_deca.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/gifts/pletena_igrachka_podaruk.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/gifts/original_handmade_podaruk.webp"]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse catalog' })).toHaveAttribute(
      'href',
      '/en/products'
    );
    expect(screen.getByRole('link', { name: /Gifts for children/ })).toHaveAttribute(
      'href',
      '/en/gifts/gifts-for-children'
    );
    expect(screen.getByRole('link', { name: /Original handmade gift/ })).toHaveAttribute(
      'href',
      '/en/gifts/original-handmade-gift'
    );
    expect(screen.getAllByRole('link', { name: /View cartoons/ }).some((link) => (
      link.getAttribute('href') === '/en/cartoons'
    ))).toBe(true);
    expect(screen.getByRole('heading', { name: 'How to choose more easily' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Who is the gift for?' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3, name: /Catalog of available items|Personalized caricature from a photo|Questions about ordering and care|Enquiry for a specific occasion/ })).toHaveLength(4);
    expect(document.body.textContent).not.toMatch(/\/podaraci/);

    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent));

    expect(scripts.map((script) => script['@type'])).toEqual(['CollectionPage', 'BreadcrumbList']);
    expect(scripts[0]).toMatchObject({
      '@id': 'https://happycolors.eu/en/gifts#collection',
      url: 'https://happycolors.eu/en/gifts',
      inLanguage: 'en-US',
      mainEntity: {
        '@type': 'ItemList',
      },
    });
    expect(scripts[0].mainEntity.itemListElement).toHaveLength(3);
    expect(JSON.stringify(scripts)).not.toMatch(/localhost|preview|podaraci/i);
  });

  it('links the original handmade gift guide to cartoons', async () => {
    const element = await GiftGuidePage({
      params: Promise.resolve({ locale: 'en', guideSlug: 'original-handmade-gift' }),
    });

    const { container } = render(element, { locale: 'en' });

    expect(screen.getByRole('img', { name: 'Original handmade gift' })).toHaveAttribute(
      'src',
      '/images/gifts/original_handmade_gift_hero.webp'
    );
    expect(container.querySelector('img[src="/images/gifts/original_handmade_gift_koga_e_dobur.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/gifts/original_handmade_gift_kakvi_idei.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/gifts/original_handmade_gift_izbegnete_sluchaen_izbor.webp"]')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /View cartoons/ }).some((link) => (
      link.getAttribute('href') === '/en/cartoons'
    ))).toBe(true);
  });

  it('renders the crochet toy gift guide with its curated images', async () => {
    const element = await GiftGuidePage({
      params: Promise.resolve({ locale: 'en', guideSlug: 'handmade-crochet-toy-gift' }),
    });

    const { container } = render(element, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Handmade crochet toy as a gift' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Handmade crochet toy as a gift' })).toHaveAttribute(
      'src',
      '/images/gifts/crochet_toy_gift_hero.webp'
    );
    expect(container.querySelector('img[src="/images/gifts/crochet_toy_gift_zashto_raboti.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/gifts/crochet_toy_gift_kak_da_izberete_model.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/gifts/crochet_toy_gift_kakvo_da_utochnim.webp"]')).toBeInTheDocument();
  });

  it('generates localized gift hub metadata', async () => {
    const metadata = await generateGiftHubMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata.title).toBe('Gift ideas');
    expect(metadata.alternates.canonical).toBe('/en/gifts');
    expect(metadata.alternates.languages).toMatchObject({
      bg: '/bg/gifts',
      en: '/en/gifts',
      'x-default': '/bg/gifts',
    });
  });

  it('renders a gift guide with production-safe structured data and breadcrumbs', async () => {
    const element = await GiftGuidePage({
      params: Promise.resolve({ locale: 'en', guideSlug: 'gifts-for-children' }),
    });

    const { container } = render(element, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Gifts for children' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Gifts for children' })).toHaveAttribute(
      'src',
      '/images/gifts/gifts_for_children_hero.webp'
    );
    expect(container.querySelector('img[src="/images/gifts/gifts_for_children_vuzrast_izpolzvane.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/gifts/gifts_for_children_tema.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/images/gifts/gifts_for_children_srok.webp"]')).toBeInTheDocument();
    expect(screen.getByText('Encourage creativity')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View all gifts' })).toHaveAttribute('href', '/en/gifts');
    expect(screen.getByRole('heading', { name: 'How to choose a gift for a child' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Soft crochet toys' })).toHaveAttribute('href', '/en/products');
    expect(screen.getByRole('link', { name: 'Safety and care questions' })).toHaveAttribute('href', '/en/faq');
    expect(screen.getByRole('link', { name: 'Ask for a specific occasion' })).toHaveAttribute('href', '/en/contacts');
    expect(screen.getByRole('link', { name: /Browse catalog/ })).toHaveAttribute('href', '/en/products');
    expect(screen.getByRole('link', { name: /Send inquiry/ })).toHaveAttribute('href', '/en/contacts');

    const scripts = [...container.querySelectorAll('script[type="application/ld+json"]')]
      .map((script) => JSON.parse(script.textContent));

    expect(scripts.map((script) => script['@type'])).toEqual(['WebPage', 'BreadcrumbList']);
    expect(scripts[0]).not.toHaveProperty('mainEntity');
    expect(JSON.stringify(scripts)).toContain('https://happycolors.eu/en/gifts/gifts-for-children');
    expect(JSON.stringify(scripts)).not.toMatch(/localhost|preview|podaraci/i);
  });

  it('does not reuse legacy gift guide static params for localized dynamic routes', async () => {
    const localizedGiftGuideRoute = await import('@/app/(localized)/[locale]/gifts/[guideSlug]/page');

    expect(localizedGiftGuideRoute.generateStaticParams).toBeUndefined();
  });

  it('noindexes unknown gift guide slugs', async () => {
    const metadata = await generateGiftGuideMetadata({
      params: Promise.resolve({ locale: 'en', guideSlug: 'missing-guide' }),
    });

    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it('keeps gift pages noindex and without canonicals outside production', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SITE_ENV', 'preview');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happy-colors-preview.onrender.com');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');

    const { generateMetadata: generatePreviewGiftHubMetadata } = await import('@/app/gifts/page');
    const { generateMetadata: generatePreviewGiftGuideMetadata } = await import('@/app/gifts/[guideSlug]/page');

    await expect(
      generatePreviewGiftHubMetadata({ params: Promise.resolve({ locale: 'en' }) })
    ).resolves.toMatchObject({
      robots: {
        index: false,
        follow: false,
      },
    });
    await expect(
      generatePreviewGiftGuideMetadata({
        params: Promise.resolve({ locale: 'en', guideSlug: 'gifts-for-children' }),
      })
    ).resolves.toMatchObject({
      robots: {
        index: false,
        follow: false,
      },
    });

    const previewHubMetadata = await generatePreviewGiftHubMetadata({
      params: Promise.resolve({ locale: 'en' }),
    });
    const previewGuideMetadata = await generatePreviewGiftGuideMetadata({
      params: Promise.resolve({ locale: 'en', guideSlug: 'gifts-for-children' }),
    });

    expect(previewHubMetadata).not.toHaveProperty('alternates');
    expect(previewGuideMetadata).not.toHaveProperty('alternates');
  });
});
