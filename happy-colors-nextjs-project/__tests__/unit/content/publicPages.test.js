import { describe, expect, it } from 'vitest';
import { publicPageContentModules } from '@/content/publicPages';
import {
  GIFT_GUIDE_SLUGS,
  GIFT_HUB_PATH,
  getGiftImagePlaceholderLabel,
  getGiftGuideCards,
  getGiftGuideContent,
  getGiftsPageContent,
} from '@/content/publicPages/gifts';

const ENGLISH_CYRILLIC_PATTERN = /[\u0400-\u04FF]/;
const BRAND_NAMES = ['Happy Colors', 'Хепи Колорс'];

function collectShape(value) {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      length: value.length,
      items: value.map(collectShape),
    };
  }

  if (value && typeof value === 'object') {
    return {
      type: 'object',
      keys: Object.keys(value).sort(),
      entries: Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, collectShape(value[key])])
      ),
    };
  }

  return { type: typeof value };
}

function getTitleText(title) {
  if (typeof title === 'string') {
    return title;
  }

  return title?.absolute || title?.default || '';
}

function getRenderedTitle(metadata, locale) {
  const title = getTitleText(metadata?.title);

  if (metadata?.title?.absolute) {
    return title;
  }

  return locale === 'en'
    ? `${title} | Happy Colors`
    : `${title} | Happy Colors | Хепи Колорс`;
}

function countOccurrences(value, needle) {
  return String(value || '').split(needle).length - 1;
}

describe('public page content modules', () => {
  it('keeps paired Bulgarian and English content structurally aligned', () => {
    for (const [moduleName, content] of Object.entries(publicPageContentModules)) {
      expect(content, moduleName).toHaveProperty('bg');
      expect(content, moduleName).toHaveProperty('en');
      expect(collectShape(content.en), moduleName).toEqual(collectShape(content.bg));
    }
  });

  it('keeps English public metadata free from Cyrillic fallback copy', () => {
    for (const [moduleName, content] of Object.entries(publicPageContentModules)) {
      const metadata = content.en.metadata;

      expect(getRenderedTitle(metadata, 'en'), moduleName).not.toMatch(ENGLISH_CYRILLIC_PATTERN);
      expect(metadata.description, moduleName).not.toMatch(ENGLISH_CYRILLIC_PATTERN);
    }
  });

  it('does not duplicate brand names in rendered public metadata titles', () => {
    for (const [moduleName, content] of Object.entries(publicPageContentModules)) {
      for (const locale of ['bg', 'en']) {
        const title = getRenderedTitle(content[locale].metadata, locale);

        for (const brandName of BRAND_NAMES) {
          expect(countOccurrences(title, brandName), `${moduleName}:${locale}:${brandName}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('differentiates the English catalog title from the home title', () => {
    const homeMetadata = publicPageContentModules.home.en.metadata;
    const productsMetadata = publicPageContentModules.products.en.metadata;
    const homeTitle = getRenderedTitle(homeMetadata, 'en');
    const productsTitle = getRenderedTitle(productsMetadata, 'en');

    expect(productsTitle).not.toBe(homeTitle);
    expect(productsMetadata.description).not.toBe(homeMetadata.description);
    expect(productsTitle).toContain('Handmade Crochet Toys');
    expect(productsTitle).toContain('Bags & Home Decor');
    expect(productsTitle).toContain('Catalog');
  });

  it('keeps gift guide content complete for every shared English slug', () => {
    expect(GIFT_HUB_PATH).toBe('/gifts');

    for (const locale of ['bg', 'en']) {
      const content = getGiftsPageContent(locale);
      const cards = getGiftGuideCards(locale);

      expect(content.hub.eyebrow, locale).toBeTruthy();
      expect(content.hub.primaryCta?.href, locale).toMatch(/^\//);
      expect(content.hub.primaryCta?.label, locale).toBeTruthy();
      expect(content.hub.secondaryCta?.href, locale).toMatch(/^\//);
      expect(content.hub.secondaryCta?.label, locale).toBeTruthy();
      expect(content.hub.guideSectionIntro, locale).toBeTruthy();
      expect(content.hub.decisionTitle, locale).toBeTruthy();
      expect(content.hub.decisionIntro, locale).toBeTruthy();
      expect(content.hub.decisionSteps, locale).toHaveLength(3);
      expect(content.hub.decisionSteps.every((step) => step.title && step.text), locale).toBe(true);
      expect(content.hub.supportItems, locale).toHaveLength(4);
      expect(content.hub.supportItems.every((item) => (
        item.title && item.text && item.cta?.href?.startsWith('/') && item.cta?.label
      )), locale).toBe(true);

      expect(cards).toHaveLength(GIFT_GUIDE_SLUGS.length);
      expect(cards.map((card) => card.slug)).toEqual([...GIFT_GUIDE_SLUGS]);
      expect(cards.map((card) => card.href)).toEqual(
        GIFT_GUIDE_SLUGS.map((slug) => `/gifts/${slug}`)
      );

      for (const slug of GIFT_GUIDE_SLUGS) {
        const guide = getGiftGuideContent(slug, locale);

        expect(guide, `${locale}:${slug}`).toBeTruthy();
        expect(guide.eyebrow, `${locale}:${slug}`).toBeTruthy();
        expect(guide.metadata.title, `${locale}:${slug}`).toBeTruthy();
        expect(guide.metadata.description, `${locale}:${slug}`).toBeTruthy();
        expect(guide.title, `${locale}:${slug}`).toBeTruthy();
        expect(guide.featureSectionTitle, `${locale}:${slug}`).toBeTruthy();
        expect(guide.cardText, `${locale}:${slug}`).toBeTruthy();
        expect(guide.summary, `${locale}:${slug}`).toBeTruthy();
        expect(guide.highlights, `${locale}:${slug}`).toHaveLength(3);
        expect(guide.sections, `${locale}:${slug}`).toHaveLength(3);
        expect(guide.pathCards, `${locale}:${slug}`).toHaveLength(3);
        expect(guide.pathCards, `${locale}:${slug}`).toHaveLength(guide.sections.length);
        expect(guide.finalCta?.title, `${locale}:${slug}`).toBeTruthy();
        expect(guide.finalCta?.text, `${locale}:${slug}`).toBeTruthy();
        expect(guide.finalCta?.actions?.length, `${locale}:${slug}`).toBeGreaterThanOrEqual(2);
        expect(guide.finalCta.actions.every((action) => action.href.startsWith('/'))).toBe(true);
        expect(guide.pathCards.every((card) => card.href.startsWith('/'))).toBe(true);
      }

      const titles = GIFT_GUIDE_SLUGS.map((slug) => content.guides[slug].metadata.title);
      expect(new Set(titles).size, locale).toBe(titles.length);
    }
  });

  it('keeps gift runtime content on shared /gifts slugs without translated aliases', () => {
    const serializedGiftContent = JSON.stringify(publicPageContentModules.gifts);

    expect(serializedGiftContent).toContain('/gifts/gifts-for-children');
    expect(serializedGiftContent).not.toMatch(/\/podaraci/i);
  });

  it('formats gift image placeholder labels for both public locales', () => {
    expect(getGiftImagePlaceholderLabel('en', 'Gift ideas', '1200 x 675 px')).toBe(
      'Gift ideas image slot - 1200 x 675 px'
    );
    expect(getGiftImagePlaceholderLabel('bg', 'Идеи за подарък', '1200 x 675 px')).toBe(
      'Място за изображение: Идеи за подарък - 1200 x 675 px'
    );
  });
});
