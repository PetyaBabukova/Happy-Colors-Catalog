import { describe, expect, it } from 'vitest';
import Product from '../../../models/Product.js';
import { backfillProductPublicationStatus } from '../../../../scripts/backfillProductPublicationStatus.js';
import { PRODUCT_PUBLICATION_STATUSES } from '../../../utils/productPublication.js';
import { buildProduct, createCategory, createUser } from '../factories.js';

describe('product publication migration', () => {
  it('backfills missing product publication statuses and reports missing owners', async () => {
    const owner = await createUser();
    const category = await createCategory();
    const legacyProduct = await Product.create({
      ...buildProduct({ owner, category, publicationStatus: undefined }),
      publicationStatus: undefined,
    });
    await Product.collection.updateOne(
      { _id: legacyProduct._id },
      { $unset: { publicationStatus: '' } }
    );
    const missingOwnerProduct = await Product.create({
      ...buildProduct({ owner, category }),
      owner: '507f1f77bcf86cd799439011',
      title: 'Missing owner',
    });

    const result = await backfillProductPublicationStatus();

    await expect(Product.findById(legacyProduct._id).lean()).resolves.toMatchObject({
      publicationStatus: PRODUCT_PUBLICATION_STATUSES.PUBLISHED,
    });
    expect(result.modifiedCount).toBeGreaterThanOrEqual(1);
    expect(result.productsWithMissingOwners).toEqual([
      expect.objectContaining({
        _id: String(missingOwnerProduct._id),
        title: 'Missing owner',
        owner: '507f1f77bcf86cd799439011',
      }),
    ]);
  });

  it('is idempotent after products are backfilled', async () => {
    const owner = await createUser();
    const category = await createCategory();
    await Product.create(buildProduct({ owner, category }));

    await backfillProductPublicationStatus();
    const secondRun = await backfillProductPublicationStatus();

    expect(secondRun.modifiedCount).toBe(0);
    expect(secondRun.productsWithMissingOwners).toEqual([]);
  });
});
