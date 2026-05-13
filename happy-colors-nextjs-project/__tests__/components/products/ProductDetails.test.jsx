import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductDetails from '@/app/products/[productId]/ProductDetails';
import useImageSlideshow from '@/hooks/useImageSlideshow';
import { fireEvent, render, screen } from '../test-utils.jsx';

vi.mock('@/hooks/useImageSlideshow', () => ({
  default: vi.fn(),
}));

const showPrev = vi.fn();
const showNext = vi.fn();
const pause = vi.fn();
const resume = vi.fn();
const handleTrackTransitionEnd = vi.fn();

const product = {
  _id: 'product-1',
  title: 'Lavender Candle',
  description: 'A handmade lavender candle.',
  price: 18,
  owner: 'owner-1',
  imageUrl: '/images/fallback.webp',
  imageUrls: ['/images/one.webp', '/images/two.webp'],
  availability: 'available',
  videos: [
    {
      url: '/videos/demo.mp4',
      posterUrl: '/images/video-poster.webp',
      mimeType: 'video/mp4',
      durationSeconds: 12,
    },
  ],
};

function mockSlideshow(overrides = {}) {
  useImageSlideshow.mockReturnValue({
    currentIndex: 0,
    hasMultiple: true,
    trackIndex: 1,
    transitionEnabled: true,
    showPrev,
    showNext,
    pause,
    resume,
    handleTrackTransitionEnd,
    ...overrides,
  });
}

describe('ProductDetails', () => {
  beforeEach(() => {
    showPrev.mockClear();
    showNext.mockClear();
    pause.mockClear();
    resume.mockClear();
    handleTrackTransitionEnd.mockClear();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    mockSlideshow();
  });

  it('renders product details and builds image/video slideshow slides', () => {
    render(<ProductDetails product={product} />);

    expect(screen.getByRole('heading', { name: 'Lavender Candle' })).toBeInTheDocument();
    expect(screen.getByText('A handmade lavender candle.')).toBeInTheDocument();

    const [slides, interval, options] = useImageSlideshow.mock.calls[0];

    expect(interval).toBe(5000);
    expect(options).toEqual({ resetKey: 'product-1' });
    expect(slides).toEqual([
      expect.objectContaining({ type: 'image', url: '/images/one.webp' }),
      expect.objectContaining({ type: 'image', url: '/images/two.webp' }),
      expect.objectContaining({
        type: 'video',
        url: '/videos/demo.mp4',
        posterUrl: '/images/video-poster.webp',
      }),
    ]);
  });

  it('adds the active image slide to cart and navigates to the cart', () => {
    const addToCart = vi.fn();
    const routerPush = vi.fn();
    render(<ProductDetails product={product} />, {
      cartOverrides: { addToCart },
      routerOverrides: { push: routerPush },
    });

    fireEvent.click(screen.getByTestId('add-to-cart-button'));

    expect(addToCart).toHaveBeenCalledWith({
      _id: 'product-1',
      title: 'Lavender Candle',
      price: 18,
      image: '/images/one.webp',
    });
    expect(routerPush).toHaveBeenCalledWith('/cart');
  });

  it('routes unavailable products to inquiry instead of adding them to cart', () => {
    mockSlideshow({ hasMultiple: false });
    const addToCart = vi.fn();
    const routerPush = vi.fn();
    render(<ProductDetails product={{ ...product, availability: 'unavailable' }} />, {
      cartOverrides: { addToCart },
      routerOverrides: { push: routerPush },
    });

    expect(screen.queryByTestId('add-to-cart-button')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button'));

    expect(addToCart).not.toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith('/contacts?productId=product-1');
  });

  it('shows owner edit and delete actions only for product owners', () => {
    const ownerRender = render(<ProductDetails product={product} />, {
      user: { _id: 'owner-1' },
    });

    expect(ownerRender.container.querySelector('a[href="/products/product-1/edit"]')).toBeInTheDocument();
    expect(ownerRender.container.querySelector('a[href="/products/product-1/delete"]')).toBeInTheDocument();

    ownerRender.unmount();

    const guestRender = render(<ProductDetails product={product} />);

    expect(guestRender.container.querySelector('a[href="/products/product-1/edit"]')).not.toBeInTheDocument();
    expect(guestRender.container.querySelector('a[href="/products/product-1/delete"]')).not.toBeInTheDocument();
  });

  it('renders the active video slide and advances when it ends', () => {
    mockSlideshow({ currentIndex: 2 });

    render(<ProductDetails product={product} />);

    const video = screen.getByLabelText(/Lavender Candle/);

    expect(video).toHaveAttribute('src', '/videos/demo.mp4');
    expect(video).toHaveAttribute('poster', '/images/video-poster.webp');

    fireEvent.ended(video);

    expect(pause).toHaveBeenCalled();
    expect(showNext).toHaveBeenCalled();
  });
});
