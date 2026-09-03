import { describe, expect, it } from 'vitest';
import {
  MAX_PRESERVED_TRACKING_PARAMS,
  MAX_PRESERVED_TRACKING_QUERY_LENGTH,
  MAX_PRESERVED_TRACKING_VALUE_LENGTH,
  getPreservedTrackingSearch,
  findIndexableCategoryByCanonicalSlug,
  resolveCategoryRedirect,
} from '../../../src/app/products/categoryRedirects';

function category(overrides = {}) {
  return {
    _id: 'cat-1',
    name: 'Fairytale Characters',
    filterSlug: 'fairytale-characters',
    slug: 'prikazni-geroi',
    canonicalSlug: 'fairytale-characters',
    canonicalSlugReviewed: true,
    slugAliases: ['old-fairytale-characters'],
    displayNames: {
      bg: 'Prikazni geroi',
      en: 'Fairytale Characters',
    },
    ...overrides,
  };
}

describe('category redirect resolver', () => {
  it('does not redirect the generic products page', () => {
    expect(
      resolveCategoryRedirect({
        categories: [category()],
        locale: 'bg',
        searchParams: {},
      })
    ).toBeNull();
  });

  it('does not redirect reviewed canonical shared English slugs', () => {
    expect(
      resolveCategoryRedirect({
        categories: [category()],
        locale: 'bg',
        searchParams: { category: 'fairytale-characters', foo: 'ignored' },
      })
    ).toBeNull();
  });

  it('permanently redirects non-exact canonical casing to the reviewed canonical slug', () => {
    expect(
      resolveCategoryRedirect({
        categories: [category()],
        locale: 'bg',
        searchParams: { category: 'Fairytale-Characters' },
      })
    ).toEqual({
      type: 'permanent',
      target: '/products?category=fairytale-characters',
    });

    expect(
      findIndexableCategoryByCanonicalSlug({
        categories: [category()],
        locale: 'bg',
        category: 'Fairytale-Characters',
      })
    ).toBeNull();
  });

  it('temporarily redirects non-exact canonical casing when tracking params are present', () => {
    expect(
      resolveCategoryRedirect({
        categories: [category()],
        locale: 'bg',
        searchParams: { category: 'Fairytale-Characters', utm_source: 'newsletter' },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products?category=fairytale-characters&utm_source=newsletter',
    });
  });

  it('permanently redirects clean stable aliases and legacy slugs to the canonical slug', () => {
    expect(
      resolveCategoryRedirect({
        categories: [category()],
        locale: 'bg',
        searchParams: { category: 'old-fairytale-characters' },
      })
    ).toEqual({
      type: 'permanent',
      target: '/products?category=fairytale-characters',
    });

    expect(
      resolveCategoryRedirect({
        categories: [category()],
        locale: 'bg',
        searchParams: { category: 'prikazni-geroi' },
      })
    ).toEqual({
      type: 'permanent',
      target: '/products?category=fairytale-characters',
    });
  });

  it('temporarily redirects mutable display names to the canonical slug', () => {
    expect(
      resolveCategoryRedirect({
        categories: [category()],
        locale: 'en',
        searchParams: { category: 'Fairytale Characters' },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products?category=fairytale-characters',
    });
  });

  it('uses stable slug fields before display-name collisions', () => {
    expect(
      resolveCategoryRedirect({
        categories: [
          category({
            _id: 'cat-1',
            displayNames: { bg: 'shared-token', en: '' },
          }),
          category({
            _id: 'cat-2',
            canonicalSlug: 'shared-token',
            filterSlug: 'shared-token',
            slug: 'another-legacy',
            slugAliases: [],
            displayNames: { bg: 'Other Name', en: '' },
          }),
        ],
        locale: 'bg',
        searchParams: { category: 'shared-token' },
      })
    ).toBeNull();
  });

  it('treats canonical slugs as authoritative when another category has a colliding alias', () => {
    expect(
      resolveCategoryRedirect({
        categories: [
          category({
            _id: 'cat-1',
            canonicalSlug: 'fairytale-characters',
            filterSlug: 'fairytale-characters',
            slugAliases: ['shared-token'],
          }),
          category({
            _id: 'cat-2',
            canonicalSlug: 'shared-token',
            filterSlug: 'shared-token',
            slug: 'another-legacy',
            slugAliases: [],
            displayNames: { bg: 'Other Name', en: '' },
          }),
        ],
        locale: 'bg',
        searchParams: { category: 'shared-token' },
      })
    ).toBeNull();
  });

  it('does not fall back to display-name matching after ambiguous stable tokens', () => {
    expect(
      resolveCategoryRedirect({
        categories: [
          category({
            _id: 'cat-1',
            slugAliases: ['shared-token'],
            displayNames: { bg: 'First Name', en: '' },
          }),
          category({
            _id: 'cat-2',
            canonicalSlug: 'crochet-animals',
            filterSlug: 'crochet-animals',
            slug: 'crochet-animals',
            slugAliases: ['shared-token'],
            displayNames: { bg: 'Second Name', en: '' },
          }),
          category({
            _id: 'cat-3',
            canonicalSlug: 'handmade-bags',
            filterSlug: 'handmade-bags',
            slug: 'handmade-bags',
            slugAliases: [],
            displayNames: { bg: 'shared-token', en: '' },
          }),
        ],
        locale: 'bg',
        searchParams: { category: 'shared-token' },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products',
    });
  });

  it('does not guess ambiguous display-name matches', () => {
    expect(
      resolveCategoryRedirect({
        categories: [
          category({ _id: 'cat-1', displayNames: { bg: 'Same Name', en: '' } }),
          category({
            _id: 'cat-2',
            canonicalSlug: 'crochet-animals',
            filterSlug: 'crochet-animals',
            slug: 'crochet-animals',
            slugAliases: [],
            displayNames: { bg: 'Same Name', en: '' },
          }),
        ],
        locale: 'bg',
        searchParams: { category: 'Same Name' },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products',
    });
  });

  it('temporarily redirects unknown, duplicate, and ineligible categories to the generic catalog', () => {
    expect(
      resolveCategoryRedirect({
        categories: [category()],
        searchParams: { category: 'unknown', utm_source: 'paid' },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products?utm_source=paid',
    });

    expect(
      resolveCategoryRedirect({
        categories: [category()],
        searchParams: { category: ['fairytale-characters', 'crochet-animals'] },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products',
    });

    expect(
      resolveCategoryRedirect({
        categories: [category({ canonicalSlugReviewed: false })],
        searchParams: { category: 'old-fairytale-characters' },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products',
    });
  });

  it('keeps browsable unreviewed current slugs on the products page without making them indexable', () => {
    const unreviewedCategory = category({
      canonicalSlug: '',
      filterSlug: 'prikazni-geroi',
      canonicalSlugReviewed: false,
      eligibleLocales: ['bg'],
    });

    expect(
      resolveCategoryRedirect({
        categories: [unreviewedCategory],
        locale: 'bg',
        searchParams: { category: 'prikazni-geroi' },
      })
    ).toBeNull();

    expect(
      findIndexableCategoryByCanonicalSlug({
        categories: [unreviewedCategory],
        locale: 'bg',
        category: 'prikazni-geroi',
      })
    ).toBeNull();
  });

  it('temporarily normalizes browsable unreviewed current slug casing', () => {
    expect(
      resolveCategoryRedirect({
        categories: [
          category({
            canonicalSlug: '',
            filterSlug: 'prikazni-geroi',
            canonicalSlugReviewed: false,
            eligibleLocales: ['bg'],
          }),
        ],
        locale: 'bg',
        searchParams: { category: 'Prikazni-Geroi', utm_source: 'header' },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products?category=prikazni-geroi&utm_source=header',
    });
  });

  it('temporarily redirects English fallback categories to the generic catalog', () => {
    expect(
      resolveCategoryRedirect({
        categories: [
          category({
            contentLocale: 'bg',
            translationPending: true,
          }),
        ],
        locale: 'en',
        searchParams: { category: 'fairytale-characters' },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products',
    });
  });

  it('uses eligibleLocales to block locale-ineligible category pages', () => {
    expect(
      resolveCategoryRedirect({
        categories: [
          category({
            eligibleLocales: ['bg'],
            translationPending: false,
          }),
        ],
        locale: 'en',
        searchParams: { category: 'fairytale-characters', utm_source: 'paid' },
      })
    ).toEqual({
      type: 'temporary',
      target: '/products?utm_source=paid',
    });
  });

  it('preserves only bounded allowlisted tracking params in cleanup redirects', () => {
    const searchParams = {
      category: 'old-fairytale-characters',
      utm_source: 'newsletter',
      gclid: 'paid click',
      redirect: 'https://evil.test',
      fbclid: 'x'.repeat(MAX_PRESERVED_TRACKING_VALUE_LENGTH + 1),
    };

    expect(getPreservedTrackingSearch(searchParams)).toBe('?utm_source=newsletter&gclid=paid+click');
    expect(
      resolveCategoryRedirect({
        categories: [category()],
        searchParams,
      })
    ).toEqual({
      type: 'temporary',
      target: '/products?category=fairytale-characters&utm_source=newsletter&gclid=paid+click',
    });
  });

  it('drops over-limit tracking params from the end without truncating values', () => {
    const searchParams = { category: 'unknown' };

    for (let index = 0; index < MAX_PRESERVED_TRACKING_PARAMS + 2; index += 1) {
      searchParams[`utm_param_${index}`] = `value-${index}`;
    }

    const preserved = getPreservedTrackingSearch(searchParams);

    expect(new URLSearchParams(preserved).get('utm_param_0')).toBe('value-0');
    expect(new URLSearchParams(preserved).get('utm_param_11')).toBe('value-11');
    expect(new URLSearchParams(preserved).has('utm_param_12')).toBe(false);
  });

  it('stops preserving tracking params before the encoded query length limit', () => {
    const searchParams = { category: 'unknown' };
    const value = 'x'.repeat(MAX_PRESERVED_TRACKING_VALUE_LENGTH);

    for (let index = 0; index < MAX_PRESERVED_TRACKING_PARAMS; index += 1) {
      searchParams[`utm_long_param_${index}`] = value;
    }

    const preserved = getPreservedTrackingSearch(searchParams);

    expect(preserved.length - 1).toBeLessThanOrEqual(MAX_PRESERVED_TRACKING_QUERY_LENGTH);
    expect(new URLSearchParams(preserved).get('utm_long_param_0')).toBe(value);
  });
});
