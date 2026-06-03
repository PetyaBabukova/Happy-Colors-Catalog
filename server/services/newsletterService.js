import crypto from 'crypto';
import validator from 'validator';
import { sendEmail } from '../helpers/sendEmail.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';

const MAX_EMAIL_LENGTH = 254;
const ALLOWED_SUBSCRIBE_FIELDS = new Set(['email', 'consent', 'website', 'formToken']);
const DEFAULT_NEWSLETTER_PUBLIC_SITE_URL = 'https://happycolors.eu';
const SUBSCRIBE_TOKEN_PURPOSE = 'newsletter-subscribe';
const SUBSCRIBE_TOKEN_MAX_AGE_SECONDS = 30 * 60;
const DEFAULT_SUBSCRIBE_TOKEN_MIN_AGE_SECONDS = process.env.NODE_ENV === 'test' ? 0 : 2;
const LEGACY_REACTIVATION_HEURISTIC_MS = 24 * 60 * 60 * 1000;
const GENERIC_SUBSCRIBE_MESSAGE = 'Успешно се абонирахте.';
const GENERIC_UNSUBSCRIBE_MESSAGE = 'Успешно се отписахте.';

export class NewsletterError extends Error {
  constructor(message, statusCode = 400, code = 'newsletter_error') {
    super(message);
    this.name = 'NewsletterError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function getNewsletterSecret() {
  const secret = process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;

  if (!secret) {
    throw new NewsletterError('Newsletter unsubscribe secret is not configured.', 500);
  }

  return secret;
}

function getSubscribeTokenMinAgeSeconds() {
  const configuredValue = Number(process.env.NEWSLETTER_SUBSCRIBE_TOKEN_MIN_AGE_SECONDS);

  if (Number.isFinite(configuredValue) && configuredValue >= 0) {
    return configuredValue;
  }

  return DEFAULT_SUBSCRIBE_TOKEN_MIN_AGE_SECONDS;
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload, secret = getNewsletterSecret()) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function timingSafeEqualStrings(first, second) {
  const firstBuffer = Buffer.from(String(first));
  const secondBuffer = Buffer.from(String(second));

  if (firstBuffer.length !== secondBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function assertSubscribePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new NewsletterError('Невалидни данни за абонамент.');
  }

  const unknownFields = Object.keys(payload).filter((key) => !ALLOWED_SUBSCRIBE_FIELDS.has(key));

  if (unknownFields.length > 0) {
    throw new NewsletterError('Невалидни данни за абонамент.');
  }

  if (typeof payload.email !== 'string') {
    throw new NewsletterError('Моля, въведете валиден email адрес.');
  }

  if (payload.consent !== true) {
    throw new NewsletterError('Моля, потвърдете съгласието си за получаване на новини.');
  }
}

export function isHoneypotSubscribePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }

  return Boolean(String(payload.website ?? '').trim());
}

function assertValidEmail(email) {
  if (!email || email.length > MAX_EMAIL_LENGTH || !validator.isEmail(email)) {
    throw new NewsletterError('Моля, въведете валиден email адрес.');
  }
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

async function upsertSubscriber(email) {
  const now = new Date();
  const existing = await NewsletterSubscriber.findOne({ email });

  if (!existing) {
    try {
      const subscriber = await NewsletterSubscriber.create({
        email,
        status: 'active',
        consentGivenAt: now,
        firstSubscribedAt: now,
        lastSubscribedAt: now,
        subscribeCount: 1,
        hasEverUnsubscribed: false,
        lastStatusChangedAt: now,
      });

      return { subscriber, shouldSendWelcomeEmail: true, alreadyActive: false };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      return upsertSubscriber(email);
    }
  }

  if (existing.status === 'unsubscribed') {
    existing.status = 'active';
    existing.consentGivenAt = now;
    existing.firstSubscribedAt = existing.firstSubscribedAt || existing.createdAt || existing.consentGivenAt;
    existing.lastSubscribedAt = now;
    existing.subscribeCount = Math.max(1, Number(existing.subscribeCount || 1)) + 1;
    existing.hasEverUnsubscribed = true;
    existing.lastStatusChangedAt = now;
    existing.unsubscribedAt = null;
    existing.unsubscribeTokenVersion += 1;
    existing.welcomeEmailSentAt = null;
    await existing.save();

    return { subscriber: existing, shouldSendWelcomeEmail: true, alreadyActive: false };
  }

  return {
    subscriber: existing,
    shouldSendWelcomeEmail: !existing.welcomeEmailSentAt,
    alreadyActive: true,
  };
}

export function createUnsubscribeToken(subscriber) {
  const payload = encodeBase64Url(
    JSON.stringify({
      sub: String(subscriber?._id || ''),
      ver: Number(subscriber?.unsubscribeTokenVersion || 1),
      iat: nowInSeconds(),
    })
  );
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function createSubscribeFormToken() {
  const payload = encodeBase64Url(
    JSON.stringify({
      purpose: SUBSCRIBE_TOKEN_PURPOSE,
      iat: nowInSeconds(),
      // Unique per form render, but intentionally not single-use without a server-side nonce store.
      nonce: crypto.randomBytes(16).toString('base64url'),
    })
  );
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

function buildPublicSiteUrl(pathOrUrl) {
  const publicSiteUrl = String(
    process.env.NEWSLETTER_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.CLIENT_URL ||
      DEFAULT_NEWSLETTER_PUBLIC_SITE_URL
  ).replace(/\/+$/, '');

  return new URL(pathOrUrl, `${publicSiteUrl}/`).toString();
}

export function createUnsubscribePageUrl(token) {
  return `${buildPublicSiteUrl('/newsletter/unsubscribe')}?token=${encodeURIComponent(token)}`;
}

function createUnsubscribeUrl(subscriber) {
  return createUnsubscribePageUrl(createUnsubscribeToken(subscriber));
}

async function sendWelcomeEmail(subscriber) {
  const unsubscribeUrl = createUnsubscribeUrl(subscriber);
  const text = [
    'Вие се абонирахте за новини от Happy Colors.',
    '',
    'Благодарим ви!',
    '',
    `Можете да се отпишете по всяко време тук: ${unsubscribeUrl}`,
  ].join('\n');

  await sendEmail({
    to: subscriber.email,
    subject: 'Абонамент за новини от Happy Colors',
    text,
  });
}

export function verifyUnsubscribeToken(token) {
  const safeToken = String(token ?? '').trim();
  const [payload, signature, extra] = safeToken.split('.');

  if (!payload || !signature || extra !== undefined) {
    throw new NewsletterError('Невалиден линк за отписване.');
  }

  const expectedSignature = signPayload(payload);

  if (!timingSafeEqualStrings(signature, expectedSignature)) {
    throw new NewsletterError('Невалиден линк за отписване.');
  }

  const decoded = safeJsonParse(decodeBase64Url(payload));

  if (
    !decoded ||
    typeof decoded.sub !== 'string' ||
    !decoded.sub ||
    typeof decoded.ver !== 'number' ||
    typeof decoded.iat !== 'number'
  ) {
    throw new NewsletterError('Невалиден линк за отписване.');
  }

  return decoded;
}

export function verifySubscribeFormToken(token, { nowSeconds = nowInSeconds() } = {}) {
  const safeToken = String(token ?? '').trim();
  const [payload, signature, extra] = safeToken.split('.');

  if (!payload || !signature || extra !== undefined) {
    throw new NewsletterError('Невалидни данни за абонамент.', 400, 'invalid_form_token');
  }

  const expectedSignature = signPayload(payload);

  if (!timingSafeEqualStrings(signature, expectedSignature)) {
    throw new NewsletterError('Невалидни данни за абонамент.', 400, 'invalid_form_token');
  }

  const decoded = safeJsonParse(decodeBase64Url(payload));

  if (
    !decoded ||
    decoded.purpose !== SUBSCRIBE_TOKEN_PURPOSE ||
    typeof decoded.iat !== 'number' ||
    typeof decoded.nonce !== 'string' ||
    !decoded.nonce
  ) {
    throw new NewsletterError('Невалидни данни за абонамент.', 400, 'invalid_form_token');
  }

  const ageSeconds = nowSeconds - decoded.iat;

  if (ageSeconds > SUBSCRIBE_TOKEN_MAX_AGE_SECONDS) {
    throw new NewsletterError('Невалидни данни за абонамент.', 400, 'expired_form_token');
  }

  if (ageSeconds < getSubscribeTokenMinAgeSeconds()) {
    throw new NewsletterError('Невалидни данни за абонамент.', 400, 'too_new_form_token');
  }

  return decoded;
}

export function getLegacyReactivationHeuristic(firstDate, consentDate) {
  if (!firstDate || !consentDate) {
    return false;
  }

  return consentDate.getTime() - firstDate.getTime() > LEGACY_REACTIVATION_HEURISTIC_MS;
}

export async function subscribeToNewsletter(payload) {
  if (isHoneypotSubscribePayload(payload)) {
    return { message: GENERIC_SUBSCRIBE_MESSAGE };
  }

  assertSubscribePayload(payload);
  verifySubscribeFormToken(payload.formToken);

  const email = normalizeEmail(payload.email);
  assertValidEmail(email);

  const { subscriber, shouldSendWelcomeEmail } = await upsertSubscriber(email);

  if (shouldSendWelcomeEmail) {
    await sendWelcomeEmail(subscriber);
    subscriber.welcomeEmailSentAt = new Date();
    await subscriber.save();
  }

  return {
    message: GENERIC_SUBSCRIBE_MESSAGE,
  };
}

export async function unsubscribeFromNewsletter(payload = {}) {
  const token = payload?.token;
  let decoded;

  try {
    decoded = verifyUnsubscribeToken(token);
  } catch (error) {
    if (error?.statusCode >= 500) {
      throw error;
    }

    return { message: GENERIC_UNSUBSCRIBE_MESSAGE };
  }

  const subscriber = await NewsletterSubscriber.findById(decoded.sub);

  if (!subscriber || subscriber.unsubscribeTokenVersion !== decoded.ver) {
    return { message: GENERIC_UNSUBSCRIBE_MESSAGE };
  }

  if (subscriber.status !== 'unsubscribed') {
    subscriber.status = 'unsubscribed';
    subscriber.unsubscribedAt = new Date();
    subscriber.hasEverUnsubscribed = true;
    subscriber.lastStatusChangedAt = subscriber.unsubscribedAt;
    await subscriber.save();
  }

  return { message: GENERIC_UNSUBSCRIBE_MESSAGE };
}
