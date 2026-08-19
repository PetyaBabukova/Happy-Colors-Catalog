import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  buildBreadcrumbListJsonLd,
  buildPageMetadata,
  buildStructuredDataId,
  buildStructuredDataUrl,
  getLocalizedCanonicalPath,
  getStructuredDataLanguage,
  WEBSITE_SCHEMA_ID,
} from '@/config/siteSeo';
import {
  GIFT_GUIDE_SLUGS,
  GIFT_HUB_PATH,
  getGiftGuideContent,
  getGiftsPageContent,
} from '@/content/publicPages/gifts';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import { stringifyJsonLd } from '@/utils/jsonLd';
import styles from '../gifts.module.css';

function getGuidePath(slug) {
  return `${GIFT_HUB_PATH}/${slug}`;
}

function buildGuideStructuredData(guide, slug, locale) {
  const canonicalPath = getLocalizedCanonicalPath(getGuidePath(slug), locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': buildStructuredDataId(canonicalPath, 'webpage'),
    name: guide.title,
    description: guide.metadata.description,
    url: buildStructuredDataUrl(canonicalPath),
    inLanguage: getStructuredDataLanguage(locale),
    isPartOf: {
      '@id': WEBSITE_SCHEMA_ID,
    },
  };
}

function buildGuideBreadcrumb(content, guide, slug, locale) {
  return buildBreadcrumbListJsonLd([
    {
      name: content.common.breadcrumbHome,
      path: getLocalizedCanonicalPath('/', locale),
    },
    {
      name: content.common.breadcrumbGifts,
      path: getLocalizedCanonicalPath(GIFT_HUB_PATH, locale),
    },
    {
      name: guide.title,
      path: getLocalizedCanonicalPath(getGuidePath(slug), locale),
    },
  ]);
}

export function generateStaticParams() {
  return GIFT_GUIDE_SLUGS.map((guideSlug) => ({ guideSlug }));
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale || DEFAULT_LOCALE;
  const guideSlug = params?.guideSlug;
  const guide = getGiftGuideContent(guideSlug, locale);

  if (!guide) {
    return {
      title: locale === 'en' ? 'Gift guide not found' : 'Идеята за подарък не е намерена',
      description: locale === 'en'
        ? 'Try another Happy Colors gift guide.'
        : 'Опитайте с друга идея за подарък от Happy Colors.',
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildPageMetadata({
    ...guide.metadata,
    path: getGuidePath(guideSlug),
    locale,
  });
}

export default async function GiftGuidePage(props = {}) {
  const params = await props.params;
  const locale = params?.locale || DEFAULT_LOCALE;
  const guideSlug = params?.guideSlug;
  const content = getGiftsPageContent(locale);
  const guide = getGiftGuideContent(guideSlug, locale);

  if (!guide) {
    notFound();
  }

  const publicHref = (href) => getServerPublicHref(href, locale);
  const structuredData = buildGuideStructuredData(guide, guideSlug, locale);
  const breadcrumbData = buildGuideBreadcrumb(content, guide, guideSlug, locale);

  return (
    <main className={`${styles.page} pageInline`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumbData) }}
      />

      <section className={styles.hero}>
        <Link className={styles.backLink} href={publicHref(GIFT_HUB_PATH)}>
          {content.common.backToHub}
        </Link>
        <h1>{guide.title}</h1>
        <p className={styles.intro}>{guide.summary}</p>
      </section>

      <article className={styles.article}>
        {guide.sections.map((section) => (
          <section key={section.title} className={styles.articleSection}>
            <h2>{section.title}</h2>
            <p className={styles.sectionText}>{section.text}</p>
          </section>
        ))}
      </article>

      <section aria-labelledby="gift-guide-paths">
        <div className={styles.sectionHeader}>
          <h2 id="gift-guide-paths">{content.common.guidePathsTitle}</h2>
        </div>
        <div className={styles.pathGrid}>
          {guide.pathCards.map((card) => (
            <Link key={card.title} className={styles.pathCard} href={publicHref(card.href)}>
              <div>
                <h3>{card.title}</h3>
                <p className={styles.cardText}>{card.text}</p>
              </div>
              <span className={styles.cardAction}>{content.hub.browseLabel}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className={styles.actions}>
        <Link className={styles.primaryLink} href={publicHref('/products')}>
          {content.common.primaryCta}
        </Link>
        <Link className={styles.secondaryLink} href={publicHref('/contacts')}>
          {content.common.secondaryCta}
        </Link>
      </div>
    </main>
  );
}
