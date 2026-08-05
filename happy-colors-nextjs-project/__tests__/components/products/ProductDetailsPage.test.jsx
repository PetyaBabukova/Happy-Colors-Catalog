import { beforeEach, describe, expect, it, vi } from 'vitest';

const getProductMock = vi.hoisted(() => vi.fn());
const buildProductJsonLdMock = vi.hoisted(() => vi.fn(() => ({ '@type': 'Product' })));
const buildProductMetadataMock = vi.hoisted(() => vi.fn(() => ({ title: 'Product metadata' })));
const shouldRenderProductJsonLdMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('@/lib/getProduct', () => ({
  getProduct: getProductMock,
}));

vi.mock('@/app/products/[productId]/ProductDetails', () => ({
  default: vi.fn(() => <div data-testid="product-details" />),
}));

vi.mock('@/utils/productSeo', () => ({
  buildProductJsonLd: buildProductJsonLdMock,
  buildProductMetadata: buildProductMetadataMock,
  shouldRenderProductJsonLd: shouldRenderProductJsonLdMock,
  stringifyJsonLd: vi.fn(() => '{}'),
}));

describe('ProductDetailsPage locale wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProductMock.mockResolvedValue({ _id: 'product-1', title: 'Crochet Lion' });
    shouldRenderProductJsonLdMock.mockReturnValue(true);
  });

  it('threads locale through product detail fetches and SEO helpers', async () => {
    const { default: ProductDetailsPage, generateMetadata } = await import('@/app/products/[productId]/page');

    await expect(
      generateMetadata({ params: Promise.resolve({ productId: 'product-1', locale: 'en' }) })
    ).resolves.toEqual({ title: 'Product metadata' });

    expect(getProductMock).toHaveBeenCalledWith('product-1', { locale: 'en' });
    expect(buildProductMetadataMock).toHaveBeenCalledWith(
      { _id: 'product-1', title: 'Crochet Lion' },
      'product-1',
      'en'
    );

    getProductMock.mockClear();

    await ProductDetailsPage({
      params: Promise.resolve({ productId: 'product-1', locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(getProductMock).toHaveBeenCalledWith('product-1', { locale: 'en' });
    expect(shouldRenderProductJsonLdMock).toHaveBeenCalledWith(
      { _id: 'product-1', title: 'Crochet Lion' },
      'en'
    );
    expect(buildProductJsonLdMock).toHaveBeenCalledWith(
      { _id: 'product-1', title: 'Crochet Lion' },
      'en'
    );
  });

  it('omits product JSON-LD for English fallback product content', async () => {
    getProductMock.mockResolvedValue({
      _id: 'product-1',
      title: 'Bulgarian fallback',
      contentLocale: 'bg',
      translationPending: true,
    });
    shouldRenderProductJsonLdMock.mockReturnValue(false);
    const { default: ProductDetailsPage } = await import('@/app/products/[productId]/page');

    await ProductDetailsPage({
      params: Promise.resolve({ productId: 'product-1', locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(shouldRenderProductJsonLdMock).toHaveBeenCalledWith(
      {
        _id: 'product-1',
        title: 'Bulgarian fallback',
        contentLocale: 'bg',
        translationPending: true,
      },
      'en'
    );
    expect(buildProductJsonLdMock).not.toHaveBeenCalled();
  });

  it('generates localized noindex metadata when an English product is missing', async () => {
    getProductMock.mockResolvedValue(null);
    const { generateMetadata } = await import('@/app/products/[productId]/page');

    await expect(
      generateMetadata({ params: Promise.resolve({ productId: 'missing', locale: 'en' }) })
    ).resolves.toEqual({
      title: 'Product not found',
      description: 'Try again or choose another product.',
      robots: {
        index: false,
        follow: false,
      },
    });
  });
});
