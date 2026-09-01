// happy-colors-nextjs-project/src/app/products/page.jsx

import { getProducts } from '@/managers/productsManager';
import { getVisibleCategories } from '@/managers/categoriesManager';
import { buildPageMetadata } from '@/config/siteSeo';
import { getProductsPageContent } from '@/content/publicPages/products';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import { permanentRedirect } from 'next/navigation';
import Shop from './Shop';

const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readFirstSearchParam(value) {
  if (Array.isArray(value)) {
    return value[0] || '';
  }

  return String(value || '').trim();
}

function normalizeCategoryNameMatch(value) {
  return String(value || '').trim().toLowerCase();
}

function getCategoryCanonicalFilter(category) {
  return String(category?.filterSlug || category?.slug || '').trim();
}

function findCanonicalCategoryRedirect(categories, rawCategory) {
  const categoryFilter = readFirstSearchParam(rawCategory);

  if (!categoryFilter || CATEGORY_SLUG_PATTERN.test(categoryFilter)) {
    return '';
  }

  const normalizedFilter = normalizeCategoryNameMatch(categoryFilter);
  const matchedCategory = categories.find((category) => {
    const canonicalFilter = getCategoryCanonicalFilter(category);

    if (!canonicalFilter) {
      return false;
    }

    return normalizeCategoryNameMatch(category?.name) === normalizedFilter;
  });

  return getCategoryCanonicalFilter(matchedCategory);
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getProductsPageContent(locale);

  return buildPageMetadata({
    ...content.metadata,
    path: '/products',
    locale,
  });
}

export default async function ProductsPage(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const locale = params?.locale;
  const category = readFirstSearchParam(searchParams?.category);
  const visibleCategories =
    category && !CATEGORY_SLUG_PATTERN.test(category) ? await getVisibleCategories({ locale }) : [];
  const canonicalCategory = findCanonicalCategoryRedirect(visibleCategories, category);

  if (canonicalCategory && canonicalCategory !== category) {
    permanentRedirect(getServerPublicHref(`/products?category=${encodeURIComponent(canonicalCategory)}`, locale));
  }

  const allProducts = await getProducts(category, { locale });

  return <Shop products={allProducts} />;
}
