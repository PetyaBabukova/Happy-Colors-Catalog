import Link from 'next/link';
import ProductCard from './products/ProductCard';
import HomeHeroCarousel from '@/components/home-banners/HomeHeroCarousel';
import { buildLocalizedAlternates } from '@/config/siteSeo';
import { getHomePageContent } from '@/content/publicPages/home';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import { getHomeBanners } from '@/managers/homeBannersManager';
import { getHomepageFeaturedProducts } from '@/managers/productsManager';
import styles from './page.module.css';
import shopStyles from './products/shop.module.css';

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getHomePageContent(locale);

  return {
    ...content.metadata,
    alternates: buildLocalizedAlternates('/', locale),
  };
}

export default async function Home(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getHomePageContent(locale);
  const publicHref = (href) => getServerPublicHref(href, locale);

  const [banners, favoriteProducts] = await Promise.all([
    getHomeBanners({ locale }),
    getHomepageFeaturedProducts({ locale }),
  ]);

  return (
    <>
      <HomeHeroCarousel banners={banners} />

      <section className={`${styles.introSection} pageInline`}>
        <h1>{content.intro.title}</h1>
        <p>{content.intro.text}</p>
      </section>

      {favoriteProducts.length > 0 && (
        <section className={`${styles.favoriteSection} pageInline`}>
          <h2>{content.favoritesTitle}</h2>
          <div className={shopStyles.productList}>
            {favoriteProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className={`${styles.faqSection} pageInline`}>
        <Link href={publicHref('/faq')} className={styles.faqLink}>
          <span>{content.faqLinkLabel}</span>
          <span aria-hidden="true" className={styles.faqArrowGroup}>
            <span>&rsaquo;</span>
            <span>&rsaquo;</span>
            <span>&rsaquo;</span>
          </span>
        </Link>
      </section>
    </>
  );
}
