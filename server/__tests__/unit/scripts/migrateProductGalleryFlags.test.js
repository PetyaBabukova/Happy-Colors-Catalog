import { describe, expect, it, vi } from 'vitest';

import { migrateProductGalleryFlags } from '../../../../scripts/migrateProductGalleryFlags.js';

function buildFakeProductModel(initialDocs) {
  const docs = initialDocs.map((doc) => ({ ...doc }));

  function matchesMissing(doc) {
    return !Object.prototype.hasOwnProperty.call(doc, 'isInCatalog');
  }

  return {
    docs,
    countDocuments: vi.fn(async () => docs.filter(matchesMissing).length),
    updateMany: vi.fn(async (_filter, update) => {
      const value = update.$set.isInCatalog;
      let modifiedCount = 0;

      for (const doc of docs) {
        if (matchesMissing(doc)) {
          doc.isInCatalog = value;
          modifiedCount += 1;
        }
      }

      return { modifiedCount };
    }),
  };
}

describe('migrateProductGalleryFlags', () => {
  it('reports pending count without mutating in dry-run mode', async () => {
    const model = buildFakeProductModel([
      { _id: '1' },
      { _id: '2', isInCatalog: true },
      { _id: '3' },
    ]);

    const result = await migrateProductGalleryFlags({ dryRun: true, ProductModel: model });

    expect(result).toEqual({ dryRun: true, pending: 2, updated: 0 });
    expect(model.updateMany).not.toHaveBeenCalled();
  });

  it('sets isInCatalog: true only on products missing the field', async () => {
    const model = buildFakeProductModel([
      { _id: '1' },
      { _id: '2', isInCatalog: false },
      { _id: '3' },
    ]);

    const result = await migrateProductGalleryFlags({ ProductModel: model });

    expect(result).toMatchObject({ dryRun: false, updated: 2 });
    // Продукт с явно isInCatalog: false НЕ се променя.
    expect(model.docs.find((doc) => doc._id === '2').isInCatalog).toBe(false);
    expect(model.docs.find((doc) => doc._id === '1').isInCatalog).toBe(true);
    expect(model.docs.find((doc) => doc._id === '3').isInCatalog).toBe(true);
  });

  it('is idempotent on a second run', async () => {
    const model = buildFakeProductModel([{ _id: '1' }, { _id: '2' }]);

    await migrateProductGalleryFlags({ ProductModel: model });
    const secondRun = await migrateProductGalleryFlags({ ProductModel: model });

    expect(secondRun).toMatchObject({ pending: 0, updated: 0 });
  });
});
