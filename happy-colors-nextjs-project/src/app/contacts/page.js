// happy-colors-nextjs-project/src/app/contacts/page.js

import ContactForm from '../../components/contacts/ContactForm';
import styles from '../../components/products/create.module.css';
import { getProduct } from '@/lib/getProduct';

export const metadata = {
  title: 'Контакти',
  description:
    'Свържи се с Happy Colors за въпроси относно плетени играчки, аксесоари и декорация за дома.',
  alternates: {
    canonical: '/contacts',
  },
};

async function fetchProduct(productId) {
  if (!productId) return null;

  try {
    return await getProduct(productId);
  } catch {
    return null;
  }
}

export default async function ContactPage({ searchParams }) {
  const params = await searchParams;
  const product = await fetchProduct(params?.productId);

  return (
    <section className={styles.createWrapper}>
      <h1 className={styles.title}>Контакти</h1>

      <p>+359 889 91 26 71, +359 887 45 45 09</p>

      <p>happy.colors.bg@gmail.com</p>

      <ContactForm product={product} />
    </section>
  );
}
