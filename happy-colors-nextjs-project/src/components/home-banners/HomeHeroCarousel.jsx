'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import useTranslations from '@/i18n/useTranslations';
import { deleteHomeBanner } from '@/managers/homeBannersManager';
import styles from './HomeHeroCarousel.module.css';

const ROTATION_INTERVAL_MS = 6000;
const SWIPE_THRESHOLD_PX = 50;
const PREVIOUS_SYMBOL = '\u2039';
const NEXT_SYMBOL = '\u203a';
const DELETE_SYMBOL = '\u00d7';
const EDIT_SYMBOL = '\u270e';
const ADMIN_LABELS = {
  confirmDelete: '\u0421\u0438\u0433\u0443\u0440\u043d\u0438 \u043b\u0438 \u0441\u0442\u0435, \u0447\u0435 \u0438\u0441\u043a\u0430\u0442\u0435 \u0434\u0430 \u0438\u0437\u0442\u0440\u0438\u0435\u0442\u0435 \u0442\u043e\u0437\u0438 \u0445\u043e\u0443\u043c \u0431\u0430\u043d\u0435\u0440?',
  controls: '\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043d\u0430 \u0431\u0430\u043d\u0435\u0440\u0430',
  edit: '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u0430\u0439 \u0431\u0430\u043d\u0435\u0440\u0430',
  delete: '\u0418\u0437\u0442\u0440\u0438\u0439 \u0431\u0430\u043d\u0435\u0440\u0430',
};

export default function HomeHeroCarousel({ banners = [] }) {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, publicHref } = useLocaleNavigation();
  const { t } = useTranslations('homeHero');
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
    return (
      <section className={`${styles.carousel} pageInline`} aria-label={t('carouselAriaLabel')}>
        <div className={`${styles.mediaFrame} ${styles.staticHero}`}>
          <picture className={styles.picture}>
            <source media="(max-width: 768px)" srcSet="/lion_banner_MOBILE.webp" />
            <img
              src="/lion_banner.webp"
              alt={t('fallbackImageAlt')}
              className={styles.bannerImage}
              draggable="false"
              fetchPriority="high"
            />
          </picture>
          <div className={styles.content}>
            <div className={styles.textPanel}>
              <h2>{t('fallbackTitle')}</h2>
              <p>{t('fallbackDescription')}</p>
            </div>
            <div className={styles.ctaBar}>
              <Link href={publicHref('/products')} className={styles.ctaLink}>
                {t('fallbackCta')}
                <span aria-hidden="true" className={styles.arrowGroup}>
                  <span>{NEXT_SYMBOL}</span>
                  <span>{NEXT_SYMBOL}</span>
                  <span>{NEXT_SYMBOL}</span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const currentBanner = activeBanners[currentIndex];
  const bannerTitle = locale === 'en' ? t('fallbackTitle') : currentBanner.title;
  const bannerDescription = locale === 'en' ? '' : currentBanner.description;
  const bannerImageAlt = locale === 'en' ? t('fallbackImageAlt') : currentBanner.title;
  const bannerCtaLabel = locale === 'en'
    ? t('bannerCta')
    : currentBanner.ctaLabel || t('bannerCta');

  async function handleDeleteBanner(bannerId) {
    if (!window.confirm(ADMIN_LABELS.confirmDelete)) {
      return;
    }

    try {
      setDeletingBannerId(bannerId);
      await deleteHomeBanner(bannerId, { placement: currentBanner.placement || 'home' });
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
    if (
      activeBanners.length <= 1 ||
      event.target.closest('a, button')
    ) {
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
    <section className={`${styles.carousel} pageInline`} aria-label={t('carouselAriaLabel')}>
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
            alt={bannerImageAlt}
            className={styles.bannerImage}
            draggable="false"
            fetchPriority={currentIndex === 0 ? 'high' : 'auto'}
          />
        </picture>
        <div className={styles.content}>
          <div className={styles.textPanel}>
            <h2>{bannerTitle}</h2>
            {bannerDescription && <p>{bannerDescription}</p>}
          </div>
          <div className={styles.ctaBar}>
            <Link href={publicHref(currentBanner.ctaHref)} className={styles.ctaLink}>
              {bannerCtaLabel}
              <span aria-hidden="true" className={styles.arrowGroup}>
                <span>{NEXT_SYMBOL}</span>
                <span>{NEXT_SYMBOL}</span>
                <span>{NEXT_SYMBOL}</span>
              </span>
            </Link>
          </div>
        </div>

        {user && (
          <div className={styles.operatorControls} aria-label={ADMIN_LABELS.controls}>
            <Link
              href={`/home-banners/${currentBanner._id}/edit`}
              className={styles.iconButton}
              aria-label={ADMIN_LABELS.edit}
              title={ADMIN_LABELS.edit}
            >
              {EDIT_SYMBOL}
            </Link>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={ADMIN_LABELS.delete}
              title={ADMIN_LABELS.delete}
              disabled={deletingBannerId === currentBanner._id}
              onClick={() => handleDeleteBanner(currentBanner._id)}
            >
              {DELETE_SYMBOL}
            </button>
          </div>
        )}
        {activeBanners.length > 1 && (
          <div className={styles.carouselControls} aria-label={t('navigationAriaLabel')}>
            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.previousArrow}`}
              aria-label={t('previous')}
              onClick={showPreviousBanner}
            >
              {PREVIOUS_SYMBOL}
            </button>
            <button
              type="button"
              className={`${styles.carouselArrow} ${styles.nextArrow}`}
              aria-label={t('next')}
              onClick={showNextBanner}
            >
              {NEXT_SYMBOL}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
