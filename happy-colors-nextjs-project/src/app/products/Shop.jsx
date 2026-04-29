//happy-colors-nextjs-project/src/app/products/Shop.jsx

'use client';

import styles from './shop.module.css';
import ProductCard from './ProductCard';

function getAvailabilityRank(product) {
  return product?.availability === 'unavailable' ? 1 : 0;
}

export default function Shop({ products }) {
  const grouped = {};

  // Групиране на продуктите по категория
  products.forEach((product) => {
    const categoryName = product.category?.name || 'Без категория';
    if (!grouped[categoryName]) {
      grouped[categoryName] = [];
    }
    grouped[categoryName].push(product);

  });

  Object.values(grouped).forEach((categoryProducts) => {
    categoryProducts.sort((a, b) => getAvailabilityRank(a) - getAvailabilityRank(b));
  });

  const categories = Object.keys(grouped)
  .filter((cat) => cat !== 'Други')
  .sort((a, b) => a.localeCompare(b, 'bg', { sensitivity: 'base' }));

if (grouped['Други']) {
  categories.push('Други'); // добавяме я последна
}



  return (
    <>
    <section className={styles.shopPage}>
      <h1 className={styles.shopPageTitle}>Плетени играчки, аксесоари и декорация за дома</h1>

      <section className={styles.categories}>
        {categories.map((category) => (
          <article key={category} className={styles.shoppingCategory}>
            <h3>{category}</h3>
            <div className={styles.productList}>
              {grouped[category].map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>
          </article>
        ))}
      </section>
    </section>


    </>
  );
}
