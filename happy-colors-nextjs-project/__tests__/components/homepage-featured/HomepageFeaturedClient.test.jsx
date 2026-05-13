import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomepageFeaturedClient from '@/app/homepage-featured/HomepageFeaturedClient';
import { getProducts, updateHomepageFeaturedProducts } from '@/managers/productsManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/productsManager', () => ({
  getProducts: vi.fn(),
  updateHomepageFeaturedProducts: vi.fn(),
}));

const products = [
  {
    _id: 'product-1',
    title: 'Мече',
    category: { name: 'Играчки' },
    imageUrl: 'https://cdn.test/bear.webp',
    imageUrls: ['https://cdn.test/bear.webp'],
    availability: 'available',
    isHomepageFeatured: true,
    homepageFeaturedOrder: 0,
  },
  {
    _id: 'product-2',
    title: 'Зайче',
    category: { name: 'Играчки' },
    imageUrl: 'https://cdn.test/bunny.webp',
    imageUrls: ['https://cdn.test/bunny.webp'],
    availability: 'available',
    isHomepageFeatured: false,
    homepageFeaturedOrder: 0,
  },
  {
    _id: 'product-3',
    title: 'Гирлянд',
    category: { name: 'Декор' },
    imageUrl: 'https://cdn.test/decor.webp',
    imageUrls: ['https://cdn.test/decor.webp'],
    availability: 'unavailable',
    isHomepageFeatured: true,
    homepageFeaturedOrder: 1,
  },
];

describe('HomepageFeaturedClient', () => {
  beforeEach(() => {
    getProducts.mockResolvedValue(products);
    updateHomepageFeaturedProducts.mockResolvedValue([]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('loads selected products and saves ordered ids', async () => {
    const { mockRouterPush } = render(<HomepageFeaturedClient />, {
      user: { _id: 'user-1', username: 'Petya' },
    });

    expect(await screen.findByRole('heading', { name: 'Избери любими продукти' })).toBeInTheDocument();
    expect(screen.getByText('избрани 2 / 4')).toBeInTheDocument();
    expect(screen.getByText('Гирлянд')).toBeInTheDocument();
    expect(screen.getByText(/няма да се показва публично/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Махни Гирлянд' }));
    fireEvent.click(screen.getByRole('button', { name: 'Добави Зайче' }));
    fireEvent.click(screen.getByRole('button', { name: 'Запази' }));

    await waitFor(() => {
      expect(updateHomepageFeaturedProducts).toHaveBeenCalledWith(['product-1', 'product-2']);
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('redirects anonymous users to login', async () => {
    const { mockRouterPush } = render(<HomepageFeaturedClient />, {
      user: null,
    });

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/users/login');
    });
    expect(getProducts).not.toHaveBeenCalled();
  });

  it('does not save when confirmation is cancelled', async () => {
    window.confirm.mockReturnValueOnce(false);

    render(<HomepageFeaturedClient />, {
      user: { _id: 'user-1', username: 'Petya' },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Запази' }));

    expect(updateHomepageFeaturedProducts).not.toHaveBeenCalled();
  });
});
