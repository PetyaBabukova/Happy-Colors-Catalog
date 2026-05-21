import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../../helpers/sendEmail.js';
import NewsletterSubscriber from '../../../models/NewsletterSubscriber.js';
import BlogArticle from '../../../models/BlogArticle.js';
import { getProductById } from '../../../services/productsServices.js';
import { createUnsubscribeToken } from '../../../services/newsletterService.js';
import { buildNewsletterEmailTemplate } from '../../../services/newsletterEmailTemplate.js';
import {
  buildBlogNewsletterPrefill,
  buildProductNewsletterPrefill,
  sendNewsletterTest,
  sendNewsletterToSubscribers,
} from '../../../services/newsletterSendService.js';

vi.mock('../../../helpers/sendEmail.js', () => ({
  sendEmail: vi.fn(),
}));

vi.mock('../../../models/NewsletterSubscriber.js', () => ({
  default: {
    countDocuments: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('../../../models/BlogArticle.js', () => ({
  default: {
    findById: vi.fn(),
  },
}));

vi.mock('../../../services/productsServices.js', () => ({
  getProductById: vi.fn(),
}));

vi.mock('../../../services/newsletterService.js', () => ({
  createUnsubscribeToken: vi.fn(),
}));

vi.mock('../../../services/newsletterEmailTemplate.js', () => ({
  buildNewsletterEmailTemplate: vi.fn(),
}));

const validProductId = '665000000000000000000001';
const validBlogId = '665000000000000000000002';
const validContentJson = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello subscribers.' }] }],
};

function payload(overrides = {}) {
  return {
    subject: 'Newsletter update',
    contentHtml: '<p>Hello subscribers.</p>',
    contentJson: validContentJson,
    contentText: 'Hello subscribers.',
    sourceType: 'custom',
    ...overrides,
  };
}

function mockSubscribers(subscribers) {
  NewsletterSubscriber.find.mockReturnValue({
    sort: vi.fn().mockResolvedValue(subscribers),
  });
}

describe('newsletterSendService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEWSLETTER_TEST_RECIPIENTS = 'owner@example.com,copy@example.com';
    process.env.NEWSLETTER_PUBLIC_SITE_URL = 'https://happycolors.eu';
    process.env.NEWSLETTER_DEFAULT_IMAGE_URL = '';
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';

    sendEmail.mockResolvedValue({ messageId: 'unit-message-id' });
    createUnsubscribeToken.mockImplementation((subscriber) => `token-${subscriber.email}`);
    buildNewsletterEmailTemplate.mockImplementation((values) => ({
      subject: values.subject,
      text: `${values.ctaUrl || ''} ${values.unsubscribeUrl || ''}`,
      html: `${values.imageUrl || ''} ${values.ctaUrl || ''} ${values.unsubscribeUrl || ''}`,
      headers: values.unsubscribeUrl
        ? { 'List-Unsubscribe': `<${values.unsubscribeUrl}>` }
        : {},
    }));
  });

  afterEach(() => {
    delete process.env.NEWSLETTER_TEST_RECIPIENTS;
    delete process.env.NEWSLETTER_PUBLIC_SITE_URL;
    delete process.env.NEWSLETTER_DEFAULT_IMAGE_URL;
    delete process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
  });

  it('builds custom test emails with public site URLs and configured recipients only', async () => {
    const result = await sendNewsletterTest(payload());

    expect(result).toEqual({ message: 'Test email sent.', recipients: 2 });
    expect(buildNewsletterEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaUrl: 'https://happycolors.eu/products',
        imageUrl: 'https://happycolors.eu/logo_64pxH.svg',
        isTest: true,
      })
    );
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: 'owner@example.com' }));
    expect(sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: 'copy@example.com' }));
  });

  it('rejects client-provided image and CTA fields before sending', async () => {
    await expect(
      sendNewsletterTest(
        payload({
          imageUrl: 'https://evil.example/image.png',
          ctaUrl: 'https://evil.example',
        })
      )
    ).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid newsletter payload fields.',
    });

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('preserves absolute product image URLs and re-derives product CTA for broadcasts', async () => {
    getProductById.mockResolvedValue({
      _id: validProductId,
      title: 'Product newsletter',
      imageUrls: ['https://storage.googleapis.com/happy/products/product.webp'],
    });
    mockSubscribers([{ email: 'subscriber@example.com', unsubscribeTokenVersion: 1 }]);

    const result = await sendNewsletterToSubscribers(
      payload({
        sourceType: 'product',
        sourceId: validProductId,
      })
    );

    expect(result).toMatchObject({ sent: 1, failed: 0, activeSubscribers: 1 });
    expect(buildNewsletterEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaUrl: `https://happycolors.eu/products/${validProductId}`,
        imageUrl: 'https://storage.googleapis.com/happy/products/product.webp',
        unsubscribeUrl: 'https://happycolors.eu/newsletter/unsubscribe?token=token-subscriber%40example.com',
        listUnsubscribeUrl:
          'https://happycolors.eu/api/newsletter/unsubscribe/one-click?token=token-subscriber%40example.com',
      })
    );
  });

  it('validates prefill ids before querying source records', async () => {
    await expect(buildProductNewsletterPrefill('not-a-mongo-id')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Product id is invalid.',
    });
    await expect(buildBlogNewsletterPrefill('not-a-mongo-id')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Blog article id is invalid.',
    });

    expect(getProductById).not.toHaveBeenCalled();
    expect(BlogArticle.findById).not.toHaveBeenCalled();
  });

  it('builds blog prefill from the first sanitized paragraph and default newsletter image', async () => {
    BlogArticle.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: validBlogId,
        title: 'Color story',
        contentHtml: '<p>First paragraph.</p><p>Second paragraph.</p><script>alert(1)</script>',
        contentText: 'First paragraph. Second paragraph.',
      }),
    });

    const result = await buildBlogNewsletterPrefill(validBlogId);

    expect(result).toMatchObject({
      sourceType: 'blog',
      sourceId: validBlogId,
      subject: 'Color story',
      contentHtml: '<p>First paragraph.</p>',
      contentText: 'First paragraph.',
      imageUrl: 'https://happycolors.eu/logo_64pxH.svg',
      ctaUrl: `/blog/${validBlogId}`,
    });
  });

  it('skips empty leading paragraphs in blog prefill', async () => {
    BlogArticle.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: validBlogId,
        title: 'Color story',
        contentHtml: '<p><br></p><p>First real paragraph.</p><p>Second paragraph.</p>',
        contentText: 'First real paragraph. Second paragraph.',
      }),
    });

    const result = await buildBlogNewsletterPrefill(validBlogId);

    expect(result).toMatchObject({
      contentHtml: '<p>First real paragraph.</p>',
      contentText: 'First real paragraph.',
    });
  });
});
