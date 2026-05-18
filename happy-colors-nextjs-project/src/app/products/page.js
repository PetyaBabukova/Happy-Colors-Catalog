// happy-colors-nextjs-project/src/app/products/page.js

import { getProducts } from '@/managers/productsManager';
import Shop from './Shop';

export const metadata = {
  title: 'Плетени играчки, аксесоари и декорация за дома – каталог',
  description: 'Разгледай ръчно изработени плетени играчки, аксесоари и декорация за дома от Happy Colors (Хепи Колорс) – уникални модели за подарък, специални поводи и уютен интериор.',
  alternates: {
    canonical: '/products',
  },
};

export default async function ProductsPage(props) {
  const searchParams = await props.searchParams;
  const category = searchParams?.category || null;

  const allProducts = await getProducts(category);

  return <Shop products={allProducts} />;
}
