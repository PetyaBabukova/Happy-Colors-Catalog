// happy-colors-nextjs-project/src/app/contacts/page.jsx

import { Suspense } from 'react';
import { getLocalizedCanonicalPath } from '@/config/siteSeo';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getDictionary } from '@/i18n/getDictionary';
import ContactForm from '../../components/contacts/ContactForm';
import styles from '../../components/products/create.module.css';
import { resolveContactPageData } from './contactPageData';

function getContactPageDictionary(locale) {
  return getDictionary(locale || DEFAULT_LOCALE).contacts;
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale || DEFAULT_LOCALE;
  const contacts = getContactPageDictionary(locale);

  return {
    title: contacts.title,
    description: contacts.pageDescription,
    alternates: {
      canonical: getLocalizedCanonicalPath('/contacts', locale),
    },
  };
}

export default async function ContactPage({ params, searchParams } = {}) {
  const resolvedParams = await params;
  const contacts = getContactPageDictionary(resolvedParams?.locale);
  const { product, productId, serviceContext } = await resolveContactPageData(searchParams);

  return (
    <section className={styles.createWrapper}>
      <h1 className={styles.title}>{contacts.title}</h1>

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
