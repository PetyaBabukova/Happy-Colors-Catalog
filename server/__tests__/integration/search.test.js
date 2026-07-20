import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createExpressApp } from '../../server.js';
import { createCategory, createProduct, createUser } from './factories.js';

describe('search integration', () => {
  function expectNoPublicProductReviewFields(payload) {
    expect(payload).not.toHaveProperty('deletedAt');
    expect(payload).not.toHaveProperty('deletedBy');
    expect(payload).not.toHaveProperty('draftContent');
    expect(payload).not.toHaveProperty('draftRevision');
    expect(payload).not.toHaveProperty('draftSubmittedAt');
    expect(payload).not.toHaveProperty('draftSubmittedBy');
    expect(payload).not.toHaveProperty('draftUpdatedAt');
    expect(payload).not.toHaveProperty('reviewNote');
    expect(payload).not.toHaveProperty('reviewNotes');
    expect(payload).not.toHaveProperty('reviewStatus');
    expect(payload).not.toHaveProperty('reviewedAt');
    expect(payload).not.toHaveProperty('reviewedBy');
  }

  it('returns matching products by title and category', async () => {
    const app = createExpressApp();
    const owner = await createUser();
    const candles = await createCategory({ name: 'Candles', slug: 'candles' });
    const paintings = await createCategory({ name: 'Paintings', slug: 'paintings' });
    await createProduct({
      owner,
      category: candles,
      title: 'Lavender Light',
      deletedAt: null,
      deletedBy: owner._id,
      draftContent: {
        title: 'Unapproved Lavender Draft',
        description: 'Unapproved draft description',
      },
      draftRevision: 2,
      draftSubmittedAt: new Date(),
      draftSubmittedBy: owner._id,
      draftUpdatedAt: new Date(),
      reviewNote: 'Internal review note',
      reviewStatus: 'pending_review',
      reviewedAt: new Date(),
      reviewedBy: owner._id,
    });
    await createProduct({ owner, category: paintings, title: 'Forest Painting' });

    const titleRes = await request(app).get('/search').query({ q: 'Lavender' }).expect(200);
    const categoryRes = await request(app).get('/search').query({ q: 'Paintings' }).expect(200);

    expect(titleRes.body).toHaveLength(1);
    expect(titleRes.body[0]).toMatchObject({ title: 'Lavender Light' });
    expectNoPublicProductReviewFields(titleRes.body[0]);
    expect(categoryRes.body).toHaveLength(1);
    expect(categoryRes.body[0]).toMatchObject({ title: 'Forest Painting' });
  });

  it('searches English product and category translations when locale is English', async () => {
    const app = createExpressApp();
    const owner = await createUser();
    const category = await createCategory({
      name: 'Източник категория',
      slug: 'source-category',
      canonicalSlug: 'decor',
      sourceRevision: 2,
      translations: {
        en: {
          name: 'Room Decor',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });
    await createProduct({
      owner,
      category,
      title: 'Източник продукт',
      description: 'Описание',
      sourceRevision: 2,
      deletedAt: null,
      deletedBy: owner._id,
      draftContent: {
        title: 'Unapproved draft title',
        description: 'Unapproved draft description',
      },
      draftRevision: 2,
      draftSubmittedAt: new Date(),
      draftSubmittedBy: owner._id,
      draftUpdatedAt: new Date(),
      reviewNote: 'Internal review note',
      reviewStatus: 'pending_review',
      reviewedAt: new Date(),
      reviewedBy: owner._id,
      translations: {
        en: {
          title: 'Rainbow Wall Hanging',
          description: 'Soft room decoration',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });

    const titleRes = await request(app)
      .get('/search')
      .query({ q: 'Rainbow', locale: 'en' })
      .expect(200);
    const categoryRes = await request(app)
      .get('/search')
      .query({ q: 'Room Decor', locale: 'en' })
      .expect(200);

    expect(titleRes.body).toEqual([
      expect.objectContaining({
        title: 'Rainbow Wall Hanging',
        contentLocale: 'en',
        category: expect.objectContaining({
          name: 'Room Decor',
          filterSlug: 'decor',
        }),
      }),
    ]);
    expectNoPublicProductReviewFields(titleRes.body[0]);
    expect(categoryRes.body).toHaveLength(1);
    expect(categoryRes.body[0]).toMatchObject({ title: 'Rainbow Wall Hanging' });
    expectNoPublicProductReviewFields(categoryRes.body[0]);
  });

  it('rejects unsupported search locales', async () => {
    const app = createExpressApp();

    await request(app).get('/search').query({ q: 'test', locale: 'fr' }).expect(400);
  });

  it('returns an empty array for an empty query', async () => {
    const app = createExpressApp();

    const res = await request(app).get('/search').query({ q: '' }).expect(200);

    expect(res.body).toEqual([]);
  });
});
