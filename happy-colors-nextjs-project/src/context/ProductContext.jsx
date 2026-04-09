'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import baseUrl from '@/config';
import { readResponseJsonSafely } from '@/utils/errorHandler';

const ProductContext = createContext();

export function ProductProvider({ children }) {
  const [categories, setCategories] = useState([]); // всички категории – за форми
  const [visibleCategories, setVisibleCategories] = useState([]); // за хедъра и shop
  const [products, setProducts] = useState([]); // резервираме за бъдеща нужда
  const [loading, setLoading] = useState(true);
  const [reloadFlag, setReloadFlag] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);

        // 1. Взимаме всички категории (обекти)
        const allCatsRes = await fetch(`${baseUrl}/categories`);

        if (!allCatsRes.ok) {
          throw new Error('Грешка при зареждане на категориите.');
        }

        const allCatsData = await readResponseJsonSafely(allCatsRes);
        setCategories(Array.isArray(allCatsData) ? allCatsData : []);

        // 2. Взимаме само видимите категории (обекти с поне 1 продукт)
        const visibleRes = await fetch(`${baseUrl}/categories/visible`);

        if (!visibleRes.ok) {
          throw new Error('Грешка при зареждане на видимите категории.');
        }

        const visibleData = await readResponseJsonSafely(visibleRes);
        setVisibleCategories(Array.isArray(visibleData) ? visibleData : []);
      } catch (err) {
        console.error('Грешка при зареждане на категориите:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [reloadFlag]);

  const triggerCategoriesReload = () => {
    setReloadFlag(prev => !prev);
  };

  return (
    <ProductContext.Provider
      value={{
        categories,
        visibleCategories,
        products,
        loading,
        triggerCategoriesReload,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export const useProducts = () => useContext(ProductContext);
