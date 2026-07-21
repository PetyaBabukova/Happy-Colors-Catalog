import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../../../helpers/sendEmail.js';
import NewsletterSubscriber from '../../../models/NewsletterSubscriber.js';
import NewsletterCampaign from '../../../models/NewsletterCampaign.js';
import NewsletterDelivery from '../../../models/NewsletterDelivery.js';
import BlogArticle from '../../../models/BlogArticle.js';
import { getProductById } from '../../../services/productsServices.js';
import {
  createNewsletterPreferencesPageUrl,
  createNewsletterPreferencesToken,
  createUnsubscribePageUrl,
  createUnsubscribeToken,
} from '../../../services/newsletterService.js';
import { buildNewsletterEmailTemplate } from '../../../services/newsletterEmailTemplate.js';
import {
  buildBlogNewsletterPrefill,
  buildProductNewsletterPrefill,
  getNewsletterSendStatus,
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
    findOne: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('../../../models/NewsletterCampaign.js', () => ({
  default: {
    create: vi.fn(),
    findById: vi.fn(),
    updateOne: vi.fn(),
  },
}));

vi.mock('../../../models/NewsletterDelivery.js', () => ({
  default: {
    insertMany: vi.fn(),
    find: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    countDocuments: vi.fn(),
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
  createNewsletterPreferencesPageUrl: vi.fn(),
  createNewsletterPreferencesToken: vi.fn(),
  createUnsubscribePageUrl: vi.fn(),
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

let mockDeliveryDocs = [];
let mockSubscriberDocs = [];
let mockCampaignDoc = null;

function mockSubscribers(subscribers) {
  mockSubscriberDocs = subscribers.map((subscriber, index) => ({
    _id: subscriber._id || `subscriber-${index + 1}`,
    status: 'active',
    ...subscriber,
  }));
  mockDeliveryDocs = [];

  NewsletterSubscriber.find.mockReturnValue({
    sort: vi.fn().mockResolvedValue(mockSubscriberDocs),
  });
}

describe('newsletterSendService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEWSLETTER_TEST_RECIPIENTS = 'owner@example.com,copy@example.com';
    process.env.NEWSLETTER_PUBLIC_SITE_URL = 'https://happycolors.eu';
    process.env.NEWSLETTER_DEFAULT_IMAGE_URL = '';
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    mockDeliveryDocs = [];
    mockSubscriberDocs = [];
    mockCampaignDoc = null;

    sendEmail.mockResolvedValue({ messageId: 'unit-message-id' });
    NewsletterSubscriber.updateOne.mockResolvedValue({ modifiedCount: 1 });
    NewsletterSubscriber.findOne.mockImplementation(async (query) => {
      const subscriber = mockSubscriberDocs.find((candidate) => candidate._id === query?._id);

      return subscriber?.status === 'active' ? subscriber : null;
    });
    NewsletterCampaign.create.mockImplementation(async (campaign) => {
      mockCampaignDoc = {
        _id: 'campaign-1',
        ...campaign,
      };

      return mockCampaignDoc;
    });
    NewsletterCampaign.findById.mockImplementation(() => ({
      lean: vi.fn().mockResolvedValue(mockCampaignDoc),
    }));
    NewsletterCampaign.updateOne.mockResolvedValue({ modifiedCount: 1 });
    NewsletterDelivery.insertMany.mockImplementation(async (deliveries) => {
      mockDeliveryDocs = deliveries.map((delivery, index) => ({
        _id: `delivery-${index + 1}`,
        status: 'pending',
        attemptCount: 0,
        claimToken: '',
        ...delivery,
      }));
      return mockDeliveryDocs;
    });
    NewsletterDelivery.find.mockImplementation(() => ({
      sort: vi.fn().mockResolvedValue(mockDeliveryDocs.filter((delivery) => delivery.status === 'pending')),
    }));
    NewsletterDelivery.findOneAndUpdate.mockImplementation(async (query) => {
      const delivery = mockDeliveryDocs.find(
        (candidate) => candidate._id === query?._id && candidate.status === query?.status
      );

      if (!delivery) {
        return null;
      }

      delivery.status = 'sending';
      delivery.claimToken = 'claim-token';
      delivery.claimedAt = new Date();
      return delivery;
    });
    NewsletterDelivery.updateOne.mockImplementation(async (query, update) => {
      const delivery = mockDeliveryDocs.find(
        (candidate) =>
          candidate._id === query?._id &&
          candidate.status === query?.status &&
          candidate.claimToken === query?.claimToken
      );

      if (delivery) {
        Object.assign(delivery, update?.$set || {});
        delivery.attemptCount += Number(update?.$inc?.attemptCount || 0);
      }

      return { modifiedCount: delivery ? 1 : 0 };
    });
    NewsletterDelivery.countDocuments.mockImplementation(async (query) =>
      mockDeliveryDocs.filter(
        (delivery) => delivery.campaignId === query?.campaignId && delivery.status === query?.status
      ).length
    );
    createUnsubscribeToken.mockImplementation((subscriber) => `token-${subscriber.email}`);
    createUnsubscribePageUrl.mockImplementation(
      (token, { locale }) => `https://happycolors.eu/${locale}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`
    );
    createNewsletterPreferencesToken.mockImplementation((subscriber) => `preferences-${subscriber.email}`);
    createNewsletterPreferencesPageUrl.mockImplementation(
      (token, { locale }) => `https://happycolors.eu/${locale}/newsletter/preferences#token=${encodeURIComponent(token)}`
    );
    buildNewsletterEmailTemplate.mockImplementation((values) => ({
      subject: values.subject,
      text: `${values.ctaUrl || ''} ${values.unsubscribeUrl || ''} ${values.preferencesUrl || ''}`,
      html: `${values.imageUrl || ''} ${values.ctaUrl || ''} ${values.unsubscribeUrl || ''} ${values.preferencesUrl || ''}`,
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
        ctaUrl: 'https://happycolors.eu/bg/products',
        imageUrl: 'https://happycolors.eu/logo_64pxH.svg',
        isTest: true,
      })
    );
    expect(sendEmail).toHaveBeenCalledTimes(2);
    expect(sendEmail).toHaveBeenNthCalledWith(1, expect.objectContaining({ to: 'owner@example.com' }));
    expect(sendEmail).toHaveBeenNthCalledWith(2, expect.objectContaining({ to: 'copy@example.com' }));
  });

  it('returns active subscriber counts by newsletter language without exposing addresses', async () => {
    NewsletterSubscriber.countDocuments
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);

    await expect(getNewsletterSendStatus()).resolves.toEqual({
      activeSubscribers: 5,
      activeSubscribersByLocale: {
        bg: 3,
        en: 2,
      },
    });
    expect(NewsletterSubscriber.countDocuments).toHaveBeenNthCalledWith(1, { status: 'active' });
    expect(NewsletterSubscriber.countDocuments).toHaveBeenNthCalledWith(2, {
      status: 'active',
      preferredLocale: 'en',
    });
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
    mockSubscribers([{ email: 'subscriber@example.com', preferredLocale: 'en', unsubscribeTokenVersion: 1 }]);

    const result = await sendNewsletterToSubscribers(
      payload({
        sourceType: 'product',
        sourceId: validProductId,
      })
    );

    expect(result).toMatchObject({
      sent: 1,
      failed: 0,
      activeSubscribers: 1,
      activeSubscribersByLocale: {
        bg: 0,
        en: 1,
      },
    });
    expect(buildNewsletterEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en',
        ctaUrl: `https://happycolors.eu/en/products/${validProductId}`,
        imageUrl: 'https://storage.googleapis.com/happy/products/product.webp',
        unsubscribeUrl: 'https://happycolors.eu/en/newsletter/unsubscribe?token=token-subscriber%40example.com',
        listUnsubscribeUrl:
          'https://happycolors.eu/api/newsletter/unsubscribe/one-click?token=token-subscriber%40example.com',
        preferencesUrl:
          'https://happycolors.eu/en/newsletter/preferences#token=preferences-subscriber%40example.com',
      })
    );
  });

  it('sends only explicitly selected newsletter language groups', async () => {
    mockSubscribers([
      { email: 'bg@example.com', preferredLocale: 'bg', unsubscribeTokenVersion: 1 },
      { email: 'en@example.com', preferredLocale: 'en', unsubscribeTokenVersion: 1 },
    ]);

    const result = await sendNewsletterToSubscribers(payload({ locales: ['en'] }));

    expect(result).toMatchObject({
      sent: 1,
      failed: 0,
      activeSubscribers: 1,
      activeSubscribersByLocale: {
        bg: 0,
        en: 1,
      },
    });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'en@example.com' }));
    expect(sendEmail).not.toHaveBeenCalledWith(expect.objectContaining({ to: 'bg@example.com' }));
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
