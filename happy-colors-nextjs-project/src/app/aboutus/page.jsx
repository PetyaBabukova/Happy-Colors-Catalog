import {
  ArrowUpRight,
  Check,
  Gift,
  MessageCircleHeart,
  MessageCircleQuestion,
  WandSparkles,
} from 'lucide-react';
import Link from 'next/link';
import { getLocalizedCanonicalPath } from '@/config/siteSeo';
import { getAboutPageContent } from '@/content/publicPages/about';
import { getServerPublicHref } from '@/i18n/serverNavigation';
import styles from './about.module.css';

const iconByName = {
  contact: MessageCircleHeart,
  gift: Gift,
  question: MessageCircleQuestion,
  sparkles: WandSparkles,
};

function renderInlineParts(parts, publicHref) {
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

function InternalLinkCard({ item, publicHref }) {
  const Icon = iconByName[item.icon];

  return (
    <Link className={styles.linkCard} href={publicHref(item.href)}>
      <span className={styles.linkCardHeading}>
        <Icon className={styles.linkIcon} aria-hidden="true" size={24} strokeWidth={1.7} />
        <span>{item.title}</span>
        <ArrowUpRight className={styles.linkArrow} aria-hidden="true" size={18} strokeWidth={1.9} />
      </span>
      <small>{item.text}</small>
    </Link>
  );
}

function ExternalLinkCard({ item }) {
  const Icon = iconByName[item.icon];

  return (
    <a className={styles.linkCard} href={item.href} target="_blank" rel="noopener noreferrer">
      <span className={styles.linkCardHeading}>
        <Icon className={styles.linkIcon} aria-hidden="true" size={24} strokeWidth={1.7} />
        <span>{item.title}</span>
        <ArrowUpRight className={styles.linkArrow} aria-hidden="true" size={18} strokeWidth={1.9} />
      </span>
      <small>{item.text}</small>
    </a>
  );
}

export async function generateMetadata(props = {}) {
  const params = await props.params;
  const content = getAboutPageContent(params?.locale);

  return {
    ...content.metadata,
    alternates: {
      canonical: getLocalizedCanonicalPath('/aboutus', params?.locale),
    },
  };
}

export default async function AboutUs(props = {}) {
  const params = await props.params;
  const locale = params?.locale;
  const content = getAboutPageContent(locale);
  const publicHref = (href) => getServerPublicHref(href, locale);

  return (
    <main className={styles.aboutPage}>
      <section className={styles.heroSection} aria-labelledby="about-title">
        <picture className={styles.heroPicture}>
          <source media="(max-width: 768px)" srcSet="/lion_banner_MOBILE.webp" />
          <img
            className={styles.heroImage}
            src="/lion_banner.webp"
            alt={content.hero.imageAlt}
            fetchPriority="high"
          />
        </picture>

        <div className={styles.heroContent}>
          <h1 id="about-title">{content.hero.title}</h1>
        </div>
      </section>

      <section className={styles.contentSection} aria-labelledby="story-title">
        <div className={styles.leftColumn}>
          <div className={styles.storyText}>
            <h2 id="story-title">{content.story.title}</h2>

            {content.story.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          <div className={styles.linksIntro}>
            <h2 id="links-title">{content.linksIntro.title}</h2>
            <p>{renderInlineParts(content.linksIntro.parts, publicHref)}</p>
          </div>
        </div>

        <div className={styles.rightColumn}>
          <ul className={styles.highlightList} aria-label={content.highlights.ariaLabel}>
            {content.highlights.items.map((highlight) => (
              <li key={highlight}>
                <Check className={styles.checkIcon} aria-hidden="true" size={20} strokeWidth={2} />
                <span>{highlight}</span>
              </li>
            ))}
          </ul>

          <nav className={styles.linkGrid} aria-label={content.usefulLinks.ariaLabel}>
            {content.usefulLinks.items.map((item) => (
              <InternalLinkCard key={item.href} item={item} publicHref={publicHref} />
            ))}

            <ExternalLinkCard item={content.usefulLinks.external} />
          </nav>
        </div>
      </section>

      <section className={styles.closingSection} aria-label={content.closing.ariaLabel}>
        <p className={styles.thankYou}>{content.closing.text}</p>
      </section>
    </main>
  );
}
