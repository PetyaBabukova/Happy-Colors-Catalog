import { describe, expect, it } from 'vitest';
import {
  buildCategoryProductsMetadata,
  buildCategoryProductsPageContent,
} from '../../../src/app/products/categoryMetadata';

describe('category products metadata', () => {
  it.each([
    [
      'fairytale-characters',
      'bg',
      'Плетени приказни герои',
      'Плетени приказни герои и ръчно плетени кукли | Happy Colors',
    ],
    [
      'handmade-backpacks-and-bags',
      'en',
      'Handmade Backpacks and Bags',
      'Handmade Crochet Backpacks and Bags | Happy Colors',
    ],
    [
      'crochet-animals',
      'bg',
      'Плетени животинки',
      'Плетени играчки животни и плетени животинки | Happy Colors',
    ],
    [
      'crochet-toy-backpack-sets',
      'en',
      'Crochet Toy & Backpack Sets',
      'Crochet Toy and Backpack Sets | Happy Colors',
    ],
  ])('uses reviewed marketing content for %s in %s', (canonicalSlug, locale, heading, title) => {
    const category = {
      name: 'Fallback category name',
      canonicalSlug,
      eligibleLocales: ['bg', 'en'],
    };

    expect(buildCategoryProductsPageContent(category, locale)).toEqual({ heading });
    expect(buildCategoryProductsMetadata(category, locale).title).toEqual({ absolute: title });
  });

  it('uses reviewed marketing metadata for known category slugs', () => {
    expect(
      buildCategoryProductsMetadata(
        {
          name: 'Fairytale Characters',
          canonicalSlug: 'fairytale-characters',
          eligibleLocales: ['bg', 'en'],
        },
        'en'
      )
    ).toEqual({
      title: { absolute: 'Crochet Character Toys & Handmade Crochet Dolls | Happy Colors' },
      description:
        'Discover crochet character toys and handmade crochet dolls by Happy Colors – unique storybook-inspired toys, carefully crafted with attention to detail.',
      path: '/products?category=fairytale-characters',
      locale: 'en',
      alternateLocales: ['bg', 'en'],
      includeXDefault: true,
    });
  });

  it('builds category page headings from reviewed marketing display names', () => {
    expect(
      buildCategoryProductsPageContent(
        {
          name: 'Fallback source name',
          canonicalSlug: 'crochet-animals',
        },
        'bg'
      )
    ).toEqual({
      heading: 'Плетени животинки',
    });
  });

  it('uses Bulgarian fallback wording and encodes the shared slug in the metadata path', () => {
    const metadata = buildCategoryProductsMetadata(
      {
        name: '  Приказни герои  ',
        canonicalSlug: 'fairytale characters',
        eligibleLocales: ['bg', 'bg', ''],
      },
      'bg'
    );

    expect(metadata.title).toEqual({ absolute: 'Приказни герои | Happy Colors' });
    expect(metadata.description).toBe(
      'Разгледайте Приказни герои от Happy Colors с ръчно изработени предложения от каталога.'
    );
    expect(metadata.path).toBe('/products?category=fairytale%20characters');
    expect(metadata.alternateLocales).toEqual(['bg']);
    expect(metadata.includeXDefault).toBe(true);
  });

  it('falls back to displayNames.bg and omits x-default when the default locale is not eligible', () => {
    expect(
      buildCategoryProductsMetadata(
        {
          displayNames: { bg: 'Подаръци' },
          filterSlug: 'gifts',
          eligibleLocales: ['en'],
        },
        'en'
      )
    ).toMatchObject({
      title: { absolute: 'Подаръци | Happy Colors' },
      path: '/products?category=gifts',
      alternateLocales: ['en'],
      includeXDefault: false,
    });
  });
});
