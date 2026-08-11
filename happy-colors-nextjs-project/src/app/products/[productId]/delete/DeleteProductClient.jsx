'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import {
  canRequestPublicProductRevalidation,
  revalidatePublicProductSurfaces,
} from '@/managers/productsManager';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import { checkProductAccess } from '@/utils/checkProductAccess';
import MessageBox from '@/components/ui/MessageBox';
import styles from './delete.module.css';
import baseURL from '@/config';

export default function DeleteProductClient({ params }) {
  const { productId } = typeof params?.then === 'function' ? use(params) : params;
  const { user, loading } = useAuth();
  const { triggerCategoriesReload } = useProducts();
  const router = useRouter();
  const { publicHref } = useLocaleNavigation();

  const [product, setProduct] = useState(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading || !productId) return;

    checkProductAccess(productId, user).then(({ product, unauthorized, error: accessError }) => {
      setProduct(product);
      setUnauthorized(unauthorized);
      if (accessError) {
        setError('Грешка при зареждане на продукта.');
      }
    });
  }, [productId, user, loading]);

  const handleDelete = async () => {
    try {
      const res = await fetch(`${baseURL}/products/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) throw new Error('Грешка при изтриването');

      triggerCategoriesReload();
      if (canRequestPublicProductRevalidation(user)) {
        await revalidatePublicProductSurfaces(productId);
      }
      router.push(publicHref('/products'));
      router.refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p className={styles.message}>Зареждане...</p>;
  if (unauthorized) return <MessageBox type="error" message="Нямате права да премахнете този продукт." />;
  if (error) return <MessageBox type="error" message={`Грешка: ${error}`} />;

  return (
    <div className={styles.deleteContainer}>
      <h2>Сигурни ли сте, че искате да изтриете &quot;{product?.title}&quot;?</h2>
      <div className={styles.buttons}>
        <button className={styles.deleteBtn} onClick={handleDelete}>Да</button>
        <button className={styles.cancelBtn} onClick={() => router.push(publicHref(`/products/${productId}`))}>Отказ</button>
      </div>
    </div>
  );
}
