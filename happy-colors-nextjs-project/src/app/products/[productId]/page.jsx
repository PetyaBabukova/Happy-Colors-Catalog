// happy-colors-nextjs-project/src/app/products/[productId]/page.jsx

import ProductDetails from './ProductDetails';
import { notFound } from 'next/navigation';
import { getDictionary } from '@/i18n/getDictionary';
import { getProduct } from '@/lib/getProduct';
import { getReleasedServiceContext } from '@/config/cartoonsFeature';
import {
  buildProductJsonLd,
  buildProductMetadata,
  stringifyJsonLd,
} from '@/utils/productSeo';

export async function generateMetadata({ params: paramsPromise }) {
  const { productId, locale } = await paramsPromise;

  const product = await getProduct(productId, { locale });

  if (!product) {
    const dictionary = getDictionary(locale || 'bg');

    return {
      title: dictionary.products.notFoundTitle,
      description: dictionary.products.notFoundDescription,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildProductMetadata(product, productId, locale);
}

export default async function ProductDetailsPage({ params: paramsPromise, searchParams: searchParamsPromise }) {
  const { productId, locale } = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const serviceContext = getReleasedServiceContext(searchParams?.service);

  const product = await getProduct(productId, { locale });

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
      <ProductDetails product={product} serviceContext={serviceContext} />
    </>
  );
}
