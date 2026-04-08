//happy-colors-nextjs-project/src/app/products/ProductCard.jsx

'use client';

import Link from 'next/link';
import Image from 'next/image';
import styles from './shop.module.css';

export default function ProductCard({ product }) {
    return (
        <Link href={`/products/${product._id}`} className={styles.product}>
            <div className={styles.productImageContainer}>
                {product.imageUrl ? (
                    <Image
                        src={product.imageUrl}
                        alt={product.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        className={styles.productImage}
                    />
                ) : null}
            </div>
            <h4 className={styles.productTitle}>{product.title}</h4>
            {/* <p>{isCatalogMode ? 'Цена при запитване' : `Цена: ${product.price} €`}</p> */}
        </Link>
    );
}
