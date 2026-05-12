'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import MessageBox from '@/components/ui/MessageBox';
import { useAuth } from '@/context/AuthContext';
import { getProducts, updateHomepageFeaturedProducts } from '@/managers/productsManager';
import { normalizeImageUrls } from '@/utils/normalizeImageUrls';
import styles from './HomepageFeatured.module.css';

const FEATURED_LIMIT = 4;

function getProductImage(product) {
  return normalizeImageUrls(product)[0] || '/logo_64pxH.svg';
}

function sortFeaturedProducts(products) {
  return [...products].sort((a, b) => {
    const orderA = Number(a.homepageFeaturedOrder) || 0;
    const orderB = Number(b.homepageFeaturedOrder) || 0;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return String(a._id).localeCompare(String(b._id));
  });
}

export default function HomepageFeaturedClient() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.push('/users/login');
      return;
    }

    let cancelled = false;

    setLoadingProducts(true);
    getProducts()
      .then((loadedProducts) => {
        if (cancelled) {
          return;
        }

        setProducts(loadedProducts);
        setSelectedIds(
          sortFeaturedProducts(
            loadedProducts.filter((product) => product?.isHomepageFeatured)
          ).map((product) => product._id)
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProducts(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, router, user]);

  const productsById = useMemo(
    () => new Map(products.map((product) => [product._id, product])),
    [products]
  );
  const selectedProducts = selectedIds
    .map((productId) => productsById.get(productId))
    .filter(Boolean);
  const availableSelectionCount = selectedProducts.filter(
    (product) => product.availability !== 'unavailable'
  ).length;
  const unselectedProducts = products.filter((product) => !selectedIds.includes(product._id));
  const hasUnavailableSelected = selectedProducts.some(
    (product) => product.availability === 'unavailable'
  );

  function toggleProduct(product) {
    setError('');
    setSuccess('');

    if (selectedIds.includes(product._id)) {
      setSelectedIds((current) => current.filter((productId) => productId !== product._id));
      return;
    }

    if (product.availability === 'unavailable') {
      setError('Неналичен продукт не може да бъде добавен към началната страница.');
      return;
    }

    if (selectedIds.length >= FEATURED_LIMIT) {
      setError(`Можете да изберете най-много ${FEATURED_LIMIT} продукта.`);
      return;
    }

    setSelectedIds((current) => [...current, product._id]);
  }

  function moveProduct(productId, direction) {
    setSelectedIds((current) => {
      const next = [...current];
      const index = next.indexOf(productId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= next.length) {
        return current;
      }

      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  async function handleSave() {
    setError('');
    setSuccess('');

    if (!window.confirm('Това ще промени продуктите на началната страница. Продължавате ли?')) {
      return;
    }

    try {
      setSaving(true);
      await updateHomepageFeaturedProducts(selectedIds);
      setProducts((currentProducts) =>
        currentProducts.map((product) => {
          const selectedIndex = selectedIds.indexOf(product._id);

          return {
            ...product,
            isHomepageFeatured: selectedIndex >= 0,
            homepageFeaturedOrder: selectedIndex >= 0 ? selectedIndex : 0,
          };
        })
      );
      setSuccess('Любимите продукти за началната страница бяха обновени.');
      router.refresh();
    } catch (err) {
      setError(err.message || 'Възникна грешка при запазване.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loadingProducts) {
    return <p className="pageInline">Зареждане...</p>;
  }

  if (!user) {
    return null;
  }

  return (
    <main className={`${styles.page} pageInline`}>
      <h1>Избери любими продукти</h1>

      {error && <MessageBox type="error" message={error} />}
      {success && <MessageBox type="success" message={success} />}
      {hasUnavailableSelected && (
        <MessageBox
          type="error"
          message="Има избран продукт, който вече е неналичен. Той няма да се вижда публично, докато не стане наличен или докато не го махнете от списъка."
        />
      )}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Избрани</h2>
          <span className={styles.counter}>избрани {selectedIds.length} / {FEATURED_LIMIT}</span>
        </div>

        {selectedProducts.length > 0 ? (
          <div className={styles.productList}>
            {selectedProducts.map((product, index) => (
              <article key={product._id} className={styles.productRow}>
                <ProductThumb product={product} />
                <div className={styles.productInfo}>
                  <h3>{product.title}</h3>
                  <p>{product.category?.name || 'Без категория'}</p>
                  {product.availability === 'unavailable' && (
                    <p className={styles.warning}>Неналичен - няма да се показва публично</p>
                  )}
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => moveProduct(product._id, -1)}
                    disabled={index === 0 || saving}
                    aria-label={`Премести ${product.title} нагоре`}
                    title="Нагоре"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => moveProduct(product._id, 1)}
                    disabled={index === selectedProducts.length - 1 || saving}
                    aria-label={`Премести ${product.title} надолу`}
                    title="Надолу"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={`${styles.iconButton} ${styles.removeButton}`}
                    onClick={() => toggleProduct(product)}
                    disabled={saving}
                    aria-label={`Махни ${product.title}`}
                    title="Махни"
                  >
                    ×
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>Няма избрани продукти.</p>
        )}
      </section>

      <section className={styles.section}>
        <h2>Всички продукти</h2>
        <div className={styles.productList}>
          {unselectedProducts.map((product) => {
            const isUnavailable = product.availability === 'unavailable';

            return (
              <article key={product._id} className={`${styles.productRow} ${isUnavailable ? styles.disabledRow : ''}`}>
                <ProductThumb product={product} />
                <div className={styles.productInfo}>
                  <h3>{product.title}</h3>
                  <p>{product.category?.name || 'Без категория'}</p>
                  <p>{isUnavailable ? 'Неналичен' : 'Наличен'}</p>
                </div>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.iconButton}
                    onClick={() => toggleProduct(product)}
                    disabled={saving || isUnavailable || selectedIds.length >= FEATURED_LIMIT}
                    aria-label={`Добави ${product.title}`}
                    title="Добави"
                  >
                    ✓
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className={styles.saveBar}>
        <button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Запазване...' : 'Запази'}
        </button>
      </div>
    </main>
  );
}

function ProductThumb({ product }) {
  return (
    <div className={styles.thumb}>
      <Image
        src={getProductImage(product)}
        alt={product.title}
        width={96}
        height={96}
        className={styles.thumbImage}
      />
    </div>
  );
}
