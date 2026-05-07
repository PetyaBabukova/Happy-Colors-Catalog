import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useImageSlideshow from '../../../src/hooks/useImageSlideshow.js';

describe('useImageSlideshow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 0));
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not advance single-image slideshows', () => {
    const { result } = renderHook(() => useImageSlideshow(['one.webp'], 1000));

    act(() => {
      result.current.showNext();
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toMatchObject({
      currentIndex: 0,
      currentUrl: 'one.webp',
      hasMultiple: false,
    });
  });

  it('advances automatically, pauses, and resumes multi-image slideshows', () => {
    const { result } = renderHook(() => useImageSlideshow(['one.webp', 'two.webp'], 1000));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.currentUrl).toBe('two.webp');

    act(() => {
      result.current.pause();
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.currentUrl).toBe('two.webp');

    act(() => {
      result.current.resume();
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.currentUrl).toBe('one.webp');
  });

  it('snaps clone slides back to the real start after transition end', () => {
    const { result } = renderHook(() => useImageSlideshow(['one.webp', 'two.webp'], 1000));

    act(() => {
      result.current.showNext();
      result.current.showNext();
    });

    expect(result.current).toMatchObject({
      currentIndex: 0,
      trackIndex: 3,
    });

    act(() => {
      result.current.handleTrackTransitionEnd();
    });

    expect(result.current).toMatchObject({
      currentIndex: 0,
      trackIndex: 1,
      transitionEnabled: false,
    });
  });

  it('uses IntersectionObserver visibility to stop and restart timers', () => {
    let observerCallback;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      vi.fn((callback) => {
        observerCallback = callback;
        return { observe, disconnect };
      })
    );
    const element = {
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 }),
    };
    const observeRef = { current: element };

    const { result, unmount } = renderHook(() =>
      useImageSlideshow(['one.webp', 'two.webp'], 1000, {
        observeRef,
        exposeInViewState: true,
      })
    );

    expect(observe).toHaveBeenCalledWith(element);
    expect(result.current.isInView).toBe(true);

    act(() => {
      observerCallback([{ isIntersecting: false }]);
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.currentUrl).toBe('one.webp');
    expect(result.current.isInView).toBe(false);

    act(() => {
      observerCallback([{ isIntersecting: true }]);
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.currentUrl).toBe('two.webp');
    expect(result.current.isInView).toBe(true);

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
