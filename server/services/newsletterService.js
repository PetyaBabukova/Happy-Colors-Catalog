import crypto from 'crypto';
import validator from 'validator';
import { sendEmail } from '../helpers/sendEmail.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';

const MAX_EMAIL_LENGTH = 254;
const ALLOWED_SUBSCRIBE_FIELDS = new Set(['email', 'consent', 'website']);
const GENERIC_SUBSCRIBE_MESSAGE = 'Успешно се абонирахте.';
const DUPLICATE_SUBSCRIBE_MESSAGE = 'Вече имате абонамент за тази страница.';
const GENERIC_UNSUBSCRIBE_MESSAGE = 'Успешно се отписахте.';

export class NewsletterError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'NewsletterError';
    this.statusCode = statusCode;
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

function assertValidEmail(email) {
  if (!email || email.length > MAX_EMAIL_LENGTH || !validator.isEmail(email)) {
    throw new NewsletterError('Моля, въведете валиден email адрес.');
  }
}

function isDuplicateKeyError(error) {
  return error?.code === 11000;
}

async function upsertSubscriber(email) {
  const existing = await NewsletterSubscriber.findOne({ email });

  if (!existing) {
    try {
      const subscriber = await NewsletterSubscriber.create({
        email,
        status: 'active',
        consentGivenAt: new Date(),
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
    existing.consentGivenAt = new Date();
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
      iat: Math.floor(Date.now() / 1000),
    })
  );
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

function createUnsubscribeUrl(subscriber) {
  const baseClientUrl = String(process.env.CLIENT_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const token = createUnsubscribeToken(subscriber);

  return `${baseClientUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
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

export async function subscribeToNewsletter(payload) {
  assertSubscribePayload(payload);

  const honeypot = String(payload.website ?? '').trim();

  if (honeypot) {
    return { message: GENERIC_SUBSCRIBE_MESSAGE, honeypot: true };
  }

  const email = normalizeEmail(payload.email);
  assertValidEmail(email);

  const { subscriber, shouldSendWelcomeEmail, alreadyActive } = await upsertSubscriber(email);

  if (shouldSendWelcomeEmail) {
    await sendWelcomeEmail(subscriber);
    subscriber.welcomeEmailSentAt = new Date();
    await subscriber.save();
  }

  return {
    message: alreadyActive ? DUPLICATE_SUBSCRIBE_MESSAGE : GENERIC_SUBSCRIBE_MESSAGE,
    status: alreadyActive ? 'already_subscribed' : 'subscribed',
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
    await subscriber.save();
  }

  return { message: GENERIC_UNSUBSCRIBE_MESSAGE };
}
