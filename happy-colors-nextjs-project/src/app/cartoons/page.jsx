import { notFound } from 'next/navigation';
import Link from 'next/link';
import ProductCard from '@/app/products/ProductCard';
import shopStyles from '@/app/products/shop.module.css';
import CartoonsHeroCarousel from '@/components/home-banners/CartoonsHeroCarousel';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';
import { buildPageMetadata } from '@/config/siteSeo';
import { getCartoonsPageContent } from '@/content/publicPages/cartoons';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import { getCartoonHeroBanners } from '@/managers/homeBannersManager';
import { getCartoonGalleryProducts } from '@/managers/productsManager';
import { buildCartoonServiceContactHref } from '@/utils/cartoonServiceRoutes';
import styles from './cartoons.module.css';

function renderRichTextParts(parts, publicHref) {
  return parts.map((part, index) => {
    if (typeof part === 'string') {
      return part;
    }

    return (
      <Link key={`${part.href}-${index}`} href={publicHref(part.href)} className={styles.inquiryLink}>
        {part.label}
      </Link>
    );
  });
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale || DEFAULT_LOCALE;
  const content = getCartoonsPageContent(locale);

  if (!isCartoonsServiceEnabled) {
    return {
      title: content.unavailable.title,
      description: content.unavailable.description,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildPageMetadata({
    title: content.metadata.title,
    description: content.metadata.description,
    path: '/cartoons',
    locale,
    indexable: true,
  });
}

export default async function CartoonsPage(props = {}) {
  if (!isCartoonsServiceEnabled) {
    notFound();
  }

  const params = await props.params;
  const locale = params?.locale || DEFAULT_LOCALE;
  const content = getCartoonsPageContent(locale);
  const publicHref = (href) => getServerPublicHref(href, locale);

  const [banners, galleryProducts] = await Promise.all([
    getCartoonHeroBanners({ locale }),
    getCartoonGalleryProducts({ locale }),
  ]);

  return (
    <>
      <CartoonsHeroCarousel banners={banners} />

      <main className={styles.page}>
        <section className={`${styles.introSection} pageInline`}>
          <h1>{content.intro.title}</h1>
          {content.intro.paragraphs.map((parts, index) => (
            <p key={index}>{renderRichTextParts(parts, publicHref)}</p>
          ))}
          <Link href={publicHref(buildCartoonServiceContactHref())} className={styles.inquiryButton}>
            {content.intro.ctaLabel}
          </Link>
        </section>

        {galleryProducts.length > 0 && (
          <section className={`${styles.gallerySection} pageInline`}>
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
