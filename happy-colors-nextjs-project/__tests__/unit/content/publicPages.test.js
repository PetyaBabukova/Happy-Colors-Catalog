import { describe, expect, it } from 'vitest';
import { publicPageContentModules } from '@/content/publicPages';

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
    expect(productsTitle).toContain('Shop');
    expect(productsTitle).not.toContain('Accessories, and Home Decor');
  });
});
