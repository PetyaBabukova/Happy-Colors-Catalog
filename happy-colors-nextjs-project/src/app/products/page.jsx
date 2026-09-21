// happy-colors-nextjs-project/src/app/products/page.jsx

import { getProducts } from '@/managers/productsManager';
import { getVisibleCategoryRedirectCandidatesSeed } from '@/managers/categoriesManager';
import { buildPageMetadata } from '@/config/siteSeo';
import { getProductsPageContent } from '@/content/publicPages/products';
import { getServerRedirectHref } from '@/i18n/serverNavigation';
import { permanentRedirect, redirect } from 'next/navigation';
import {
  buildCategoryProductsBreadcrumbJsonLd,
  buildCategoryProductsMetadata,
  buildCategoryProductsPageContent,
} from './categoryMetadata';
import {
  findIndexableCategoryByCanonicalSlug,
  readFirstSearchParam,
  resolveCategoryRedirect,
} from './categoryRedirects';
import Shop from './Shop';
import { stringifyJsonLd } from '@/utils/jsonLd';

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const locale = params?.locale;
  const category = readFirstSearchParam(searchParams?.category);
  const content = getProductsPageContent(locale);

  if (category) {
    const visibleCategoryRedirects = await getVisibleCategoryRedirectCandidatesSeed({ locale });
    const categoryRedirect = visibleCategoryRedirects.loaded
      ? resolveCategoryRedirect({
          categories: visibleCategoryRedirects.categories,
          locale,
          searchParams,
        })
      : null;
    const indexableCategory =
      visibleCategoryRedirects.loaded && !categoryRedirect
        ? findIndexableCategoryByCanonicalSlug({
            categories: visibleCategoryRedirects.categories,
            locale,
            category,
          })
        : null;

    if (indexableCategory) {
      return buildPageMetadata(buildCategoryProductsMetadata(indexableCategory, locale));
    }
  }

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
  const visibleCategoryRedirects = category
    ? await getVisibleCategoryRedirectCandidatesSeed({ locale })
    : { categories: [], loaded: true };
  const categoryRedirect = visibleCategoryRedirects.loaded
    ? resolveCategoryRedirect({
        categories: visibleCategoryRedirects.categories,
        locale,
        searchParams,
      })
    : null;

  if (categoryRedirect?.type === 'permanent') {
    permanentRedirect(getServerRedirectHref(categoryRedirect.target, locale));
  }

  if (categoryRedirect?.type === 'temporary') {
    redirect(getServerRedirectHref(categoryRedirect.target, locale));
  }

  const indexableCategory =
    category && visibleCategoryRedirects.loaded
      ? findIndexableCategoryByCanonicalSlug({
          categories: visibleCategoryRedirects.categories,
          locale,
          category,
        })
      : null;
  const allProducts = await getProducts(category, { locale });
  const breadcrumbJsonLd = indexableCategory
    ? buildCategoryProductsBreadcrumbJsonLd(indexableCategory, locale)
    : null;

  return (
    <>
      {breadcrumbJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumbJsonLd) }}
        />
      ) : null}
      <Shop
        products={allProducts}
        pageContent={
          indexableCategory
            ? buildCategoryProductsPageContent(indexableCategory, locale)
            : null
        }
      />
    </>
  );
}
