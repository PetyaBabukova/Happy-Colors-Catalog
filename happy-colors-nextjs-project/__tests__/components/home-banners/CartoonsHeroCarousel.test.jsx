import { beforeEach, describe, expect, it, vi } from 'vitest';
import CartoonsHeroCarousel from '@/components/home-banners/CartoonsHeroCarousel';
import { deleteHomeBanner } from '@/managers/homeBannersManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

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

  it('renders nothing when there are no images', () => {
    const { container } = render(<CartoonsHeroCarousel banners={[{ _id: 'empty' }]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('passes cartoon placement when deleting from admin controls', async () => {
    render(<CartoonsHeroCarousel banners={banners} />, {
      user: { _id: 'user-1', email: 'owner@example.com' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Изтрий банера' }));

    await waitFor(() => {
      expect(deleteHomeBanner).toHaveBeenCalledWith('cartoon-banner-1', { placement: 'cartoons' });
    });
  });
});
