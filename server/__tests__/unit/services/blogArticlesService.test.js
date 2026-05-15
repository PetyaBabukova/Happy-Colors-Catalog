import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import BlogArticle from '../../../models/BlogArticle.js';
import {
  archiveBlogArticle,
  createBlogArticle,
  editBlogArticle,
  extractContentText,
  generateExcerpt,
  getAdminBlogArticles,
  restoreBlogArticle,
  sanitizeArticleHtml,
  validateBlogImageUrl,
  validateContentJson,
} from '../../../services/blogArticlesService.js';

const validContentJson = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [
        {
          type: 'text',
          text: 'Colorful text',
          marks: [
            { type: 'bold' },
            { type: 'textStyle', attrs: { color: '#ff6600', fontSize: '18px' } },
          ],
        },
      ],
    },
  ],
};

let mongoServer;

function buildArticlePayload(overrides = {}) {
  return {
    title: 'Colorful blog article',
    contentHtml: '<p>Helpful colorful article body.</p>',
    contentJson: validContentJson,
    heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
    thumbnailImageUrl:
      'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/article.webp',
    heroImageAlt: 'Colorful hero image',
    ...overrides,
  };
}

beforeAll(async () => {
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });
  await mongoose.connect(mongoServer.getUri(), {
    dbName: 'happy-colors-blog-service-unit',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

describe('blogArticlesService validation helpers', () => {
  beforeEach(() => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
  });

  afterEach(() => {
    delete process.env.GCS_BUCKET_NAME;
  });

  it('sanitizes unsafe HTML and keeps the supported article formatting', () => {
    const sanitized = sanitizeArticleHtml(`
      <p style="color:#ff6600;font-size:18px;text-align:center;position:fixed;background-image:url(javascript:alert(1))">
        Hello <strong>friend</strong>
        <img src=x onerror="alert(1)">
        <a href="javascript:alert(1)" onclick="alert(1)">bad link</a>
        <a href="http://example.com">insecure link</a>
        <a href="https://example.com" target="_blank">safe link</a>
      </p>
      <iframe src="https://example.com"></iframe>
      <script>alert(1)</script>
    `);

    expect(sanitized).toContain('<strong>friend</strong>');
    expect(sanitized).toContain('color:#ff6600');
    expect(sanitized).toContain('font-size:18px');
    expect(sanitized).toContain('text-align:center');
    expect(sanitized).not.toContain('script');
    expect(sanitized).not.toContain('iframe');
    expect(sanitized).not.toContain('onerror');
    expect(sanitized).not.toContain('javascript:');
    expect(sanitized).not.toContain('href="http://example.com"');
    expect(sanitized).toContain('href="https://example.com"');
    expect(sanitized).toContain('rel="noopener noreferrer"');
    expect(sanitized).not.toContain('position');
    expect(sanitized).not.toContain('background-image');
  });

  it('generates text and capped excerpts from sanitized HTML', () => {
    const contentText = extractContentText('<p>Hello&nbsp;<strong>world</strong></p>');
    const blockText = extractContentText('<p>Hello</p><p>World</p><ul><li>Again</li></ul>');
    const excerpt = generateExcerpt('a'.repeat(260));

    expect(contentText).toBe('Hello world');
    expect(blockText).toBe('Hello World Again');
    expect(excerpt).toHaveLength(240);
    expect(excerpt.endsWith('...')).toBe(true);
  });

  it('allows valid TipTap JSON and rejects unknown nodes, marks, attrs, and oversize JSON', () => {
    expect(validateContentJson(validContentJson)).toEqual(validContentJson);
    expect(validateContentJson(undefined)).toBeNull();

    expect(() => validateContentJson({ type: 'doc', content: [{ type: 'image' }] })).toThrow(
      /Unsupported contentJson node/
    );
    expect(() =>
      validateContentJson({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'code' }] }] }],
      })
    ).toThrow(/Unsupported contentJson mark/);
    expect(() =>
      validateContentJson({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'x',
                marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              },
            ],
          },
        ],
      })
    ).toThrow(/link href/);
    expect(() =>
      validateContentJson({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'x',
                marks: [{ type: 'link', attrs: { href: 'http://example.com' } }],
              },
            ],
          },
        ],
      })
    ).toThrow(/link href/);
    expect(() =>
      validateContentJson({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'x',
                marks: [
                  {
                    type: 'link',
                    attrs: { href: 'https://example.com', target: '_blank', rel: 'opener' },
                  },
                ],
              },
            ],
          },
        ],
      })
    ).toThrow(/link rel/);
    expect(
      validateContentJson({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'x',
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: 'https://example.com',
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    },
                  },
                ],
              },
            ],
          },
        ],
      })
    ).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'x',
              marks: [
                {
                  type: 'link',
                  attrs: {
                    href: 'https://example.com',
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  },
                },
              ],
            },
          ],
        },
      ],
    });
    expect(() =>
      validateContentJson({ type: 'doc', attrs: { nope: true }, content: [] })
    ).toThrow(/Unexpected contentJson attrs/);
    expect(() =>
      validateContentJson({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x'.repeat(110 * 1024) }] }],
      })
    ).toThrow(/100 KB/);
    expect(() => {
      let node = { type: 'paragraph', content: [{ type: 'text', text: 'x' }] };

      for (let index = 0; index < 31; index += 1) {
        node = { type: 'blockquote', content: [node] };
      }

      validateContentJson({ type: 'doc', content: [node] });
    }).toThrow(/nested too deeply/);
  });

  it('validates blog image URLs against the configured bucket and object prefix', () => {
    expect(
      validateBlogImageUrl(
        'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
        'blog/articles/hero/'
      )
    ).toBe('https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp');

    expect(() =>
      validateBlogImageUrl(
        'https://storage.googleapis.com/other-bucket/blog/articles/hero/article.webp',
        'blog/articles/hero/'
      )
    ).toThrow(/configured storage bucket/);
    expect(() =>
      validateBlogImageUrl(
        'https://storage.googleapis.com/test-bucket/products/images/article.webp',
        'blog/articles/hero/'
      )
    ).toThrow(/expected blog storage path/);
    expect(() =>
      validateBlogImageUrl(
        'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp?X-Goog-Signature=1',
        'blog/articles/hero/'
      )
    ).toThrow(/query parameters/);
    expect(() =>
      validateBlogImageUrl(
        'https://storage.googleapis.com/test-bucket/blog/articles/hero/%2e%2e/secret.webp',
        'blog/articles/hero/'
      )
    ).toThrow(/valid storage object/);

    delete process.env.GCS_BUCKET_NAME;

    expect(() =>
      validateBlogImageUrl(
        'https://storage.googleapis.com/test-bucket/blog/articles/hero/article.webp',
        'blog/articles/hero/'
      )
    ).toThrow(/bucket is not configured/);
  });
});

describe('blogArticlesService persistence behavior', () => {
  beforeEach(async () => {
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    const collections = await mongoose.connection.db.collections();

    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  });

  afterEach(() => {
    delete process.env.GCS_BUCKET_NAME;
  });

  it('creates published articles with owner stamping, sanitized body, contentJson, and excerpt', async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();
    const clientOwnerId = new mongoose.Types.ObjectId().toString();

    const article = await createBlogArticle(
      buildArticlePayload({
        owner: clientOwnerId,
        excerpt: 'client excerpt',
        newsletterReady: true,
        contentHtml: '<p>Hello <script>alert(1)</script>world</p>',
      }),
      ownerId
    );

    expect(String(article.owner)).toBe(ownerId);
    expect(String(article.owner)).not.toBe(clientOwnerId);
    expect(article.status).toBe('published');
    expect(article.newsletterReady).toBe(false);
    expect(article.contentHtml).not.toContain('script');
    expect(article.contentText).toBe('Hello world');
    expect(article.excerpt).toBe('Hello world');
    expect(article.contentJson).toEqual(validContentJson);
    expect(article.publishedAt).toBeInstanceOf(Date);
  });

  it('rejects missing auth and field lengths at the service boundary', async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();

    await expect(createBlogArticle(buildArticlePayload(), null)).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(
      createBlogArticle(buildArticlePayload({ title: 'a'.repeat(161) }), ownerId)
    ).rejects.toThrow(/Title cannot be longer than 160/);
    await expect(
      createBlogArticle(buildArticlePayload({ seoTitle: 'a'.repeat(71) }), ownerId)
    ).rejects.toThrow(/SEO title cannot be longer than 70/);
    await expect(
      createBlogArticle(buildArticlePayload({ seoDescription: 'a'.repeat(171) }), ownerId)
    ).rejects.toThrow(/SEO description cannot be longer than 170/);
    await expect(
      createBlogArticle(buildArticlePayload({ heroImageAlt: 'a'.repeat(181) }), ownerId)
    ).rejects.toThrow(/Hero image alt text cannot be longer than 180/);
  });

  it('edits articles without accepting status or server-owned fields', async () => {
    const ownerId = new mongoose.Types.ObjectId().toString();
    const otherOwnerId = new mongoose.Types.ObjectId().toString();
    const article = await createBlogArticle(
      buildArticlePayload({
        status: 'published',
      }),
      ownerId
    );
    const originalPublishedAt = article.publishedAt;

    await expect(editBlogArticle(article._id, { status: 'draft' }, ownerId)).rejects.toMatchObject({
      statusCode: 400,
    });

    const updated = await editBlogArticle(
      article._id,
      {
        title: 'Updated service title',
        contentHtml: '<p>Updated service body</p>',
        owner: otherOwnerId,
        excerpt: 'client excerpt',
        publishedAt: '2000-01-01T00:00:00.000Z',
        archivedAt: '2000-01-01T00:00:00.000Z',
        newsletterReady: true,
        newsletterSentAt: '2000-01-01T00:00:00.000Z',
      },
      ownerId
    );

    expect(updated.title).toBe('Updated service title');
    expect(updated.contentText).toBe('Updated service body');
    expect(updated.excerpt).toBe('Updated service body');
    expect(String(updated.owner)).toBe(ownerId);
    expect(updated.newsletterReady).toBe(false);
    expect(updated.newsletterSentAt).toBeNull();
    expect(updated.archivedAt).toBeNull();
    expect(updated.publishedAt.toISOString()).toBe(originalPublishedAt.toISOString());
  });

  it('keeps archive, restore, and admin list behavior explicit', async () => {
    const firstOwnerId = new mongoose.Types.ObjectId().toString();
    const secondOwnerId = new mongoose.Types.ObjectId().toString();
    const first = await createBlogArticle(buildArticlePayload({ title: 'First' }), firstOwnerId);
    const second = await createBlogArticle(
      buildArticlePayload({
        title: 'Second',
        heroImageUrl: 'https://storage.googleapis.com/test-bucket/blog/articles/hero/second.webp',
        thumbnailImageUrl:
          'https://storage.googleapis.com/test-bucket/blog/articles/thumbnails/second.webp',
      }),
      secondOwnerId
    );

    await expect(getAdminBlogArticles(null)).rejects.toMatchObject({ statusCode: 401 });
    await expect(getAdminBlogArticles(firstOwnerId)).resolves.toHaveLength(2);

    const archived = await archiveBlogArticle(second._id, firstOwnerId);
    const secondArchive = await archiveBlogArticle(second._id, firstOwnerId);
    const restored = await restoreBlogArticle(second._id, firstOwnerId);

    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(secondArchive.archivedAt.toISOString()).toBe(archived.archivedAt.toISOString());
    expect(restored.archivedAt).toBeNull();
    expect(restored.status).toBe('published');
    expect(first.status).toBe('published');
  });
});
