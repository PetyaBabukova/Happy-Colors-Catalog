import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Heart, Palette, Sparkles } from 'lucide-react';
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
  getGiftImagePlaceholderLabel,
  getGiftGuideContent,
  getGiftsPageContent,
} from '@/content/publicPages/gifts';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import { stringifyJsonLd } from '@/utils/jsonLd';
import styles from '../gifts.module.css';

const HIGHLIGHT_ICONS = [Heart, Palette, Sparkles];
const NEXT_SYMBOL = '\u203a';
const GUIDE_IMAGE_SETS = {
  'gifts-for-children': {
    hero: '/images/gifts/gifts_for_children_hero.webp',
    features: [
      '/images/gifts/gifts_for_children_vuzrast_izpolzvane.webp',
      '/images/gifts/gifts_for_children_tema.webp',
      '/images/gifts/gifts_for_children_srok.webp',
    ],
  },
  'handmade-crochet-toy-gift': {
    hero: '/images/gifts/crochet_toy_gift_hero.webp',
    features: [
      '/images/gifts/crochet_toy_gift_zashto_raboti.webp',
      '/images/gifts/crochet_toy_gift_kak_da_izberete_model.webp',
      '/images/gifts/crochet_toy_gift_kakvo_da_utochnim.webp',
    ],
  },
  'original-handmade-gift': {
    hero: '/images/gifts/original_handmade_gift_hero.webp',
    features: [
      '/images/gifts/original_handmade_gift_koga_e_dobur.webp',
      '/images/gifts/original_handmade_gift_kakvi_idei.webp',
      '/images/gifts/original_handmade_gift_izbegnete_sluchaen_izbor.webp',
    ],
  },
};

function getGuidePath(slug) {
  return `${GIFT_HUB_PATH}/${slug}`;
}

function getGuideImageSet(slug) {
  return GUIDE_IMAGE_SETS[slug] || null;
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
  const guideImageSet = getGuideImageSet(guideSlug);
  const heroImageLabel = getGiftImagePlaceholderLabel(locale, guide.title, '1200 x 675 px');
  const guideFeatureCards = guide.sections.map((section, index) => ({
    section,
    pathCard: guide.pathCards[index],
    imageLabel: getGiftImagePlaceholderLabel(locale, section.title, '900 x 675 px'),
    imageSrc: guideImageSet?.features?.[index] || '',
  }));
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
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{guide.eyebrow}</p>
          <h1>{guide.title}</h1>
          <p className={styles.intro}>{guide.summary}</p>
          <ul className={styles.highlightList}>
            {guide.highlights.map((highlight, index) => {
              const HighlightIcon = HIGHLIGHT_ICONS[index % HIGHLIGHT_ICONS.length];

              return (
                <li key={highlight}>
                  <span className={styles.highlightIcon} aria-hidden="true">
                    <HighlightIcon />
                  </span>
                  <span>{highlight}</span>
                </li>
              );
            })}
          </ul>
          <Link className={`${styles.primaryLink} ${styles.heroCta}`} href={publicHref(GIFT_HUB_PATH)}>
            {content.common.backToHub}
            <span aria-hidden="true" className={styles.arrowGroup}>
              <span>{NEXT_SYMBOL}</span>
              <span>{NEXT_SYMBOL}</span>
              <span>{NEXT_SYMBOL}</span>
            </span>
          </Link>
        </div>
        <div className={styles.heroImageSlot}>
          {guideImageSet?.hero ? (
            <img
              className={styles.giftImage}
              src={guideImageSet.hero}
              alt={guide.title}
              width="1200"
              height="675"
              fetchPriority="high"
            />
          ) : (
            <span>{heroImageLabel}</span>
          )}
        </div>
      </section>

      <section className={styles.visualGuide} aria-labelledby="gift-guide-features">
        <div className={styles.sectionHeader}>
          <h2 id="gift-guide-features">{guide.featureSectionTitle}</h2>
        </div>
        <div className={styles.visualGuideGrid}>
          {guideFeatureCards.map(({ section, pathCard, imageLabel, imageSrc }, index) => (
            <article key={section.title} className={styles.featurePanel}>
              <div className={styles.featureImageSlot}>
                {imageSrc ? (
                  <img
                    className={styles.giftImage}
                    src={imageSrc}
                    alt=""
                    width="900"
                    height="675"
                    loading="lazy"
                  />
                ) : (
                  <span>{imageLabel}</span>
                )}
              </div>
              <div className={styles.featureBody}>
                <span className={styles.featureNumber} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3>{section.title}</h3>
                <p className={styles.sectionText}>{section.text}</p>
                {pathCard && (
                  <div className={styles.featureAction}>
                    <p>{pathCard.text}</p>
                    <Link className={styles.featureLink} href={publicHref(pathCard.href)}>
                      {pathCard.title}
                      <span aria-hidden="true" className={styles.arrowGroup}>
                        <span>{NEXT_SYMBOL}</span>
                        <span>{NEXT_SYMBOL}</span>
                        <span>{NEXT_SYMBOL}</span>
                      </span>
                    </Link>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.ctaBand} aria-labelledby="gift-guide-cta">
        <div>
          <h2 id="gift-guide-cta">{guide.finalCta.title}</h2>
          <p className={styles.sectionText}>{guide.finalCta.text}</p>
        </div>
        <div className={styles.actions}>
          {guide.finalCta.actions.map((action, index) => (
            <Link
              key={action.href}
              className={index === 0 ? styles.primaryLink : styles.secondaryLink}
              href={publicHref(action.href)}
            >
              {action.label}
              <span aria-hidden="true" className={styles.arrowGroup}>
                <span>{NEXT_SYMBOL}</span>
                <span>{NEXT_SYMBOL}</span>
                <span>{NEXT_SYMBOL}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
