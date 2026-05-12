'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { deleteHomeBanner } from '@/managers/homeBannersManager';
import styles from './HomeHeroCarousel.module.css';

const ROTATION_INTERVAL_MS = 6000;

export default function HomeHeroCarousel({ banners = [] }) {
  const router = useRouter();
  const { user } = useAuth();
  const activeBanners = useMemo(() => banners.filter((banner) => banner?.imageUrl), [banners]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [deletingBannerId, setDeletingBannerId] = useState('');

  useEffect(() => {
    setCurrentIndex(0);
  }, [activeBanners.length]);

  useEffect(() => {
    if (activeBanners.length <= 1) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % activeBanners.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [activeBanners.length]);

  if (activeBanners.length === 0) {
    return (
      <section className={`${styles.emptyHero} pageInline`}>
        <div className={styles.fallbackContent}>
          <h1>Плетени играчки, аксесоари и декорация за дома</h1>
          <p>Ръчно изработени изделия за подарък, уют и специални поводи.</p>
          <Link href="/products" className={styles.ctaLink}>Каталог</Link>
        </div>
      </section>
    );
  }

  const currentBanner = activeBanners[currentIndex];

  async function handleDeleteBanner(bannerId) {
    if (!window.confirm('Сигурни ли сте, че искате да изтриете този хоум банер?')) {
      return;
    }

    try {
      setDeletingBannerId(bannerId);
      await deleteHomeBanner(bannerId);
      router.refresh();
    } finally {
      setDeletingBannerId('');
    }
  }

  return (
    <section className={`${styles.carousel} pageInline`} aria-label="Начални банери">
      <div className={styles.mediaFrame}>
        <img
          key={currentBanner._id}
          src={currentBanner.imageUrl}
          alt={currentBanner.title}
          className={styles.bannerImage}
          fetchPriority={currentIndex === 0 ? 'high' : 'auto'}
        />
        <div className={styles.content}>
          <div className={styles.headingRow}>
            <h2>{currentBanner.title}</h2>
            <Link href={currentBanner.ctaHref} className={styles.ctaLink}>
              {currentBanner.ctaLabel}
              <span aria-hidden="true" className={styles.arrowGroup}>
                <span>›</span>
                <span>›</span>
                <span>›</span>
              </span>
            </Link>
          </div>
          {currentBanner.description && <p>{currentBanner.description}</p>}
        </div>

        {user && (
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
      </div>

      {activeBanners.length > 1 && (
        <div className={styles.carouselControls} aria-label="Избор на банер">
          {activeBanners.map((banner, index) => (
            <button
              key={banner._id}
              type="button"
              className={`${styles.dotButton} ${index === currentIndex ? styles.activeDot : ''}`}
              aria-label={`Покажи банер ${index + 1}`}
              aria-current={index === currentIndex ? 'true' : undefined}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
