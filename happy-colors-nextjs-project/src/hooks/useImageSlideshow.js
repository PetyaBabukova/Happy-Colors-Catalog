'use client';

import { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';

function slideReducer(state, action) {
  switch (action.type) {
    case 'next':
      return {
        currentIndex: (state.currentIndex + 1) % action.length,
      };
    case 'prev':
      return {
        currentIndex: state.currentIndex === 0 ? action.length - 1 : state.currentIndex - 1,
      };
    case 'reset':
      return {
        currentIndex: 0,
      };
    default:
      return state;
  }
}

export default function useImageSlideshow(imageUrls, interval = 4000, options = {}) {
  const { observeRef, resetKey, respectReducedMotion = false } = options;
  const [state, dispatch] = useReducer(slideReducer, { currentIndex: 0 });
  const timerRef = useRef(null);
  const pausedRef = useRef(false);
  const inViewportRef = useRef(!observeRef);
  const hasMultiple = imageUrls.length > 1;

  useEffect(() => {
    dispatch({ type: 'reset' });
  }, [resetKey]);

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();

    if (
      !hasMultiple ||
      pausedRef.current ||
      (respectReducedMotion && prefersReducedMotion) ||
      !inViewportRef.current
    ) {
      return;
    }

    timerRef.current = setInterval(() => {
      dispatch({ type: 'next', length: imageUrls.length });
    }, interval);
  }, [clearTimer, hasMultiple, imageUrls.length, interval, prefersReducedMotion, respectReducedMotion]);

  useEffect(() => {
    startTimer();

    return clearTimer;
  }, [clearTimer, startTimer]);

  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        clearTimer();
        return;
      }

      if (!pausedRef.current && inViewportRef.current) {
        startTimer();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [clearTimer, startTimer]);

  useEffect(() => {
    if (!observeRef?.current) {
      return;
    }

    const element = observeRef.current;
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
    const elementArea = Math.max(rect.width * rect.height, 1);
    const visibleArea = Math.max(visibleHeight, 0) * Math.max(visibleWidth, 0);

    inViewportRef.current = visibleArea / elementArea >= 0.3;

    if (inViewportRef.current && !pausedRef.current) {
      startTimer();
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewportRef.current = entry.isIntersecting;

        if (entry.isIntersecting && !pausedRef.current) {
          startTimer();
          return;
        }

        clearTimer();
      },
      { threshold: 0.3 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [clearTimer, observeRef, startTimer]);

  const showPrev = useCallback(() => {
    dispatch({ type: 'prev', length: imageUrls.length });
    startTimer();
  }, [imageUrls.length, startTimer]);

  const showNext = useCallback(() => {
    dispatch({ type: 'next', length: imageUrls.length });
    startTimer();
  }, [imageUrls.length, startTimer]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    pausedRef.current = false;

    if (inViewportRef.current) {
      startTimer();
    }
  }, [startTimer]);

  const currentUrl = imageUrls[state.currentIndex] || imageUrls[0] || '';

  return {
    currentIndex: state.currentIndex,
    currentUrl,
    hasMultiple,
    showPrev,
    showNext,
    pause,
    resume,
  };
}
