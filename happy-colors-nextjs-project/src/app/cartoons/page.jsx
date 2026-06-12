import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/app/products/ProductCard';
import shopStyles from '@/app/products/shop.module.css';
import CartoonsHeroCarousel from '@/components/home-banners/CartoonsHeroCarousel';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';
import { buildPageMetadata } from '@/config/siteSeo';
import { getCartoonHeroBanners } from '@/managers/homeBannersManager';
import { getCartoonGalleryProducts } from '@/managers/productsManager';
import { buildCartoonServiceContactHref } from '@/utils/cartoonServiceRoutes';
import styles from './cartoons.module.css';

const PAGE_TITLE = 'Шарж по снимка за подарък с усмивка';
const PAGE_DESCRIPTION =
  'Превърнете любима снимка в забавен персонален шарж — за рожден ден, юбилей, сватба, годишнина или друг специален повод. Кажете ни идеята, изпратете снимка, а ние, ще създадем артистичен портрет с настроение, характер и щипка закачка. За повече информация изпратете запитване.';

export function generateMetadata() {
  if (!isCartoonsServiceEnabled) {
    return {
      title: 'Страницата не е намерена',
      description: 'Тази страница не е достъпна.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildPageMetadata({
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    path: '/cartoons',
    indexable: true,
  });
}

export default async function CartoonsPage() {
  if (!isCartoonsServiceEnabled) {
    notFound();
  }

  const [banners, galleryProducts] = await Promise.all([
    getCartoonHeroBanners(),
    getCartoonGalleryProducts(),
  ]);

  return (
    <>
      <CartoonsHeroCarousel banners={banners} />

      <main className={styles.page}>
        <section className={`${styles.introSection} pageInline`}>
          <h1>{PAGE_TITLE}</h1>
          <p>
            Превърнете любима снимка в забавен персонален шарж — за рожден ден, юбилей,
            сватба, годишнина или друг специален повод. Кажете ни идеята, изпратете снимка,
            а ние, ще създадем артистичен портрет с настроение, характер и щипка закачка.
            За повече информация{' '}
            <Link href={buildCartoonServiceContactHref()} className={styles.inquiryLink}>изпратете запитване.</Link>
          </p>
        </section>

        {galleryProducts.length > 0 && (
          <section className={`${styles.gallerySection} pageInline`}>
            {/* <h2>Шаржове направени от нас</h2> */}
            <div className={shopStyles.productList}>
              {galleryProducts.map((product) => (
                <ProductCard key={product._id} product={product} serviceContext="cartoons" />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
