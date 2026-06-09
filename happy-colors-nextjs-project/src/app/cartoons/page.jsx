import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/app/products/ProductCard';
import shopStyles from '@/app/products/shop.module.css';
import CartoonsHeroCarousel from '@/components/home-banners/CartoonsHeroCarousel';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';
import { buildPageMetadata } from '@/config/siteSeo';
import { getCartoonHeroBanners } from '@/managers/homeBannersManager';
import { getCartoonGalleryProducts } from '@/managers/productsManager';
import styles from './cartoons.module.css';

const PAGE_TITLE = 'Шарж по снимка за специален подарък';
const PAGE_DESCRIPTION =
  'Поръчайте персонален шарж по снимка от Happy Colors с идея, повод и детайли, подходящи за специален подарък.';

export const revalidate = 60;

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
          <p>{PAGE_DESCRIPTION}</p>
          <Link className={styles.primaryAction} href="/contacts">
            Изпрати запитване
          </Link>
        </section>

        {galleryProducts.length > 0 && (
          <section className={`${styles.gallerySection} pageInline`}>
            <h2>Примери и варианти за шарж</h2>
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
