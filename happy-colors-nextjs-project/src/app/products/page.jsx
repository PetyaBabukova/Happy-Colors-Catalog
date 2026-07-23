// happy-colors-nextjs-project/src/app/products/page.jsx

import { getProducts } from '@/managers/productsManager';
import { buildLocalizedAlternates } from '@/config/siteSeo';
import { getProductsPageContent } from '@/content/publicPages/products';
import Shop from './Shop';

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getProductsPageContent(locale);

  return {
    ...content.metadata,
    alternates: buildLocalizedAlternates('/products', locale),
  };
}

export default async function ProductsPage(props) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const locale = params?.locale;
  const category = searchParams?.category || null;

  const allProducts = await getProducts(category, { locale });

  return <Shop products={allProducts} />;
}
