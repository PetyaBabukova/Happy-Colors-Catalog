import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import Product from '../../models/Product.js';
import { createExpressApp } from '../../server.js';
import { authCookie, createCategory, createProduct, createFullAdmin, createUser } from './factories.js';

describe('categories integration', () => {
  function enableSingleRevalidationTarget(fetchMock) {
    vi.stubEnv('CLIENT_URL', 'http://localhost:3000');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEWSLETTER_PUBLIC_SITE_URL', '');
    vi.stubEnv('PUBLIC_SITE_URL', '');
    vi.stubEnv('PRODUCT_REVALIDATE_SECRET', 'test-revalidate-secret');
    vi.stubGlobal('fetch', fetchMock);
  }

  it('creates and lists categories', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const createRes = await request(app)
      .post('/categories')
      .set('Cookie', authCookie(owner))
      .send({ name: 'Candles' })
      .expect(201);
    const listRes = await request(app).get('/categories').expect(200);

    expect(createRes.body).toMatchObject({
      name: 'Candles',
      slug: 'candles',
      canonicalSlug: 'candles',
      canonicalSlugReviewed: false,
      slugAliases: [],
    });
    expect(listRes.body).toEqual([expect.objectContaining({ name: 'Candles' })]);
  });

  it('projects translated categories for English public requests', async () => {
    const app = createExpressApp();
    const translated = await createCategory({
      name: 'Source Category',
      slug: 'source-category',
      canonicalSlug: 'stable-category',
      sourceRevision: 2,
      translations: {
        en: {
          name: 'English Category',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });
    const fallback = await createCategory({
      name: 'Fallback Category',
      slug: 'fallback-category',
      sourceRevision: 3,
    });

    const enRes = await request(app).get('/categories').query({ locale: 'en' }).expect(200);
    const bgRes = await request(app).get('/categories').expect(200);

    expect(enRes.body).toEqual([
      expect.objectContaining({
        _id: String(translated._id),
        name: 'English Category',
        filterSlug: 'stable-category',
        contentLocale: 'en',
        translationPending: false,
      }),
      expect.objectContaining({
        _id: String(fallback._id),
        name: 'Fallback Category',
        filterSlug: 'fallback-category',
        contentLocale: 'bg',
        translationPending: true,
      }),
    ]);
    expect(enRes.body[0]).not.toHaveProperty('translations');
    expect(enRes.body[0]).not.toHaveProperty('sourceRevision');
    expect(enRes.body[0]).not.toHaveProperty('canonicalSlug');
    expect(enRes.body[0]).not.toHaveProperty('canonicalSlugReviewed');
    expect(enRes.body[0]).not.toHaveProperty('slugAliases');
    expect(bgRes.body[0]).toMatchObject({ name: 'Source Category' });
    expect(bgRes.body[0]).toMatchObject({ filterSlug: 'stable-category' });
    expect(bgRes.body[0]).not.toHaveProperty('translations');
    expect(bgRes.body[0]).not.toHaveProperty('sourceRevision');
    expect(bgRes.body[0]).not.toHaveProperty('canonicalSlug');
    expect(bgRes.body[0]).not.toHaveProperty('canonicalSlugReviewed');
    expect(bgRes.body[0]).not.toHaveProperty('slugAliases');
    expect(bgRes.body[0]).not.toHaveProperty('contentLocale');
  });

  it('marks stale English category translations as fallbacks', async () => {
    const app = createExpressApp();
    await createCategory({
      name: 'Updated Category Source',
      slug: 'updated-category-source',
      canonicalSlug: 'updated-category',
      sourceRevision: 3,
      translations: {
        en: {
          name: 'Stale Category Translation',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });

    const res = await request(app).get('/categories').query({ locale: 'en' }).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        name: 'Updated Category Source',
        filterSlug: 'updated-category',
        contentLocale: 'bg',
        translationPending: true,
      }),
    ]);
  });

  it('bumps category sourceRevision when the source name is edited', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory({
      name: 'Original category name',
      slug: 'original-category-name',
      sourceRevision: 1,
    });

    const res = await request(app)
      .put(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .send({ name: 'Updated category name' })
      .expect(200);

    expect(res.body).toMatchObject({
      name: 'Updated category name',
      sourceRevision: 2,
    });
  });

  it('keeps reviewed canonical slugs stable and aliases previous category slugs after renames', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory({
      name: 'Old category name',
      slug: 'old-category-name',
      canonicalSlug: 'stable-category',
      canonicalSlugReviewed: true,
      slugAliases: ['historic-category'],
      sourceRevision: 1,
    });

    const res = await request(app)
      .put(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .send({ name: 'New category name' })
      .expect(200);

    expect(res.body).toMatchObject({
      name: 'New category name',
      slug: 'new-category-name',
      canonicalSlug: 'stable-category',
      canonicalSlugReviewed: true,
      slugAliases: ['historic-category', 'old-category-name'],
    });
  });

  it('allows explicit canonical slug changes and preserves the previous canonical slug as an alias', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory({
      name: 'Original category',
      slug: 'original-category',
      canonicalSlug: 'original-stable',
      canonicalSlugReviewed: true,
    });

    const res = await request(app)
      .put(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .send({
        name: 'Original category',
        canonicalSlug: 'new-stable',
        canonicalSlugReviewed: true,
        slugAliases: ['manual-alias'],
      })
      .expect(200);

    expect(res.body).toMatchObject({
      slug: 'original-category',
      canonicalSlug: 'new-stable',
      canonicalSlugReviewed: true,
      slugAliases: ['manual-alias', 'original-stable'],
    });
  });

  it('rejects canonical slug collisions against other category aliases', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createCategory({
      name: 'Taken category',
      slug: 'taken-category',
      canonicalSlug: 'taken-stable',
      slugAliases: ['taken-alias'],
    });
    const category = await createCategory({
      name: 'Editable category',
      slug: 'editable-category',
      canonicalSlug: 'editable-stable',
    });

    const res = await request(app)
      .put(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .send({
        name: 'Editable category',
        canonicalSlug: 'taken-alias',
        canonicalSlugReviewed: true,
      })
      .expect(400);

    expect(res.body).toMatchObject({
      field: 'canonicalSlug',
      message: 'Stable category slug is already used by another category.',
    });
  });

  it('rejects category creation when the canonical slug collides with another alias', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    await createCategory({
      name: 'Taken category',
      slug: 'taken-category',
      canonicalSlug: 'taken-stable',
      slugAliases: ['taken-alias'],
    });

    const res = await request(app)
      .post('/categories')
      .set('Cookie', authCookie(owner))
      .send({ name: 'New category', canonicalSlug: 'taken-alias' })
      .expect(400);

    expect(res.body).toMatchObject({
      field: 'canonicalSlug',
      message: 'Stable category slug is already used by another category.',
    });
  });

  it('returns an English translation decision when an already translated category name changes', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory({
      name: 'Original category name',
      slug: 'original-category-name',
      sourceRevision: 1,
      translations: {
        en: {
          name: 'Original category translation',
          sourceRevision: 1,
          translationRevision: 4,
          method: 'manual',
        },
      },
    });

    const res = await request(app)
      .put(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .send({ name: 'Updated category name' })
      .expect(200);

    expect(res.body).toMatchObject({
      name: 'Updated category name',
      sourceRevision: 2,
      englishTranslationDecision: {
        locale: 'en',
        status: 'needs_decision',
        sourceRevision: 2,
        translationRevision: 4,
        translationSourceRevision: 1,
      },
    });
  });

  it('projects translated visible categories for English header navigation', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory({
      name: 'Source Visible',
      slug: 'source-visible',
      canonicalSlug: 'source-visible-stable',
      sourceRevision: 2,
      translations: {
        en: {
          name: 'English Visible',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });
    await createProduct({ owner, category });

    const res = await request(app).get('/categories/visible').query({ locale: 'en' }).expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({
        name: 'English Visible',
        filterSlug: 'source-visible-stable',
        contentLocale: 'en',
        translationPending: false,
      }),
    ]);
  });

  it('rejects unsupported public category locales', async () => {
    const app = createExpressApp();

    await request(app).get('/categories').query({ locale: 'fr' }).expect(400);
    await request(app).get('/categories/visible').query({ locale: 'fr' }).expect(400);
  });

  it('requires authentication for category management endpoints', async () => {
    const app = createExpressApp();
    const category = await createCategory({ name: 'Protected', slug: 'protected' });

    await request(app).post('/categories').send({ name: 'Candles' }).expect(401);
    await request(app).get(`/categories/${category._id}`).expect(401);
    await request(app).put(`/categories/${category._id}`).send({ name: 'Updated' }).expect(401);
    await request(app).delete(`/categories/${category._id}`).expect(401);
  });

  it('requires full admin for category management endpoints', async () => {
    const app = createExpressApp();
    const customer = await createUser();
    const category = await createCategory({ name: 'Admin only', slug: 'admin-only' });

    await request(app)
      .post('/categories')
      .set('Cookie', authCookie(customer))
      .send({ name: 'Candles' })
      .expect(403);
    await request(app).get(`/categories/${category._id}`).set('Cookie', authCookie(customer)).expect(403);
    await request(app)
      .put(`/categories/${category._id}`)
      .set('Cookie', authCookie(customer))
      .send({ name: 'Updated' })
      .expect(403);
    await request(app).delete(`/categories/${category._id}`).set('Cookie', authCookie(customer)).expect(403);
  });

  it('revalidates public catalog surfaces after category create, update, and delete', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    enableSingleRevalidationTarget(fetchMock);

    try {
      const createRes = await request(app)
        .post('/categories')
        .set('Cookie', authCookie(owner))
        .send({ name: 'Cacheable Category' })
        .expect(201);

      await request(app)
        .put(`/categories/${createRes.body._id}`)
        .set('Cookie', authCookie(owner))
        .send({ name: 'Updated Cacheable Category' })
        .expect(200);

      await request(app)
        .delete(`/categories/${createRes.body._id}`)
        .set('Cookie', authCookie(owner))
        .expect(200);

      expect(fetchMock).toHaveBeenCalledTimes(3);
      for (const call of fetchMock.mock.calls) {
        expect(call[0]).toBe('http://localhost:3000/api/revalidate/products');
        expect(call[1]).toMatchObject({
          method: 'POST',
          body: '{}',
        });
      }
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });

  it('does not fail committed category writes when production revalidation is misconfigured', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CLIENT_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEWSLETTER_PUBLIC_SITE_URL', '');
    vi.stubEnv('PUBLIC_SITE_URL', '');
    vi.stubEnv('PRODUCT_REVALIDATE_SECRET', '');
    vi.stubEnv('REVALIDATE_SECRET', '');

    try {
      const res = await request(app)
        .post('/categories')
        .set('Cookie', authCookie(owner))
        .send({ name: 'Committed Despite Revalidation Misconfig' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Committed Despite Revalidation Misconfig',
      });
    } finally {
      consoleError.mockRestore();
      vi.unstubAllEnvs();
    }
  });

  it('allows authenticated users to load and update a category', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory({ name: 'Original', slug: 'original' });

    const getRes = await request(app)
      .get(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .expect(200);
    const updateRes = await request(app)
      .put(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .send({ name: 'Updated' })
      .expect(200);

    expect(getRes.body).toMatchObject({ name: 'Original' });
    expect(updateRes.body).toMatchObject({ name: 'Updated', slug: 'updated' });
  });

  it('returns only categories with products from /categories/visible', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const visible = await createCategory({ name: 'Visible', slug: 'visible' });
    await createCategory({ name: 'Hidden', slug: 'hidden' });
    await createProduct({ owner, category: visible });

    const res = await request(app).get('/categories/visible').expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'Visible' });
  });

  it('excludes categories whose only products are cartoon-gallery (not in catalog)', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const catalogCategory = await createCategory({ name: 'Catalog', slug: 'catalog-cat' });
    const cartoonCategory = await createCategory({ name: 'Cartoons', slug: 'cartoons-cat' });
    await createProduct({ owner, category: catalogCategory });
    await createProduct({
      owner,
      category: cartoonCategory,
      isInCatalog: false,
      isCartoonGallery: true,
    });

    const res = await request(app).get('/categories/visible').expect(200);

    expect(res.body.map((category) => category.name)).toEqual(['Catalog']);
  });

  it('reassigns products when deleting a category in use', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const category = await createCategory({ name: 'Original', slug: 'original' });
    const product = await createProduct({ owner, category });

    const res = await request(app)
      .delete(`/categories/${category._id}`)
      .set('Cookie', authCookie(owner))
      .expect(200);
    const updatedProduct = await Product.findById(product._id).populate('category', 'name').lean();

    expect(res.body.reassigned).toBe(true);
    expect(String(updatedProduct.category._id)).not.toBe(String(category._id));
    expect(updatedProduct.category.name).toBeTruthy();
  });
});
