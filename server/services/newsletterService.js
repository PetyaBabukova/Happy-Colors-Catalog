import crypto from 'crypto';
import validator from 'validator';
import { sendEmail } from '../helpers/sendEmail.js';
import NewsletterSubscriber from '../models/NewsletterSubscriber.js';
import { PUBLIC_LOCALES } from '../models/localizationSchemas.js';

const MAX_EMAIL_LENGTH = 254;
const ALLOWED_SUBSCRIBE_FIELDS = new Set(['email', 'consent', 'website', 'formToken', 'locale']);
const DEFAULT_NEWSLETTER_PUBLIC_SITE_URL = 'https://happycolors.eu';
const SUBSCRIBE_TOKEN_PURPOSE = 'newsletter-subscribe';
const CONFIRMATION_TOKEN_PURPOSE = 'newsletter-confirm';
const DEFAULT_NEWSLETTER_LOCALE = 'bg';
const SUBSCRIBE_TOKEN_MAX_AGE_SECONDS = 30 * 60;
const CONFIRMATION_TOKEN_MAX_AGE_SECONDS = 24 * 60 * 60;
const DEFAULT_SUBSCRIBE_TOKEN_MIN_AGE_SECONDS = process.env.NODE_ENV === 'test' ? 0 : 2;
const LEGACY_REACTIVATION_HEURISTIC_MS = 24 * 60 * 60 * 1000;
const GENERIC_SUBSCRIBE_MESSAGE = 'Благодарим ви. Ако е необходимо потвърждение, ще получите имейл с линк за абонамента.';
const GENERIC_CONFIRM_MESSAGE = 'Абонаментът ви е потвърден успешно.';
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

function normalizeNewsletterLocale(locale) {
  const normalizedLocale = String(locale || DEFAULT_NEWSLETTER_LOCALE).trim().toLowerCase();

  if (!PUBLIC_LOCALES.includes(normalizedLocale)) {
    throw new NewsletterError('Invalid newsletter language.', 400, 'invalid_newsletter_locale');
  }

  return normalizedLocale;
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

export function createNewsletterConfirmationToken(email, subscriber = null, options = {}) {
  const normalizedEmail = normalizeEmail(email);
  assertValidEmail(normalizedEmail);
  const requestedLocale = options.locale ? normalizeNewsletterLocale(options.locale) : '';

  const tokenPayload = {
    purpose: CONFIRMATION_TOKEN_PURPOSE,
    email: normalizedEmail,
    iat: nowInSeconds(),
    nonce: crypto.randomBytes(16).toString('base64url'),
  };

  if (subscriber) {
    tokenPayload.ver = Number(subscriber.unsubscribeTokenVersion || 1);
  }

  if (requestedLocale) {
    tokenPayload.locale = requestedLocale;
  }

  if (options.localeChangeRequestVersion !== undefined) {
    tokenPayload.localeVer = Number(options.localeChangeRequestVersion);
  }

  const payload = encodeBase64Url(JSON.stringify(tokenPayload));
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

function isLocalOrPrivateSiteUrl(value) {
  try {
    const url = new URL(value);

    return (
      /^https?:$/.test(url.protocol) &&
      /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(url.hostname)
    );
  } catch {
    return false;
  }
}

function buildPublicSiteUrl(pathOrUrl, { allowClientUrlFallback = true } = {}) {
  const publicSiteUrl = String(
    process.env.NEWSLETTER_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (allowClientUrlFallback ? process.env.CLIENT_URL : '') ||
      DEFAULT_NEWSLETTER_PUBLIC_SITE_URL
  ).replace(/\/+$/, '');

  const allowsLocalConfirmationUrl = ['development', 'test'].includes(process.env.NODE_ENV);

  if (!allowClientUrlFallback && !allowsLocalConfirmationUrl && isLocalOrPrivateSiteUrl(publicSiteUrl)) {
    throw new NewsletterError('Newsletter public site URL is not configured for confirmation links.', 500);
  }

  return new URL(pathOrUrl, `${publicSiteUrl}/`).toString();
}

function buildLocalizedNewsletterPath(locale, path) {
  return `/${normalizeNewsletterLocale(locale)}${path}`;
}

export function createUnsubscribePageUrl(token, { locale = DEFAULT_NEWSLETTER_LOCALE } = {}) {
  return `${buildPublicSiteUrl(buildLocalizedNewsletterPath(locale, '/newsletter/unsubscribe'))}?token=${encodeURIComponent(token)}`;
}

export function createNewsletterConfirmationPageUrl(token, { locale = DEFAULT_NEWSLETTER_LOCALE } = {}) {
  return `${buildPublicSiteUrl(buildLocalizedNewsletterPath(locale, '/newsletter/confirm'), {
    allowClientUrlFallback: false,
  })}#token=${encodeURIComponent(token)}`;
}

function createUnsubscribeUrl(subscriber) {
  return createUnsubscribePageUrl(createUnsubscribeToken(subscriber), {
    locale: subscriber?.preferredLocale || DEFAULT_NEWSLETTER_LOCALE,
  });
}

async function sendWelcomeEmail(subscriber) {
  const locale = normalizeNewsletterLocale(subscriber?.preferredLocale);

  if (locale === 'en') {
    const unsubscribeUrl = createUnsubscribeUrl(subscriber);

    await sendEmail({
      to: subscriber.email,
      subject: 'Happy Colors newsletter subscription',
      text: [
        'You are subscribed to Happy Colors news.',
        '',
        'Thank you!',
        '',
        `You can unsubscribe at any time here: ${unsubscribeUrl}`,
      ].join('\n'),
    });
    return;
  }

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

async function sendWelcomeEmailAndMark(subscriber) {
  await sendWelcomeEmail(subscriber);
  subscriber.welcomeEmailSentAt = new Date();
  await subscriber.save();
}

async function sendNewsletterConfirmationEmail(email, confirmationUrl, locale = DEFAULT_NEWSLETTER_LOCALE) {
  if (normalizeNewsletterLocale(locale) === 'en') {
    await sendEmail({
      to: email,
      subject: 'Confirm your Happy Colors newsletter subscription',
      text: [
        'We received a request to subscribe to Happy Colors news.',
        '',
        'Please confirm your subscription here:',
        confirmationUrl,
        '',
        'This link is valid for 24 hours. If you did not request this subscription, you can ignore this email.',
      ].join('\n'),
    });
    return;
  }

  const text = [
    'Получихме заявка за абонамент за новини от Happy Colors.',
    '',
    'Моля, потвърдете абонамента си тук:',
    confirmationUrl,
    '',
    'Линкът е валиден 24 часа. Ако не сте заявявали този абонамент, просто игнорирайте този имейл.',
  ].join('\n');

  await sendEmail({
    to: email,
    subject: 'Потвърдете абонамента си за новини от Happy Colors',
    text,
  });
}

function logNewsletterSideEffectFailure(event, error, subscriber = null) {
  console.error(event, {
    message: error?.message || 'Unknown error',
    name: error?.name || 'Error',
    subscriberId: subscriber?._id ? String(subscriber._id) : undefined,
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

export function verifyNewsletterConfirmationToken(token, { nowSeconds = nowInSeconds() } = {}) {
  const safeToken = String(token ?? '').trim();
  const [payload, signature, extra] = safeToken.split('.');
  const invalidError = () =>
    new NewsletterError('Линкът за потвърждение е невалиден или изтекъл.', 400, 'invalid_confirmation_token');

  if (!payload || !signature || extra !== undefined) {
    throw invalidError();
  }

  const expectedSignature = signPayload(payload);

  if (!timingSafeEqualStrings(signature, expectedSignature)) {
    throw invalidError();
  }

  const decoded = safeJsonParse(decodeBase64Url(payload));

  if (
    !decoded ||
    decoded.purpose !== CONFIRMATION_TOKEN_PURPOSE ||
    typeof decoded.email !== 'string' ||
    typeof decoded.iat !== 'number' ||
    typeof decoded.nonce !== 'string' ||
    !decoded.nonce ||
    (decoded.ver !== undefined && (!Number.isInteger(decoded.ver) || decoded.ver < 1)) ||
    (decoded.locale !== undefined && !PUBLIC_LOCALES.includes(decoded.locale)) ||
    (decoded.localeVer !== undefined && (!Number.isInteger(decoded.localeVer) || decoded.localeVer < 1))
  ) {
    throw invalidError();
  }

  const normalizedEmail = normalizeEmail(decoded.email);

  if (!normalizedEmail || normalizedEmail.length > MAX_EMAIL_LENGTH || !validator.isEmail(normalizedEmail)) {
    throw invalidError();
  }

  if (normalizedEmail !== decoded.email) {
    throw invalidError();
  }

  if (nowSeconds - decoded.iat > CONFIRMATION_TOKEN_MAX_AGE_SECONDS) {
    throw new NewsletterError(
      'Линкът за потвърждение е изтекъл. Моля, изпратете формата за абонамент отново.',
      400,
      'expired_confirmation_token'
    );
  }

  return {
    ...decoded,
    email: normalizedEmail,
  };
}

export function getLegacyReactivationHeuristic(firstDate, consentDate) {
  if (!firstDate || !consentDate) {
    return false;
  }

  return consentDate.getTime() - firstDate.getTime() > LEGACY_REACTIVATION_HEURISTIC_MS;
}

export async function requestNewsletterSubscription(payload) {
  if (isHoneypotSubscribePayload(payload)) {
    return { message: GENERIC_SUBSCRIBE_MESSAGE };
  }

  assertSubscribePayload(payload);
  verifySubscribeFormToken(payload.formToken);

  const email = normalizeEmail(payload.email);
  const locale = normalizeNewsletterLocale(payload.locale);
  assertValidEmail(email);

  const existing = await NewsletterSubscriber.findOne({ email });

  if (existing?.status === 'active') {
    if (existing.preferredLocale === locale && existing.pendingPreferredLocale) {
      existing.pendingPreferredLocale = null;
      existing.pendingLocaleRequestedAt = null;
      existing.localeChangeRequestVersion = Math.max(1, Number(existing.localeChangeRequestVersion || 1)) + 1;
      await existing.save();
    }

    if (existing.preferredLocale !== locale) {
      existing.pendingPreferredLocale = locale;
      existing.pendingLocaleRequestedAt = new Date();
      existing.localeChangeRequestVersion = Math.max(1, Number(existing.localeChangeRequestVersion || 1)) + 1;
      await existing.save();

      const confirmationToken = createNewsletterConfirmationToken(email, existing, {
        locale,
        localeChangeRequestVersion: existing.localeChangeRequestVersion,
      });
      const confirmationUrl = createNewsletterConfirmationPageUrl(confirmationToken, { locale });

      return {
        message: GENERIC_SUBSCRIBE_MESSAGE,
        afterResponse: async () => {
          await sendNewsletterConfirmationEmail(email, confirmationUrl, locale);
        },
      };
    }

    return {
      message: GENERIC_SUBSCRIBE_MESSAGE,
      afterResponse: existing.welcomeEmailSentAt
        ? null
        : async () => {
            await sendWelcomeEmailAndMark(existing);
          },
    };
  }

  const confirmationToken = createNewsletterConfirmationToken(email, existing, { locale });
  const confirmationUrl = createNewsletterConfirmationPageUrl(confirmationToken, { locale });

  return {
    message: GENERIC_SUBSCRIBE_MESSAGE,
    afterResponse: async () => {
      await sendNewsletterConfirmationEmail(email, confirmationUrl, locale);
    },
  };
}

async function createConfirmedSubscriber(email, locale = DEFAULT_NEWSLETTER_LOCALE) {
  const now = new Date();

  try {
    const subscriber = await NewsletterSubscriber.create({
      email,
      status: 'active',
      consentGivenAt: now,
      confirmedAt: now,
      firstSubscribedAt: now,
      lastSubscribedAt: now,
      subscribeCount: 1,
      hasEverUnsubscribed: false,
      lastStatusChangedAt: now,
      unsubscribedAt: null,
      preferredLocale: normalizeNewsletterLocale(locale),
      pendingPreferredLocale: null,
      pendingLocaleRequestedAt: null,
    });

    return { subscriber, shouldSendWelcomeEmail: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    return null;
  }
}

function assertFreshConfirmationForUnsubscribed(subscriber, decoded) {
  if (decoded.ver !== undefined) {
    if (decoded.ver !== subscriber.unsubscribeTokenVersion) {
      throw new NewsletterError('Линкът за потвърждение е невалиден или изтекъл.', 400, 'invalid_confirmation_token');
    }

    return;
  }

  if (!subscriber.unsubscribedAt) {
    throw new NewsletterError('Линкът за потвърждение е невалиден или изтекъл.', 400, 'invalid_confirmation_token');
  }

  if (decoded.iat * 1000 <= subscriber.unsubscribedAt.getTime()) {
    throw new NewsletterError('Линкът за потвърждение е невалиден или изтекъл.', 400, 'invalid_confirmation_token');
  }
}

async function reactivateConfirmedSubscriber(subscriber, locale = DEFAULT_NEWSLETTER_LOCALE) {
  const now = new Date();

  subscriber.status = 'active';
  subscriber.consentGivenAt = now;
  subscriber.confirmedAt = now;
  subscriber.firstSubscribedAt = subscriber.firstSubscribedAt || subscriber.createdAt || subscriber.consentGivenAt;
  subscriber.lastSubscribedAt = now;
  subscriber.subscribeCount = Math.max(1, Number(subscriber.subscribeCount || 1)) + 1;
  subscriber.hasEverUnsubscribed = true;
  subscriber.lastStatusChangedAt = now;
  subscriber.unsubscribedAt = null;
  subscriber.unsubscribeTokenVersion += 1;
  subscriber.welcomeEmailSentAt = null;
  subscriber.preferredLocale = normalizeNewsletterLocale(locale);
  subscriber.pendingPreferredLocale = null;
  subscriber.pendingLocaleRequestedAt = null;
  await subscriber.save();

  return { subscriber, shouldSendWelcomeEmail: true };
}

function assertLatestLocaleChangeConfirmation(subscriber, decoded) {
  const locale = normalizeNewsletterLocale(decoded.locale);

  if (
    decoded.localeVer === Number(subscriber.localeChangeRequestVersion) &&
    subscriber.preferredLocale === locale &&
    !subscriber.pendingPreferredLocale
  ) {
    return false;
  }

  if (
    decoded.localeVer !== Number(subscriber.localeChangeRequestVersion) ||
    subscriber.pendingPreferredLocale !== locale
  ) {
    throw new NewsletterError('The newsletter language confirmation link is no longer valid.', 400, 'invalid_locale_change_token');
  }

  return true;
}

export async function confirmNewsletterSubscription(payload = {}) {
  const decoded = verifyNewsletterConfirmationToken(payload?.token);
  const decodedLocale = decoded.locale ? normalizeNewsletterLocale(decoded.locale) : DEFAULT_NEWSLETTER_LOCALE;
  let subscriber = await NewsletterSubscriber.findOne({ email: decoded.email });
  let shouldSendWelcomeEmail = false;

  if (!subscriber) {
    const created = await createConfirmedSubscriber(decoded.email, decodedLocale);

    if (created) {
      subscriber = created.subscriber;
      shouldSendWelcomeEmail = created.shouldSendWelcomeEmail;
    } else {
      subscriber = await NewsletterSubscriber.findOne({ email: decoded.email });
    }
  }

  if (!subscriber) {
    throw new NewsletterError('Възникна грешка. Моля, опитайте отново.', 500);
  }

  if (subscriber.status === 'unsubscribed') {
    assertFreshConfirmationForUnsubscribed(subscriber, decoded);
    const reactivated = await reactivateConfirmedSubscriber(subscriber, decodedLocale);
    subscriber = reactivated.subscriber;
    shouldSendWelcomeEmail = reactivated.shouldSendWelcomeEmail;
  } else if (decoded.locale && decoded.localeVer !== undefined) {
    if (assertLatestLocaleChangeConfirmation(subscriber, decoded)) {
      subscriber.preferredLocale = decodedLocale;
      subscriber.pendingPreferredLocale = null;
      subscriber.pendingLocaleRequestedAt = null;
      await subscriber.save();
    }
  } else if (!subscriber.welcomeEmailSentAt) {
    shouldSendWelcomeEmail = true;
  }

  if (shouldSendWelcomeEmail) {
    try {
      await sendWelcomeEmailAndMark(subscriber);
    } catch (error) {
      logNewsletterSideEffectFailure('Newsletter welcome email delivery failed after confirmation.', error, subscriber);
    }
  }

  return { message: GENERIC_CONFIRM_MESSAGE };
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
    // Re-subscribe confirmation bumps this version, so old confirmation/unsubscribe tokens stay stale after reactivation.
    await subscriber.save();
  }

  return { message: GENERIC_UNSUBSCRIBE_MESSAGE };
}
