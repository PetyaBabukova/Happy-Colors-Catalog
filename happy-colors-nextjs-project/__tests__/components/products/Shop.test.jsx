import { describe, expect, it, vi } from 'vitest';
import Shop from '@/app/products/Shop';
import { render, screen, within } from '../test-utils.jsx';

vi.mock('@/app/products/ProductCard', () => ({
  default: ({ product }) => <article data-testid={`product-${product._id}`}>{product.title}</article>,
}));

function product(_id, title, categoryName, availability = 'available', categoryOverrides = {}) {
  return {
    _id,
    title,
    availability,
    category: categoryName ? { name: categoryName, ...categoryOverrides } : null,
  };
}

describe('Shop', () => {
  it('renders no category sections for an empty product list', () => {
    render(<Shop products={[]} />);

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Ръчно изработени плетени изделия – играчки, чанти и декорация',
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/В Happy Colors може да намерите/)).toBeInTheDocument();
    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.queryAllByTestId(/product-/)).toHaveLength(0);
  });

  it('can hide the catalog title when embedded in search results', () => {
    render(<Shop products={[]} showTitle={false} />);

    expect(
      screen.queryByRole('heading', {
        level: 1,
        name: 'Ръчно изработени плетени изделия – играчки, чанти и декорация',
      })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/В Happy Colors може да намерите/)).not.toBeInTheDocument();
  });

  it('renders a single category page H1 without the generic catalog intro', () => {
    render(
      <Shop
        products={[]}
        pageContent={{ heading: 'Плетени приказни герои' }}
      />
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Плетени приказни герои' })).toBeInTheDocument();
    expect(screen.queryByText(/В Happy Colors може да намерите/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('groups products by category and puts unavailable products last within each group', () => {
    render(
      <Shop
        products={[
          product('toy-unavailable', 'Sold Toy', 'Toys', 'unavailable'),
          product('candle', 'Lavender Candle', 'Candles'),
          product('toy-available', 'Happy Toy', 'Toys'),
        ]}
      />
    );

    const toys = screen.getByRole('heading', { name: 'Toys' }).closest('article');
    const toyCards = within(toys).getAllByTestId(/product-/).map((node) => node.textContent);

    expect(screen.getByRole('heading', { name: 'Candles' })).toBeInTheDocument();
    expect(toyCards).toEqual(['Happy Toy', 'Sold Toy']);
  });

  it('renders products without category under the fallback category', () => {
    render(<Shop products={[product('uncategorized', 'Mystery Item', null)]} />);

    expect(screen.getByText('Mystery Item')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Без категория/ })).toBeInTheDocument();
  });

  it('moves the miscellaneous category to the end', () => {
    render(
      <Shop
        products={[
          product('other', 'Other Item', 'Други'),
          product('aaa', 'A Item', 'Aardvark'),
        ]}
      />
    );

    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);

    expect(headings.at(-1)).toMatch(/Други/);
  });

  it('moves localized miscellaneous categories to the end by public filter slug', () => {
    render(
      <Shop
        products={[
          product('other', 'Other Item', 'Other', 'available', { filterSlug: 'drugi' }),
          product('aaa', 'A Item', 'Aardvark'),
        ]}
      />,
      { locale: 'en' }
    );

    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);

    expect(headings.at(-1)).toMatch(/Other/);
  });

  it('marks a Bulgarian category fallback on the English catalog', () => {
    render(
      <Shop
        products={[
          product('fallback', 'Translated product', 'Приказни герои', 'available', {
            contentLocale: 'bg',
            translationPending: true,
          }),
        ]}
      />,
      { locale: 'en' }
    );

    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'Приказни герои Translation pending',
    });

    expect(within(heading).getByText('Приказни герои')).toHaveAttribute('lang', 'bg');
    expect(within(heading).getByText('Translation pending')).toBeInTheDocument();
  });
});
