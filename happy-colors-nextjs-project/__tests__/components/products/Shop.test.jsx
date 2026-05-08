import { describe, expect, it, vi } from 'vitest';
import Shop from '@/app/products/Shop';
import { render, screen, within } from '../test-utils.jsx';

vi.mock('@/app/products/ProductCard', () => ({
  default: ({ product }) => <article data-testid={`product-${product._id}`}>{product.title}</article>,
}));

function product(_id, title, categoryName, availability = 'available') {
  return {
    _id,
    title,
    availability,
    category: categoryName ? { name: categoryName } : null,
  };
}

describe('Shop', () => {
  it('renders no category sections for an empty product list', () => {
    render(<Shop products={[]} />);

    expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    expect(screen.queryAllByTestId(/product-/)).toHaveLength(0);
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
});
