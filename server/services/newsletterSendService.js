import sanitizeHtml from 'sanitize-html';
import validator from 'validator';
import { sendEmail } from '../helpers/sendEmail.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';
import BlogArticle from '../models/BlogArticle.js';
import { createUnsubscribeToken } from './newsletterService.js';
import { buildNewsletterEmailTemplate } from './newsletterEmailTemplate.js';
import { extractContentText, validateContentJson } from './blogArticlesService.js';
import { getProductById } from './productsServices.js';

const SUBJECT_MAX_LENGTH = 160;
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
]);
const SUPPORTED_SOURCE_TYPES = new Set(['custom', 'product', 'blog']);

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
  };
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
      ctaUrl: buildPublicSiteUrl(`/products/${newsletter.sourceId}`),
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
      ctaUrl: buildPublicSiteUrl(`/blog/${newsletter.sourceId}`),
      imageUrl: buildPublicSiteUrl(blogImage(article) || getDefaultNewsletterImageUrl()),
    };
  }

  return {
    ...newsletter,
    ctaUrl: buildPublicSiteUrl(CUSTOM_CTA_PATH),
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

function buildUnsubscribeUrls(subscriber) {
  const token = createUnsubscribeToken(subscriber);

  return {
    unsubscribeUrl: `${buildPublicSiteUrl('/newsletter/unsubscribe')}?token=${encodeURIComponent(token)}`,
    listUnsubscribeUrl: buildOneClickUnsubscribeUrl(token),
  };
}

function getErrorReason(error) {
  return error?.message || 'Unknown email delivery error';
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

export async function getNewsletterSendStatus() {
  const activeSubscribers = await NewsletterSubscriber.countDocuments({ status: 'active' });

  return { activeSubscribers };
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
    const subscribers = await NewsletterSubscriber.find({ status: 'active' }).sort({ createdAt: 1 });
    const activeSubscribers = subscribers.length;

    if (activeSubscribers === 0) {
      return {
        message: 'No active subscribers.',
        sent: 0,
        failed: 0,
        activeSubscribers: 0,
      };
    }

    let sent = 0;
    const failures = [];

    for (const subscriber of subscribers) {
      const { unsubscribeUrl, listUnsubscribeUrl } = buildUnsubscribeUrls(subscriber);
      const template = buildNewsletterEmailTemplate({
        ...newsletter,
        unsubscribeUrl,
        listUnsubscribeUrl,
      });

      try {
        await sendEmail({
          to: subscriber.email,
          subject: template.subject,
          text: template.text,
          html: template.html,
          headers: template.headers,
        });
        sent += 1;
      } catch (error) {
        failures.push({
          email: subscriber.email,
          reason: getErrorReason(error),
        });
      }
    }

    await sendFailureReport(failures);

    return {
      message: failures.length > 0 ? 'Newsletter send finished with failures.' : 'Newsletter send finished.',
      sent,
      failed: failures.length,
      activeSubscribers,
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
