// happy-colors-nextjs-project/src/app/contacts/page.js

import { Suspense } from 'react';
import ContactForm from '../../components/contacts/ContactForm';
import styles from '../../components/products/create.module.css';
import { resolveContactPageData } from './contactPageData';

export const metadata = {
  title: 'Контакти',
  description:
    'Свържи се с Happy Colors (Хепи Колорс) за въпроси относно плетени играчки, аксесоари и декорация за дома.',
  alternates: {
    canonical: '/contacts',
  },
};

export default async function ContactPage({ searchParams }) {
  const { product, productId, serviceContext } = await resolveContactPageData(searchParams);

  return (
    <section className={styles.createWrapper}>
      <h1 className={styles.title}>Контакти</h1>

      <p>+359 889 91 26 71, +359 887 45 45 09</p>

      <p>happy.colors.bg@gmail.com</p>

      <Suspense fallback={null}>
        <ContactForm
          product={product}
          productId={productId}
          serviceContext={serviceContext}
        />
      </Suspense>
    </section>
  );
}
