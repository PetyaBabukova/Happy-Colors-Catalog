// happy-colors-nextjs-project/src/app/partners/page.jsx

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { buildPageMetadata } from '@/config/siteSeo';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import { getPartnersPageContent } from '@/content/publicPages/partners';

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getPartnersPageContent(locale);

  return buildPageMetadata({
    ...content.metadata,
    path: '/partners',
    locale,
  });
}

export default async function Partners(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getPartnersPageContent(locale);

  return (
    <>
      <h1>{content.heading}</h1>

      {content.paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      <Link href={getServerPublicHref(content.cta.href, locale)}>
        {content.cta.label}
        <ChevronRight aria-hidden="true" size={24} strokeWidth={2} />
        <ChevronRight aria-hidden="true" size={24} strokeWidth={2} />
        <ChevronRight aria-hidden="true" size={24} strokeWidth={2} />
      </Link>
    </>
  );
}
