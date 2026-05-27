import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { deleteImageFromGCS } from '../../helpers/gcsImageHelper.js';
import BlogArticle from '../../models/BlogArticle.js';
import { createExpressApp } from '../../server.js';
import {
  authCookie,
  buildBlogArticle,
  createActiveArtist,
  createBlogArticle,
  createFullAdmin,
} from './factories.js';

function articleFields(overrides = {}) {
  return {
    status: 'published',
    publishedAt: new Date('2026-05-01T10:00:00.000Z'),
    ...overrides,
  };
}

describe('blog articles integration', () => {
  it('lists non-archived articles publicly newest-first', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const legacyDraft = buildBlogArticle({
      owner,
      title: 'Legacy draft should be public after draft removal',
      status: 'draft',
      publishedAt: null,
      createdAt: new Date('2026-04-30T10:00:00.000Z'),
      updatedAt: new Date('2026-04-30T10:00:00.000Z'),
    });
    const legacyDraftInsert = await BlogArticle.collection.insertOne(legacyDraft);
    const oldPublished = await createBlogArticle(
      articleFields({
        owner,
        title: 'Old published',
        publishedAt: new Date('2026-05-01T10:00:00.000Z'),
      })
    );
    const newestPublished = await createBlogArticle(
      articleFields({
        owner,
        title: 'Newest published',
        publishedAt: new Date('2026-05-02T10:00:00.000Z'),
      })
    );
    await createBlogArticle(
      articleFields({
        owner,
        title: 'Archived article',
        archivedAt: new Date('2026-05-03T10:00:00.000Z'),
      })
    );

    const res = await request(app).get('/blog-articles').expect(200);

    expect(res.body.map((article) => article._id)).toEqual([
      String(newestPublished._id),
      String(oldPublished._id),
      String(legacyDraftInsert.insertedId),
    ]);
    expect(res.body[0]).toMatchObject({
      title: 'Newest published',
      excerpt: expect.any(String),
      thumbnailImageUrl: expect.any(String),
    });
    expect(res.body[0]).not.toHaveProperty('contentHtml');
    expect(res.body[0]).not.toHaveProperty('contentJson');
    expect(res.body[0]).not.toHaveProperty('owner');
    expect(res.body[0]).not.toHaveProperty('newsletterReady');
    expect(res.body[0]).not.toHaveProperty('newsletterSentAt');
    expect(res.body[0]).not.toHaveProperty('archivedAt');
  });

  it('returns public detail only for non-archived articles', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const published = await createBlogArticle(articleFields({ owner, title: 'Public article' }));
    const legacyDraftInsert = await BlogArticle.collection.insertOne(
      buildBlogArticle({
        owner,
        title: 'Legacy public article',
        status: 'draft',
        publishedAt: null,
      })
    );
    const archived = await createBlogArticle(
      articleFields({ owner, archivedAt: new Date('2026-05-03T10:00:00.000Z') })
    );

    const res = await request(app).get(`/blog-articles/${published._id}`).expect(200);
    expect(res.body.title).toBe('Public article');
    expect(res.body.contentHtml).toBeTruthy();
    expect(res.body).not.toHaveProperty('contentJson');
    expect(res.body).not.toHaveProperty('owner');
    expect(res.body).not.toHaveProperty('newsletterReady');
    expect(res.body).not.toHaveProperty('newsletterSentAt');
    expect(res.body).not.toHaveProperty('archivedAt');

    const legacyRes = await request(app).get(`/blog-articles/${legacyDraftInsert.insertedId}`).expect(200);
    expect(legacyRes.body.title).toBe('Legacy public article');

    await request(app).get('/blog-articles/not-a-valid-id').expect(404);
    await request(app).get(`/blog-articles/${archived._id}`).expect(404);
  });

  it('protects admin list and detail routes without letting /admin fall through to :articleId', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const cookie = authCookie(owner);
    const article = await createBlogArticle({ owner, title: 'Article in admin' });
    const published = await createBlogArticle(articleFields({ owner, title: 'Published in admin' }));
    const archived = await createBlogArticle({
      owner,
      title: 'Archived in admin',
      archivedAt: new Date('2026-05-04T10:00:00.000Z'),
    });

    await request(app).get('/blog-articles/admin').expect(401);
    await request(app).get(`/blog-articles/admin/${article._id}`).expect(401);

    const listRes = await request(app).get('/blog-articles/admin').set('Cookie', cookie).expect(200);
    expect(listRes.body.map((article) => article.title)).toEqual(
      expect.arrayContaining(['Article in admin', 'Published in admin', 'Archived in admin'])
    );

    const detailRes = await request(app)
      .get(`/blog-articles/admin/${article._id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(detailRes.body.title).toBe('Article in admin');
    expect(listRes.body.find((article) => article._id === String(archived._id))).toBeTruthy();
    expect(listRes.body.find((article) => article._id === String(published._id))).toBeTruthy();
  });

  it('creates an article for an authenticated trusted operator and sanitizes/mass-assigns safely', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const payload = {
      ...buildBlogArticle({ owner, status: 'draft' }),
      owner: 'client-owner-is-ignored',
      excerpt: 'client excerpt is ignored',
      newsletterReady: true,
      contentHtml:
        '<p style="color:#ff6600;position:fixed">Hello <script>alert(1)</script><img src=x onerror=alert(1)></p>',
    };

    await request(app).post('/blog-articles').send(payload).expect(401);

    const res = await request(app)
      .post('/blog-articles')
      .set('Cookie', authCookie(owner))
      .send(payload)
      .expect(201);

    expect(res.body).toMatchObject({
      title: payload.title,
      owner: String(owner._id),
      status: 'published',
      newsletterReady: false,
    });
    expect(res.body.publishedAt).toBeTruthy();
    expect(res.body.excerpt).toBe('Hello');
    expect(res.body.contentText).toBe('Hello');
    expect(res.body.contentHtml).not.toContain('script');
    expect(res.body.contentHtml).not.toContain('onerror');
    expect(res.body.contentHtml).not.toContain('position');
  });

  it('rejects blog article creation for artists', async () => {
    const app = createExpressApp();
    const artist = await createActiveArtist({ email: 'blog-artist@example.com' });

    await request(app)
      .post('/blog-articles')
      .set('Cookie', authCookie(artist))
      .send(buildBlogArticle({ owner: artist }))
      .expect(403);
  });

  it('creates published articles when status is omitted', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();

    const res = await request(app)
      .post('/blog-articles')
      .set('Cookie', authCookie(owner))
      .send(buildBlogArticle({ owner, status: undefined }))
      .expect(201);

    expect(res.body.status).toBe('published');
    expect(res.body.publishedAt).toBeTruthy();
  });

  it('rejects invalid create payloads and image URLs', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const cookie = authCookie(owner);

    await request(app)
      .post('/blog-articles')
      .set('Cookie', cookie)
      .send(buildBlogArticle({ owner, title: 'a'.repeat(161) }))
      .expect(400);

    await request(app)
      .post('/blog-articles')
      .set('Cookie', cookie)
      .send(buildBlogArticle({ owner, seoTitle: 'a'.repeat(71) }))
      .expect(400);

    await request(app)
      .post('/blog-articles')
      .set('Cookie', cookie)
      .send(buildBlogArticle({ owner, seoDescription: 'a'.repeat(171) }))
      .expect(400);

    await request(app)
      .post('/blog-articles')
      .set('Cookie', cookie)
      .send(buildBlogArticle({ owner, heroImageAlt: 'a'.repeat(181) }))
      .expect(400);

    await request(app)
      .post('/blog-articles')
      .set('Cookie', cookie)
      .send(
        buildBlogArticle({
          owner,
          heroImageUrl: 'https://storage.googleapis.com/other-bucket/blog/articles/hero/article.webp',
        })
      )
      .expect(400);

    await request(app)
      .post('/blog-articles')
      .set('Cookie', cookie)
      .send(
        buildBlogArticle({
          owner,
          thumbnailImageUrl:
            'https://storage.googleapis.com/test-bucket/blog/articles/hero/not-a-thumbnail.webp',
        })
      )
      .expect(400);
  });

  it('edits articles without allowing server-owned fields or direct status changes', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const cookie = authCookie(owner);
    const article = await createBlogArticle(
      articleFields({
        owner,
        title: 'Original title',
        publishedAt: new Date('2026-05-01T10:00:00.000Z'),
      })
    );
    const originalOwner = String(article.owner);
    const originalPublishedAt = article.publishedAt.toISOString();

    await request(app)
      .put(`/blog-articles/${article._id}`)
      .send({ title: 'No auth' })
      .expect(401);

    await request(app)
      .put(`/blog-articles/${article._id}`)
      .set('Cookie', cookie)
      .send({ status: 'draft' })
      .expect(400);

    const res = await request(app)
      .put(`/blog-articles/${article._id}`)
      .set('Cookie', cookie)
      .send({
        title: 'Updated title',
        contentHtml: '<p>Updated body</p>',
        excerpt: 'client excerpt',
        owner: String((await createFullAdmin({ email: 'other@example.com' }))._id),
        publishedAt: '2000-01-01T00:00:00.000Z',
        archivedAt: '2000-01-01T00:00:00.000Z',
        newsletterReady: true,
        newsletterSentAt: '2000-01-01T00:00:00.000Z',
      })
      .expect(200);

    expect(res.body).toMatchObject({
      title: 'Updated title',
      contentText: 'Updated body',
      excerpt: 'Updated body',
      owner: originalOwner,
      newsletterReady: false,
      archivedAt: null,
    });
    expect(new Date(res.body.publishedAt).toISOString()).toBe(originalPublishedAt);
  });

  it('rate limits blog article mutation routes through the shared bucket', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const cookie = authCookie(owner);

    for (let index = 0; index < 20; index += 1) {
      const article = await createBlogArticle({
        owner,
        heroImageUrl: `https://storage.googleapis.com/test-bucket/blog/articles/hero/rate-${index}.webp`,
        thumbnailImageUrl: `https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/rate-${index}.webp`,
      });

      await request(app)
        .delete(`/blog-articles/${article._id}`)
        .set('Cookie', cookie)
        .expect(204);
    }

    const limitedArticle = await createBlogArticle({
      owner,
      heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/rate-limited.webp',
      thumbnailImageUrl:
        'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/rate-limited.webp',
    });

    await request(app)
      .delete(`/blog-articles/${limitedArticle._id}`)
      .set('Cookie', cookie)
      .expect(429);
  });

  it('hard deletes an article and removes unreferenced bucket images', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const cookie = authCookie(owner);
    const heroImageUrl = 'https://storage.googleapis.com/test-bucket/blog/articles/hero/delete-me.webp';
    const thumbnailImageUrl =
      'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/delete-me.webp';
    const article = await createBlogArticle(articleFields({ owner, heroImageUrl, thumbnailImageUrl }));

    await request(app).delete(`/blog-articles/${article._id}`).expect(401);

    await request(app)
      .delete(`/blog-articles/${article._id}`)
      .set('Cookie', cookie)
      .expect(204);

    await expect(BlogArticle.findById(article._id).lean()).resolves.toBeNull();
    expect(deleteImageFromGCS).toHaveBeenCalledWith(heroImageUrl, { throwOnError: true });
    expect(deleteImageFromGCS).toHaveBeenCalledWith(thumbnailImageUrl, { throwOnError: true });
    await request(app).get(`/blog-articles/${article._id}`).expect(404);
  });

  it('keeps the article when storage cleanup fails during delete', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const cookie = authCookie(owner);
    const heroImageUrl =
      'https://storage.googleapis.com/test-bucket/blog/articles/hero/delete-fails.webp';
    const thumbnailImageUrl =
      'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/delete-fails.webp';
    const article = await createBlogArticle(articleFields({ owner, heroImageUrl, thumbnailImageUrl }));
    deleteImageFromGCS.mockRejectedValueOnce(new Error('storage outage'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await request(app)
      .delete(`/blog-articles/${article._id}`)
      .set('Cookie', cookie)
      .expect(500);

    await expect(BlogArticle.findById(article._id).lean()).resolves.toMatchObject({
      _id: article._id,
      heroImageUrl,
    });
  });

  it('cleans up replaced blog images only after saving and only when unreferenced', async () => {
    const app = createExpressApp();
    const owner = await createFullAdmin();
    const cookie = authCookie(owner);
    const oldHero = 'https://storage.googleapis.com/test-bucket/blog/articles/hero/old.webp';
    const oldThumbnail = 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/old.webp';
    const article = await createBlogArticle({ owner, heroImageUrl: oldHero, thumbnailImageUrl: oldThumbnail });

    await request(app)
      .put(`/blog-articles/${article._id}`)
      .set('Cookie', cookie)
      .send({
        heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/new.webp',
        thumbnailImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/new.webp',
      })
      .expect(200);

    expect(deleteImageFromGCS).toHaveBeenCalledWith(oldHero, { throwOnError: false });
    expect(deleteImageFromGCS).toHaveBeenCalledWith(oldThumbnail, { throwOnError: false });

    const sharedHero = 'https://storage.googleapis.com/test-bucket/blog/articles/hero/shared.webp';
    const sharedThumbnail = 'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/shared.webp';
    const sharedArticle = await createBlogArticle({
      owner,
      heroImageUrl: sharedHero,
      thumbnailImageUrl: sharedThumbnail,
    });
    await createBlogArticle({
      owner,
      heroImageUrl: sharedHero,
      thumbnailImageUrl: sharedThumbnail,
    });
    deleteImageFromGCS.mockClear();

    await request(app)
      .put(`/blog-articles/${sharedArticle._id}`)
      .set('Cookie', cookie)
      .send({
        heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/replacement.webp',
        thumbnailImageUrl:
          'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/replacement.webp',
      })
      .expect(200);

    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedHero);
    expect(deleteImageFromGCS.mock.calls.map(([assetUrl]) => assetUrl)).not.toContain(sharedThumbnail);
  });
});
