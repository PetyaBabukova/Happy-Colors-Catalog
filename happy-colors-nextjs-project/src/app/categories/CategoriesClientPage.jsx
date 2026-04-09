'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import baseURL from '@/config';
import { readResponseJsonSafely } from '@/utils/errorHandler';
import styles from './categories.module.css';

export default function CategoriesManagerPage() {
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const res = await fetch(`${baseURL}/categories`);

      if (!res.ok) {
        throw new Error('Грешка при зареждане на категориите.');
      }

      const data = await readResponseJsonSafely(res);
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Грешка при зареждане на категориите.');
    }
  }

  async function handleDelete(id, name) {
    const confirm = window.confirm(
      `Сигурни ли сте, че искате да изтриете категория "${name}"?`
    );

    if (!confirm) return;

    try {
      const res = await fetch(`${baseURL}/categories/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await readResponseJsonSafely(res);

      if (!res.ok) {
        throw new Error(result?.message || 'Неуспешно изтриване.');
      }

      alert(result?.message || 'Категорията е изтрита.');

      fetchCategories();
    } catch (err) {
      setError(err.message || 'Неуспешно изтриване.');
    }
  }

  return (
    <div className={styles.categoriesWrapper}>
      <div className={styles.categoriesInner}>
        <h2 className={styles.categoriesTitle}>
          Управление на категории
        </h2>

        {error && <p className={styles.errorMessage}>{error}</p>}

        <ul className={styles.categoriesList}>
          {categories.map((cat) => (
            <li key={cat._id} className={styles.categoryItem}>
              <span className={styles.categoryName}>{cat.name}</span>

              <div className={styles.categoryActions}>
                <Link
                  href={`/categories/${cat._id}/edit`}
                  className={styles.editLink}
                  title="Редактирай"
                >
                  ✎
                </Link>

                {cat.name !== 'Други' && (
                  <a
                    onClick={() => handleDelete(cat._id, cat.name)}
                    title="Изтрий"
                    className={styles.deleteLink}
                  >
                    ×
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}