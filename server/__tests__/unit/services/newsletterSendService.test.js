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
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateMany: vi.fn(),
    updateOne: vi.fn(),
    deleteMany: vi.fn(),
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

function localeContent(overrides = {}) {
  return {
    subject: 'Newsletter update',
    contentHtml: '<p>Hello subscribers.</p>',
    contentJson: validContentJson,
    contentText: 'Hello subscribers.',
    ctaLabel: 'View more',
    ...overrides,
  };
}

function localizedPayload(overrides = {}) {
  return {
    sourceType: 'custom',
    locales: ['bg', 'en'],
    contentByLocale: {
      bg: localeContent({
        subject: 'Новини от Happy Colors',
        contentHtml: '<p>Здравейте, абонати.</p>',
        contentText: 'Здравейте, абонати.',
        ctaLabel: 'Виж повече',
      }),
      en: localeContent({
        subject: 'Happy Colors news',
        contentHtml: '<p>Hello subscribers.</p>',
        contentText: 'Hello subscribers.',
        ctaLabel: 'View more',
      }),
    },
    ...overrides,
  };
}

let mockDeliveryDocs = [];
let mockSubscriberDocs = [];
let mockCampaignDoc = null;
const mockCampaignId = '665000000000000000000101';

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

function matchesValue(value, expected) {
  if (expected === null) {
    return value === null || value === undefined;
  }

  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    if (Object.prototype.hasOwnProperty.call(expected, '$lt') && !(value < expected.$lt)) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(expected, '$lte') && !(value <= expected.$lte)) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(expected, '$gt') && !(value > expected.$gt)) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(expected, '$gte') && !(value >= expected.$gte)) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(expected, '$ne') && value === expected.$ne) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(expected, '$in')) {
      return expected.$in.some((candidate) => String(candidate) === String(value));
    }

    return true;
  }

  return value === expected;
}

function matchesDeliveryQuery(delivery, query = {}) {
  if (query.$or && !query.$or.some((branch) => matchesDeliveryQuery(delivery, branch))) {
    return false;
  }

  if (query.$and && !query.$and.every((branch) => matchesDeliveryQuery(delivery, branch))) {
    return false;
  }

  return Object.entries(query).every(([key, expected]) => {
    if (key === '$or' || key === '$and') {
      return true;
    }

    return matchesValue(delivery[key], expected);
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
        _id: mockCampaignId,
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
        manualAttemptCount: 0,
        claimToken: '',
        nextAttemptAt: null,
        isPermanentFailure: false,
        subscriberCounterUpdatedAt: null,
        ...delivery,
      }));
      return mockDeliveryDocs;
    });
    NewsletterDelivery.updateMany.mockResolvedValue({ modifiedCount: 0 });
    NewsletterDelivery.deleteMany.mockImplementation(async (query = {}) => {
      const beforeCount = mockDeliveryDocs.length;
      mockDeliveryDocs = mockDeliveryDocs.filter((delivery) => !matchesDeliveryQuery(delivery, query));

      return { deletedCount: beforeCount - mockDeliveryDocs.length };
    });
    NewsletterDelivery.find.mockImplementation((query = {}) => {
      const deliveries = mockDeliveryDocs.filter((delivery) => matchesDeliveryQuery(delivery, query));
      deliveries.sort = vi.fn().mockResolvedValue(deliveries);

      return deliveries;
    });
    NewsletterDelivery.findOne.mockImplementation((query = {}) => ({
      sort: vi.fn((sortSpec = {}) => ({
        lean: vi.fn().mockResolvedValue(
          [...mockDeliveryDocs]
            .filter((delivery) => matchesDeliveryQuery(delivery, query))
            .sort((left, right) => {
              const [field, direction] = Object.entries(sortSpec)[0] || [];

              if (!field) {
                return 0;
              }

              return direction >= 0
                ? left[field] - right[field]
                : right[field] - left[field];
            })[0] || null
        ),
      })),
    }));
    NewsletterDelivery.findOneAndUpdate.mockImplementation(async (query) => {
      const delivery = mockDeliveryDocs.find(
        (candidate) =>
          candidate._id === query?._id &&
          matchesDeliveryQuery(candidate, {
            ...query,
            _id: candidate._id,
          })
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
      const delivery = mockDeliveryDocs.find((candidate) => matchesDeliveryQuery(candidate, query));

      if (delivery) {
        Object.assign(delivery, update?.$set || {});
        delivery.attemptCount += Number(update?.$inc?.attemptCount || 0);
        delivery.manualAttemptCount += Number(update?.$inc?.manualAttemptCount || 0);
      }

      return { modifiedCount: delivery ? 1 : 0 };
    });
    NewsletterDelivery.countDocuments.mockImplementation(async (query) =>
      mockDeliveryDocs.filter((delivery) => matchesDeliveryQuery(delivery, query)).length
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
      localizedPayload({
        locales: ['en'],
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

    const result = await sendNewsletterToSubscribers(localizedPayload({ locales: ['en'] }));

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

  it('uses the delivery locale to choose the newsletter campaign content variant', async () => {
    mockSubscribers([
      { email: 'bg@example.com', preferredLocale: 'bg', unsubscribeTokenVersion: 1 },
      { email: 'en@example.com', preferredLocale: 'en', unsubscribeTokenVersion: 1 },
    ]);

    const result = await sendNewsletterToSubscribers(localizedPayload());

    expect(result).toMatchObject({
      sent: 2,
      failed: 0,
      activeSubscribersByLocale: {
        bg: 1,
        en: 1,
      },
    });
    expect(buildNewsletterEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'bg',
        subject: 'Новини от Happy Colors',
        ctaLabel: 'Виж повече',
        ctaUrl: 'https://happycolors.eu/bg/products',
      })
    );
    expect(buildNewsletterEmailTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: 'en',
        subject: 'Happy Colors news',
        ctaLabel: 'View more',
        ctaUrl: 'https://happycolors.eu/en/products',
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

  it('builds product prefill with current English content when available', async () => {
    getProductById.mockImplementation(async (productId, viewer, { locale = 'bg' } = {}) => {
      if (locale === 'en') {
        return {
          _id: productId,
          title: 'Lavender Candle',
          description: 'A relaxing handmade candle.',
          imageUrls: ['https://cdn.example.com/lavender.webp'],
          contentLocale: 'en',
          translationPending: false,
        };
      }

      return {
        _id: productId,
        title: 'Лавандулова свещ',
        description: 'Ръчно изработена свещ.',
        imageUrls: ['https://cdn.example.com/lavender.webp'],
      };
    });

    const result = await buildProductNewsletterPrefill(validProductId);

    expect(getProductById).toHaveBeenCalledWith(validProductId, null, { locale: 'bg' });
    expect(getProductById).toHaveBeenCalledWith(validProductId, null, { locale: 'en' });
    expect(result).toMatchObject({
      subject: 'Лавандулова свещ',
      contentByLocale: {
        bg: {
          subject: 'Лавандулова свещ',
          contentHtml: '<p>Ръчно изработена свещ.</p>',
          contentText: 'Ръчно изработена свещ.',
          ctaLabel: 'Виж повече',
        },
        en: {
          subject: 'Lavender Candle',
          contentHtml: '<p>A relaxing handmade candle.</p>',
          contentText: 'A relaxing handmade candle.',
          ctaLabel: 'View more',
        },
      },
    });
  });

  it('omits English product prefill when public projection is pending', async () => {
    getProductById.mockImplementation(async (productId, viewer, { locale = 'bg' } = {}) => ({
      _id: productId,
      title: locale === 'en' ? 'Лавандулова свещ' : 'Лавандулова свещ',
      description: 'Ръчно изработена свещ.',
      contentLocale: locale === 'en' ? 'bg' : undefined,
      translationPending: locale === 'en' ? true : undefined,
    }));

    const result = await buildProductNewsletterPrefill(validProductId);

    expect(result.contentByLocale).toEqual({
      bg: expect.objectContaining({
        subject: 'Лавандулова свещ',
      }),
    });
  });

  it('builds blog prefill from the first sanitized paragraph and default newsletter image', async () => {
    BlogArticle.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: validBlogId,
        title: 'Color story',
        contentHtml: '<p>First paragraph.</p><p>Second paragraph.</p><script>alert(1)</script>',
        contentText: 'First paragraph. Second paragraph.',
        sourceRevision: 2,
        translations: {
          en: {
            title: 'English color story',
            contentHtml: '<p>English first paragraph.</p><p>English second paragraph.</p>',
            contentText: 'English first paragraph. English second paragraph.',
            heroImageAlt: 'English alt',
            sourceRevision: 2,
            method: 'manual',
          },
        },
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
      contentByLocale: {
        bg: {
          subject: 'Color story',
          contentHtml: '<p>First paragraph.</p>',
          contentText: 'First paragraph.',
          ctaLabel: 'Виж повече',
        },
        en: {
          subject: 'English color story',
          contentHtml: '<p>English first paragraph.</p>',
          contentText: 'English first paragraph.',
          ctaLabel: 'View more',
        },
      },
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

  it('omits English blog prefill when the article has no current English translation', async () => {
    BlogArticle.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: validBlogId,
        title: 'Color story',
        contentHtml: '<p>First paragraph.</p><p>Second paragraph.</p>',
        contentText: 'First paragraph. Second paragraph.',
        sourceRevision: 3,
        translations: {
          en: {
            title: 'Stale English color story',
            contentHtml: '<p>Stale English first paragraph.</p>',
            contentText: 'Stale English first paragraph.',
            heroImageAlt: 'Stale English alt',
            sourceRevision: 2,
            method: 'manual',
          },
        },
      }),
    });

    const result = await buildBlogNewsletterPrefill(validBlogId);

    expect(result.contentByLocale).toEqual({
      bg: expect.objectContaining({
        subject: 'Color story',
        contentHtml: '<p>First paragraph.</p>',
      }),
    });
  });
});
