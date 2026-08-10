'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import baseUrl from '@/config';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import { readResponseJsonSafely } from '@/utils/errorHandler';

const ProductContext = createContext();

function normalizeInitialCategories(value) {
  return Array.isArray(value) ? value : [];
}

export function ProductProvider({
  children,
  initialVisibleCategories = [],
  initialVisibleCategoriesLoaded = true,
  initialVisibleCategoriesLocale,
}) {
  const { locale } = useLocaleNavigation();
  const explicitSeedLocale = initialVisibleCategoriesLocale || null;
  const [categories, setCategories] = useState([]);
  const [visibleCategories, setVisibleCategories] = useState(() =>
    normalizeInitialCategories(initialVisibleCategories)
  );
  const [visibleCategoriesLocale, setVisibleCategoriesLocale] = useState(() => explicitSeedLocale || locale);
  const [visibleCategoriesLoaded, setVisibleCategoriesLoaded] = useState(Boolean(initialVisibleCategoriesLoaded));
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (!explicitSeedLocale || explicitSeedLocale !== locale) {
      return;
    }

    setVisibleCategories(normalizeInitialCategories(initialVisibleCategories));
    setVisibleCategoriesLocale(explicitSeedLocale);
    setVisibleCategoriesLoaded(Boolean(initialVisibleCategoriesLoaded));
  }, [initialVisibleCategories, initialVisibleCategoriesLoaded, explicitSeedLocale, locale]);

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);

        const localeQuery = locale ? `?locale=${encodeURIComponent(locale)}` : '';
        const allCatsRes = await fetch(`${baseUrl}/categories${localeQuery}`);

        if (!allCatsRes.ok) {
          throw new Error('Failed to load categories.');
        }

        const allCatsData = await readResponseJsonSafely(allCatsRes);
        setCategories(Array.isArray(allCatsData) ? allCatsData : []);

        const shouldRefreshVisibleCategories =
          reloadVersion > 0 || !visibleCategoriesLoaded || visibleCategoriesLocale !== locale;

        if (!shouldRefreshVisibleCategories) {
          return;
        }

        const visibleRes = await fetch(`${baseUrl}/categories/visible${localeQuery}`);

        if (!visibleRes.ok) {
          throw new Error('Failed to load visible categories.');
        }

        const visibleData = await readResponseJsonSafely(visibleRes);
        setVisibleCategories(Array.isArray(visibleData) ? visibleData : []);
        setVisibleCategoriesLocale(locale);
        setVisibleCategoriesLoaded(true);
      } catch (err) {
        console.error('Failed to load product context categories:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
    // Only locale changes and explicit admin reloads should trigger network refreshes.
    // Seed state is read as the current snapshot for that route event.
  }, [locale, reloadVersion]);

  const triggerCategoriesReload = () => {
    setReloadVersion((prev) => prev + 1);
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
