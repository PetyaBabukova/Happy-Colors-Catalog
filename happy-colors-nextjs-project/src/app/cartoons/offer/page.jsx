import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';
import { buildPageMetadata } from '@/config/siteSeo';
import { getCartoonsOfferPageContent } from '@/content/publicPages/cartoons';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import { buildCartoonServiceContactHref } from '@/utils/cartoonServiceRoutes';
import {
  buildCartoonServiceJsonLd,
  buildCartoonsBreadcrumbJsonLd,
} from '@/utils/cartoonsSeo';
import { stringifyJsonLd } from '@/utils/jsonLd';
import styles from './offer.module.css';

function renderRichTextParts(parts, publicHref) {
  return parts.map((part, index) => {
    if (typeof part === 'string') {
      return part;
    }

    return (
      <Link key={`${part.href}-${index}`} href={publicHref(part.href)}>
        {part.label}
      </Link>
    );
  });
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const locale = params?.locale || DEFAULT_LOCALE;
  const content = getCartoonsOfferPageContent(locale);

  if (!isCartoonsServiceEnabled) {
    return {
      title: content.unavailable.title,
      description: content.unavailable.description,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  return buildPageMetadata({
    title: content.metadata.title,
    description: content.metadata.description,
    path: '/cartoons/offer',
    locale,
    indexable: true,
  });
}

export default async function CartoonsOfferPage(props = {}) {
  if (!isCartoonsServiceEnabled) {
    notFound();
  }

  const params = await props.params;
  const locale = params?.locale || DEFAULT_LOCALE;
  const content = getCartoonsOfferPageContent(locale);
  const publicHref = (href) => getServerPublicHref(href, locale);
  const serviceData = buildCartoonServiceJsonLd({
    content,
    path: '/cartoons/offer',
    locale,
  });
  const breadcrumbData = buildCartoonsBreadcrumbJsonLd({
    currentName: content.hero.title,
    path: '/cartoons/offer',
    locale,
  });

  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(serviceData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: stringifyJsonLd(breadcrumbData) }}
      />
      <section className={styles.hero}>
        <picture className={styles.heroPicture}>
          <source
            media="(max-width: 640px)"
            srcSet="/Offer_page_hero_banner_MOBILE.webp"
          />
          <Image
            className={styles.heroImage}
            src="/Offer_page_hero_banner.webp"
            alt=""
            fill
            priority
            sizes="100vw"
          />
        </picture>
        <div className={`${styles.heroContent} pageInline`}>
          <Image
            className={styles.logo}
            src="/LOGO.webp"
            alt={content.hero.logoAlt}
            width={720}
            height={191}
            priority
          />
          <p className={styles.kicker}>{content.hero.kicker}</p>
          <h1>{content.hero.title}</h1>
          <p className={styles.lead}>{content.hero.lead}</p>
          <div className={styles.heroActions}>
            <Link href={publicHref(buildCartoonServiceContactHref())} className={styles.primaryButton}>
              {content.hero.primaryCta}
            </Link>
            <Link href={publicHref('/cartoons')} className={styles.secondaryButton}>
              {content.hero.secondaryCta}
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.priceSection} pageInline`} aria-labelledby="base-prices">
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>{content.packages.kicker}</p>
          <h2 id="base-prices">{content.packages.title}</h2>
        </div>
        <div className={styles.packageGrid}>
          {content.packages.items.map((item) => (
            <article className={styles.packageCard} key={item.title}>
              <span>{item.eyebrow}</span>
              <h3>{item.title}</h3>
              <p className={styles.price}>{item.price}</p>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.splitSection} pageInline`}>
        <div className={styles.photoPanel}>
          <Image
            src="/Offer_page__bdy_image.webp"
            alt={content.addOns.imageAlt}
            fill
            sizes="(max-width: 768px) 100vw, 42vw"
          />
        </div>
        <div className={styles.addOnsPanel}>
          <p className={styles.kicker}>{content.addOns.kicker}</p>
          <h2>{content.addOns.title}</h2>
          <dl className={styles.addOnsList}>
            {content.addOns.items.map((item) => (
              <div className={styles.addOnRow} key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.price}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className={`${styles.timelineSection} pageInline`} aria-labelledby="timeline-title">
        <div className={styles.sectionHeader}>
          <p className={styles.kicker}>{content.timeline.kicker}</p>
          <h2 id="timeline-title">{content.timeline.title}</h2>
        </div>
        <div className={styles.timelineGrid}>
          {content.timeline.items.map((item) => (
            <article className={styles.timelineItem} key={item.title}>
              <h3>{item.title}</h3>
              <p className={styles.timelineTime}>{item.time}</p>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.noteSection} pageInline`}>
        <div>
          <p className={styles.kicker}>{content.note.kicker}</p>
          <h2>{content.note.title}</h2>
          <p>{renderRichTextParts(content.note.parts, publicHref)}</p>
        </div>
        <Link href={publicHref(buildCartoonServiceContactHref())} className={styles.primaryButton}>
          {content.note.ctaLabel}
        </Link>
      </section>
    </main>
  );
}
