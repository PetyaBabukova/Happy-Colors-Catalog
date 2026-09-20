import { describe, expect, it } from 'vitest';
import { freezeCategorySeoInventory } from '../../../../scripts/freezeCategorySeoInventory.js';
import Category from '../../../models/Category.js';
import { hasValidCategoryTranslation } from '../../../services/localization/publicProjection.js';
import { getVisibleCategoryRedirectCandidates } from '../../../services/categoryServices.js';
import { createFullAdmin, createProduct } from '../factories.js';

function getMapEntry(value, key) {
  if (!value) {
    return null;
  }

  if (typeof value.get === 'function') {
    return value.get(key) || null;
  }

  return value[key] || null;
}

describe('category SEO inventory migration', () => {
  it('writes active English category translations through the real Category model', async () => {
    const owner = await createFullAdmin();
    const category = await Category.create({
      name: 'Животинки',
      slug: 'zhivotinki',
      canonicalSlug: 'zhivotinki',
      canonicalSlugReviewed: false,
      slugAliases: [],
      sourceRevision: 1,
    });

    await createProduct({
      owner,
      category,
      sourceRevision: 1,
      translations: {
        en: {
          title: 'English animal toy',
          description: 'English animal toy description',
          sourceRevision: 1,
          translationRevision: 1,
          method: 'manual',
        },
      },
    });

    const firstRun = await freezeCategorySeoInventory({
      CategoryModel: Category,
      dryRun: false,
      inventory: [
        {
          sourceNames: ['Животинки'],
          bgName: 'Плетени животинки',
          enName: 'Crochet Animals',
          canonicalSlug: 'crochet-animals',
        },
      ],
    });
    const secondRun = await freezeCategorySeoInventory({
      CategoryModel: Category,
      dryRun: false,
      inventory: [
        {
          sourceNames: ['Животинки'],
          bgName: 'Плетени животинки',
          enName: 'Crochet Animals',
          canonicalSlug: 'crochet-animals',
        },
      ],
    });
    const migratedCategory = await Category.findById(category._id).lean();
    const englishTranslation = getMapEntry(migratedCategory.translations, 'en');
    const redirectCandidates = await getVisibleCategoryRedirectCandidates({ locale: 'en' });

    expect(firstRun).toMatchObject({
      dryRun: false,
      planned: 1,
      updated: 1,
      missing: [],
      blocked: [],
    });
    expect(secondRun).toMatchObject({
      dryRun: false,
      planned: 0,
      updated: 0,
      missing: [],
      blocked: [],
    });
    expect(migratedCategory).toMatchObject({
      name: 'Плетени животинки',
      slug: 'zhivotinki',
      canonicalSlug: 'crochet-animals',
      canonicalSlugReviewed: true,
      slugAliases: ['zhivotinki'],
      sourceRevision: 2,
    });
    expect(englishTranslation).toMatchObject({
      name: 'Crochet Animals',
      sourceRevision: 2,
      translationRevision: 1,
      method: 'manual',
    });
    expect(hasValidCategoryTranslation(migratedCategory)).toBe(true);
    expect(redirectCandidates).toHaveLength(1);
    expect(String(redirectCandidates[0]._id)).toBe(String(category._id));
    expect(redirectCandidates[0]).toMatchObject({
      name: 'Crochet Animals',
      filterSlug: 'crochet-animals',
      canonicalSlug: 'crochet-animals',
      canonicalSlugReviewed: true,
      slugAliases: ['zhivotinki'],
      eligibleLocales: ['bg', 'en'],
      displayNames: {
        bg: 'Плетени животинки',
        en: 'Crochet Animals',
      },
    });
  });
});
