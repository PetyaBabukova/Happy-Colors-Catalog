import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProductCard from '@/app/products/ProductCard';
import useImageSlideshow from '@/hooks/useImageSlideshow';
import { fireEvent, render, screen } from '../test-utils.jsx';

vi.mock('@/hooks/useImageSlideshow', () => ({
  default: vi.fn(),
}));

const pause = vi.fn();
const resume = vi.fn();

const product = {
  _id: 'product-1',
  title: 'Lavender Candle',
  imageUrls: ['/images/candle-1.webp', '/images/candle-2.webp'],
  videos: [
    {
      url: '/videos/candle.mp4',
      posterUrl: '/images/candle-video.webp',
      mimeType: 'video/mp4',
    },
  ],
  availability: 'available',
};

describe('ProductCard', () => {
  beforeEach(() => {
    pause.mockClear();
    resume.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    useImageSlideshow.mockReturnValue({
      currentItem: {
        type: 'image',
        imageUrl: '/images/candle-1.webp',
        key: 'image-/images/candle-1.webp-0',
      },
      isInView: true,
      pause,
      resume,
    });
  });

  it('links to the product detail page and renders the current image slide', () => {
    render(<ProductCard product={product} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/product-1');
    expect(screen.getByRole('heading', { name: 'Lavender Candle' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lavender Candle' })).toHaveAttribute('src', '/images/candle-1.webp');
    expect(screen.getByText('Налично')).toBeInTheDocument();
  });

  it('links the card to the product detail page', () => {
    render(<ProductCard product={product} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/product-1');
  });

  it('preserves cartoon service context when requested', () => {
    render(<ProductCard product={product} serviceContext="cartoons" />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/product-1?service=cartoons');
  });

  it('ignores unrelated service context values', () => {
    render(<ProductCard product={product} serviceContext="not-cartoons" />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/product-1');
  });

  it('builds image and video slides for the slideshow hook', () => {
    render(<ProductCard product={product} />);

    const [slides, interval, options] = useImageSlideshow.mock.calls[0];

    expect(interval).toBe(4000);
    expect(options).toMatchObject({
      exposeInViewState: true,
      resetKey: 'product-1',
    });
    expect(slides).toEqual([
      expect.objectContaining({ type: 'image', imageUrl: '/images/candle-1.webp' }),
      expect.objectContaining({ type: 'image', imageUrl: '/images/candle-2.webp' }),
      expect.objectContaining({
        type: 'video',
        posterUrl: '/images/candle-video.webp',
        videoUrl: '/videos/candle.mp4',
      }),
    ]);
  });

  it('pauses and resumes the slideshow on hover', () => {
    render(<ProductCard product={product} />);

    const imageContainer = screen.getByTestId('product-card-media');

    fireEvent.mouseEnter(imageContainer);
    fireEvent.mouseLeave(imageContainer);

    expect(pause).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('hides the availability badge when the product is unavailable', () => {
    render(<ProductCard product={{ ...product, availability: 'unavailable' }} />);

    expect(screen.queryByText('Налично')).not.toBeInTheDocument();
  });

  it('renders the active video slide when it is in view', () => {
    useImageSlideshow.mockReturnValueOnce({
      currentItem: {
        type: 'video',
        posterUrl: '/images/candle-video.webp',
        videoUrl: '/videos/candle.mp4',
        mimeType: 'video/mp4',
        key: 'video-/videos/candle.mp4-0',
      },
      isInView: true,
      pause,
      resume,
    });

    render(<ProductCard product={product} />);

    const video = screen.getByLabelText('Lavender Candle видео');

    expect(video).toHaveAttribute('poster', '/images/candle-video.webp');
    expect(video.querySelector('source')).toHaveAttribute('src', '/videos/candle.mp4');
    expect(video.querySelector('source')).toHaveAttribute('type', 'video/mp4');
  });

  it('renders the video poster while a video slide is offscreen', () => {
    useImageSlideshow.mockReturnValueOnce({
      currentItem: {
        type: 'video',
        posterUrl: '/images/candle-video.webp',
        videoUrl: '/videos/candle.mp4',
        mimeType: 'video/mp4',
        key: 'video-/videos/candle.mp4-0',
      },
      isInView: false,
      pause,
      resume,
    });

    render(<ProductCard product={product} />);

    expect(screen.queryByLabelText('Lavender Candle видео')).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lavender Candle' })).toHaveAttribute('src', '/images/candle-video.webp');
  });

  it('pauses active video playback when the slide leaves view', () => {
    const pauseVideo = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    const videoSlide = {
      currentItem: {
        type: 'video',
        posterUrl: '/images/candle-video.webp',
        videoUrl: '/videos/candle.mp4',
        mimeType: 'video/mp4',
        key: 'video-/videos/candle.mp4-0',
      },
      pause,
      resume,
    };
    useImageSlideshow
      .mockReturnValueOnce({ ...videoSlide, isInView: true })
      .mockReturnValueOnce({ ...videoSlide, isInView: false });

    const { rerender } = render(<ProductCard product={product} />);
    rerender(<ProductCard product={product} />);

    expect(pauseVideo).toHaveBeenCalled();
  });
});
