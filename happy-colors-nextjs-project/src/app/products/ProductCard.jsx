//happy-colors-nextjs-project/src/app/products/ProductCard.jsx

'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useImageSlideshow from '@/hooks/useImageSlideshow';
import { buildProductHref } from '@/utils/cartoonServiceRoutes';
import { normalizeImageUrls } from '@/utils/normalizeImageUrls';
import { normalizeProductVideosForSeo } from '@/utils/productSeo';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import useTranslations from '@/i18n/useTranslations';
import styles from './shop.module.css';

function buildCardMediaSlides(product) {
  const imageSlides = normalizeImageUrls(product).map((url, index) => ({
    type: 'image',
    imageUrl: url,
    key: `image-${url}-${index}`,
  }));
  const videoSlides = normalizeProductVideosForSeo(product?.videos).map((video, index) => ({
    type: 'video',
    posterUrl: video.posterUrl,
    videoUrl: video.url,
    mimeType: video.mimeType || 'video/mp4',
    key: `video-${video.url}-${index}`,
  }));

  return [...imageSlides, ...videoSlides];
}

export default function ProductCard({ product, serviceContext = '' }) {
  const { publicHref } = useLocaleNavigation();
  const { t } = useTranslations();
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const mediaSlides = useMemo(() => buildCardMediaSlides(product), [product]);
  const { currentItem: currentSlide, isInView, pause, resume } = useImageSlideshow(mediaSlides, 4000, {
    observeRef: containerRef,
    exposeInViewState: true,
    resetKey: product._id,
  });

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    if (!isInView || currentSlide?.type !== 'video') {
      video.pause();
      return;
    }

    const playPromise = video.play();

    if (playPromise?.catch) {
      playPromise.catch(() => {
        // Listing cards use muted autoplay; if the browser blocks it, the poster remains visible.
      });
    }

    return () => {
      video.pause();
    };
  }, [currentSlide?.key, currentSlide?.type, isInView]);

  const shouldRenderVideo = currentSlide?.type === 'video' && isInView;
  const isAvailable = product?.availability !== 'unavailable';
  const showAvailabilityBadge = isAvailable && serviceContext !== 'cartoons';
  const isTranslationPending = product?.translationPending && product?.contentLocale === 'bg';

  return (
    <Link href={publicHref(buildProductHref(product._id, serviceContext))} className={styles.product}>
      <div
        ref={containerRef}
        data-testid="product-card-media"
        className={styles.productImageContainer}
        onMouseEnter={pause}
        onMouseLeave={resume}
      >
        {showAvailabilityBadge && (
          <span className={styles.availabilityBadge}>{t('products.availableBadge')}</span>
        )}
        {isTranslationPending && (
          <span className={styles.translationBadge}>{t('products.translationPending')}</span>
        )}

        {shouldRenderVideo ? (
          <video
            ref={videoRef}
            key={currentSlide.key}
            muted
            autoPlay
            loop
            playsInline
            preload="metadata"
            poster={currentSlide.posterUrl}
            className={styles.productImage}
            aria-label={t('products.videoLabel', { title: product.title })}
          >
            <source src={currentSlide.videoUrl} type={currentSlide.mimeType} />
          </video>
        ) : currentSlide?.type === 'video' ? (
          <Image
            key={currentSlide.key}
            src={currentSlide.posterUrl}
            alt={product.title}
            width={1200}
            height={1200}
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 22vw"
            className={styles.productImage}
            priority={false}
            loading="lazy"
          />
        ) : currentSlide ? (
          <Image
            key={currentSlide.key}
            src={currentSlide.imageUrl}
            alt={product.title}
            width={1200}
            height={1200}
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 22vw"
            className={styles.productImage}
            priority={false}
            loading="lazy"
          />
        ) : null}
      </div>
      <h4 className={styles.productTitle} lang={isTranslationPending ? 'bg' : undefined}>
        {product.title}
      </h4>
      {/* <p>{isCatalogMode ? 'Цена при запитване' : `Цена: ${product.price} €`}</p> */}
    </Link>
  );
}
