import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HomeHeroCarousel from '@/components/home-banners/HomeHeroCarousel';
import { deleteHomeBanner } from '@/managers/homeBannersManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

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
    mobileImageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/animals.webp',
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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders active banner content and switches slides manually', () => {
    render(<HomeHeroCarousel banners={banners} />);

    expect(screen.getByRole('heading', { name: 'Животинки' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Виж животинки' })).toHaveAttribute('href', '/search?q=животинки');

    fireEvent.click(screen.getByRole('button', { name: 'Следващ банер' }));

    expect(screen.getByRole('heading', { name: 'Декорация' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Виж декорация' })).toHaveAttribute('href', '/search?q=декорация');
  });

  it('renders approved translated banner content on English routes', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en' });
    const translatedBanners = [{
      ...banners[0],
      title: 'Crochet animals',
      description: 'Handmade companions for a thoughtful gift.',
      ctaLabel: 'Explore animals',
    }];

    render(<HomeHeroCarousel banners={translatedBanners} />, { locale: 'en' });

    expect(screen.getByRole('heading', { name: 'Crochet animals' })).toBeInTheDocument();
    expect(screen.getByText('Handmade companions for a thoughtful gift.')).toBeInTheDocument();
    expect(screen.getByAltText('Crochet animals')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore animals' })).toHaveAttribute(
      'href',
      `/en/search?q=${encodeURIComponent('животинки')}`
    );
  });

  it('keeps admin banner content on Bulgarian localized routes', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/bg' });

    render(<HomeHeroCarousel banners={banners} />);

    expect(screen.getByRole('heading', { name: banners[0].title })).toBeInTheDocument();
    expect(screen.getByAltText(banners[0].title)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: banners[0].ctaLabel })).toHaveAttribute(
      'href',
      `/bg/search?q=${encodeURIComponent('животинки')}`
    );
  });

  it('renders a mobile picture source when a mobile image exists', () => {
    const { container } = render(<HomeHeroCarousel banners={banners} />);

    const source = container.querySelector('source');

    expect(source).toHaveAttribute('media', '(max-width: 768px)');
    expect(source).toHaveAttribute(
      'srcset',
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/animals.webp'
    );
    expect(screen.getByAltText('Животинки')).toHaveAttribute(
      'src',
      'https://storage.googleapis.com/test-bucket/home-banners/animals.webp'
    );
  });

  it('renders only the desktop fallback image when no mobile image exists', () => {
    const { container } = render(<HomeHeroCarousel banners={[{ ...banners[0], mobileImageUrl: '' }]} />);

    expect(container.querySelector('source')).toBeNull();
    expect(screen.getByAltText('Животинки')).toHaveAttribute(
      'src',
      'https://storage.googleapis.com/test-bucket/home-banners/animals.webp'
    );
  });

  it('switches slides with a horizontal pointer drag', () => {
    render(<HomeHeroCarousel banners={banners} />);

    const mediaFrame = screen.getByAltText('Животинки').closest('div');
    const pointerDown = new Event('pointerdown', { bubbles: true });
    const pointerUp = new Event('pointerup', { bubbles: true });

    Object.assign(pointerDown, { pointerId: 1, clientX: 240 });
    Object.assign(pointerUp, { pointerId: 1, clientX: 120 });

    fireEvent(mediaFrame, pointerDown);
    fireEvent(mediaFrame, pointerUp);

    expect(screen.getByRole('heading', { name: 'Декорация' })).toBeInTheDocument();
  });

  it('does not crash when the current banner index is out of range after a list shrink', () => {
    const { rerender } = render(<HomeHeroCarousel banners={banners} />);

    fireEvent.click(screen.getByRole('button', { name: 'Следващ банер' }));
    expect(screen.getByRole('heading', { name: 'Декорация' })).toBeInTheDocument();

    expect(() => rerender(<HomeHeroCarousel banners={[banners[0]]} />)).not.toThrow();
    expect(screen.getByRole('heading', { name: 'Животинки' })).toBeInTheDocument();
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
      expect(deleteHomeBanner).toHaveBeenCalledWith('banner-1', { placement: 'home' });
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('renders localized English fallback hero when no banners are available', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en' });

    render(<HomeHeroCarousel banners={[]} />, { locale: 'en' });

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Handmade crochet toys, accessories, and home decor',
      })
    ).toBeInTheDocument();
    expect(screen.getByAltText('Crocheted lion and colorful yarn from Happy Colors')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Catalog' })).toHaveAttribute('href', '/en/products');
  });

  it('renders fallback hero when there are no banners', () => {
    render(<HomeHeroCarousel banners={[]} />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Плетени играчки, аксесоари и декорация за дома',
      })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Каталог' })).toHaveAttribute('href', '/products');
  });
});
