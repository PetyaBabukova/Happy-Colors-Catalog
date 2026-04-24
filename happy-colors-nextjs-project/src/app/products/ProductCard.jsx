//happy-colors-nextjs-project/src/app/products/ProductCard.jsx

'use client';

import { useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useImageSlideshow from '@/hooks/useImageSlideshow';
import { normalizeImageUrls } from '@/utils/normalizeImageUrls';
import { normalizeProductVideosForSeo } from '@/utils/productSeo';
import styles from './shop.module.css';

function buildCardMediaSlides(product) {
  const imageSlides = normalizeImageUrls(product).map((url, index) => ({
    url,
    type: 'image',
    key: `image-${url}-${index}`,
  }));
  const videoSlides = normalizeProductVideosForSeo(product?.videos).map((video, index) => ({
    url: video.posterUrl,
    type: 'video-poster',
    key: `video-${video.url}-${index}`,
  }));

  return [...imageSlides, ...videoSlides];
}

export default function ProductCard({ product }) {
  const containerRef = useRef(null);
  const mediaSlides = useMemo(() => buildCardMediaSlides(product), [product]);
  const mediaUrls = useMemo(() => mediaSlides.map((slide) => slide.url), [mediaSlides]);
  const { currentIndex, pause, resume } = useImageSlideshow(mediaUrls, 4000, {
    observeRef: containerRef,
    resetKey: product._id,
  });
  const currentSlide = mediaSlides[currentIndex] || mediaSlides[0] || null;
  const hasVideos = mediaSlides.some((slide) => slide.type === 'video-poster');

  return (
    <Link href={`/products/${product._id}`} className={styles.product}>
      <div
        ref={containerRef}
        className={styles.productImageContainer}
        onMouseEnter={pause}
        onMouseLeave={resume}
      >
        {currentSlide ? (
          <Image
            key={currentSlide.key}
            src={currentSlide.url}
            alt={product.title}
            width={1200}
            height={1200}
            sizes="(max-width: 768px) 90vw, (max-width: 1200px) 45vw, 22vw"
            className={styles.productImage}
            priority={false}
            loading="lazy"
          />
        ) : null}

        {hasVideos && (
          <span className={styles.productVideoBadge}>
            Видео
          </span>
        )}
      </div>
      <h4 className={styles.productTitle}>{product.title}</h4>
      {/* <p>{isCatalogMode ? 'Цена при запитване' : `Цена: ${product.price} €`}</p> */}
    </Link>
  );
}
