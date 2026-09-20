import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProductsMock = vi.hoisted(() => vi.fn());
const getVisibleCategoryRedirectCandidatesSeedMock = vi.hoisted(() => vi.fn());
const ShopMock = vi.hoisted(() => vi.fn(() => <main data-testid="shop" />));
const permanentRedirectMock = vi.hoisted(() =>
  vi.fn((href) => {
    throw new Error(`NEXT_PERMANENT_REDIRECT:${href}`);
  })
);
const redirectMock = vi.hoisted(() =>
  vi.fn((href) => {
    throw new Error(`NEXT_TEMPORARY_REDIRECT:${href}`);
  })
);

vi.mock('@/managers/productsManager', () => ({
  getProducts: getProductsMock,
}));

vi.mock('@/managers/categoriesManager', () => ({
  getVisibleCategoryRedirectCandidatesSeed: getVisibleCategoryRedirectCandidatesSeedMock,
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: permanentRedirectMock,
  redirect: redirectMock,
}));

vi.mock('@/app/products/Shop', () => ({
  default: ShopMock,
}));

function category(overrides = {}) {
  return {
    _id: 'cat-1',
    name: 'Fairytale Characters',
    filterSlug: 'fairytale-characters',
    slug: 'prikazni-geroi',
    canonicalSlug: 'fairytale-characters',
    canonicalSlugReviewed: true,
    slugAliases: ['old-fairytale-characters'],
    displayNames: {
      bg: 'Prikazni geroi',
      en: 'Fairytale Characters',
    },
    ...overrides,
  };
}

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    getProductsMock.mockResolvedValue([]);
    getVisibleCategoryRedirectCandidatesSeedMock.mockResolvedValue({
      categories: [category()],
      loaded: true,
    });
  });

  it('generates English catalog metadata for localized product listing routes', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');

    const { generateMetadata } = await import('@/app/products/page');
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata.title).toEqual({
      absolute: 'Handmade Crochet Toys, Bags & Home Decor - Catalog | Happy Colors',
    });
    expect(metadata.description).toMatch(/soft crochet animals/);
    expect(metadata.alternates.canonical).toBe('/en/products');
  });

  it('generates Bulgarian catalog metadata for the default product listing route', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');

    const { generateMetadata } = await import('@/app/products/page');
    const metadata = await generateMetadata();

    expect(metadata.title.absolute).toContain('Happy Colors');
    expect(metadata.description).toContain('Happy Colors');
    expect(metadata.alternates.canonical).toBe('/products');
  });

  it('generates clean self-canonical category metadata for eligible category queries', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    getVisibleCategoryRedirectCandidatesSeedMock.mockResolvedValue({
      categories: [category({ eligibleLocales: ['bg', 'en'] })],
      loaded: true,
    });

    const { generateMetadata } = await import('@/app/products/page');
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'bg' }),
      searchParams: Promise.resolve({
        category: 'fairytale-characters',
        utm_source: 'newsletter',
        foo: 'ignored',
      }),
    });

    expect(metadata.title).toEqual({
      absolute: 'Плетени приказни герои и ръчно плетени кукли | Happy Colors',
    });
    expect(metadata.description).toBe(
      'Открийте плетени приказни герои и ръчно плетени кукли от Happy Colors – ръчно изработени играчки, създадени с внимание към всеки детайл.'
    );
    expect(metadata.alternates).toEqual({
      canonical: '/bg/products?category=fairytale-characters',
      languages: {
        bg: '/bg/products?category=fairytale-characters',
        en: '/en/products?category=fairytale-characters',
        'x-default': '/bg/products?category=fairytale-characters',
      },
    });
    expect(metadata.openGraph).toMatchObject({
      url: '/bg/products?category=fairytale-characters',
      locale: 'bg_BG',
      alternateLocale: ['en_US'],
    });
    expect(metadata).not.toHaveProperty('keywords');
  });

  it('generates clean default-route category metadata when locale routing is disabled', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'false');
    getVisibleCategoryRedirectCandidatesSeedMock.mockResolvedValue({
      categories: [category({ eligibleLocales: ['bg'] })],
      loaded: true,
    });

    const { generateMetadata } = await import('@/app/products/page');
    const metadata = await generateMetadata({
      searchParams: Promise.resolve({ category: 'fairytale-characters' }),
    });

    expect(metadata.title).toEqual({
      absolute: 'Плетени приказни герои и ръчно плетени кукли | Happy Colors',
    });
    expect(metadata.alternates).toEqual({
      canonical: '/products?category=fairytale-characters',
      languages: {
        bg: '/products?category=fairytale-characters',
        'x-default': '/products?category=fairytale-characters',
      },
    });
    expect(metadata.openGraph.url).toBe('/products?category=fairytale-characters');
    expect(metadata).not.toHaveProperty('keywords');
  });

  it('omits ineligible locale alternates from category metadata', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    getVisibleCategoryRedirectCandidatesSeedMock.mockResolvedValue({
      categories: [category({ eligibleLocales: ['bg'] })],
      loaded: true,
    });

    const { generateMetadata } = await import('@/app/products/page');
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'bg' }),
      searchParams: Promise.resolve({ category: 'fairytale-characters' }),
    });

    expect(metadata.alternates.languages).toEqual({
      bg: '/bg/products?category=fairytale-characters',
      'x-default': '/bg/products?category=fairytale-characters',
    });
    expect(metadata.openGraph).not.toHaveProperty('alternateLocale');
  });

  it('uses generic catalog metadata for category queries that will redirect', async () => {
    vi.stubEnv('RENDER_GIT_BRANCH', 'main');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://happycolors.eu/');
    getVisibleCategoryRedirectCandidatesSeedMock.mockResolvedValue({
      categories: [category()],
      loaded: true,
    });

    const { generateMetadata } = await import('@/app/products/page');
    const metadata = await generateMetadata({
      params: Promise.resolve({ locale: 'bg' }),
      searchParams: Promise.resolve({ category: 'old-fairytale-characters' }),
    });

    expect(metadata.title.absolute).not.toBe('Fairytale Characters | Happy Colors');
    expect(metadata.alternates.canonical).toBe('/products');
  });

  it('temporarily redirects category display-name queries to the shared English slug', async () => {
    const { default: ProductsPage } = await import('@/app/products/page');

    await expect(
      ProductsPage({
        params: Promise.resolve({ locale: 'bg' }),
        searchParams: Promise.resolve({ category: 'Prikazni geroi' }),
      })
    ).rejects.toThrow('NEXT_TEMPORARY_REDIRECT:/products?category=fairytale-characters');

    expect(getVisibleCategoryRedirectCandidatesSeedMock).toHaveBeenCalledWith({ locale: 'bg' });
    expect(redirectMock).toHaveBeenCalledWith('/products?category=fairytale-characters');
    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('keeps the locale prefix when redirecting localized category display-name queries', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    const { default: ProductsPage } = await import('@/app/products/page');

    await expect(
      ProductsPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ category: 'Fairytale Characters' }),
      })
    ).rejects.toThrow('NEXT_TEMPORARY_REDIRECT:/en/products?category=fairytale-characters');

    expect(getVisibleCategoryRedirectCandidatesSeedMock).toHaveBeenCalledWith({ locale: 'en' });
    expect(redirectMock).toHaveBeenCalledWith('/en/products?category=fairytale-characters');
    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('keeps shared English slug category queries on the products page', async () => {
    const { default: ProductsPage } = await import('@/app/products/page');

    const page = await ProductsPage({
      params: Promise.resolve({ locale: 'bg' }),
      searchParams: Promise.resolve({ category: 'fairytale-characters' }),
    });

    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(getVisibleCategoryRedirectCandidatesSeedMock).toHaveBeenCalledWith({ locale: 'bg' });
    expect(getProductsMock).toHaveBeenCalledWith('fairytale-characters', { locale: 'bg' });
    expect(page.props.pageContent).toEqual({ heading: 'Плетени приказни герои' });
  });

  it('temporarily redirects unmatched category queries to the current locale generic catalog', async () => {
    const { default: ProductsPage } = await import('@/app/products/page');

    await expect(
      ProductsPage({
        params: Promise.resolve({ locale: 'bg' }),
        searchParams: Promise.resolve({ category: 'missing-category' }),
      })
    ).rejects.toThrow('NEXT_TEMPORARY_REDIRECT:/products');

    expect(getVisibleCategoryRedirectCandidatesSeedMock).toHaveBeenCalledWith({ locale: 'bg' });
    expect(redirectMock).toHaveBeenCalledWith('/products');
    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('uses a permanent redirect for clean stored category aliases', async () => {
    const { default: ProductsPage } = await import('@/app/products/page');

    await expect(
      ProductsPage({
        params: Promise.resolve({ locale: 'bg' }),
        searchParams: Promise.resolve({ category: 'old-fairytale-characters' }),
      })
    ).rejects.toThrow('NEXT_PERMANENT_REDIRECT:/products?category=fairytale-characters');

    expect(permanentRedirectMock).toHaveBeenCalledWith('/products?category=fairytale-characters');
    expect(redirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('uses one temporary alias redirect when tracking params need preservation', async () => {
    const { default: ProductsPage } = await import('@/app/products/page');

    await expect(
      ProductsPage({
        params: Promise.resolve({ locale: 'bg' }),
        searchParams: Promise.resolve({
          category: 'old-fairytale-characters',
          utm_source: 'newsletter',
          foo: 'drop-me',
        }),
      })
    ).rejects.toThrow(
      'NEXT_TEMPORARY_REDIRECT:/products?category=fairytale-characters&utm_source=newsletter'
    );

    expect(redirectMock).toHaveBeenCalledWith(
      '/products?category=fairytale-characters&utm_source=newsletter'
    );
    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('temporarily redirects duplicate category params to the current locale generic catalog', async () => {
    const { default: ProductsPage } = await import('@/app/products/page');

    await expect(
      ProductsPage({
        params: Promise.resolve({ locale: 'bg' }),
        searchParams: Promise.resolve({
          category: ['fairytale-characters', 'crochet-animals'],
          utm_source: 'paid',
        }),
      })
    ).rejects.toThrow('NEXT_TEMPORARY_REDIRECT:/products?utm_source=paid');

    expect(redirectMock).toHaveBeenCalledWith('/products?utm_source=paid');
    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('renders browsable unreviewed current category slugs without category SEO content', async () => {
    getVisibleCategoryRedirectCandidatesSeedMock.mockResolvedValue({
      categories: [
        category({
          name: 'Unreviewed',
          filterSlug: 'unreviewed-category',
          slug: 'unreviewed-category',
          canonicalSlug: 'unreviewed-category',
          canonicalSlugReviewed: false,
          slugAliases: ['old-unreviewed-category'],
          displayNames: { bg: 'Unreviewed', en: '' },
        }),
      ],
      loaded: true,
    });
    const { default: ProductsPage } = await import('@/app/products/page');

    const page = await ProductsPage({
      params: Promise.resolve({ locale: 'bg' }),
      searchParams: Promise.resolve({ category: 'unreviewed-category' }),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).toHaveBeenCalledWith('unreviewed-category', { locale: 'bg' });
    expect(page.props.pageContent).toBeNull();
  });

  it('keeps the locale prefix when redirecting English fallback categories to the generic catalog', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    getVisibleCategoryRedirectCandidatesSeedMock.mockResolvedValue({
      categories: [
        category({
          contentLocale: 'bg',
          translationPending: true,
        }),
      ],
      loaded: true,
    });
    const { default: ProductsPage } = await import('@/app/products/page');

    await expect(
      ProductsPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ category: 'fairytale-characters' }),
      })
    ).rejects.toThrow('NEXT_TEMPORARY_REDIRECT:/en/products');

    expect(redirectMock).toHaveBeenCalledWith('/en/products');
    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('renders through the products fetch when redirect candidates fail to load', async () => {
    getVisibleCategoryRedirectCandidatesSeedMock.mockResolvedValue({
      categories: [],
      loaded: false,
    });
    const { default: ProductsPage } = await import('@/app/products/page');

    await ProductsPage({
      params: Promise.resolve({ locale: 'bg' }),
      searchParams: Promise.resolve({ category: 'fairytale-characters' }),
    });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).toHaveBeenCalledWith('fairytale-characters', { locale: 'bg' });
  });
});
