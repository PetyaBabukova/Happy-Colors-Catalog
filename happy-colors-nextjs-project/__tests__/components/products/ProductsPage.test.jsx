import { describe, expect, it, vi } from 'vitest';

vi.mock('@/managers/productsManager', () => ({
  getProducts: vi.fn(),
}));

vi.mock('@/app/products/Shop', () => ({
  default: () => <main data-testid="shop" />,
}));

describe('ProductsPage metadata', () => {
  it('generates English catalog metadata for localized product listing routes', async () => {
    const { generateMetadata } = await import('@/app/products/page');
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata.title).toBe('Handmade Crochet Toys, Accessories, And Home Decor - Catalog');
    expect(metadata.description).toMatch(/Browse handmade crochet toys/);
    expect(metadata.alternates.canonical).toBe('/en/products');
  });
});
