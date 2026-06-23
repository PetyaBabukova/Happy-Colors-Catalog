import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductDetails from '@/app/products/[productId]/ProductDetails';
import useImageSlideshow from '@/hooks/useImageSlideshow';
import { approveAdminProduct } from '@/managers/usersAdminManager';
import { fireEvent, render, screen, waitFor } from '../test-utils.jsx';

vi.mock('@/hooks/useImageSlideshow', () => ({
  default: vi.fn(),
}));

vi.mock('@/managers/usersAdminManager', () => ({
  approveAdminProduct: vi.fn(),
  rejectAdminProduct: vi.fn(),
}));

const catalogModeState = vi.hoisted(() => ({
  value: false,
}));

vi.mock('@/utils/catalogMode', () => ({
  get isCatalogMode() {
    return catalogModeState.value;
  },
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
    approveAdminProduct.mockResolvedValue({});
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    catalogModeState.value = false;
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

  it('shows product availability copy for available and unavailable product pages', () => {
    const availableRender = render(<ProductDetails product={product} />);

    expect(
      screen.getByText(/Налична готова бройка — изпратете запитване за потвърждение/)
    ).toBeInTheDocument();

    availableRender.unmount();

    render(<ProductDetails product={{ ...product, availability: 'unavailable' }} />);

    expect(screen.getByText(/Възможна изработка след потвърждение\./)).toBeInTheDocument();
  });

  it('preserves cartoon service context for inquiry links when provided', () => {
    mockSlideshow({ hasMultiple: false });
    const routerPush = vi.fn();
    render(
      <ProductDetails
        product={{ ...product, availability: 'unavailable' }}
        serviceContext="cartoons"
      />,
      {
        routerOverrides: { push: routerPush },
      }
    );

    fireEvent.click(screen.getByRole('button'));

    expect(routerPush).toHaveBeenCalledWith('/contacts?service=cartoons&productId=product-1');
  });

  it('routes available cartoon-context products to inquiry before the shop cart branch', () => {
    catalogModeState.value = false;
    mockSlideshow({ hasMultiple: false });
    const addToCart = vi.fn();
    const routerPush = vi.fn();
    render(<ProductDetails product={product} serviceContext="cartoons" />, {
      cartOverrides: { addToCart },
      routerOverrides: { push: routerPush },
    });

    expect(screen.queryByTestId('add-to-cart-button')).not.toBeInTheDocument();
    expect(screen.getByText(/Изработва се по индивидуално запитване\./)).toBeInTheDocument();
    expect(screen.getByText(/Ориентировъчна цена от 18 €/)).toBeInTheDocument();
    expect(
      screen.getByText(/Крайната цена зависи от броя лица, сложността, стила и срока за изработка. Вижте подробности за цени и варианти/)
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'тук' })).toHaveAttribute('href', '/cartoons/offer');

    fireEvent.click(screen.getByRole('button'));

    expect(addToCart).not.toHaveBeenCalled();
    expect(routerPush).toHaveBeenCalledWith('/contacts?service=cartoons&productId=product-1');
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

  it('shows full-admin review actions for pending products on the product page', async () => {
    const routerRefresh = vi.fn();
    const { container } = render(
      <ProductDetails
        product={{
          ...product,
          publicationStatus: 'published',
          reviewStatus: 'pending_review',
        }}
      />,
      {
        user: { _id: 'admin-1', role: 'full_admin' },
        routerOverrides: { refresh: routerRefresh },
      }
    );

    expect(container.querySelector('a[href="/products/product-1/edit"]')).toBeInTheDocument();
    expect(container.querySelector('a[href="/products/product-1/delete"]')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Одобри' }));

    expect(approveAdminProduct).toHaveBeenCalledWith('product-1');
    await waitFor(() => expect(routerRefresh).toHaveBeenCalled());
  });

  it('shows a pending approval notice after artist edit redirects back to the product page', () => {
    window.history.pushState(null, '', '/products/product-1?updated=review-pending');

    render(
      <ProductDetails
        product={{
          ...product,
          publicationStatus: 'published',
          reviewStatus: 'pending_review',
        }}
      />,
      {
        user: { _id: 'owner-1', role: 'artist', artistStatus: 'active' },
      }
    );

    expect(screen.getByText(/Промените са запазени/)).toBeInTheDocument();
  });

  it('shows newsletter send action only for authenticated users', () => {
    const authenticatedRender = render(<ProductDetails product={product} />, {
      user: { _id: 'user-2' },
    });

    const newsletterLink = authenticatedRender.container.querySelector(
      'a[href="/newsletter/send?source=product&id=product-1"]'
    );

    expect(newsletterLink).toBeInTheDocument();
    expect(newsletterLink.className).toContain('newsletterActionBtn');

    authenticatedRender.unmount();

    const guestRender = render(<ProductDetails product={product} />);

    expect(
      guestRender.container.querySelector('a[href="/newsletter/send?source=product&id=product-1"]')
    ).not.toBeInTheDocument();
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
