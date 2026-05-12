// happy-colors-nextjs-project/src/app/page.js

import Link from 'next/link';
import HomeHeroCarousel from '@/components/home-banners/HomeHeroCarousel';
import ProductCard from './products/ProductCard';
import { getHomeBanners } from '@/managers/homeBannersManager';
import { getProducts } from '@/managers/productsManager';
import styles from './page.module.css';
import shopStyles from './products/shop.module.css';

const INTRO_TEXT = 'В Happy Colors ще откриете ръчно изработени плетени играчки, аксесоари и декорация за дома, създадени с внимание към всеки детайл. Колекцията включва красиви и оригинални изделия, подходящи за подарък, детска стая, празник или уютен акцент у дома. Ако нещо ви хареса, можете да се свържете с мен за наличност, въпроси и поръчка. Разгледайте галерията и открийте изделие с характер, изработено с грижа и стил.';

function getFavoriteProducts(products = []) {
  return products
    .filter((product) => product?.availability !== 'unavailable')
    .slice(0, 4);
}

export default async function Home() {
  const [banners, products] = await Promise.all([
    getHomeBanners(),
    getProducts(),
  ]);
  const favoriteProducts = getFavoriteProducts(products);

  return (
    <>
      <HomeHeroCarousel banners={banners} />

      <section className={`${styles.introSection} pageInline`}>
        <h1>Плетени играчки, аксесоари и декорация за дома</h1>
        <p>{INTRO_TEXT}</p>
      </section>

      {favoriteProducts.length > 0 && (
        <section className={`${styles.favoriteSection} pageInline`}>
          <h2>Най-любимите ви продукти</h2>
          <div className={shopStyles.productList}>
            {favoriteProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className={`${styles.faqSection} pageInline`}>
        <Link href="/faq" className={styles.faqLink}>
          <span>Често задавани въпроси</span>
          <span aria-hidden="true" className={styles.faqArrowGroup}>
            <span>›</span>
            <span>›</span>
            <span>›</span>
          </span>
        </Link>
      </section>
    </>
  );
}
