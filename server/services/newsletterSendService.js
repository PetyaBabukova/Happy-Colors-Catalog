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
import { projectPublicBlogArticle } from './localization/publicProjection.js';

const SUBJECT_MAX_LENGTH = 160;
const CTA_LABEL_MAX_LENGTH = 80;
const DEFAULT_NEWSLETTER_LOCALE = 'bg';
const NEWSLETTER_DEFAULT_IMAGE_PATH = '/logo_64pxH.svg';
const CUSTOM_CTA_PATH = '/products';
const DEFAULT_NEWSLETTER_PUBLIC_SITE_URL = 'https://happycolors.eu';
const NEWSLETTER_CTA_LABEL_BY_LOCALE = {
  bg: 'Виж повече',
  en: 'View more',
};
const MAX_AUTOMATIC_DELIVERY_ATTEMPTS = 3;
const MAX_MANUAL_DELIVERY_ATTEMPTS = 1;
const DELIVERY_RETRY_BACKOFF_MS = [5 * 60 * 1000, 30 * 60 * 1000];
const DELIVERY_CLAIM_STALE_AFTER_MS = 60 * 60 * 1000;
const LOCK_COLLISION_RESCHEDULE_DELAY_MS = 60 * 1000;
const MANUAL_DELIVERY_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_SEND_FIELDS = new Set([
  'subject',
  'contentHtml',
  'contentJson',
  'contentText',
  'contentByLocale',
  'ctaLabel',
  'sourceType',
  'sourceId',
  'locales',
]);
const ALLOWED_SEND_CONTENT_FIELDS = new Set([
  'subject',
  'contentHtml',
  'contentJson',
  'contentText',
  'ctaLabel',
]);
const SUPPORTED_SOURCE_TYPES = new Set(['custom', 'product', 'blog']);
const PUBLIC_LOCALE_SET = new Set(PUBLIC_LOCALES);

// V1 runs on a single API instance; move this to a database lock before scaling horizontally.
let broadcastInProgress = false;
const scheduledCampaignTimers = new Map();
const processingCampaignKeys = new Set();

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

function normalizeCtaLabel(ctaLabel) {
  const value = String(ctaLabel || '').trim();

  if (value.length > CTA_LABEL_MAX_LENGTH) {
    throw new NewsletterSendError(`Newsletter CTA label cannot be longer than ${CTA_LABEL_MAX_LENGTH} characters.`);
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

function normalizeNewsletterContentVariant(rawContent, locale) {
  assertPlainObject(rawContent);

  const unknownFields = Object.keys(rawContent).filter((key) => !ALLOWED_SEND_CONTENT_FIELDS.has(key));

  if (unknownFields.length > 0) {
    throw new NewsletterSendError('Invalid newsletter payload fields.');
  }

  const subject = normalizeSubject(rawContent.subject);
  const contentHtml = sanitizeNewsletterHtml(rawContent.contentHtml);
  const contentJson = validateContentJson(rawContent.contentJson);
  const contentText = String(rawContent.contentText || extractContentText(contentHtml)).trim();

  if (!contentText) {
    throw new NewsletterSendError(`Newsletter ${locale.toUpperCase()} text content is required.`);
  }

  return {
    subject,
    title: subject,
    contentHtml,
    contentJson,
    contentText,
    ctaLabel: normalizeCtaLabel(rawContent.ctaLabel),
  };
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

  const contentByLocale = normalizeNewsletterContentByLocale(payload, selectedLocales);
  const defaultContentLocale = selectedLocales.includes(DEFAULT_NEWSLETTER_LOCALE)
    ? DEFAULT_NEWSLETTER_LOCALE
    : selectedLocales[0];
  const defaultContent = contentByLocale[defaultContentLocale];

  if (!defaultContent) {
    throw new NewsletterSendError('Newsletter content is required for every selected language.');
  }

  if (sourceType !== 'custom' && !validator.isMongoId(sourceId)) {
    throw new NewsletterSendError('Newsletter source id is invalid.');
  }

  return {
    subject: defaultContent.subject,
    title: defaultContent.title,
    contentHtml: defaultContent.contentHtml,
    contentJson: defaultContent.contentJson,
    contentText: defaultContent.contentText,
    ctaLabel: defaultContent.ctaLabel,
    contentByLocale,
    sourceType,
    sourceId,
    selectedLocales,
  };
}

function normalizeNewsletterContentByLocale(payload, selectedLocales) {
  const rawContentByLocale = payload.contentByLocale;

  if (rawContentByLocale !== undefined) {
    assertPlainObject(rawContentByLocale);

    return selectedLocales.reduce((content, locale) => {
      if (!rawContentByLocale[locale]) {
        throw new NewsletterSendError('Newsletter content is required for every selected language.');
      }

      content[locale] = normalizeNewsletterContentVariant(rawContentByLocale[locale], locale);
      return content;
    }, {});
  }

  if (selectedLocales.length > 1 || selectedLocales[0] !== DEFAULT_NEWSLETTER_LOCALE) {
    throw new NewsletterSendError('Newsletter content is required for every selected language.');
  }

  return {
    [DEFAULT_NEWSLETTER_LOCALE]: normalizeNewsletterContentVariant(
      {
        subject: payload.subject,
        contentHtml: payload.contentHtml,
        contentJson: payload.contentJson,
        contentText: payload.contentText,
        ctaLabel: payload.ctaLabel,
      },
      DEFAULT_NEWSLETTER_LOCALE
    ),
  };
}

function normalizeSelectedLocales(locales) {
  if (locales === undefined) {
    return [DEFAULT_NEWSLETTER_LOCALE];
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

function buildProductNewsletterContent(product, locale) {
  const contentText = String(product?.description || '').trim();

  return {
    subject: product?.title || '',
    contentHtml: `<p>${escapeHtml(contentText)}</p>`,
    contentText,
    ctaLabel: NEWSLETTER_CTA_LABEL_BY_LOCALE[locale] || NEWSLETTER_CTA_LABEL_BY_LOCALE.bg,
  };
}

function isCurrentEnglishProductProjection(product) {
  return product?.contentLocale === 'en' && product?.translationPending === false;
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

function buildBlogNewsletterContent(article, locale) {
  const content = firstParagraphHtml(article);

  return {
    subject: article?.title || '',
    contentHtml: content.contentHtml,
    contentText: content.contentText,
    ctaLabel: NEWSLETTER_CTA_LABEL_BY_LOCALE[locale] || NEWSLETTER_CTA_LABEL_BY_LOCALE.bg,
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

function isPermanentNewsletterDeliveryError(error) {
  if (error?.retryable === false || error?.permanent === true) {
    return true;
  }

  const responseCode = Number(error?.responseCode || error?.statusCode || error?.status || 0);

  return responseCode >= 500 && responseCode < 600;
}

function getRetryDelayMs(attemptCount) {
  const index = Math.max(0, Math.min(attemptCount - 1, DELIVERY_RETRY_BACKOFF_MS.length - 1));

  return DELIVERY_RETRY_BACKOFF_MS[index];
}

function getManualRetryClosesAt(startedAt) {
  const baseTime = startedAt instanceof Date ? startedAt.getTime() : new Date(startedAt || Date.now()).getTime();

  return new Date(baseTime + MANUAL_DELIVERY_RETRY_WINDOW_MS);
}

function getDueDeliveryQuery(campaignId, now) {
  return {
    campaignId,
    $or: [
      { status: 'pending' },
      {
        status: 'failed',
        attemptCount: { $lt: MAX_AUTOMATIC_DELIVERY_ATTEMPTS },
        isPermanentFailure: { $ne: true },
        nextAttemptAt: null,
      },
      {
        status: 'failed',
        attemptCount: { $lt: MAX_AUTOMATIC_DELIVERY_ATTEMPTS },
        isPermanentFailure: { $ne: true },
        nextAttemptAt: { $lte: now },
      },
    ],
  };
}

function getManualDeliveryQuery(campaignId) {
  return {
    campaignId,
    status: 'failed',
    $and: [
      {
        $or: [
          { manualAttemptCount: { $lt: MAX_MANUAL_DELIVERY_ATTEMPTS } },
          { manualAttemptCount: null },
        ],
      },
      {
        $or: [
          { attemptCount: { $gte: MAX_AUTOMATIC_DELIVERY_ATTEMPTS } },
          { isPermanentFailure: true },
        ],
      },
    ],
  };
}

function getEarliestDate(dates) {
  const timestamps = dates
    .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()))
    .map((date) => date.getTime());

  if (timestamps.length === 0) {
    return null;
  }

  return new Date(Math.min(...timestamps));
}

async function getNextNewsletterCampaignProcessAt(campaignId, manualRetryClosesAt, now) {
  const [pendingCount, dueAutomaticRetryCount, nextAutomaticRetry, oldestSendingDelivery, manualRetryCount] =
    await Promise.all([
      NewsletterDelivery.countDocuments({ campaignId, status: 'pending' }),
      NewsletterDelivery.countDocuments(getDueDeliveryQuery(campaignId, now)),
      NewsletterDelivery.findOne({
        campaignId,
        status: 'failed',
        attemptCount: { $lt: MAX_AUTOMATIC_DELIVERY_ATTEMPTS },
        isPermanentFailure: { $ne: true },
        nextAttemptAt: { $gt: now },
      }).sort({ nextAttemptAt: 1 }).lean(),
      NewsletterDelivery.findOne({
        campaignId,
        status: 'sending',
        claimedAt: { $ne: null },
      }).sort({ claimedAt: 1 }).lean(),
      now <= manualRetryClosesAt
        ? NewsletterDelivery.countDocuments(getManualDeliveryQuery(campaignId))
        : 0,
    ]);

  if (pendingCount > 0 || dueAutomaticRetryCount > 0) {
    return now;
  }

  const oldestClaimedAt = oldestSendingDelivery?.claimedAt
    ? new Date(oldestSendingDelivery.claimedAt)
    : null;

  return getEarliestDate([
    nextAutomaticRetry?.nextAttemptAt ? new Date(nextAutomaticRetry.nextAttemptAt) : null,
    oldestClaimedAt && !Number.isNaN(oldestClaimedAt.getTime())
      ? new Date(oldestClaimedAt.getTime() + DELIVERY_CLAIM_STALE_AFTER_MS)
      : null,
    manualRetryCount > 0 ? manualRetryClosesAt : null,
  ]);
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

export function scheduleNewsletterCampaignProcessing(campaignId, runAt = new Date()) {
  const campaignKey = String(campaignId || '').trim();

  if (!campaignKey) {
    return false;
  }

  const scheduledFor = runAt instanceof Date ? runAt : new Date(runAt || Date.now());
  const existing = scheduledCampaignTimers.get(campaignKey);

  if (existing && existing.runAt <= scheduledFor) {
    return false;
  }

  if (existing) {
    clearTimeout(existing.timer);
  }

  const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());
  const timer = setTimeout(async () => {
    scheduledCampaignTimers.delete(campaignKey);

    try {
      await processNewsletterCampaignDeliveries(campaignKey);
    } catch (error) {
      if (error?.statusCode === 409) {
        scheduleNewsletterCampaignProcessing(
          campaignKey,
          new Date(Date.now() + LOCK_COLLISION_RESCHEDULE_DELAY_MS)
        );
        return;
      }

      console.error('Newsletter campaign scheduled processing failed:', {
        campaignId: campaignKey,
        message: error?.message || 'Unknown newsletter campaign processing error',
      });
    }
  }, delayMs);

  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  scheduledCampaignTimers.set(campaignKey, {
    runAt: scheduledFor,
    timer,
  });

  return true;
}

export async function scheduleOpenNewsletterCampaignProcessing(options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const shouldScheduleTimers = options.scheduleTimers !== false;
  let cleanupSummary = { deletedCount: 0 };

  try {
    cleanupSummary = await purgeCompletedNewsletterDeliveryDetails();
  } catch (error) {
    console.error('Newsletter completed delivery reconciliation failed:', {
      message: error?.message || 'Unknown newsletter delivery reconciliation error',
    });
  }

  const campaigns = await NewsletterCampaign.find({ status: 'sending' })
    .select('_id startedAt manualRetryClosesAt')
    .lean();
  let scheduledCampaigns = 0;

  for (const campaign of campaigns) {
    const manualRetryClosesAt = campaign.manualRetryClosesAt || getManualRetryClosesAt(campaign.startedAt);
    const nextProcessAt = await getNextNewsletterCampaignProcessAt(campaign._id, manualRetryClosesAt, now) || now;

    scheduledCampaigns += 1;

    if (shouldScheduleTimers) {
      scheduleNewsletterCampaignProcessing(campaign._id, nextProcessAt);
    }
  }

  return {
    purgedCompletedDeliveries: cleanupSummary.deletedCount,
    openCampaigns: campaigns.length,
    scheduledCampaigns,
  };
}

export async function purgeCompletedNewsletterDeliveryDetails() {
  const campaignIds = await NewsletterDelivery.distinct('campaignId');

  if (campaignIds.length === 0) {
    return { deletedCount: 0 };
  }

  const completedCampaigns = await NewsletterCampaign.find({
    _id: { $in: campaignIds },
    status: 'completed',
  })
    .select('_id')
    .lean();
  const completedCampaignIds = completedCampaigns.map((campaign) => campaign._id);

  if (completedCampaignIds.length === 0) {
    return { deletedCount: 0 };
  }

  const result = await NewsletterDelivery.deleteMany({
    campaignId: { $in: completedCampaignIds },
  });

  return {
    deletedCount: Number(result.deletedCount || 0),
  };
}

async function createCampaignSnapshot(newsletter, subscribers, recipientCountsByLocale) {
  const now = new Date();
  const defaultContentLocale = newsletter.selectedLocales.includes(DEFAULT_NEWSLETTER_LOCALE)
    ? DEFAULT_NEWSLETTER_LOCALE
    : newsletter.selectedLocales[0];
  const defaultContent = newsletter.contentByLocale[defaultContentLocale];
  const campaign = await NewsletterCampaign.create({
    status: 'sending',
    sourceType: newsletter.sourceType,
    sourceId: newsletter.sourceId || '',
    selectedLocales: newsletter.selectedLocales,
    subject: defaultContent.subject,
    title: defaultContent.title,
    contentHtml: defaultContent.contentHtml,
    contentText: defaultContent.contentText,
    contentJson: defaultContent.contentJson || null,
    contentByLocale: newsletter.contentByLocale,
    ctaPath: newsletter.ctaPath,
    ctaLabel: defaultContent.ctaLabel,
    imageUrl: newsletter.imageUrl,
    recipientCountsByLocale,
    totalRecipients: subscribers.length,
    startedAt: now,
    manualRetryClosesAt: getManualRetryClosesAt(now),
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

function getCampaignContentForLocale(campaign, locale) {
  const normalizedLocale = normalizeStoredPublicLocale(locale);
  const localizedContent = campaign?.contentByLocale?.[normalizedLocale];

  if (localizedContent) {
    return localizedContent;
  }

  return {
    subject: campaign?.subject,
    title: campaign?.title,
    contentHtml: campaign?.contentHtml,
    contentText: campaign?.contentText,
    contentJson: campaign?.contentJson || null,
    ctaLabel: campaign?.ctaLabel || '',
  };
}

async function recoverStaleNewsletterDeliveryClaims(campaignId, now) {
  const staleBefore = new Date(now.getTime() - DELIVERY_CLAIM_STALE_AFTER_MS);

  await NewsletterDelivery.updateMany(
    {
      campaignId,
      status: 'sending',
      $or: [
        { claimedAt: { $lte: staleBefore } },
        { claimedAt: null },
      ],
    },
    {
      $set: {
        status: 'pending',
        claimToken: '',
        claimedAt: null,
      },
    }
  );
}

async function claimNewsletterDelivery(deliveryId, campaignId, now, { manual = false } = {}) {
  return NewsletterDelivery.findOneAndUpdate(
    {
      _id: deliveryId,
      ...(manual ? getManualDeliveryQuery(campaignId) : getDueDeliveryQuery(campaignId, now)),
    },
    {
      $set: {
        status: 'sending',
        claimedAt: now,
        claimToken: crypto.randomBytes(16).toString('base64url'),
        nextAttemptAt: null,
      },
    },
    { new: true }
  );
}

async function markNewsletterDeliverySkipped(delivery, reason, now) {
  await NewsletterDelivery.updateOne(
    {
      _id: delivery._id,
      status: 'sending',
      claimToken: delivery.claimToken,
    },
    {
      $set: {
        status: 'skipped',
        skippedAt: now,
        lastErrorReason: truncateErrorReason(reason),
        claimToken: '',
        claimedAt: null,
        nextAttemptAt: null,
      },
    }
  );
}

async function markNewsletterDeliverySent(delivery, now, { manual = false } = {}) {
  const increment = {
    attemptCount: 1,
  };

  if (manual) {
    increment.manualAttemptCount = 1;
  }

  await NewsletterDelivery.updateOne(
    {
      _id: delivery._id,
      status: 'sending',
      claimToken: delivery.claimToken,
    },
    {
      $set: {
        status: 'sent',
        sentAt: now,
        lastErrorReason: '',
        claimToken: '',
        claimedAt: null,
        nextAttemptAt: null,
        isPermanentFailure: false,
        subscriberCounterUpdatedAt: now,
      },
      $inc: increment,
    }
  );
  await NewsletterSubscriber.updateOne(
    { _id: delivery.subscriberId },
    { $set: { consecutiveUndeliveredCount: 0 } }
  );
}

async function markNewsletterDeliveryFailed(delivery, reason, error, now, { manual = false } = {}) {
  const nextAttemptCount = Number(delivery.attemptCount || 0) + 1;
  const isPermanentFailure = isPermanentNewsletterDeliveryError(error);
  const shouldRetryAutomatically =
    !manual && !isPermanentFailure && nextAttemptCount < MAX_AUTOMATIC_DELIVERY_ATTEMPTS;
  const nextAttemptAt = shouldRetryAutomatically
    ? new Date(now.getTime() + getRetryDelayMs(nextAttemptCount))
    : null;
  const increment = {
    attemptCount: 1,
  };

  if (manual) {
    increment.manualAttemptCount = 1;
  }

  await NewsletterDelivery.updateOne(
    {
      _id: delivery._id,
      status: 'sending',
      claimToken: delivery.claimToken,
    },
    {
      $set: {
        status: 'failed',
        failedAt: now,
        lastErrorReason: truncateErrorReason(reason),
        claimToken: '',
        claimedAt: null,
        nextAttemptAt,
        isPermanentFailure,
      },
      $inc: increment,
    }
  );
}

async function updateFinalFailedSubscriberCounters(campaignId, now) {
  const failedDeliveries = await NewsletterDelivery.find({
    campaignId,
    status: 'failed',
    subscriberCounterUpdatedAt: null,
  });

  for (const delivery of failedDeliveries) {
    const result = await NewsletterDelivery.updateOne(
      {
        _id: delivery._id,
        status: 'failed',
        subscriberCounterUpdatedAt: null,
      },
      {
        $set: {
          subscriberCounterUpdatedAt: now,
        },
      }
    );

    if (result.modifiedCount > 0) {
      await NewsletterSubscriber.updateOne(
        { _id: delivery.subscriberId },
        { $inc: { consecutiveUndeliveredCount: 1 } }
      );
    }
  }
}

async function purgeNewsletterCampaignDeliveries(campaignId) {
  try {
    await NewsletterDelivery.deleteMany({ campaignId });
  } catch (error) {
    console.error('Newsletter campaign delivery cleanup failed:', {
      campaignId: String(campaignId),
      message: error?.message || 'Unknown newsletter delivery cleanup error',
    });
  }
}

async function finalizeNewsletterCampaign(campaign, now) {
  const campaignId = campaign._id;
  const manualRetryClosesAt = campaign.manualRetryClosesAt || getManualRetryClosesAt(campaign.startedAt);
  const [sentCount, failedCount, skippedCount, pendingCount, sendingCount, automaticRetryCount, manualRetryCount] =
    await Promise.all([
      NewsletterDelivery.countDocuments({ campaignId, status: 'sent' }),
      NewsletterDelivery.countDocuments({ campaignId, status: 'failed' }),
      NewsletterDelivery.countDocuments({ campaignId, status: 'skipped' }),
      NewsletterDelivery.countDocuments({ campaignId, status: 'pending' }),
      NewsletterDelivery.countDocuments({ campaignId, status: 'sending' }),
      NewsletterDelivery.countDocuments({
        campaignId,
        status: 'failed',
        attemptCount: { $lt: MAX_AUTOMATIC_DELIVERY_ATTEMPTS },
        isPermanentFailure: { $ne: true },
      }),
      now <= manualRetryClosesAt
        ? NewsletterDelivery.countDocuments(getManualDeliveryQuery(campaignId))
        : 0,
    ]);

  const openCount = pendingCount + sendingCount + automaticRetryCount + manualRetryCount;

  if (openCount > 0) {
    const nextProcessAt = await getNextNewsletterCampaignProcessAt(campaignId, manualRetryClosesAt, now);

    await NewsletterCampaign.updateOne(
      { _id: campaignId },
      {
        $set: {
          sentCount,
          failedCount,
          skippedCount,
          manualRetryClosesAt,
        },
      }
    );

    return {
      status: 'sending',
      sentCount,
      failedCount,
      skippedCount,
      openCount,
      pendingRetryCount: automaticRetryCount + manualRetryCount,
      nextProcessAt,
    };
  }

  await updateFinalFailedSubscriberCounters(campaignId, now);

  await NewsletterCampaign.updateOne(
    { _id: campaignId },
    {
      $set: {
        status: 'completed',
        finishedAt: now,
        sentCount,
        failedCount,
        skippedCount,
        manualRetryClosesAt,
      },
    }
  );

  await purgeNewsletterCampaignDeliveries(campaignId);

  return {
    status: 'completed',
    sentCount,
    failedCount,
    skippedCount,
    openCount: 0,
    pendingRetryCount: 0,
    nextProcessAt: null,
  };
}

async function summarizeCompletedNewsletterCampaign(campaign) {
  await purgeNewsletterCampaignDeliveries(campaign._id);

  return {
    status: 'completed',
    sent: Number(campaign.sentCount || 0),
    failed: Number(campaign.failedCount || 0),
    skipped: Number(campaign.skippedCount || 0),
    pendingRetries: 0,
    nextProcessAt: null,
    failures: [],
  };
}

export async function processNewsletterCampaignDeliveries(campaignId, options = {}) {
  if (!validator.isMongoId(String(campaignId || ''))) {
    throw new NewsletterSendError('Newsletter campaign id is invalid.');
  }

  const campaignKey = String(campaignId);

  if (processingCampaignKeys.has(campaignKey)) {
    throw new NewsletterSendError('Newsletter campaign is already being processed.', 409);
  }

  processingCampaignKeys.add(campaignKey);

  try {
    return await processNewsletterCampaignDeliveriesUnlocked(campaignId, options);
  } finally {
    processingCampaignKeys.delete(campaignKey);
  }
}

async function processNewsletterCampaignDeliveriesUnlocked(campaignId, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const manual = options.manual === true;
  const shouldScheduleNext = options.scheduleNext !== false && !options.now;
  const campaign = await NewsletterCampaign.findById(campaignId).lean();

  if (!campaign) {
    throw new NewsletterSendError('Newsletter campaign was not found.', 404);
  }

  if (campaign.status === 'completed') {
    return summarizeCompletedNewsletterCampaign(campaign);
  }

  await recoverStaleNewsletterDeliveryClaims(campaign._id, now);

  const manualRetryClosesAt = campaign.manualRetryClosesAt || getManualRetryClosesAt(campaign.startedAt);
  const deliveryQuery = manual
    ? now <= manualRetryClosesAt
      ? getManualDeliveryQuery(campaign._id)
      : { campaignId: campaign._id, _id: null }
    : getDueDeliveryQuery(campaign._id, now);
  const deliveries = await NewsletterDelivery.find(deliveryQuery).sort({ createdAt: 1 });
  const failures = [];

  for (const pendingDelivery of deliveries) {
    const delivery = await claimNewsletterDelivery(pendingDelivery._id, campaign._id, now, { manual });

    if (!delivery) {
      continue;
    }

    const subscriber = await NewsletterSubscriber.findOne({
      _id: delivery.subscriberId,
      status: 'active',
    });

    if (!subscriber) {
      await markNewsletterDeliverySkipped(delivery, 'Subscriber is no longer active.', now);
      continue;
    }

    try {
      const locale = normalizeStoredPublicLocale(delivery.locale);
      const { unsubscribeUrl, listUnsubscribeUrl, preferencesUrl } = buildSubscriberUrls(subscriber, locale);
      const campaignContent = getCampaignContentForLocale(campaign, locale);
      const template = buildNewsletterEmailTemplate({
        ...campaign,
        ...campaignContent,
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
      await markNewsletterDeliverySent(delivery, now, { manual });
    } catch (error) {
      const reason = getErrorReason(error);
      failures.push({
        email: delivery.email,
        reason,
      });
      await markNewsletterDeliveryFailed(delivery, reason, error, now, { manual });
    }
  }

  const summary = await finalizeNewsletterCampaign(campaign, now);

  if (shouldScheduleNext && summary.status !== 'completed' && summary.nextProcessAt) {
    scheduleNewsletterCampaignProcessing(campaign._id, summary.nextProcessAt);
  }

  return {
    status: summary.status,
    sent: summary.sentCount,
    failed: summary.failedCount,
    skipped: summary.skippedCount,
    pendingRetries: summary.pendingRetryCount,
    nextProcessAt: summary.nextProcessAt,
    failures,
  };
}

export async function retryNewsletterCampaignFailedDeliveries(campaignId, options = {}) {
  return processNewsletterCampaignDeliveries(campaignId, {
    ...options,
    manual: true,
  });
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
  const testMessages = newsletter.selectedLocales.flatMap((locale) => {
    const newsletterContent = newsletter.contentByLocale[locale];
    const template = buildNewsletterEmailTemplate({
      ...newsletter,
      ...newsletterContent,
      locale,
      ctaUrl: buildLocalizedPublicSiteUrl(locale, newsletter.ctaPath),
      isTest: true,
    });

    return recipients.map((to) => ({
      to,
      subject: template.subject,
      text: template.text,
      html: template.html,
      headers: template.headers,
    }));
  });

  await Promise.all(testMessages.map((message) => sendEmail(message)));

  return {
    message: 'Test email sent.',
    recipients: testMessages.length,
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
    const isCampaignOpen = deliverySummary.status !== 'completed';

    await sendFailureReport(failures);

    return {
      message: isCampaignOpen
        ? 'Newsletter send has pending retries.'
        : deliverySummary.failed > 0
          ? 'Newsletter send finished with failures.'
          : 'Newsletter send finished.',
      campaignStatus: deliverySummary.status,
      sent: deliverySummary.sent,
      failed: deliverySummary.failed,
      skipped: deliverySummary.skipped,
      pendingRetries: deliverySummary.pendingRetries,
      nextProcessAt: deliverySummary.nextProcessAt,
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
  let englishProduct;

  try {
    [product, englishProduct] = await Promise.all([
      getProductById(productId, null, { locale: 'bg' }),
      getProductById(productId, null, { locale: 'en' }),
    ]);
  } catch {
    throw new NewsletterSendError('Product was not found.', 404);
  }

  if (!product) {
    throw new NewsletterSendError('Product was not found.', 404);
  }

  const bgContent = buildProductNewsletterContent(product, 'bg');
  const contentByLocale = {
    bg: bgContent,
  };

  if (isCurrentEnglishProductProjection(englishProduct)) {
    contentByLocale.en = buildProductNewsletterContent(englishProduct, 'en');
  }

  return {
    sourceType: 'product',
    sourceId: String(product._id || productId),
    subject: bgContent.subject,
    contentHtml: bgContent.contentHtml,
    contentText: bgContent.contentText,
    contentByLocale,
    imageUrl: buildPublicSiteUrl(firstProductImage(product) || getDefaultNewsletterImageUrl()),
    ctaUrl: `/products/${productId}`,
    ctaLabel: bgContent.ctaLabel,
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

  const bgContent = buildBlogNewsletterContent(article, 'bg');
  const englishArticle = projectPublicBlogArticle(article, 'en');
  const contentByLocale = {
    bg: bgContent,
  };

  if (englishArticle) {
    contentByLocale.en = buildBlogNewsletterContent(englishArticle, 'en');
  }

  return {
    sourceType: 'blog',
    sourceId: String(article._id || articleId),
    subject: bgContent.subject,
    contentHtml: bgContent.contentHtml,
    contentText: bgContent.contentText,
    contentByLocale,
    imageUrl: buildPublicSiteUrl(blogImage(article) || getDefaultNewsletterImageUrl()),
    ctaUrl: `/blog/${articleId}`,
    ctaLabel: bgContent.ctaLabel,
  };
}
