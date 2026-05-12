import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomeHeroCarousel from '@/components/home-banners/HomeHeroCarousel';
import { deleteHomeBanner } from '@/managers/homeBannersManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/managers/homeBannersManager', () => ({
  deleteHomeBanner: vi.fn(),
}));

const banners = [
  {
    _id: 'banner-1',
    title: 'Животинки',
    description: 'Плетени приятели за подарък.',
    ctaLabel: 'Виж животинки',
    ctaHref: '/search?q=животинки',
    imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/animals.webp',
  },
  {
    _id: 'banner-2',
    title: 'Декорация',
    description: 'Уют за дома.',
    ctaLabel: 'Виж декорация',
    ctaHref: '/search?q=декорация',
    imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/decor.webp',
  },
];

describe('HomeHeroCarousel', () => {
  beforeEach(() => {
    deleteHomeBanner.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders active banner content and switches slides manually', () => {
    render(<HomeHeroCarousel banners={banners} />);

    expect(screen.getByRole('heading', { name: 'Животинки' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Виж животинки' })).toHaveAttribute('href', '/search?q=животинки');

    fireEvent.click(screen.getByRole('button', { name: 'Следващ банер' }));

    expect(screen.getByRole('heading', { name: 'Декорация' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Виж декорация' })).toHaveAttribute('href', '/search?q=декорация');
  });

  it('shows edit and delete controls only for authenticated users', async () => {
    const { mockRouterPush } = render(<HomeHeroCarousel banners={banners} />, {
      user: { _id: 'user-1', email: 'owner@example.com' },
    });

    expect(screen.getByRole('link', { name: 'Редактирай банера' })).toHaveAttribute(
      'href',
      '/home-banners/banner-1/edit'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Изтрий банера' }));

    await waitFor(() => {
      expect(deleteHomeBanner).toHaveBeenCalledWith('banner-1');
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('renders fallback hero when there are no banners', () => {
    render(<HomeHeroCarousel banners={[]} />);

    expect(screen.getByRole('heading', { name: 'Плетени играчки, аксесоари и декорация за дома' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Каталог' })).toHaveAttribute('href', '/products');
  });
});
