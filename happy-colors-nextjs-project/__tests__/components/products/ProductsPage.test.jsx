import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProductsMock = vi.hoisted(() => vi.fn());
const getVisibleCategoriesMock = vi.hoisted(() => vi.fn());
const permanentRedirectMock = vi.hoisted(() =>
  vi.fn((href) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  })
);

vi.mock('@/managers/productsManager', () => ({
  getProducts: getProductsMock,
}));

vi.mock('@/managers/categoriesManager', () => ({
  getVisibleCategories: getVisibleCategoriesMock,
}));

vi.mock('next/navigation', () => ({
  permanentRedirect: permanentRedirectMock,
}));

vi.mock('@/app/products/Shop', () => ({
  default: () => <main data-testid="shop" />,
}));

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    getProductsMock.mockResolvedValue([]);
    getVisibleCategoriesMock.mockResolvedValue([
      {
        _id: 'cat-1',
        name: 'Приказни герои',
        filterSlug: 'prikazni-geroi',
      },
    ]);
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

    expect(metadata.title).toEqual({
      absolute: 'Ръчно плетени играчки, аксесоари и декорация за дома - каталог | Happy Colors',
    });
    expect(metadata.description).toBe(
      'Разгледайте ръчно плетени играчки на една кука, меки животинки, аксесоари, чанти и декорация за дома от Happy Colors.'
    );
    expect(metadata.alternates.canonical).toBe('/products');
  });

  it('redirects category display-name queries to the shared category slug', async () => {
    const { default: ProductsPage } = await import('@/app/products/page');

    await expect(
      ProductsPage({
        params: Promise.resolve({ locale: 'bg' }),
        searchParams: Promise.resolve({ category: 'Приказни герои' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/products?category=prikazni-geroi');

    expect(getVisibleCategoriesMock).toHaveBeenCalledWith({ locale: 'bg' });
    expect(permanentRedirectMock).toHaveBeenCalledWith('/products?category=prikazni-geroi');
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('keeps the locale prefix when redirecting localized category display-name queries', async () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    getVisibleCategoriesMock.mockResolvedValue([
      {
        _id: 'cat-1',
        name: 'Fairytale Characters',
        filterSlug: 'prikazni-geroi',
      },
    ]);
    const { default: ProductsPage } = await import('@/app/products/page');

    await expect(
      ProductsPage({
        params: Promise.resolve({ locale: 'en' }),
        searchParams: Promise.resolve({ category: 'Fairytale Characters' }),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/en/products?category=prikazni-geroi');

    expect(getVisibleCategoriesMock).toHaveBeenCalledWith({ locale: 'en' });
    expect(permanentRedirectMock).toHaveBeenCalledWith('/en/products?category=prikazni-geroi');
    expect(getProductsMock).not.toHaveBeenCalled();
  });

  it('keeps shared slug category queries on the products page', async () => {
    const { default: ProductsPage } = await import('@/app/products/page');

    await ProductsPage({
      params: Promise.resolve({ locale: 'bg' }),
      searchParams: Promise.resolve({ category: 'prikazni-geroi' }),
    });

    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getVisibleCategoriesMock).not.toHaveBeenCalled();
    expect(getProductsMock).toHaveBeenCalledWith('prikazni-geroi', { locale: 'bg' });
  });

  it('keeps unmatched display-name-like category queries on the products page', async () => {
    const { default: ProductsPage } = await import('@/app/products/page');

    await ProductsPage({
      params: Promise.resolve({ locale: 'bg' }),
      searchParams: Promise.resolve({ category: 'Няма такава категория' }),
    });

    expect(getVisibleCategoriesMock).toHaveBeenCalledWith({ locale: 'bg' });
    expect(permanentRedirectMock).not.toHaveBeenCalled();
    expect(getProductsMock).toHaveBeenCalledWith('Няма такава категория', { locale: 'bg' });
  });
});
