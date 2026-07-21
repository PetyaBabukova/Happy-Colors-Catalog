import sanitizeHtml from 'sanitize-html';
import crypto from 'crypto';
import validator from 'validator';
import { sendEmail } from '../helpers/sendEmail.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';
import NewsletterCampaign from '../models/NewsletterCampaign.js';
import NewsletterDelivery from '../models/NewsletterDelivery.js';
import BlogArticle from '../models/BlogArticle.js';
import { PUBLIC_LOCALES } from '../models/localizationSchemas.js';
import {
  createNewsletterPreferencesPageUrl,
  createNewsletterPreferencesToken,
  createUnsubscribePageUrl,
  createUnsubscribeToken,
} from './newsletterService.js';
import { buildNewsletterEmailTemplate } from './newsletterEmailTemplate.js';
import { extractContentText, validateContentJson } from './blogArticlesService.js';
import { getProductById } from './productsServices.js';

const SUBJECT_MAX_LENGTH = 160;
const DEFAULT_NEWSLETTER_LOCALE = 'bg';
const NEWSLETTER_DEFAULT_IMAGE_PATH = '/logo_64pxH.svg';
const CUSTOM_CTA_PATH = '/products';
const DEFAULT_NEWSLETTER_PUBLIC_SITE_URL = 'https://happycolors.eu';
const ALLOWED_SEND_FIELDS = new Set([
  'subject',
  'contentHtml',
  'contentJson',
  'contentText',
  'sourceType',
  'sourceId',
  'locales',
]);
const SUPPORTED_SOURCE_TYPES = new Set(['custom', 'product', 'blog']);
const PUBLIC_LOCALE_SET = new Set(PUBLIC_LOCALES);

// V1 runs on a single API instance; move this to a database lock before scaling horizontally.
let broadcastInProgress = false;

export class NewsletterSendError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'NewsletterSendError';
    this.statusCode = statusCode;
  }
}

function assertPlainObject(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NewsletterSendError('Invalid newsletter payload.');
  }
}

function buildPublicSiteUrl(pathOrUrl) {
  const publicSiteUrl = String(
    process.env.NEWSLETTER_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_NEWSLETTER_PUBLIC_SITE_URL
  ).replace(/\/+$/, '');

  return new URL(pathOrUrl, `${publicSiteUrl}/`).toString();
}

function buildLocalizedPublicSiteUrl(locale, pathOrUrl) {
  const normalizedLocale = normalizeStoredPublicLocale(locale);
  const publicUrl = new URL(pathOrUrl, `${buildPublicSiteUrl('/')}`);

  if (!PUBLIC_LOCALE_SET.has(publicUrl.pathname.split('/')[1])) {
    publicUrl.pathname = `/${normalizedLocale}${publicUrl.pathname.startsWith('/') ? '' : '/'}${publicUrl.pathname}`;
  }

  return publicUrl.toString();
}

function normalizeStoredPublicLocale(locale) {
  const normalizedLocale = String(locale || DEFAULT_NEWSLETTER_LOCALE).trim().toLowerCase();

  return PUBLIC_LOCALE_SET.has(normalizedLocale) ? normalizedLocale : DEFAULT_NEWSLETTER_LOCALE;
}

function getDefaultNewsletterImageUrl() {
  return String(process.env.NEWSLETTER_DEFAULT_IMAGE_URL || '').trim() || NEWSLETTER_DEFAULT_IMAGE_PATH;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSubject(subject) {
  const value = String(subject || '').trim();

  if (!value) {
    throw new NewsletterSendError('Newsletter subject is required.');
  }

  if (value.length > SUBJECT_MAX_LENGTH) {
    throw new NewsletterSendError(`Newsletter subject cannot be longer than ${SUBJECT_MAX_LENGTH} characters.`);
  }

  return value;
}

function sanitizeNewsletterHtml(contentHtml) {
  const rawHtml = String(contentHtml || '').trim();

  if (!rawHtml) {
    throw new NewsletterSendError('Newsletter content is required.');
  }

  const sanitized = sanitizeHtml(rawHtml, {
    allowedTags: ['h2', 'h3', 'h4', 'p', 'strong', 'em', 'u', 'ul', 'ol', 'li', 'br', 'blockquote', 'a'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['https', 'mailto'],
    allowProtocolRelative: false,
    transformTags: {
      b: 'strong',
      i: 'em',
      div: 'p',
      a(tagName, attribs) {
        const nextAttribs = { ...attribs };
        const href = String(nextAttribs.href || '').trim();

        if (href) {
          try {
            const parsedHref = new URL(href);

            if (!['https:', 'mailto:'].includes(parsedHref.protocol)) {
              delete nextAttribs.href;
            }
          } catch {
            delete nextAttribs.href;
          }
        }

        if (nextAttribs.target === '_blank') {
          nextAttribs.rel = 'noopener noreferrer';
        }

        return { tagName, attribs: nextAttribs };
      },
    },
  }).trim();

  if (!extractContentText(sanitized)) {
    throw new NewsletterSendError('Newsletter content is required.');
  }

  return sanitized;
}

function validateSendPayload(payload) {
  assertPlainObject(payload);

  const unknownFields = Object.keys(payload).filter((key) => !ALLOWED_SEND_FIELDS.has(key));

  if (unknownFields.length > 0) {
    throw new NewsletterSendError('Invalid newsletter payload fields.');
  }

  const sourceType = String(payload.sourceType || 'custom').trim();
  const sourceId = String(payload.sourceId || '').trim();
  const selectedLocales = normalizeSelectedLocales(payload.locales);

  if (!SUPPORTED_SOURCE_TYPES.has(sourceType)) {
    throw new NewsletterSendError('Newsletter source is not supported yet.');
  }

  const subject = normalizeSubject(payload.subject);
  const contentHtml = sanitizeNewsletterHtml(payload.contentHtml);
  const contentJson = validateContentJson(payload.contentJson);
  const contentText = String(payload.contentText || extractContentText(contentHtml)).trim();

  if (!contentText) {
    throw new NewsletterSendError('Newsletter text content is required.');
  }

  if (sourceType !== 'custom' && !validator.isMongoId(sourceId)) {
    throw new NewsletterSendError('Newsletter source id is invalid.');
  }

  return {
    subject,
    title: subject,
    contentHtml,
    contentJson,
    contentText,
    sourceType,
    sourceId,
    selectedLocales,
  };
}

function normalizeSelectedLocales(locales) {
  if (locales === undefined) {
    return [...PUBLIC_LOCALES];
  }

  if (!Array.isArray(locales) || locales.length === 0) {
    throw new NewsletterSendError('Newsletter languages are required.');
  }

  const normalizedLocales = locales.map((locale) => String(locale || '').trim().toLowerCase());
  const uniqueLocales = [...new Set(normalizedLocales)];

  if (
    uniqueLocales.length !== normalizedLocales.length ||
    uniqueLocales.some((locale) => !PUBLIC_LOCALE_SET.has(locale))
  ) {
    throw new NewsletterSendError('Newsletter languages are invalid.');
  }

  return uniqueLocales;
}

function firstProductImage(product) {
  if (Array.isArray(product?.imageUrls) && product.imageUrls.length > 0) {
    return product.imageUrls.find(Boolean) || '';
  }

  return product?.imageUrl || '';
}

function blogImage(article) {
  return article?.thumbnailImageUrl || article?.heroImageUrl || '';
}

async function findBlogArticle(articleId) {
  try {
    return await BlogArticle.findById(articleId).lean();
  } catch {
    throw new NewsletterSendError('Blog article was not found.', 404);
  }
}

function firstParagraphHtml(article) {
  const sanitizedHtml = sanitizeNewsletterHtml(article?.contentHtml || `<p>${escapeHtml(article?.contentText || article?.excerpt || '')}</p>`);
  const paragraphMatches = sanitizedHtml.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  const paragraphHtml =
    paragraphMatches.find((candidate) => extractContentText(candidate)) ||
    `<p>${escapeHtml(article?.excerpt || article?.contentText || '')}</p>`;
  const paragraphText = extractContentText(paragraphHtml);

  if (!paragraphText) {
    const fallbackText = String(article?.excerpt || article?.contentText || '').trim();
    return {
      contentHtml: `<p>${escapeHtml(fallbackText)}</p>`,
      contentText: fallbackText,
    };
  }

  return {
    contentHtml: paragraphHtml,
    contentText: paragraphText,
  };
}

async function deriveNewsletterPayload(payload) {
  const newsletter = validateSendPayload(payload);

  if (newsletter.sourceType === 'product') {
    let product;

    try {
      product = await getProductById(newsletter.sourceId);
    } catch {
      throw new NewsletterSendError('Product was not found.', 404);
    }

    if (!product) {
      throw new NewsletterSendError('Product was not found.', 404);
    }

    return {
      ...newsletter,
      ctaPath: `/products/${newsletter.sourceId}`,
      ctaUrl: buildLocalizedPublicSiteUrl(DEFAULT_NEWSLETTER_LOCALE, `/products/${newsletter.sourceId}`),
      imageUrl: buildPublicSiteUrl(firstProductImage(product) || getDefaultNewsletterImageUrl()),
    };
  }

  if (newsletter.sourceType === 'blog') {
    const article = await findBlogArticle(newsletter.sourceId);

    if (!article) {
      throw new NewsletterSendError('Blog article was not found.', 404);
    }

    return {
      ...newsletter,
      ctaPath: `/blog/${newsletter.sourceId}`,
      ctaUrl: buildLocalizedPublicSiteUrl(DEFAULT_NEWSLETTER_LOCALE, `/blog/${newsletter.sourceId}`),
      imageUrl: buildPublicSiteUrl(blogImage(article) || getDefaultNewsletterImageUrl()),
    };
  }

  return {
    ...newsletter,
    ctaPath: CUSTOM_CTA_PATH,
    ctaUrl: buildLocalizedPublicSiteUrl(DEFAULT_NEWSLETTER_LOCALE, CUSTOM_CTA_PATH),
    imageUrl: buildPublicSiteUrl(getDefaultNewsletterImageUrl()),
  };
}

function parseTestRecipients() {
  const rawRecipients = String(process.env.NEWSLETTER_TEST_RECIPIENTS || '').trim();

  if (!rawRecipients) {
    throw new NewsletterSendError('NEWSLETTER_TEST_RECIPIENTS is not configured.', 422);
  }

  const recipients = rawRecipients
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (recipients.length === 0 || recipients.some((email) => !validator.isEmail(email))) {
    throw new NewsletterSendError('NEWSLETTER_TEST_RECIPIENTS must contain valid email addresses.', 422);
  }

  return recipients;
}

function buildOneClickUnsubscribeUrl(token) {
  return `${buildPublicSiteUrl('/api/newsletter/unsubscribe/one-click')}?token=${encodeURIComponent(token)}`;
}

function buildSubscriberUrls(subscriber, locale) {
  const token = createUnsubscribeToken(subscriber);
  const preferencesToken = createNewsletterPreferencesToken(subscriber);

  return {
    unsubscribeUrl: createUnsubscribePageUrl(token, { locale }),
    listUnsubscribeUrl: buildOneClickUnsubscribeUrl(token),
    preferencesUrl: createNewsletterPreferencesPageUrl(preferencesToken, { locale }),
  };
}

function buildSubscriberCountsByLocale(subscribers) {
  return subscribers.reduce(
    (counts, subscriber) => {
      counts[normalizeStoredPublicLocale(subscriber?.preferredLocale)] += 1;
      return counts;
    },
    { bg: 0, en: 0 }
  );
}

function getErrorReason(error) {
  return error?.message || 'Unknown email delivery error';
}

function truncateErrorReason(reason) {
  return String(reason || 'Unknown email delivery error').slice(0, 500);
}

function buildFailureReportText(failures) {
  const lines = [
    'Newsletter delivery failures:',
    '',
    ...failures.map((failure) => `${failure.email} - ${failure.reason}`),
  ];

  return lines.join('\n');
}

async function sendFailureReport(failures) {
  if (failures.length === 0) {
    return;
  }

  try {
    await sendEmail({
      subject: 'Happy Colors newsletter delivery failures',
      text: buildFailureReportText(failures),
    });
  } catch (error) {
    console.error('Newsletter failure report send failed:', {
      failedCount: failures.length,
      message: error?.message || 'Unknown email error',
    });
  }
}

async function createCampaignSnapshot(newsletter, subscribers, recipientCountsByLocale) {
  const now = new Date();
  const campaign = await NewsletterCampaign.create({
    status: 'sending',
    sourceType: newsletter.sourceType,
    sourceId: newsletter.sourceId || '',
    selectedLocales: newsletter.selectedLocales,
    subject: newsletter.subject,
    title: newsletter.title,
    contentHtml: newsletter.contentHtml,
    contentText: newsletter.contentText,
    contentJson: newsletter.contentJson || null,
    ctaPath: newsletter.ctaPath,
    imageUrl: newsletter.imageUrl,
    recipientCountsByLocale,
    totalRecipients: subscribers.length,
    startedAt: now,
  });

  if (subscribers.length > 0) {
    await NewsletterDelivery.insertMany(
      subscribers.map((subscriber) => ({
        campaignId: campaign._id,
        subscriberId: subscriber._id,
        email: subscriber.email,
        locale: normalizeStoredPublicLocale(subscriber?.preferredLocale),
      })),
      { ordered: false }
    );
  }

  return campaign;
}

async function claimNewsletterDelivery(deliveryId) {
  return NewsletterDelivery.findOneAndUpdate(
    {
      _id: deliveryId,
      status: 'pending',
    },
    {
      $set: {
        status: 'sending',
        claimedAt: new Date(),
        claimToken: crypto.randomBytes(16).toString('base64url'),
      },
    },
    { new: true }
  );
}

async function markNewsletterDeliverySkipped(delivery, reason) {
  await NewsletterDelivery.updateOne(
    {
      _id: delivery._id,
      status: 'sending',
      claimToken: delivery.claimToken,
    },
    {
      $set: {
        status: 'skipped',
        skippedAt: new Date(),
        lastErrorReason: truncateErrorReason(reason),
      },
    }
  );
}

async function markNewsletterDeliverySent(delivery) {
  await NewsletterDelivery.updateOne(
    {
      _id: delivery._id,
      status: 'sending',
      claimToken: delivery.claimToken,
    },
    {
      $set: {
        status: 'sent',
        sentAt: new Date(),
        lastErrorReason: '',
      },
      $inc: {
        attemptCount: 1,
      },
    }
  );
  await NewsletterSubscriber.updateOne(
    { _id: delivery.subscriberId },
    { $set: { consecutiveUndeliveredCount: 0 } }
  );
}

async function markNewsletterDeliveryFailed(delivery, reason) {
  await NewsletterDelivery.updateOne(
    {
      _id: delivery._id,
      status: 'sending',
      claimToken: delivery.claimToken,
    },
    {
      $set: {
        status: 'failed',
        failedAt: new Date(),
        lastErrorReason: truncateErrorReason(reason),
      },
      $inc: {
        attemptCount: 1,
      },
    }
  );
  await NewsletterSubscriber.updateOne(
    { _id: delivery.subscriberId },
    { $inc: { consecutiveUndeliveredCount: 1 } }
  );
}

async function finalizeNewsletterCampaign(campaignId) {
  const [sentCount, failedCount, skippedCount] = await Promise.all([
    NewsletterDelivery.countDocuments({ campaignId, status: 'sent' }),
    NewsletterDelivery.countDocuments({ campaignId, status: 'failed' }),
    NewsletterDelivery.countDocuments({ campaignId, status: 'skipped' }),
  ]);

  await NewsletterCampaign.updateOne(
    { _id: campaignId },
    {
      $set: {
        status: 'completed',
        finishedAt: new Date(),
        sentCount,
        failedCount,
        skippedCount,
      },
    }
  );

  return { sentCount, failedCount, skippedCount };
}

export async function processNewsletterCampaignDeliveries(campaignId) {
  const campaign = await NewsletterCampaign.findById(campaignId).lean();

  if (!campaign) {
    throw new NewsletterSendError('Newsletter campaign was not found.', 404);
  }

  const deliveries = await NewsletterDelivery.find({
    campaignId: campaign._id,
    status: 'pending',
  }).sort({ createdAt: 1 });
  const failures = [];

  for (const pendingDelivery of deliveries) {
    const delivery = await claimNewsletterDelivery(pendingDelivery._id);

    if (!delivery) {
      continue;
    }

    const subscriber = await NewsletterSubscriber.findOne({
      _id: delivery.subscriberId,
      status: 'active',
    });

    if (!subscriber) {
      await markNewsletterDeliverySkipped(delivery, 'Subscriber is no longer active.');
      continue;
    }

    try {
      const locale = normalizeStoredPublicLocale(delivery.locale);
      const { unsubscribeUrl, listUnsubscribeUrl, preferencesUrl } = buildSubscriberUrls(subscriber, locale);
      const template = buildNewsletterEmailTemplate({
        ...campaign,
        locale,
        ctaUrl: buildLocalizedPublicSiteUrl(locale, campaign.ctaPath),
        unsubscribeUrl,
        listUnsubscribeUrl,
        preferencesUrl,
      });

      await sendEmail({
        to: delivery.email,
        subject: template.subject,
        text: template.text,
        html: template.html,
        headers: template.headers,
      });
      await markNewsletterDeliverySent(delivery);
    } catch (error) {
      const reason = getErrorReason(error);
      failures.push({
        email: delivery.email,
        reason,
      });
      await markNewsletterDeliveryFailed(delivery, reason);
    }
  }

  const summary = await finalizeNewsletterCampaign(campaign._id);

  return {
    sent: summary.sentCount,
    failed: summary.failedCount,
    skipped: summary.skippedCount,
    failures,
  };
}

export async function getNewsletterSendStatus() {
  const [activeSubscribers, activeEnglishSubscribers] = await Promise.all([
    NewsletterSubscriber.countDocuments({ status: 'active' }),
    NewsletterSubscriber.countDocuments({ status: 'active', preferredLocale: 'en' }),
  ]);

  return {
    activeSubscribers,
    activeSubscribersByLocale: {
      bg: Math.max(0, activeSubscribers - activeEnglishSubscribers),
      en: activeEnglishSubscribers,
    },
  };
}

export async function sendNewsletterTest(payload) {
  const newsletter = await deriveNewsletterPayload(payload);
  const recipients = parseTestRecipients();
  const template = buildNewsletterEmailTemplate({
    ...newsletter,
    isTest: true,
  });

  await Promise.all(
    recipients.map((to) =>
      sendEmail({
        to,
        subject: template.subject,
        text: template.text,
        html: template.html,
        headers: template.headers,
      })
    )
  );

  return {
    message: 'Test email sent.',
    recipients: recipients.length,
  };
}

export async function sendNewsletterToSubscribers(payload) {
  if (broadcastInProgress) {
    throw new NewsletterSendError('Newsletter broadcast is already in progress.', 409);
  }

  broadcastInProgress = true;

  try {
    const newsletter = await deriveNewsletterPayload(payload);
    const selectedLocaleSet = new Set(newsletter.selectedLocales);
    const allActiveSubscribers = await NewsletterSubscriber.find({ status: 'active' }).sort({ createdAt: 1 });
    const subscribers = allActiveSubscribers.filter((subscriber) =>
      selectedLocaleSet.has(normalizeStoredPublicLocale(subscriber?.preferredLocale))
    );
    const activeSubscribers = subscribers.length;
    const activeSubscribersByLocale = buildSubscriberCountsByLocale(subscribers);

    if (activeSubscribers === 0) {
      return {
        message: 'No active subscribers.',
        sent: 0,
        failed: 0,
        skipped: 0,
        activeSubscribers: 0,
        activeSubscribersByLocale,
      };
    }

    const campaign = await createCampaignSnapshot(newsletter, subscribers, activeSubscribersByLocale);
    const deliverySummary = await processNewsletterCampaignDeliveries(campaign._id);
    const failures = deliverySummary.failures;

    await sendFailureReport(failures);

    return {
      message: failures.length > 0 ? 'Newsletter send finished with failures.' : 'Newsletter send finished.',
      sent: deliverySummary.sent,
      failed: failures.length,
      skipped: deliverySummary.skipped,
      activeSubscribers,
      activeSubscribersByLocale,
    };
  } finally {
    broadcastInProgress = false;
  }
}

export async function buildProductNewsletterPrefill(productId) {
  if (!validator.isMongoId(String(productId || ''))) {
    throw new NewsletterSendError('Product id is invalid.');
  }

  let product;

  try {
    product = await getProductById(productId);
  } catch {
    throw new NewsletterSendError('Product was not found.', 404);
  }

  if (!product) {
    throw new NewsletterSendError('Product was not found.', 404);
  }

  const contentText = String(product.description || '').trim();
  const contentHtml = `<p>${escapeHtml(contentText)}</p>`;

  return {
    sourceType: 'product',
    sourceId: String(product._id || productId),
    subject: product.title,
    contentHtml,
    contentText,
    imageUrl: buildPublicSiteUrl(firstProductImage(product) || getDefaultNewsletterImageUrl()),
    ctaUrl: `/products/${productId}`,
    ctaLabel: 'Виж повече',
  };
}

export async function buildBlogNewsletterPrefill(articleId) {
  if (!validator.isMongoId(String(articleId || ''))) {
    throw new NewsletterSendError('Blog article id is invalid.');
  }

  const article = await findBlogArticle(articleId);

  if (!article) {
    throw new NewsletterSendError('Blog article was not found.', 404);
  }

  const content = firstParagraphHtml(article);

  return {
    sourceType: 'blog',
    sourceId: String(article._id || articleId),
    subject: article.title,
    contentHtml: content.contentHtml,
    contentText: content.contentText,
    imageUrl: buildPublicSiteUrl(blogImage(article) || getDefaultNewsletterImageUrl()),
    ctaUrl: `/blog/${articleId}`,
    ctaLabel: 'Виж повече',
  };
}
