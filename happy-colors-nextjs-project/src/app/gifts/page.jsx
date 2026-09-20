import Link from 'next/link';
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
  GIFT_HUB_PATH,
  getGiftGuideCards,
  getGiftsPageContent,
} from '@/content/publicPages/gifts';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import { stringifyJsonLd } from '@/utils/jsonLd';
import styles from './gifts.module.css';

const HERO_IMAGE = {
  src: '/images/gifts/hero_gift_idea.webp',
  width: 1200,
  height: 675,
};

const GUIDE_IMAGES = {
  'gifts-for-children': '/images/gifts/podaruci_za_deca.webp',
  'handmade-crochet-toy-gift': '/images/gifts/pletena_igrachka_podaruk.webp',
  'original-handmade-gift': '/images/gifts/original_handmade_podaruk.webp',
};
const NEXT_SYMBOL = '\u203a';

function ArrowGroup() {
  return (
    <span aria-hidden="true" className={styles.arrowGroup}>
      <span>{NEXT_SYMBOL}</span>
      <span>{NEXT_SYMBOL}</span>
      <span>{NEXT_SYMBOL}</span>
    </span>
  );
}

function buildGiftHubStructuredData(content, cards, locale) {
  const canonicalPath = getLocalizedCanonicalPath(GIFT_HUB_PATH, locale);

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': buildStructuredDataId(canonicalPath, 'collection'),
    name: content.hub.title,
    description: content.hub.metadata.description,
    url: buildStructuredDataUrl(canonicalPath),
    inLanguage: getStructuredDataLanguage(locale),
    isPartOf: {
      '@id': WEBSITE_SCHEMA_ID,
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: cards.map((card, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: card.title,
        url: buildStructuredDataUrl(getLocalizedCanonicalPath(card.href, locale)),
      })),
    },
  };
}

function buildGiftHubBreadcrumb(content, locale) {
  return buildBreadcrumbListJsonLd([
    {
      name: content.common.breadcrumbHome,
      path: getLocalizedCanonicalPath('/', locale),
    },
    {
      name: content.common.breadcrumbGifts,
      path: getLocalizedCanonicalPath(GIFT_HUB_PATH, locale),
    },
  ]);
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale || DEFAULT_LOCALE;
  const content = getGiftsPageContent(locale);

  return buildPageMetadata({
    ...content.hub.metadata,
    path: GIFT_HUB_PATH,
    locale,
  });
}

export default async function GiftsPage(props = {}) {
  const params = await props.params;
  const locale = params?.locale || DEFAULT_LOCALE;
  const content = getGiftsPageContent(locale);
  const publicHref = (href) => getServerPublicHref(href, locale);
  const cards = getGiftGuideCards(locale);
  const structuredData = buildGiftHubStructuredData(content, cards, locale);
  const breadcrumbData = buildGiftHubBreadcrumb(content, locale);

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
          <p className={styles.eyebrow}>{content.hub.eyebrow}</p>
          <h1>{content.hub.title}</h1>
          <p className={styles.intro}>{content.hub.intro}</p>
          <p className={styles.lead}>{content.hub.lead}</p>
          <div className={styles.heroActions}>
            <Link className={styles.primaryLink} href={publicHref(content.hub.primaryCta.href)}>
              {content.hub.primaryCta.label}
              <ArrowGroup />
            </Link>
            <Link className={styles.secondaryLink} href={publicHref(content.hub.secondaryCta.href)}>
              {content.hub.secondaryCta.label}
              <ArrowGroup />
            </Link>
          </div>
        </div>
        <div className={styles.heroImageSlot}>
          <img
            className={styles.giftImage}
            src={HERO_IMAGE.src}
            alt={content.hub.title}
            width={HERO_IMAGE.width}
            height={HERO_IMAGE.height}
            fetchPriority="high"
          />
        </div>
      </section>

      <section aria-labelledby="gift-guide-list">
        <div className={styles.sectionHeader}>
          <h2 id="gift-guide-list">{content.hub.guideSectionTitle}</h2>
          <p className={styles.sectionLead}>{content.hub.guideSectionIntro}</p>
        </div>
        <div className={styles.guideGrid}>
          {cards.map((card) => (
            <Link key={card.slug} className={styles.guideCard} href={publicHref(card.href)}>
              <div className={styles.cardImageSlot}>
                <img
                  className={styles.giftImage}
                  src={GUIDE_IMAGES[card.slug]}
                  alt=""
                  width="800"
                  height="600"
                  loading="lazy"
                />
              </div>
              <div>
                <h3>{card.title}</h3>
                <p className={styles.cardText}>{card.text}</p>
              </div>
              <span className={styles.cardAction}>
                {content.hub.browseLabel}
                <ArrowGroup />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="gift-decision">
        <div className={styles.sectionHeader}>
          <h2 id="gift-decision">{content.hub.decisionTitle}</h2>
          <p className={styles.sectionLead}>{content.hub.decisionIntro}</p>
        </div>
        <div className={styles.decisionGrid}>
          {content.hub.decisionSteps.map((step, index) => (
            <div key={step.title} className={styles.decisionCard}>
              <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
              <h3>{step.title}</h3>
              <p className={styles.cardText}>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="gift-support">
        <div className={styles.sectionHeader}>
          <h2 id="gift-support">{content.hub.supportTitle}</h2>
        </div>
        <div className={styles.supportGrid}>
          {content.hub.supportItems.map((item) => (
            <Link key={item.title} className={styles.supportCard} href={publicHref(item.cta.href)}>
              <div>
                <h3>{item.title}</h3>
                <p className={styles.cardText}>{item.text}</p>
              </div>
              <span className={styles.cardAction}>
                {item.cta.label}
                <ArrowGroup />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
