'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import baseUrl from '@/config';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import { stripPathLocale } from '@/i18n/routing';
import { readResponseJsonSafely } from '@/utils/errorHandler';

const ProductContext = createContext();

function normalizeInitialCategories(value) {
  return Array.isArray(value) ? value : [];
}

function shouldLoadAllCategoriesForPath(pathname) {
  const normalizedPath = stripPathLocale(pathname || '/');

  return normalizedPath === '/products/create' || /^\/products\/[^/]+\/edit$/.test(normalizedPath);
}

export function ProductProvider({
  children,
  initialVisibleCategories = [],
  initialVisibleCategoriesLoaded = true,
  initialVisibleCategoriesLocale,
}) {
  const { locale } = useLocaleNavigation();
  const pathname = usePathname();
  const explicitSeedLocale = initialVisibleCategoriesLocale || null;
  const shouldLoadAllCategories = shouldLoadAllCategoriesForPath(pathname);
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
        const shouldRefreshVisibleCategories =
          reloadVersion > 0 || !visibleCategoriesLoaded || visibleCategoriesLocale !== locale;

        if (!shouldLoadAllCategories && !shouldRefreshVisibleCategories) {
          setCategories([]);
          return;
        }

        if (shouldLoadAllCategories) {
          setCategories([]);
          const allCatsRes = await fetch(`${baseUrl}/categories${localeQuery}`);

          if (!allCatsRes.ok) {
            throw new Error('Failed to load categories.');
          }

          const allCatsData = await readResponseJsonSafely(allCatsRes);
          setCategories(Array.isArray(allCatsData) ? allCatsData : []);
        } else {
          setCategories([]);
        }

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
  }, [locale, reloadVersion, shouldLoadAllCategories]);

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
