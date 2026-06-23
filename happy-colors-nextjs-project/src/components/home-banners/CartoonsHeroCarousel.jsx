'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { deleteHomeBanner } from '@/managers/homeBannersManager';
import styles from './HomeHeroCarousel.module.css';

const ROTATION_INTERVAL_MS = 6000;
const SWIPE_THRESHOLD_PX = 50;

export default function CartoonsHeroCarousel({ banners = [] }) {
  const router = useRouter();
  const { user } = useAuth();
  const activeBanners = useMemo(() => banners.filter((banner) => banner?.imageUrl), [banners]);
  const pointerIdRef = useRef(null);
  const dragStartXRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deletingBannerId, setDeletingBannerId] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
  }, [activeBanners.length]);

  useEffect(() => {
    if (activeBanners.length <= 1 || isDragging) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % activeBanners.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [activeBanners.length, isDragging]);

  if (activeBanners.length === 0) {
    return null;
  }

  const safeCurrentIndex = currentIndex < activeBanners.length ? currentIndex : 0;
  const currentBanner = activeBanners[safeCurrentIndex];
  const canManageBanners = user?.role === 'full_admin';

  async function handleDeleteBanner(bannerId) {
    if (!window.confirm('Сигурни ли сте, че искате да изтриете този шарж банер?')) {
      return;
    }

    try {
      setDeletingBannerId(bannerId);
      await deleteHomeBanner(bannerId, { placement: 'cartoons' });
      router.refresh();
    } finally {
      setDeletingBannerId('');
    }
  }

  function showPreviousBanner() {
    setCurrentIndex((index) => (index - 1 + activeBanners.length) % activeBanners.length);
  }

  function showNextBanner() {
    setCurrentIndex((index) => (index + 1) % activeBanners.length);
  }

  function handlePointerDown(event) {
    if (activeBanners.length <= 1 || event.target.closest('a, button')) {
      return;
    }

    pointerIdRef.current = event.pointerId;
    dragStartXRef.current = event.clientX;
    isDraggingRef.current = true;
    setIsDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function resetDrag(event) {
    if (pointerIdRef.current === event.pointerId) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    pointerIdRef.current = null;
    isDraggingRef.current = false;
    setIsDragging(false);
  }

  function finishDrag(event) {
    if (!isDraggingRef.current || pointerIdRef.current !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragStartXRef.current;

    if (deltaX <= -SWIPE_THRESHOLD_PX) {
      showNextBanner();
    } else if (deltaX >= SWIPE_THRESHOLD_PX) {
      showPreviousBanner();
    }

    resetDrag(event);
  }

  return (
    <section className={`${styles.carousel} ${styles.cartoonsCarousel} pageInline`} aria-label="Шарж банери">
      <div
        className={`${styles.mediaFrame} ${isDragging ? styles.mediaFrameDragging : ''}`}
        onPointerDown={handlePointerDown}
        onPointerUp={finishDrag}
        onPointerCancel={resetDrag}
        onDragStart={(event) => event.preventDefault()}
      >
        <picture key={currentBanner._id} className={styles.picture}>
          {currentBanner.mobileImageUrl ? (
            <source media="(max-width: 768px)" srcSet={currentBanner.mobileImageUrl} />
          ) : null}
          <img
            src={currentBanner.imageUrl}
            alt={currentBanner.title || 'Шарж банер'}
            className={styles.bannerImage}
            draggable="false"
            fetchPriority={safeCurrentIndex === 0 ? 'high' : 'auto'}
          />
        </picture>

        {canManageBanners && (
          <div className={styles.operatorControls} aria-label="Управление на банера">
            <Link
              href={`/home-banners/${currentBanner._id}/edit`}
              className={styles.iconButton}
              aria-label="Редактирай банера"
              title="Редактирай банера"
            >
              ✎
            </Link>
            <button
              type="button"
              className={styles.iconButton}
              aria-label="Изтрий банера"
              title="Изтрий банера"
              disabled={deletingBannerId === currentBanner._id}
              onClick={() => handleDeleteBanner(currentBanner._id)}
            >
              ×
            </button>
          </div>
        )}

        {activeBanners.length > 1 && (
          <div className={styles.carouselControls} aria-label="Навигация в банерите">
            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.previousArrow}`}
              aria-label="Предишен банер"
              onClick={showPreviousBanner}
            >
              ‹
            </button>
            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.nextArrow}`}
              aria-label="Следващ банер"
              onClick={showNextBanner}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
