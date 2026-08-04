import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CartoonsHeroCarousel from '@/components/home-banners/CartoonsHeroCarousel';
import { deleteHomeBanner } from '@/managers/homeBannersManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';
import { setMockNavigation } from '../setup.js';

vi.mock('@/managers/homeBannersManager', () => ({
  deleteHomeBanner: vi.fn(),
}));

const banners = [
  {
    _id: 'cartoon-banner-1',
    title: 'Шарж първи',
    description: 'Този текст не трябва да се вижда.',
    ctaLabel: 'Не показвай CTA',
    ctaHref: '/contacts?service=cartoons',
    placement: 'cartoons',
    imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoons-one.webp',
    mobileImageUrl:
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/cartoons-one.webp',
  },
  {
    _id: 'cartoon-banner-2',
    title: 'Шарж втори',
    placement: 'cartoons',
    imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoons-two.webp',
  },
];

describe('CartoonsHeroCarousel', () => {
  beforeEach(() => {
    deleteHomeBanner.mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders image-only banners without text or CTA overlay', () => {
    render(<CartoonsHeroCarousel banners={banners} />);

    expect(screen.getByAltText('Шарж първи')).toHaveAttribute(
      'src',
      'https://storage.googleapis.com/test-bucket/home-banners/cartoons-one.webp'
    );
    expect(screen.queryByRole('heading', { name: 'Шарж първи' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Не показвай CTA/ })).not.toBeInTheDocument();
  });

  it('renders a mobile picture source when a mobile image exists', () => {
    const { container } = render(<CartoonsHeroCarousel banners={banners} />);

    const source = container.querySelector('source');

    expect(source).toHaveAttribute('media', '(max-width: 768px)');
    expect(source).toHaveAttribute(
      'srcset',
      'https://storage.googleapis.com/test-bucket/home-banners/mobile-images/cartoons-one.webp'
    );
  });

  it('switches slides manually and skips empty image records', () => {
    render(<CartoonsHeroCarousel banners={[{ _id: 'empty' }, ...banners]} />);

    fireEvent.click(screen.getByRole('button', { name: 'Следващ банер' }));

    expect(screen.getByAltText('Шарж втори')).toHaveAttribute(
      'src',
      'https://storage.googleapis.com/test-bucket/home-banners/cartoons-two.webp'
    );
  });

  it('localizes public carousel controls on English routes', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/cartoons' });
    const translatedBanners = banners.map((banner, index) => ({
      ...banner,
      title: `Caricature banner ${index + 1}`,
    }));

    const { container } = render(
      <CartoonsHeroCarousel banners={translatedBanners} />,
      { locale: 'en' }
    );

    expect(screen.getByRole('region', { name: 'Caricature banners' })).toBeInTheDocument();
    expect(container.querySelector('[aria-label="Banner navigation"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous banner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next banner' })).toBeInTheDocument();
    expect(screen.getByAltText('Caricature banner 1')).toBeInTheDocument();
  });

  it('uses the localized English image fallback when a banner has no title', () => {
    vi.stubEnv('NEXT_PUBLIC_LOCALE_ROUTES_ENABLED', 'true');
    vi.stubEnv('NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED', 'true');
    setMockNavigation({ pathname: '/en/cartoons' });

    render(
      <CartoonsHeroCarousel banners={[{ ...banners[0], title: '' }]} />,
      { locale: 'en' }
    );

    expect(screen.getByAltText('Caricature banner')).toBeInTheDocument();
  });

  it('does not crash when the current banner index is out of range after a list shrink', () => {
    const { rerender } = render(<CartoonsHeroCarousel banners={banners} />);

    fireEvent.click(screen.getByRole('button', { name: 'Следващ банер' }));

    expect(screen.getByAltText('Шарж втори')).toHaveAttribute(
      'src',
      'https://storage.googleapis.com/test-bucket/home-banners/cartoons-two.webp'
    );

    expect(() => rerender(<CartoonsHeroCarousel banners={[banners[0]]} />)).not.toThrow();
    expect(screen.getByAltText('Шарж първи')).toHaveAttribute(
      'src',
      'https://storage.googleapis.com/test-bucket/home-banners/cartoons-one.webp'
    );
  });

  it('renders nothing when there are no images', () => {
    const { container } = render(<CartoonsHeroCarousel banners={[{ _id: 'empty' }]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('hides admin controls from guests and ordinary authenticated users', () => {
    const guestRender = render(<CartoonsHeroCarousel banners={banners} />);

    expect(guestRender.container.querySelector('a[href="/home-banners/cartoon-banner-1/edit"]')).not.toBeInTheDocument();

    guestRender.unmount();

    const userRender = render(<CartoonsHeroCarousel banners={banners} />, {
      user: { _id: 'user-1', role: 'artist' },
    });

    expect(userRender.container.querySelector('a[href="/home-banners/cartoon-banner-1/edit"]')).not.toBeInTheDocument();
  });

  it('passes cartoon placement when a full admin deletes from admin controls', async () => {
    const { container } = render(<CartoonsHeroCarousel banners={banners} />, {
      user: { _id: 'admin-1', role: 'full_admin', email: 'admin@example.com' },
    });

    expect(container.querySelector('a[href="/home-banners/cartoon-banner-1/edit"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Изтрий банера' }));

    await waitFor(() => {
      expect(deleteHomeBanner).toHaveBeenCalledWith('cartoon-banner-1', { placement: 'cartoons' });
    });
  });
});
