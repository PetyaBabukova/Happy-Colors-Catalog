//happy-colors-nextjs-project/src/app/products/Shop.jsx

'use client';

import styles from './shop.module.css';
import ProductCard from './ProductCard';
import useTranslations from '@/i18n/useTranslations';

const OTHER_CATEGORY_NAMES = new Set(['\u0414\u0440\u0443\u0433\u0438', 'Other']);
const OTHER_CATEGORY_SLUGS = new Set(['drugi', 'other']);

function getAvailabilityRank(product) {
  return product?.availability === 'unavailable' ? 1 : 0;
}

function isOtherCategory(categoryName, category) {
  const normalizedName = String(categoryName || '').trim();
  const normalizedSlug = String(category?.filterSlug || category?.slug || '').trim().toLowerCase();

  return OTHER_CATEGORY_NAMES.has(normalizedName) || OTHER_CATEGORY_SLUGS.has(normalizedSlug);
}

export default function Shop({ products, showTitle = true }) {
  const { locale, t } = useTranslations();
  const grouped = {};

  products.forEach((product) => {
    const categoryName = product.category?.name || t('products.uncategorizedCategory');
    if (!grouped[categoryName]) {
      grouped[categoryName] = {
        category: product.category || null,
        products: [],
      };
    }
    grouped[categoryName].products.push(product);

  });

  Object.values(grouped).forEach((categoryGroup) => {
    categoryGroup.products.sort((a, b) => getAvailabilityRank(a) - getAvailabilityRank(b));
  });

  const allCategories = Object.keys(grouped);
  const otherCategories = allCategories.filter((categoryName) =>
    isOtherCategory(categoryName, grouped[categoryName].category)
  );
  const categories = allCategories
    .filter((categoryName) => !otherCategories.includes(categoryName))
    .sort((a, b) => a.localeCompare(b, locale === 'en' ? 'en' : 'bg', { sensitivity: 'base' }));

  categories.push(
    ...otherCategories.sort((a, b) => a.localeCompare(b, locale === 'en' ? 'en' : 'bg', { sensitivity: 'base' }))
  );



  return (
    <>
    <section className={styles.shopPage}>
      {showTitle && (
        <section className={`${styles.introSection} pageInline`}>
          <h1>{t('products.catalogTitle')}</h1>
          <p>{t('products.catalogIntro')}</p>
        </section>
      )}

      <section className={`${styles.categories} pageInline`}>
        {categories.map((category) => {
          const categoryGroup = grouped[category];
          const isCategoryTranslationPending =
            locale === 'en' &&
            categoryGroup.category?.contentLocale === 'bg' &&
            categoryGroup.category?.translationPending === true;

          return (
            <article key={category} className={styles.shoppingCategory}>
              <h3>
                <span lang={isCategoryTranslationPending ? 'bg' : undefined}>{category}</span>
                {isCategoryTranslationPending && (
                  <span className={styles.categoryTranslationBadge}>
                    {t('products.translationPending')}
                  </span>
                )}
              </h3>
              <div className={styles.productList}>
                {categoryGroup.products.map((product) => (
                  <ProductCard key={product._id} product={product} />
                ))}
              </div>
            </article>
          );
        })}
      </section>
    </section>


    </>
  );
}
