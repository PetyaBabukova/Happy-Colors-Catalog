import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import BlogArticle from '../../models/BlogArticle.js';
import HomeBanner from '../../models/HomeBanner.js';
import Product from '../../models/Product.js';
import { createExpressApp } from '../../server.js';
import { saveManualTranslation } from '../../services/translation/translationService.js';
import {
  authCookie,
  createBlogArticle,
  createCategory,
  createFullAdmin,
  createHomeBanner,
  createProduct,
  createUser,
} from './factories.js';

describe('translations integration', () => {
  it('requires full admin access for translation management', async () => {
    const app = createExpressApp();
    const customer = await createUser();
    const product = await createProduct();

    await request(app).get('/translations/queue').expect(401);
    await request(app)
      .get('/translations/queue')
      .set('Cookie', authCookie(customer))
      .expect(403);
    await request(app)
      .put(`/translations/product/${product._id}/en`)
      .send({
        expectedSourceRevision: 1,
        expectedTranslationRevision: 0,
        fields: { title: 'English title', description: 'English description' },
      })
      .expect(401);
  });

  it('returns unresolved translation queue items without source content bodies', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const product = await createProduct({
      owner: admin,
      title: 'Bulgarian product',
      sourceRevision: 3,
      translations: {
        en: {
          title: 'Old English product',
          description: 'Old English description',
          sourceRevision: 2,
          method: 'manual',
        },
      },
    });
    const article = await createBlogArticle({
      owner: admin,
      title: 'Bulgarian article',
      sourceRevision: 2,
      translationDrafts: {
        en: {
          title: 'English draft',
          contentHtml: '<p>English draft body.</p>',
          contentText: 'English draft body.',
          excerpt: 'English draft body.',
          heroImageAlt: 'English alt',
          sourceRevision: 2,
          translationRevision: 1,
          draftRevision: 1,
          method: 'manual',
        },
      },
    });

    const res = await request(app)
      .get('/translations/queue')
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.headers['cache-control']).toContain('no-store');
    expect(res.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'product',
          entityId: String(product._id),
          label: 'Bulgarian product',
          status: 'needs_decision',
          sourceRevision: 3,
          translationRevision: 1,
          translation: expect.objectContaining({
            title: 'Old English product',
            description: 'Old English description',
          }),
        }),
        expect.objectContaining({
          entityType: 'blogArticle',
          entityId: String(article._id),
          label: 'Bulgarian article',
          status: 'pending_review',
          draftRevision: 1,
        }),
      ])
    );
    expect(res.body.items[0]).not.toHaveProperty('contentHtml');
    expect(res.body.items[0]).not.toHaveProperty('description');
  });

  it('returns a targeted current translation for direct admin management', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const product = await createProduct({
      owner: admin,
      sourceRevision: 2,
      translations: {
        en: {
          title: 'Current English product',
          description: 'Current English description',
          sourceRevision: 2,
          translationRevision: 1,
          method: 'manual',
        },
      },
    });

    const res = await request(app)
      .get('/translations/queue')
      .query({
        locale: 'en',
        entityType: 'product',
        entityId: String(product._id),
      })
      .set('Cookie', authCookie(admin))
      .expect(200);

    expect(res.body).toMatchObject({
      locale: 'en',
      unresolvedCount: 0,
      items: [
        {
          entityType: 'product',
          entityId: String(product._id),
          status: 'current',
          translationRevision: 1,
          translation: {
            title: 'Current English product',
            description: 'Current English description',
          },
        },
      ],
    });
  });

  it('rejects partial targeted queue filters', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();

    const res = await request(app)
      .get('/translations/queue')
      .query({ locale: 'en', entityType: 'product' })
      .set('Cookie', authCookie(admin))
      .expect(400);

    expect(res.body).toEqual({
      message: 'Both translation entity type and id are required.',
    });
  });

  it('saves product and category manual translations as active current content', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const category = await createCategory({ name: 'Играчки', slug: 'igrachki', sourceRevision: 1 });
    const product = await createProduct({
      owner: admin,
      category,
      title: 'Лъвче',
      description: 'Плетено лъвче.',
      sourceRevision: 1,
    });

    await request(app)
      .put(`/translations/category/${category._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedTranslationRevision: 0,
        fields: { name: 'Toys' },
      })
      .expect(200);

    const saveRes = await request(app)
      .put(`/translations/product/${product._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedTranslationRevision: 0,
        fields: { title: 'Little Lion', description: 'Crocheted little lion.' },
      })
      .expect(200);

    expect(saveRes.body).toMatchObject({
      status: 'current',
      activation: 'active',
      translation: {
        title: 'Little Lion',
        description: 'Crocheted little lion.',
        sourceRevision: 1,
        translationRevision: 1,
        method: 'manual',
      },
    });

    const publicRes = await request(app)
      .get(`/products/${product._id}`)
      .query({ locale: 'en' })
      .expect(200);

    expect(publicRes.body).toMatchObject({
      title: 'Little Lion',
      description: 'Crocheted little lion.',
      contentLocale: 'en',
      translationPending: false,
      category: expect.objectContaining({ name: 'Toys' }),
    });
  });

  it('keeps legacy public product publication and catalog state unchanged after English translation', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const category = await createCategory({ sourceRevision: 1 });
    const legacyProduct = await createProduct({
      owner: admin,
      category,
      title: 'Legacy catalog source',
      description: 'Legacy catalog source description.',
      sourceRevision: 1,
      reviewStatus: 'none',
    });

    await Product.collection.updateOne(
      { _id: legacyProduct._id },
      {
        $unset: {
          publicationStatus: '',
          isInCatalog: '',
          isCartoonGallery: '',
        },
      }
    );

    const beforeRaw = await Product.collection.findOne({ _id: legacyProduct._id });
    const beforeListRes = await request(app).get('/products').expect(200);

    expect(beforeListRes.body.map((product) => product._id)).toContain(String(legacyProduct._id));
    expect(beforeRaw).not.toHaveProperty('publicationStatus');
    expect(beforeRaw).not.toHaveProperty('isInCatalog');
    expect(beforeRaw).not.toHaveProperty('isCartoonGallery');
    expect(beforeRaw.reviewStatus).toBe('none');

    const saveRes = await request(app)
      .put(`/translations/product/${legacyProduct._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedTranslationRevision: 0,
        fields: {
          title: 'Legacy catalog translation',
          description: 'Legacy catalog translated description.',
        },
      })
      .expect(200);
    const afterRaw = await Product.collection.findOne({ _id: legacyProduct._id });
    const afterBgListRes = await request(app).get('/products').expect(200);
    const afterEnDetailRes = await request(app)
      .get(`/products/${legacyProduct._id}`)
      .query({ locale: 'en' })
      .expect(200);

    expect(saveRes.body).toMatchObject({
      status: 'current',
      translation: {
        title: 'Legacy catalog translation',
        description: 'Legacy catalog translated description.',
        sourceRevision: 1,
        translationRevision: 1,
        method: 'manual',
      },
    });
    expect(afterBgListRes.body.map((product) => product._id)).toContain(String(legacyProduct._id));
    expect(afterRaw).not.toHaveProperty('publicationStatus');
    expect(afterRaw).not.toHaveProperty('isInCatalog');
    expect(afterRaw).not.toHaveProperty('isCartoonGallery');
    expect(afterRaw.reviewStatus).toBe(beforeRaw.reviewStatus);
    expect(afterRaw.translations.en).toMatchObject({
      title: 'Legacy catalog translation',
      description: 'Legacy catalog translated description.',
      sourceRevision: 1,
      translationRevision: 1,
      method: 'manual',
    });
    expect(afterEnDetailRes.body).toMatchObject({
      _id: String(legacyProduct._id),
      title: 'Legacy catalog translation',
      description: 'Legacy catalog translated description.',
      contentLocale: 'en',
      translationPending: false,
    });
  });

  it('rejects stale manual product edits with a conflict', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const product = await createProduct({
      owner: admin,
      sourceRevision: 2,
      translations: {
        en: {
          title: 'Existing title',
          description: 'Existing description',
          sourceRevision: 2,
          translationRevision: 2,
          method: 'manual',
        },
      },
    });

    await request(app)
      .put(`/translations/product/${product._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 2,
        expectedTranslationRevision: 1,
        fields: { title: 'Overwrite attempt', description: 'Overwrite attempt.' },
      })
      .expect(409);

    const stored = await Product.findById(product._id).lean();
    expect(stored.translations.en.title).toBe('Existing title');
  });

  it('rejects manual product saves when the translation changes during the targeted write', async () => {
    const admin = await createFullAdmin();
    const product = await createProduct({
      owner: admin,
      sourceRevision: 1,
    });
    const originalUpdateOne = Product.updateOne.bind(Product);
    const concurrentTranslation = {
      title: 'Concurrent title',
      description: 'Concurrent description.',
      sourceRevision: 1,
      translationRevision: 1,
      method: 'manual',
      translatedAt: new Date(),
      translatedBy: admin._id,
    };
    const updateOneSpy = vi.spyOn(Product, 'updateOne').mockImplementationOnce(async (...args) => {
      await Product.collection.updateOne(
        { _id: product._id },
        { $set: { 'translations.en': concurrentTranslation } }
      );

      return originalUpdateOne(...args);
    });

    try {
      await expect(
        saveManualTranslation({
          entityType: 'product',
          entityId: product._id,
          locale: 'en',
          payload: {
            expectedSourceRevision: 1,
            expectedTranslationRevision: 0,
            fields: {
              title: 'Late title',
              description: 'Late description.',
            },
          },
          userId: admin._id,
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'The source or English translation changed. Reload and retry.',
      });
    } finally {
      updateOneSpy.mockRestore();
    }

    const stored = await Product.collection.findOne({ _id: product._id });

    expect(stored.translations.en).toMatchObject({
      title: 'Concurrent title',
      description: 'Concurrent description.',
      sourceRevision: 1,
      translationRevision: 1,
      method: 'manual',
    });
  });

  it('rejects translations that drop protected placeholders', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const product = await createProduct({
      owner: admin,
      description: 'Персонализиран подарък за {recipient}.',
      sourceRevision: 1,
    });

    await request(app)
      .put(`/translations/product/${product._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedTranslationRevision: 0,
        fields: {
          title: 'Custom gift',
          description: 'Personalized gift for the recipient.',
        },
      })
      .expect(400);

    const stored = await Product.findById(product._id).lean();
    expect(stored.translations).toBeUndefined();
  });

  it('accepts unchanged stale English translations against the current source revision', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const product = await createProduct({
      owner: admin,
      title: 'Updated source',
      description: 'Updated source description.',
      sourceRevision: 3,
      translations: {
        en: {
          title: 'Still suitable',
          description: 'Still suitable description.',
          sourceRevision: 2,
          translationRevision: 1,
          method: 'manual',
        },
      },
    });
    await Product.collection.updateOne(
      { _id: product._id },
      {
        $unset: {
          publicationStatus: '',
          isInCatalog: '',
          isCartoonGallery: '',
        },
      }
    );

    const res = await request(app)
      .post(`/translations/product/${product._id}/en/accept-current`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 3,
        expectedTranslationRevision: 1,
      })
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'current',
      translation: {
        title: 'Still suitable',
        sourceRevision: 3,
        translationRevision: 2,
        method: 'accepted_unchanged',
      },
    });
    const stored = await Product.collection.findOne({ _id: product._id });

    expect(stored).not.toHaveProperty('publicationStatus');
    expect(stored).not.toHaveProperty('isInCatalog');
    expect(stored).not.toHaveProperty('isCartoonGallery');
    expect(stored.translations.en).toMatchObject({
      title: 'Still suitable',
      sourceRevision: 3,
      translationRevision: 2,
      method: 'accepted_unchanged',
    });
  });

  it('keeps accept-current idempotent when the translation is already current', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const product = await createProduct({
      owner: admin,
      sourceRevision: 2,
      translations: {
        en: {
          title: 'Current title',
          description: 'Current description.',
          sourceRevision: 2,
          translationRevision: 4,
          method: 'manual',
        },
      },
    });

    const res = await request(app)
      .post(`/translations/product/${product._id}/en/accept-current`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 2,
        expectedTranslationRevision: 4,
      })
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'current',
      translation: {
        title: 'Current title',
        sourceRevision: 2,
        translationRevision: 4,
        method: 'manual',
      },
    });
  });

  it('saves and approves blog translations through a draft without leaking draft content publicly', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({
      owner: admin,
      title: 'Блог статия',
      sourceRevision: 1,
    });

    const draftRes = await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: {
          title: 'English article',
          contentHtml: '<p>English body.</p><script>alert(1)</script>',
          heroImageAlt: 'English hero',
          seoTitle: 'English SEO',
          seoDescription: 'English SEO description',
        },
      })
      .expect(200);

    expect(draftRes.body).toMatchObject({
      status: 'pending_review',
      activation: 'draft',
      draft: {
        title: 'English article',
        contentHtml: '<p>English body.</p>',
        contentText: 'English body.',
        excerpt: 'English body.',
        draftRevision: 1,
      },
      translation: null,
    });

    await request(app)
      .get(`/blog-articles/${article._id}`)
      .query({ locale: 'en' })
      .expect(404);

    const approveRes = await request(app)
      .post(`/translations/blogArticle/${article._id}/en/draft/approve`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 1,
      })
      .expect(200);

    expect(approveRes.body).toMatchObject({
      status: 'current',
      translation: {
        title: 'English article',
        contentHtml: '<p>English body.</p>',
        sourceRevision: 1,
        translationRevision: 1,
      },
      draft: null,
    });

    const publicRes = await request(app)
      .get(`/blog-articles/${article._id}`)
      .query({ locale: 'en' })
      .expect(200);

    expect(publicRes.body).toMatchObject({
      title: 'English article',
      contentHtml: '<p>English body.</p>',
      contentLocale: 'en',
    });
  });

  it('rejects blog translations that change protected link destinations', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({
      owner: admin,
      contentHtml: '<p>Вижте <a href="https://happycolors.eu/products/lion">лъвчето</a>.</p>',
      sourceRevision: 1,
    });

    await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: {
          title: 'English article',
          contentHtml: '<p>See <a href="https://example.com/products/lion">the lion</a>.</p>',
          heroImageAlt: 'English hero',
        },
      })
      .expect(400);

    const stored = await BlogArticle.findById(article._id).lean();
    expect(stored.translationDrafts).toBeUndefined();
  });

  it('allows English blog translations to localize internal link prefixes', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({
      owner: admin,
      contentHtml: '<p>Вижте <a href="/blog/internal-guide">ръководството</a>.</p>',
      sourceRevision: 1,
    });

    await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: {
          title: 'English article',
          contentHtml: '<p>See <a href="/en/blog/internal-guide">the guide</a>.</p>',
          heroImageAlt: 'English hero',
        },
      })
      .expect(200);

    const stored = await BlogArticle.findById(article._id).lean();

    expect(stored.translationDrafts.en.contentHtml).toContain('href="/en/blog/internal-guide"');
  });

  it('allows English blog translations to normalize internal trailing slashes', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({
      owner: admin,
      contentHtml: '<p>Read <a href="https://happycolors.eu/bg/blog/internal-guide/">the guide</a>.</p>',
      sourceRevision: 1,
    });

    await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: {
          title: 'English article',
          contentHtml: '<p>Read <a href="/en/blog/internal-guide">the guide</a>.</p>',
          heroImageAlt: 'English hero',
        },
      })
      .expect(200);

    const stored = await BlogArticle.findById(article._id).lean();

    expect(stored.translationDrafts.en.contentHtml).toContain('href="/en/blog/internal-guide"');
  });

  it('allows English blog translations to localize internal search query text', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({
      owner: admin,
      contentHtml: '<p>See <a href="https://happycolors.eu/bg/search?q=%D1%80%D0%B0%D0%BD%D0%B8%D1%86%D0%B0">sets</a>.</p>',
      sourceRevision: 1,
    });

    await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: {
          title: 'English article',
          contentHtml: '<p>See <a href="https://happycolors.eu/en/search?q=Backpack+">sets</a>.</p>',
          heroImageAlt: 'English hero',
        },
      })
      .expect(200);

    const stored = await BlogArticle.findById(article._id).lean();

    expect(stored.translationDrafts.en.contentHtml).toContain('href="https://happycolors.eu/en/search?q=Backpack+"');
  });

  it('allows English blog translations to normalize external root trailing slashes', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({
      owner: admin,
      contentHtml: '<p>Created by <a href="https://webcreativeteam.com/">the agency</a>.</p>',
      sourceRevision: 1,
    });

    await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: {
          title: 'English article',
          contentHtml: '<p>Created by <a href="https://webcreativeteam.com">the agency</a>.</p>',
          heroImageAlt: 'English hero',
        },
      })
      .expect(200);

    const stored = await BlogArticle.findById(article._id).lean();

    expect(stored.translationDrafts.en.contentHtml).toContain('href="https://webcreativeteam.com"');
  });

  it('rejects blog translations that change internal link targets while adding locale prefixes', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({
      owner: admin,
      contentHtml: '<p>Read <a href="/blog/internal-guide">the guide</a>.</p>',
      sourceRevision: 1,
    });

    await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: {
          title: 'English article',
          contentHtml: '<p>Read <a href="/en/blog/other-guide">the guide</a>.</p>',
          heroImageAlt: 'English hero',
        },
      })
      .expect(400);

    const stored = await BlogArticle.findById(article._id).lean();
    expect(stored.translationDrafts).toBeUndefined();
  });

  it('saves edits to a current blog translation as a new review draft', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({
      owner: admin,
      sourceRevision: 2,
      translations: {
        en: {
          title: 'Current English article',
          contentHtml: '<p>Current English body.</p>',
          contentText: 'Current English body.',
          excerpt: 'Current English body.',
          heroImageAlt: 'Current English hero',
          seoTitle: '',
          seoDescription: '',
          sourceRevision: 2,
          translationRevision: 3,
          method: 'manual',
        },
      },
    });

    const saveRes = await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 2,
        expectedDraftRevision: 0,
        fields: {
          title: 'Edited English article',
          contentHtml: '<p>Edited English body.</p>',
          heroImageAlt: 'Edited English hero',
          seoTitle: '',
          seoDescription: '',
        },
      })
      .expect(200);

    expect(saveRes.body).toMatchObject({
      status: 'pending_review',
      translation: {
        title: 'Current English article',
        translationRevision: 3,
      },
      draft: {
        title: 'Edited English article',
        draftRevision: 1,
        translationRevision: 3,
      },
    });

    const stored = await BlogArticle.findById(article._id).lean();

    expect(stored.translations.en.title).toBe('Current English article');
    expect(stored.translationDrafts.en).toMatchObject({
      title: 'Edited English article',
      contentHtml: '<p>Edited English body.</p>',
      draftRevision: 1,
      translationRevision: 3,
    });
  });

  it('surfaces edited current blog translations as review drafts until approval publishes them', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({
      owner: admin,
      sourceRevision: 2,
      translations: {
        en: {
          title: 'Current English article',
          contentHtml: '<p>Current English body.</p>',
          contentText: 'Current English body.',
          excerpt: 'Current English body.',
          heroImageAlt: 'Current English hero',
          seoTitle: '',
          seoDescription: '',
          sourceRevision: 2,
          translationRevision: 3,
          method: 'manual',
        },
      },
    });

    await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 2,
        expectedDraftRevision: 0,
        fields: {
          title: 'Edited English article',
          contentHtml: '<p>Edited English body.</p>',
          heroImageAlt: 'Edited English hero',
          seoTitle: '',
          seoDescription: '',
        },
      })
      .expect(200);

    const targetedQueueRes = await request(app)
      .get('/translations/queue')
      .set('Cookie', authCookie(admin))
      .query({
        locale: 'en',
        entityType: 'blogArticle',
        entityId: String(article._id),
      })
      .expect(200);

    expect(targetedQueueRes.body).toMatchObject({
      unresolvedCount: 1,
      items: [
        {
          entityType: 'blogArticle',
          entityId: String(article._id),
          status: 'pending_review',
          translationRevision: 3,
          draftRevision: 1,
          draft: {
            title: 'Edited English article',
            draftRevision: 1,
            translationRevision: 3,
          },
        },
      ],
    });

    const globalQueueRes = await request(app)
      .get('/translations/queue')
      .set('Cookie', authCookie(admin))
      .query({ locale: 'en' })
      .expect(200);

    expect(globalQueueRes.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'blogArticle',
          entityId: String(article._id),
          status: 'pending_review',
          draftRevision: 1,
        }),
      ])
    );

    await request(app)
      .post(`/translations/blogArticle/${article._id}/en/draft/approve`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 2,
        expectedDraftRevision: 1,
      })
      .expect(200);

    const publicRes = await request(app)
      .get(`/blog-articles/${article._id}`)
      .query({ locale: 'en' })
      .expect(200);

    expect(publicRes.body).toMatchObject({
      title: 'Edited English article',
      contentHtml: '<p>Edited English body.</p>',
      contentLocale: 'en',
    });
  });

  it('rejects stale draft approval and preserves the draft', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const banner = await createHomeBanner({
      owner: admin,
      sourceRevision: 2,
      translationDrafts: {
        en: {
          title: 'English banner draft',
          description: '',
          ctaLabel: 'Open',
          sourceRevision: 2,
          translationRevision: 1,
          draftRevision: 2,
          method: 'manual',
        },
      },
    });

    await request(app)
      .post(`/translations/homeBanner/${banner._id}/en/draft/approve`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 2,
        expectedDraftRevision: 1,
      })
      .expect(409);
  });

  it('approves translation drafts without materializing unrelated legacy banner defaults', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const banner = await createHomeBanner({
      owner: admin,
      sourceRevision: 1,
      translationDrafts: {
        en: {
          title: 'English banner draft',
          description: 'English banner draft description.',
          ctaLabel: 'Open',
          sourceRevision: 1,
          translationRevision: 1,
          draftRevision: 1,
          method: 'manual',
        },
      },
    });

    await HomeBanner.collection.updateOne(
      { _id: banner._id },
      {
        $unset: {
          isActive: '',
          placement: '',
        },
      }
    );

    await request(app)
      .post(`/translations/homeBanner/${banner._id}/en/draft/approve`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 1,
      })
      .expect(200);

    const stored = await HomeBanner.collection.findOne({ _id: banner._id });

    expect(stored).not.toHaveProperty('isActive');
    expect(stored).not.toHaveProperty('placement');
    expect(stored.translationDrafts?.en).toBeUndefined();
    expect(stored.translations.en).toMatchObject({
      title: 'English banner draft',
      description: 'English banner draft description.',
      ctaLabel: 'Open',
      sourceRevision: 1,
      translationRevision: 1,
      method: 'manual',
    });
  });

  it('saves and approves an empty translation record for an image-only cartoon banner', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const banner = await createHomeBanner({
      owner: admin,
      placement: 'cartoons',
      title: '',
      description: '',
      ctaLabel: '',
      ctaHref: '',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoon-translation.webp',
      sourceRevision: 1,
    });

    const draftRes = await request(app)
      .put(`/translations/homeBanner/${banner._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: { title: '', description: '', ctaLabel: '' },
      })
      .expect(200);

    expect(draftRes.body).toMatchObject({
      status: 'pending_review',
      draft: {
        title: '',
        description: '',
        ctaLabel: '',
        draftRevision: 1,
      },
    });

    await request(app)
      .post(`/translations/homeBanner/${banner._id}/en/draft/approve`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 1,
      })
      .expect(200);

    const publicRes = await request(app)
      .get('/home-banners')
      .query({ placement: 'cartoons', locale: 'en' })
      .expect(200);

    expect(publicRes.body).toEqual([
      expect.objectContaining({
        _id: String(banner._id),
        title: '',
        ctaLabel: '',
        contentLocale: 'en',
      }),
    ]);
  });

  it('keeps translated home banner source fields required', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const banner = await createHomeBanner({
      owner: admin,
      sourceRevision: 1,
    });

    await request(app)
      .put(`/translations/homeBanner/${banner._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: { title: '', description: '', ctaLabel: '' },
      })
      .expect(400);
  });

  it('generates an empty cartoon banner draft without calling the translation provider', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const banner = await createHomeBanner({
      owner: admin,
      placement: 'cartoons',
      title: '',
      description: '',
      ctaLabel: '',
      ctaHref: '',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoon-generated.webp',
      sourceRevision: 1,
    });
    vi.stubGlobal('fetch', vi.fn());

    try {
      const res = await request(app)
        .post(`/translations/homeBanner/${banner._id}/en/generate`)
        .set('Cookie', authCookie(admin))
        .send({
          expectedSourceRevision: 1,
          expectedDraftRevision: 0,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'pending_review',
        draft: {
          title: '',
          description: '',
          ctaLabel: '',
          method: 'machine',
          provider: '',
          providerModel: '',
        },
      });
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('translates the populated copy of a partial cartoon banner source', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const banner = await createHomeBanner({
      owner: admin,
      placement: 'cartoons',
      title: 'Портретен шарж',
      description: '',
      ctaLabel: '',
      ctaHref: '',
      imageUrl: 'https://storage.googleapis.com/test-bucket/home-banners/cartoon-partial.webp',
      sourceRevision: 1,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          model: 'gpt-5-test',
          output_text: JSON.stringify({
            title: 'Portrait caricature',
            description: '',
            ctaLabel: '',
          }),
        }),
      })
    );

    try {
      const res = await request(app)
        .post(`/translations/homeBanner/${banner._id}/en/generate`)
        .set('Cookie', authCookie(admin))
        .send({
          expectedSourceRevision: 1,
          expectedDraftRevision: 0,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'pending_review',
        draft: {
          title: 'Portrait caricature',
          description: '',
          ctaLabel: '',
          provider: 'openai',
          providerModel: 'gpt-5-test',
        },
      });
      expect(fetch).toHaveBeenCalledOnce();
    } finally {
      if (typeof originalApiKey === 'undefined') {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
      vi.unstubAllGlobals();
    }
  });

  it('generates and activates product translations through the provider adapter', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const product = await createProduct({
      owner: admin,
      title: 'Плетено лъвче',
      description: 'Мека играчка за подарък.',
      sourceRevision: 1,
    });
    await Product.collection.updateOne(
      { _id: product._id },
      {
        $unset: {
          publicationStatus: '',
          isInCatalog: '',
          isCartoonGallery: '',
        },
      }
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          model: 'gpt-5-test',
          output_text: JSON.stringify({
            title: 'Crocheted Little Lion',
            description: 'Soft toy for a gift.',
          }),
        }),
      })
    );

    try {
      const res = await request(app)
        .post(`/translations/product/${product._id}/en/generate`)
        .set('Cookie', authCookie(admin))
        .send({
          expectedSourceRevision: 1,
          expectedTranslationRevision: 0,
        })
        .expect(200);

      expect(res.body).toMatchObject({
        status: 'current',
        translation: {
          title: 'Crocheted Little Lion',
          description: 'Soft toy for a gift.',
          sourceRevision: 1,
          translationRevision: 1,
          method: 'machine',
          provider: 'openai',
          providerModel: 'gpt-5-test',
        },
      });
      expect(fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/responses',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ Authorization: 'Bearer test-openai-key' }),
        })
      );
      const stored = await Product.collection.findOne({ _id: product._id });

      expect(stored).not.toHaveProperty('publicationStatus');
      expect(stored).not.toHaveProperty('isInCatalog');
      expect(stored).not.toHaveProperty('isCartoonGallery');
      expect(stored.translations.en).toMatchObject({
        title: 'Crocheted Little Lion',
        description: 'Soft toy for a gift.',
        sourceRevision: 1,
        translationRevision: 1,
        method: 'machine',
      });
    } finally {
      if (typeof originalApiKey === 'undefined') {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
      vi.unstubAllGlobals();
    }
  });

  it('discards generated translations when the Bulgarian source changes in flight', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const product = await createProduct({
      owner: admin,
      title: 'Първо заглавие',
      description: 'Първо описание.',
      sourceRevision: 1,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => {
        await Product.updateOne(
          { _id: product._id },
          {
            $set: {
              title: 'Променено заглавие',
              sourceRevision: 2,
            },
          }
        );

        return {
          ok: true,
          json: vi.fn().mockResolvedValue({
            model: 'gpt-5-test',
            output_text: JSON.stringify({
              title: 'Generated from stale source',
              description: 'Generated stale description.',
            }),
          }),
        };
      })
    );

    try {
      await request(app)
        .post(`/translations/product/${product._id}/en/generate`)
        .set('Cookie', authCookie(admin))
        .send({
          expectedSourceRevision: 1,
          expectedTranslationRevision: 0,
        })
        .expect(409);

      const stored = await Product.findById(product._id).lean();
      expect(stored.translations).toBeUndefined();
      expect(stored.sourceRevision).toBe(2);
    } finally {
      if (typeof originalApiKey === 'undefined') {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
      vi.unstubAllGlobals();
    }
  });

  it('rejects unsupported locales and returns a safe provider-not-configured response', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const product = await createProduct({ owner: admin });

    await request(app)
      .put(`/translations/product/${product._id}/fr`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedTranslationRevision: 0,
        fields: { title: 'Titre', description: 'Description' },
      })
      .expect(400);

    await request(app)
      .post(`/translations/product/${product._id}/en/generate`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedTranslationRevision: 0,
      })
      .expect(501);
  });

  it('rejects invalid blog translation HTML without saving partial data', async () => {
    const app = createExpressApp();
    const admin = await createFullAdmin();
    const article = await createBlogArticle({ owner: admin });

    await request(app)
      .put(`/translations/blogArticle/${article._id}/en`)
      .set('Cookie', authCookie(admin))
      .send({
        expectedSourceRevision: 1,
        expectedDraftRevision: 0,
        fields: {
          title: 'Invalid article',
          contentHtml: '<script>alert(1)</script>',
          heroImageAlt: 'English hero',
        },
      })
      .expect(400);

    const stored = await BlogArticle.findById(article._id).lean();
    expect(stored.translationDrafts).toBeUndefined();
  });
});
