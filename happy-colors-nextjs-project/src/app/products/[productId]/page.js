// happy-colors-nextjs-project/src/app/products/[productId]/page.js

import ProductDetails from './ProductDetails';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/getProduct';

export async function generateMetadata({ params: paramsPromise }) {
  const { productId } = await paramsPromise;

  const product = await getProduct(productId);

  if (!product) {
    return {
      title: 'Продуктът не е намерен',
      description: 'Опитайте отново или изберете друг продукт.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const categoryName = product.category?.name;
  const titleParts = [product.title, categoryName].filter(Boolean);

  return {
    title: titleParts.join(' | '),
    description: categoryName
      ? `${product.title} – ${categoryName.toLowerCase()} от Happy Colors. Ръчно изработено изделие с внимание към детайла, подходящо за подарък, декорация за дома или специален повод.`
      : `${product.title} от Happy Colors. Ръчно изработено изделие с внимание към детайла, подходящо за подарък, декорация за дома или специален повод.`,
    alternates: {
      canonical: `/products/${productId}`,
    },
  };
}

export default async function ProductDetailsPage({ params: paramsPromise }) {
  const { productId } = await paramsPromise;

  const product = await getProduct(productId);

  if (!product) {
    notFound();
  }

  return <ProductDetails product={product} />;
}
