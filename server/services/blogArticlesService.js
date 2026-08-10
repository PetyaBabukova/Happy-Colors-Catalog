import mongoose from 'mongoose';
import sanitizeHtml from 'sanitize-html';
import BlogArticle from '../models/BlogArticle.js';
import HomeBanner from '../models/HomeBanner.js';
import Product from '../models/Product.js';
import { deleteImageFromGCS, getBucketName } from '../helpers/gcsImageHelper.js';
import { validateGcsPublicAssetUrl } from '../../shared/gcsCore.js';
import { projectPublicBlogArticle } from './localization/publicProjection.js';

const CREATE_FIELDS = new Set([
  'title',
  'contentHtml',
  'contentJson',
  'heroImageUrl',
  'thumbnailImageUrl',
  'heroImageAlt',
  'seoTitle',
  'seoDescription',
]);
const EDIT_FIELDS = new Set([
  'title',
  'contentHtml',
  'contentJson',
  'heroImageUrl',
  'thumbnailImageUrl',
  'heroImageAlt',
  'seoTitle',
  'seoDescription',
]);
const TEXT_LIMITS = {
  title: 160,
  heroImageAlt: 180,
  seoTitle: 70,
  seoDescription: 170,
};
const MAX_CONTENT_JSON_BYTES = 100 * 1024;
const EXCERPT_MAX_LENGTH = 240;
const BLOG_HERO_PREFIX = 'blog/articles/hero/';
const BLOG_THUMBNAIL_PREFIX = 'blog/articles/thumbnails/';
const MAX_CONTENT_JSON_DEPTH = 30;
const MAX_CONTENT_JSON_CHILDREN = 500;
const PUBLIC_DETAIL_PROJECTION = {
  title: 1,
  contentHtml: 1,
  contentText: 1,
  excerpt: 1,
  heroImageUrl: 1,
  thumbnailImageUrl: 1,
  heroImageAlt: 1,
  seoTitle: 1,
  seoDescription: 1,
  publishedAt: 1,
  createdAt: 1,
  updatedAt: 1,
  sourceRevision: 1,
  translations: 1,
};
const ALLOWED_NODE_TYPES = new Set([
  'doc',
  'paragraph',
  'text',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'hardBreak',
  'blockquote',
]);
const ALLOWED_MARK_TYPES = new Set(['bold', 'italic', 'underline', 'link', 'textStyle']);
const ALLOWED_TEXT_ALIGN = new Set(['left', 'center', 'right']);
const SAFE_COLOR_RE = /^(#[0-9a-f]{3}|#[0-9a-f]{4}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|(black|white|red|green|blue|yellow|orange|purple|pink|brown|gray|grey))$/i;
const SAFE_FONT_SIZE_RE = /^(1[0-9]|2[0-9]|3[0-6])px$/;
const SAFE_FONT_FAMILY_RE = /^(Arial|Georgia|Courier New)(,\s*(sans-serif|serif|monospace))?$/i;

export function createError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertUser(userId) {
  if (!userId) {
    throw createError('Authentication is required.', 401);
  }
}

function assertValidArticleId(articleId) {
  if (!mongoose.Types.ObjectId.isValid(String(articleId || ''))) {
    throw createError('Blog article was not found.', 404);
  }
}

function hasOwn(source, key) {
  return Object.prototype.hasOwnProperty.call(source || {}, key);
}

function hasChangedField(target, updates, field) {
  if (!hasOwn(updates, field)) {
    return false;
  }

  return String(target?.[field] ?? '').trim() !== String(updates[field] ?? '').trim();
}

function hasBlogArticleSourceCopyChange(target, updates = {}) {
  return (
    hasChangedField(target, updates, 'title') ||
    hasChangedField(target, updates, 'contentHtml') ||
    hasChangedField(target, updates, 'heroImageAlt') ||
    hasChangedField(target, updates, 'seoTitle') ||
    hasChangedField(target, updates, 'seoDescription')
  );
}

function pickFields(source = {}, fields) {
  const picked = {};

  for (const [key, value] of Object.entries(source || {})) {
    if (fields.has(key)) {
      picked[key] = value;
    }
  }

  return picked;
}

function normalizeRequiredText(fieldName, value) {
  const text = String(value || '').trim();

  if (!text) {
    throw createError(`${fieldName} is required.`);
  }

  return text;
}

function normalizeOptionalText(value) {
  return String(value || '').trim();
}

function validateTextLength(fieldName, value, maxLength) {
  if (String(value || '').length > maxLength) {
    throw createError(`${fieldName} cannot be longer than ${maxLength} characters.`);
  }
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(parseInt(codePoint, 16)))
    .replace(/&#([0-9]+);/g, (_, codePoint) => String.fromCodePoint(parseInt(codePoint, 10)))
    .replace(/&hellip;/gi, '...')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

export function sanitizeArticleHtml(contentHtml) {
  const rawHtml = String(contentHtml || '').trim();

  if (!rawHtml) {
    throw createError('Article body is required.');
  }

  const sanitized = sanitizeHtml(rawHtml, {
    allowedTags: [
      'h2',
      'h3',
      'h4',
      'p',
      'strong',
      'em',
      'u',
      's',
      'sub',
      'sup',
      'ul',
      'ol',
      'li',
      'br',
      'blockquote',
      'a',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
      span: ['style'],
      p: ['style'],
      h2: ['style'],
      h3: ['style'],
      h4: ['style'],
      li: ['style'],
      blockquote: ['style'],
    },
    allowedSchemes: ['https', 'mailto'],
    allowedStyles: {
      '*': {
        color: [SAFE_COLOR_RE],
        'background-color': [SAFE_COLOR_RE],
        'font-family': [SAFE_FONT_FAMILY_RE],
        'font-size': [SAFE_FONT_SIZE_RE],
        'text-align': [/^(left|center|right)$/],
      },
    },
    transformTags: {
      b: 'strong',
      i: 'em',
      strike: 's',
      div: 'p',
      a(tagName, attribs) {
        const nextAttribs = { ...attribs };

        if (nextAttribs.target === '_blank') {
          nextAttribs.rel = 'noopener noreferrer';
        }

        return { tagName, attribs: nextAttribs };
      },
    },
  }).trim();

  if (!extractContentText(sanitized)) {
    throw createError('Article body is required.');
  }

  return sanitized;
}

export function extractContentText(contentHtml) {
  const htmlWithBlockSpacing = String(contentHtml || '').replace(
    /<\/?(p|h[1-6]|li|ul|ol|blockquote|br)\b[^>]*>/gi,
    ' '
  );
  const textOnly = sanitizeHtml(htmlWithBlockSpacing, {
    allowedTags: [],
    allowedAttributes: {},
  });

  return decodeHtmlEntities(textOnly).replace(/\s+/g, ' ').trim();
}

export function generateExcerpt(contentText) {
  const normalized = String(contentText || '').replace(/\s+/g, ' ').trim();

  if (normalized.length <= EXCERPT_MAX_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, EXCERPT_MAX_LENGTH - 3).trimEnd()}...`;
}

function validateAttrs(attrs = {}, allowedAttrs, nodeType) {
  if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) {
    throw createError(`Invalid attrs for ${nodeType}.`);
  }

  for (const key of Object.keys(attrs)) {
    if (!allowedAttrs.has(key)) {
      throw createError(`Unexpected contentJson attr: ${key}.`);
    }
  }
}

function validateTextStyleAttrs(attrs = {}) {
  validateAttrs(attrs, new Set(['color', 'fontSize']), 'textStyle');

  if (attrs.color && !SAFE_COLOR_RE.test(String(attrs.color))) {
    throw createError('Invalid contentJson color.');
  }

  if (attrs.fontSize && !SAFE_FONT_SIZE_RE.test(String(attrs.fontSize))) {
    throw createError('Invalid contentJson font size.');
  }
}

function validateLinkAttrs(attrs = {}) {
  validateAttrs(attrs, new Set(['href', 'target', 'rel']), 'link');

  let parsedUrl;

  try {
    parsedUrl = new URL(String(attrs.href || ''));
  } catch {
    throw createError('Invalid contentJson link href.');
  }

  if (!['https:', 'mailto:'].includes(parsedUrl.protocol)) {
    throw createError('Invalid contentJson link href.');
  }

  if (attrs.target && attrs.target !== '_blank') {
    throw createError('Invalid contentJson link target.');
  }

  if (attrs.rel && !/^[a-z -]+$/i.test(String(attrs.rel))) {
    throw createError('Invalid contentJson link rel.');
  }

  if (attrs.target === '_blank') {
    const relTokens = String(attrs.rel || '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (!relTokens.includes('noopener') || !relTokens.includes('noreferrer')) {
      throw createError('Invalid contentJson link rel.');
    }
  }
}

function validateMarks(marks = []) {
  if (typeof marks === 'undefined') {
    return;
  }

  if (!Array.isArray(marks)) {
    throw createError('Invalid contentJson marks.');
  }

  for (const mark of marks) {
    if (!mark || typeof mark !== 'object' || Array.isArray(mark)) {
      throw createError('Invalid contentJson mark.');
    }

    const type = mark.type;

    if (!ALLOWED_MARK_TYPES.has(type)) {
      throw createError(`Unsupported contentJson mark: ${type}.`);
    }

    for (const key of Object.keys(mark)) {
      if (!['type', 'attrs'].includes(key)) {
        throw createError(`Unexpected contentJson mark key: ${key}.`);
      }
    }

    if (type === 'link') {
      validateLinkAttrs(mark.attrs || {});
    } else if (type === 'textStyle') {
      validateTextStyleAttrs(mark.attrs || {});
    } else if (mark.attrs && Object.keys(mark.attrs).length > 0) {
      throw createError(`Unexpected contentJson attrs for ${type}.`);
    }
  }
}

function validateNode(node, { isRoot = false, depth = 0 } = {}) {
  if (depth > MAX_CONTENT_JSON_DEPTH) {
    throw createError('contentJson is nested too deeply.');
  }

  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    throw createError('Invalid contentJson node.');
  }

  const type = node.type;

  if (!ALLOWED_NODE_TYPES.has(type)) {
    throw createError(`Unsupported contentJson node: ${type}.`);
  }

  for (const key of Object.keys(node)) {
    if (!['type', 'attrs', 'content', 'text', 'marks'].includes(key)) {
      throw createError(`Unexpected contentJson node key: ${key}.`);
    }
  }

  if (isRoot && type !== 'doc') {
    throw createError('contentJson root must be a doc.');
  }

  if (type === 'heading') {
    validateAttrs(node.attrs || {}, new Set(['level', 'textAlign']), type);

    if (![2, 3, 4].includes(Number(node.attrs?.level))) {
      throw createError('Invalid contentJson heading level.');
    }
  } else if (['paragraph', 'listItem', 'blockquote'].includes(type)) {
    validateAttrs(node.attrs || {}, new Set(['textAlign']), type);
  } else if (node.attrs && Object.keys(node.attrs).length > 0) {
    throw createError(`Unexpected contentJson attrs for ${type}.`);
  }

  if (node.attrs?.textAlign && !ALLOWED_TEXT_ALIGN.has(node.attrs.textAlign)) {
    throw createError('Invalid contentJson textAlign.');
  }

  if (type === 'text') {
    if (typeof node.text !== 'string') {
      throw createError('contentJson text node requires text.');
    }

    validateMarks(node.marks);
  } else if (typeof node.text !== 'undefined') {
    throw createError(`Unexpected contentJson text for ${type}.`);
  }

  if (typeof node.content !== 'undefined') {
    if (!Array.isArray(node.content)) {
      throw createError('contentJson content must be an array.');
    }

    if (node.content.length > MAX_CONTENT_JSON_CHILDREN) {
      throw createError('contentJson has too many child nodes.');
    }

    node.content.forEach((child) => validateNode(child, { depth: depth + 1 }));
  }
}

export function validateContentJson(contentJson) {
  if (typeof contentJson === 'undefined' || contentJson === null || contentJson === '') {
    return null;
  }

  let serialized;

  try {
    serialized = JSON.stringify(contentJson);
  } catch {
    throw createError('contentJson must be serializable.');
  }

  if (Buffer.byteLength(serialized, 'utf8') > MAX_CONTENT_JSON_BYTES) {
    throw createError('contentJson cannot be larger than 100 KB.');
  }

  validateNode(contentJson, { isRoot: true, depth: 0 });

  return contentJson;
}

export function validateBlogImageUrl(imageUrl, expectedPrefix) {
  const validation = validateGcsPublicAssetUrl({
    assetUrl: imageUrl,
    bucketName: getBucketName(),
    expectedPrefix,
    label: 'Article image',
    messages: {
      prefix: 'Article image URL must point to the expected blog storage path.',
    },
  });

  if (!validation.ok) {
    throw createError(validation.message, validation.statusCode || 400);
  }

  return validation.value;
}

function normalizeArticleFields(data = {}, { requireAll = false } = {}) {
  const normalized = {};

  if (requireAll || hasOwn(data, 'title')) {
    const title = normalizeRequiredText('Title', data.title);

    validateTextLength('Title', title, TEXT_LIMITS.title);
    normalized.title = title;
  }

  if (requireAll || hasOwn(data, 'contentHtml')) {
    const contentHtml = sanitizeArticleHtml(data.contentHtml);

    normalized.contentHtml = contentHtml;
    normalized.contentText = extractContentText(contentHtml);
    normalized.excerpt = generateExcerpt(normalized.contentText);
  }

  if (requireAll || hasOwn(data, 'contentJson')) {
    normalized.contentJson = validateContentJson(data.contentJson);
  }

  if (requireAll || hasOwn(data, 'heroImageUrl')) {
    normalized.heroImageUrl = validateBlogImageUrl(data.heroImageUrl, BLOG_HERO_PREFIX);
  }

  if (requireAll || hasOwn(data, 'thumbnailImageUrl')) {
    normalized.thumbnailImageUrl = validateBlogImageUrl(data.thumbnailImageUrl, BLOG_THUMBNAIL_PREFIX);
  }

  if (requireAll || hasOwn(data, 'heroImageAlt')) {
    const heroImageAlt = normalizeRequiredText('Hero image alt text', data.heroImageAlt);

    validateTextLength('Hero image alt text', heroImageAlt, TEXT_LIMITS.heroImageAlt);
    normalized.heroImageAlt = heroImageAlt;
  }

  if (hasOwn(data, 'seoTitle')) {
    const seoTitle = normalizeOptionalText(data.seoTitle);

    validateTextLength('SEO title', seoTitle, TEXT_LIMITS.seoTitle);
    normalized.seoTitle = seoTitle;
  } else if (requireAll) {
    normalized.seoTitle = '';
  }

  if (hasOwn(data, 'seoDescription')) {
    const seoDescription = normalizeOptionalText(data.seoDescription);

    validateTextLength('SEO description', seoDescription, TEXT_LIMITS.seoDescription);
    normalized.seoDescription = seoDescription;
  } else if (requireAll) {
    normalized.seoDescription = '';
  }

  return normalized;
}

async function findArticleOrThrow(articleId) {
  assertValidArticleId(articleId);

  const article = await BlogArticle.findById(articleId);

  if (!article) {
    throw createError('Blog article was not found.', 404);
  }

  return article;
}

async function isBlogImageReferenced(assetUrl, { excludeArticleId = null } = {}) {
  if (!assetUrl) {
    return false;
  }

  const query = {
    ...(excludeArticleId ? { _id: { $ne: excludeArticleId } } : {}),
    $or: [{ heroImageUrl: assetUrl }, { thumbnailImageUrl: assetUrl }],
  };

  const [articleExists, bannerExists, productExists] = await Promise.all([
    BlogArticle.exists(query),
    HomeBanner.exists({
      $or: [{ imageUrl: assetUrl }, { mobileImageUrl: assetUrl }],
    }),
    Product.exists({
      $or: [
        { imageUrl: assetUrl },
        { imageUrls: assetUrl },
        { 'videos.url': assetUrl },
        { 'videos.posterUrl': assetUrl },
        { 'draftContent.imageUrl': assetUrl },
        { 'draftContent.imageUrls': assetUrl },
        { 'draftContent.videos.url': assetUrl },
        { 'draftContent.videos.posterUrl': assetUrl },
      ],
    }),
  ]);

  return Boolean(articleExists || bannerExists || productExists);
}

async function deleteBlogImageIfUnreferenced(assetUrl, options = {}) {
  if (!assetUrl || (await isBlogImageReferenced(assetUrl, options))) {
    return;
  }

  try {
    await deleteImageFromGCS(assetUrl, { throwOnError: options.throwOnError === true });
  } catch (error) {
    console.error('Error while deleting old blog article image:', error);
    if (options.throwOnError) {
      throw error;
    }
  }
}

function serializeArticle(article) {
  return typeof article.toObject === 'function' ? article.toObject() : article;
}

function ensurePublishedState(article) {
  article.status = 'published';

  if (!article.publishedAt) {
    article.publishedAt = article.createdAt || new Date();
  }
}

function stripPublicBlogArticleDetailFields(article) {
  if (!article || typeof article !== 'object') {
    return article;
  }

  const {
    contentHtml,
    contentText,
    heroImageUrl,
    ...summaryArticle
  } = article;

  return summaryArticle;
}

export async function getPublicBlogArticles({ locale = 'bg' } = {}) {
  const articles = await BlogArticle.find({ archivedAt: null })
    .select(PUBLIC_DETAIL_PROJECTION)
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean();

  const publicArticles = [];
  let hasFeaturedArticle = false;

  for (const article of articles) {
    const projectedArticle = hasFeaturedArticle
      ? projectPublicBlogArticle(
          stripPublicBlogArticleDetailFields(article),
          locale,
          { includeContent: false }
        )
      : projectPublicBlogArticle(article, locale);

    if (!projectedArticle) {
      continue;
    }

    publicArticles.push(projectedArticle);
    hasFeaturedArticle = true;
  }

  return publicArticles;
}

export async function getAdminBlogArticles(userId) {
  assertUser(userId);

  // V1 follows the trusted-operator model: any authenticated operator can manage
  // the full blog queue.
  return BlogArticle.find().sort({ updatedAt: -1 }).lean();
}

export async function getPublicBlogArticleById(articleId, { locale = 'bg' } = {}) {
  assertValidArticleId(articleId);

  const article = await BlogArticle.findOne({
    _id: articleId,
    archivedAt: null,
  })
    .select(PUBLIC_DETAIL_PROJECTION)
    .lean();

  if (!article) {
    throw createError('Blog article was not found.', 404);
  }

  const projectedArticle = projectPublicBlogArticle(article, locale);

  if (!projectedArticle) {
    throw createError('Blog article was not found.', 404);
  }

  return projectedArticle;
}

export async function getAdminBlogArticleById(articleId, userId) {
  assertUser(userId);
  assertValidArticleId(articleId);

  const article = await BlogArticle.findById(articleId).lean();

  if (!article) {
    throw createError('Blog article was not found.', 404);
  }

  return article;
}

export async function createBlogArticle(data, userId) {
  assertUser(userId);

  const picked = pickFields(data, CREATE_FIELDS);

  const article = new BlogArticle({
    ...normalizeArticleFields(picked, { requireAll: true }),
    status: 'published',
    publishedAt: new Date(),
    owner: userId,
  });
  const savedArticle = await article.save();

  return serializeArticle(savedArticle);
}

export async function editBlogArticle(articleId, data, userId) {
  assertUser(userId);

  if (hasOwn(data, 'status')) {
    throw createError('Article status cannot be changed.');
  }

  const article = await findArticleOrThrow(articleId);
  const previousHeroImageUrl = article.heroImageUrl;
  const previousThumbnailImageUrl = article.thumbnailImageUrl;
  const picked = pickFields(data, EDIT_FIELDS);
  const nextData = normalizeArticleFields(picked, { requireAll: false });
  const hasSourceCopyChange = hasBlogArticleSourceCopyChange(article, nextData);

  ensurePublishedState(article);

  if (hasSourceCopyChange) {
    article.sourceRevision = (Number(article.sourceRevision) || 1) + 1;
  }

  for (const [key, value] of Object.entries(nextData)) {
    article[key] = value;
  }

  await article.save();

  if (nextData.heroImageUrl && nextData.heroImageUrl !== previousHeroImageUrl) {
    await deleteBlogImageIfUnreferenced(previousHeroImageUrl, { excludeArticleId: article._id });
  }

  if (nextData.thumbnailImageUrl && nextData.thumbnailImageUrl !== previousThumbnailImageUrl) {
    await deleteBlogImageIfUnreferenced(previousThumbnailImageUrl, {
      excludeArticleId: article._id,
    });
  }

  return serializeArticle(article);
}

export async function deleteBlogArticle(articleId, userId) {
  assertUser(userId);

  const article = await findArticleOrThrow(articleId);
  const imageUrls = [...new Set([article.heroImageUrl, article.thumbnailImageUrl].filter(Boolean))];

  for (const imageUrl of imageUrls) {
    await deleteBlogImageIfUnreferenced(imageUrl, {
      excludeArticleId: article._id,
      throwOnError: true,
    });
  }

  await BlogArticle.findByIdAndDelete(article._id);

  return { message: 'Blog article was deleted successfully.' };
}
