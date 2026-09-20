import { describe, expect, it, vi } from 'vitest';
import {
  freezeCategorySeoInventory,
  runMigrationCli,
} from '../../../../scripts/freezeCategorySeoInventory.js';

function setPath(doc, path, value) {
  const parts = path.split('.');
  let target = doc;

  for (const part of parts.slice(0, -1)) {
    target[part] = target[part] || {};
    target = target[part];
  }

  target[parts.at(-1)] = value;
}

function matchesFilter(doc, filter = {}) {
  return Object.entries(filter).every(([key, value]) => {
    const hasKey = Object.prototype.hasOwnProperty.call(doc, key);

    if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '$exists')) {
      return value.$exists ? hasKey : !hasKey;
    }

    if (Array.isArray(value)) {
      return Array.isArray(doc[key]) && JSON.stringify(doc[key]) === JSON.stringify(value);
    }

    return String(doc[key]) === String(value);
  });
}

function buildCategoryModel(initialDocs) {
  const docs = initialDocs.map((doc) => ({ ...doc }));
  const query = {
    sort: vi.fn(() => query),
    lean: vi.fn(async () => docs.map((doc) => ({ ...doc }))),
  };

  return {
    docs,
    find: vi.fn(() => query),
    bulkWrite: vi.fn(async (operations) => {
      let modifiedCount = 0;

      for (const operation of operations) {
        const { filter, update } = operation.updateOne;
        const doc = docs.find((item) => matchesFilter(item, filter));

        if (!doc) {
          continue;
        }

        for (const [path, value] of Object.entries(update.$set || {})) {
          setPath(doc, path, value);
        }

        modifiedCount += 1;
      }

      return { modifiedCount };
    }),
  };
}

describe('freezeCategorySeoInventory', () => {
  it('plans reviewed canonical slug and translation updates without mutating in dry-run mode', async () => {
    const CategoryModel = buildCategoryModel([
      {
        _id: 'cat-1',
        name: 'Приказни герои',
        slug: 'prikazni-geroi',
        canonicalSlug: 'prikazni-geroi',
        canonicalSlugReviewed: false,
        slugAliases: [],
        sourceRevision: 1,
        translations: {},
      },
    ]);

    const result = await freezeCategorySeoInventory({
      CategoryModel,
      dryRun: true,
      inventory: [
        {
          sourceNames: ['Приказни герои'],
          bgName: 'Плетени приказни герои',
          enName: 'Crochet Fairytale Characters',
          canonicalSlug: 'fairytale-characters',
        },
      ],
    });

    expect(result).toMatchObject({
      dryRun: true,
      planned: 1,
      updated: 0,
      missing: [],
      blocked: [],
      updates: [
        {
          categoryId: 'cat-1',
          previousName: 'Приказни герои',
          nextName: 'Плетени приказни герои',
          canonicalSlug: 'fairytale-characters',
          slugAliases: ['prikazni-geroi'],
          sourceRevision: 2,
          enName: 'Crochet Fairytale Characters',
        },
      ],
    });
    expect(CategoryModel.bulkWrite).not.toHaveBeenCalled();
    expect(CategoryModel.docs[0].canonicalSlug).toBe('prikazni-geroi');
  });

  it('writes category SEO inventory updates and is idempotent on rerun', async () => {
    const CategoryModel = buildCategoryModel([
      {
        _id: 'cat-1',
        name: 'Животинки',
        slug: 'zhivotinki',
        canonicalSlug: '',
        canonicalSlugReviewed: false,
        slugAliases: [],
        sourceRevision: 1,
        translations: {},
      },
    ]);
    const inventory = [
      {
        sourceNames: ['Животинки'],
        bgName: 'Плетени животинки',
        enName: 'Crochet Animals',
        canonicalSlug: 'crochet-animals',
      },
    ];

    const firstRun = await freezeCategorySeoInventory({
      CategoryModel,
      dryRun: false,
      inventory,
    });
    const secondRun = await freezeCategorySeoInventory({
      CategoryModel,
      dryRun: false,
      inventory,
    });

    expect(firstRun).toMatchObject({ dryRun: false, planned: 1, updated: 1 });
    expect(CategoryModel.bulkWrite.mock.calls[0][0][0].updateOne.filter).toMatchObject({
      _id: 'cat-1',
      name: 'Животинки',
      slug: 'zhivotinki',
      canonicalSlug: '',
      canonicalSlugReviewed: false,
      slugAliases: [],
      sourceRevision: 1,
    });
    expect(CategoryModel.docs[0]).toMatchObject({
      name: 'Плетени животинки',
      canonicalSlug: 'crochet-animals',
      canonicalSlugReviewed: true,
      slugAliases: ['zhivotinki'],
      sourceRevision: 2,
      translations: {
        en: {
          name: 'Crochet Animals',
          sourceRevision: 2,
          translationRevision: 1,
          method: 'manual',
        },
      },
    });
    expect(secondRun).toMatchObject({ dryRun: false, planned: 0, updated: 0 });
  });

  it('reports missing, ambiguous, and colliding inventory items without guessing', async () => {
    const CategoryModel = buildCategoryModel([
      {
        _id: 'cat-1',
        name: 'Раници, чанти и комплекти',
        slug: 'bags',
        canonicalSlug: '',
        slugAliases: [],
        sourceRevision: 1,
      },
      {
        _id: 'cat-2',
        name: 'Раници, чанти и комплекти',
        slug: 'bags-copy',
        canonicalSlug: '',
        slugAliases: [],
        sourceRevision: 1,
      },
      {
        _id: 'cat-3',
        name: 'Приказни герои',
        slug: 'prikazni-geroi',
        canonicalSlug: '',
        slugAliases: [],
        sourceRevision: 1,
      },
      {
        _id: 'cat-4',
        name: 'Taken',
        slug: 'taken',
        canonicalSlug: 'fairytale-characters',
        slugAliases: [],
        sourceRevision: 1,
      },
    ]);

    const result = await freezeCategorySeoInventory({
      CategoryModel,
      dryRun: true,
      inventory: [
        {
          sourceNames: ['Раници, чанти и комплекти'],
          bgName: 'Ръчно изработени раници и чанти',
          enName: 'Handmade Backpacks and Bags',
          canonicalSlug: 'handmade-backpacks-and-bags',
        },
        {
          sourceNames: ['Приказни герои'],
          bgName: 'Плетени приказни герои',
          enName: 'Crochet Fairytale Characters',
          canonicalSlug: 'fairytale-characters',
        },
        {
          sourceNames: ['Липсваща категория'],
          bgName: 'Липсваща категория',
          enName: 'Missing Category',
          canonicalSlug: 'missing-category',
        },
      ],
    });

    expect(result.updates).toEqual([]);
    expect(result.missing).toEqual([
      {
        canonicalSlug: 'missing-category',
        sourceNames: ['Липсваща категория'],
      },
    ]);
    expect(result.blocked).toEqual([
      {
        canonicalSlug: 'handmade-backpacks-and-bags',
        reason: 'ambiguous_category_match',
        categoryIds: ['cat-1', 'cat-2'],
      },
      {
        canonicalSlug: 'fairytale-characters',
        reason: 'ambiguous_category_match',
        categoryIds: ['cat-3', 'cat-4'],
      },
    ]);
    expect(CategoryModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('blocks updates when preserving an old category slug would collide with another category', async () => {
    const CategoryModel = buildCategoryModel([
      {
        _id: 'cat-1',
        name: 'Приказни герои',
        slug: 'prikazni-geroi',
        canonicalSlug: 'historic-fairytale',
        slugAliases: [],
        sourceRevision: 1,
      },
      {
        _id: 'cat-2',
        name: 'Historic owner',
        slug: 'historic-fairytale',
        canonicalSlug: '',
        slugAliases: [],
        sourceRevision: 1,
      },
    ]);

    const result = await freezeCategorySeoInventory({
      CategoryModel,
      dryRun: true,
      inventory: [
        {
          sourceNames: ['Приказни герои'],
          bgName: 'Плетени приказни герои',
          enName: 'Crochet Fairytale Characters',
          canonicalSlug: 'fairytale-characters',
        },
      ],
    });

    expect(result.blocked).toEqual([
      {
        categoryId: 'cat-1',
        canonicalSlug: 'fairytale-characters',
        reason: 'slug_alias_collision',
        aliasCollisions: [
          {
            alias: 'historic-fairytale',
            conflictingCategoryId: 'cat-2',
          },
        ],
      },
    ]);
    expect(result.updates).toEqual([]);
    expect(CategoryModel.bulkWrite).not.toHaveBeenCalled();
  });

  it('keeps the CLI dry-run by default and returns nonzero when manual review remains', async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const runMigration = vi.fn(async ({ dryRun }) => ({
      dryRun,
      planned: 0,
      updated: 0,
      missing: [{ canonicalSlug: 'missing-category' }],
      blocked: [],
      updates: [],
    }));

    await expect(runMigrationCli({
      argv: [],
      runMigration,
      stdout,
      stderr,
    })).resolves.toBe(2);

    expect(runMigration).toHaveBeenCalledWith({ dryRun: true });
    expect(JSON.parse(stdout.mock.calls[0][0])).toMatchObject({
      dryRun: true,
      missing: [{ canonicalSlug: 'missing-category' }],
    });
    expect(stderr).not.toHaveBeenCalled();
  });
});
