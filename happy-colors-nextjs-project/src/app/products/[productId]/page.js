// happy-colors-nextjs-project/src/app/products/[productId]/page.js

import ProductDetails from './ProductDetails';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/getProduct';
import {
  buildProductJsonLd,
  buildProductMetadata,
  stringifyJsonLd,
} from '@/utils/productSeo';

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

  return buildProductMetadata(product, productId);
}

export default async function ProductDetailsPage({ params: paramsPromise }) {
  const { productId } = await paramsPromise;

  const product = await getProduct(productId);

  if (!product) {
    notFound();
  }

  const productJsonLd = buildProductJsonLd(product);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(productJsonLd) }}
      />
      <ProductDetails product={product} />
    </>
  );
}
