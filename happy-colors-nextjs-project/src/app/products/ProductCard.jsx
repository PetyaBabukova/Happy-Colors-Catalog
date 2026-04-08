//happy-colors-nextjs-project/src/app/products/ProductCard.jsx

'use client';

import Link from 'next/link';
import { isCatalogMode } from '@/utils/catalogMode';
import styles from './shop.module.css';

export default function ProductCard({ product }) {
    return (
        <Link href={`/products/${product._id}`} className={styles.product}>
            <div className={styles.productImageContainer}>
                <img src={product.imageUrl} alt={product.title} />
            </div>
            <h4 className={styles.productTitle}>{product.title}</h4>
            {/* <p>{isCatalogMode ? 'Цена при запитване' : `Цена: ${product.price} €`}</p> */}
        </Link>
    );
}
