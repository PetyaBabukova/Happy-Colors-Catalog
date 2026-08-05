import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '../test-utils.jsx';

import SearchPage, { generateMetadata } from '@/app/search/page';
import { generateMetadata as generateLocalizedMetadata } from '@/app/(localized)/[locale]/search/page';

vi.mock('@/app/products/Shop', () => ({
  default: ({ products, showTitle }) => (
    <section data-testid="shop" data-count={products.length} data-show-title={String(showTitle)} />
  ),
}));

describe('SearchPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates English noindex metadata for localized search routes', async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata.title).toBe('Search');
    expect(metadata.description).toBe('Search results from Happy Colors.');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('generates Bulgarian noindex metadata for the default search route', async () => {
    const metadata = await generateMetadata();

    expect(metadata.title).toBe('Търсене');
    expect(metadata.description).toBe('Резултати от търсене в Happy Colors (Хепи Колорс).');
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('re-exports metadata generation from the localized search wrapper', async () => {
    const metadata = await generateLocalizedMetadata({ params: Promise.resolve({ locale: 'en' }) });

    expect(metadata.title).toBe('Search');
  });

  it('renders an English heading and threads locale to the search backend', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue([{ _id: 'product-1' }]),
    });
    vi.stubGlobal('fetch', fetchMock);

    const element = await SearchPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ q: 'lion' }),
    });

    render(element, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Search results for: lion' })).toBeInTheDocument();
    expect(screen.getByTestId('shop')).toHaveAttribute('data-count', '1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/search?q=lion&locale=en');
  });

  it('does not call search when the query is empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const element = await SearchPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ q: '   ' }),
    });

    render(element, { locale: 'en' });

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(screen.getByTestId('shop')).toHaveAttribute('data-count', '0');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
