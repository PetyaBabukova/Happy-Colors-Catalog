//happy-colors-nextjs-project/src/app/products/ProductCard.jsx

'use client';

import { useMemo, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useImageSlideshow from '@/hooks/useImageSlideshow';
import { normalizeImageUrls } from '@/utils/normalizeImageUrls';
import styles from './shop.module.css';

export default function ProductCard({ product }) {
    const containerRef = useRef(null);
    const imageUrls = useMemo(() => normalizeImageUrls(product), [product]);
    const { currentIndex, pause, resume } = useImageSlideshow(imageUrls, 4000, {
        observeRef: containerRef,
        resetKey: product._id,
    });

    return (
        <Link href={`/products/${product._id}`} className={styles.product}>
            <div
                ref={containerRef}
                className={styles.productImageContainer}
                onMouseEnter={pause}
                onMouseLeave={resume}
            >
                {imageUrls.length > 0 ? (
                    <div
                        className={styles.productImageTrack}
                        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                    >
                        {imageUrls.map((url, index) => (
                            <div
                                key={`${url}-${index}`}
                                className={styles.productImageSlide}
                                aria-hidden={index !== currentIndex}
                            >
                                <Image
                                    src={url}
                                    alt={product.title}
                                    width={1200}
                                    height={1200}
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                    className={styles.productImage}
                                    priority={false}
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
            <h4 className={styles.productTitle}>{product.title}</h4>
            {/* <p>{isCatalogMode ? 'Цена при запитване' : `Цена: ${product.price} €`}</p> */}
        </Link>
    );
}
