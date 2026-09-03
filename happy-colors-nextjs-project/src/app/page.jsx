import Image from 'next/image';
import Link from 'next/link';
import ProductCard from './products/ProductCard';
import HomeHeroCarousel from '@/components/home-banners/HomeHeroCarousel';
import { buildPageMetadata } from '@/config/siteSeo';
import { getGiftsPageContent } from '@/content/publicPages/gifts';
import { getHomePageContent } from '@/content/publicPages/home';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import { getHomeBanners } from '@/managers/homeBannersManager';
import { getHomepageFeaturedProducts } from '@/managers/productsManager';
import styles from './page.module.css';
import shopStyles from './products/shop.module.css';

const HOME_GIFT_GUIDE_IMAGES = {
  '/gifts/gifts-for-children': '/images/gifts/gifts_for_children_hero.webp',
  '/gifts/handmade-crochet-toy-gift': '/images/gifts/crochet_toy_gift_hero.webp',
  '/gifts/original-handmade-gift': '/images/gifts/original_handmade_gift_hero.webp',
};
const NEXT_SYMBOL = '\u203a';

function ArrowGroup({ className }) {
  return (
    <span aria-hidden="true" className={className}>
      <span>{NEXT_SYMBOL}</span>
      <span>{NEXT_SYMBOL}</span>
      <span>{NEXT_SYMBOL}</span>
    </span>
  );
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getHomePageContent(locale);

  return buildPageMetadata({
    ...content.metadata,
    path: '/',
    locale,
  });
}

export default async function Home(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getHomePageContent(locale);
  const giftsContent = getGiftsPageContent(locale);
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

      <section className={`${styles.giftIdeasSection} pageInline`} aria-labelledby="home-gift-ideas">
        <div className={styles.giftIdeasHeader}>
          <h2 id="home-gift-ideas">{content.giftIdeas.title}</h2>
        </div>
        <div className={styles.giftIdeasGrid}>
          {content.giftIdeas.cards.map((card) => {
            const imageSrc = HOME_GIFT_GUIDE_IMAGES[card.href];

            return (
              <Link key={card.href} href={publicHref(card.href)} className={styles.giftIdeaCard}>
                {imageSrc && (
                  <div className={styles.giftIdeaImageSlot} aria-hidden="true">
                    <Image
                      src={imageSrc}
                      alt=""
                      width={800}
                      height={600}
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className={styles.giftIdeaImage}
                    />
                  </div>
                )}
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <span className={styles.giftIdeaCardAction}>
                  {giftsContent.hub.browseLabel}
                  <ArrowGroup className={styles.giftIdeasArrowGroup} />
                </span>
              </Link>
            );
          })}
        </div>
        <Link href={publicHref('/gifts')} className={styles.giftIdeasLink}>
          {content.giftIdeas.hubCta}
          <ArrowGroup className={styles.giftIdeasArrowGroup} />
        </Link>
      </section>

      <section className={`${styles.faqSection} pageInline`}>
        <Link href={publicHref('/faq')} className={styles.faqLink}>
          <span>{content.faqLinkLabel}</span>
          <ArrowGroup className={styles.faqArrowGroup} />
        </Link>
      </section>
    </>
  );
}
