import mongoose from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createNewsletterConfirmationPageUrl,
  createNewsletterConfirmationToken,
  createNewsletterPreferencesPageUrl,
  createNewsletterPreferencesToken,
  createUnsubscribePageUrl,
  createSubscribeFormToken,
  createUnsubscribeToken,
  verifyNewsletterConfirmationToken,
  verifyNewsletterPreferencesToken,
  verifySubscribeFormToken,
  verifyUnsubscribeToken,
} from '../../../services/newsletterService.js';

function buildSubscriber(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    unsubscribeTokenVersion: 1,
    preferenceTokenVersion: 1,
    ...overrides,
  };
}

function decodePayload(token) {
  const [payload] = token.split('.');

  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

describe('newsletterService token helpers', () => {
  afterEach(() => {
    delete process.env.NEWSLETTER_UNSUBSCRIBE_SECRET;
    delete process.env.NEWSLETTER_SUBSCRIBE_TOKEN_MIN_AGE_SECONDS;
  });

  it('creates signed unsubscribe tokens with subscriber id, version, and issued-at timestamp', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const subscriber = buildSubscriber({ unsubscribeTokenVersion: 3 });

    const token = createUnsubscribeToken(subscriber);
    const decoded = verifyUnsubscribeToken(token);
    const payload = decodePayload(token);

    expect(decoded).toEqual({
      sub: String(subscriber._id),
      ver: 3,
      iat: expect.any(Number),
    });
    expect(payload).toEqual(decoded);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it('rejects tampered payloads and signatures', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const token = createUnsubscribeToken(buildSubscriber());
    const [payload, signature] = token.split('.');
    const decoded = decodePayload(token);
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...decoded, ver: decoded.ver + 1 })
    ).toString('base64url');
    const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`;

    expect(() => verifyUnsubscribeToken(`${tamperedPayload}.${signature}`)).toThrow(
      'Невалиден линк за отписване.'
    );
    expect(() => verifyUnsubscribeToken(`${payload}.${tamperedSignature}`)).toThrow(
      'Невалиден линк за отписване.'
    );
  });

  it('throws a clear configuration error when the signing secret is missing', () => {
    expect(() => createUnsubscribeToken(buildSubscriber())).toThrow(
      'Newsletter unsubscribe secret is not configured.'
    );
  });

  it('creates unique signed subscribe form tokens with purpose and nonce', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';

    const firstToken = createSubscribeFormToken();
    const secondToken = createSubscribeFormToken();
    const firstDecoded = verifySubscribeFormToken(firstToken);

    expect(firstToken).not.toBe(secondToken);
    expect(firstDecoded).toEqual({
      purpose: 'newsletter-subscribe',
      iat: expect.any(Number),
      nonce: expect.any(String),
    });
  });

  it('rejects expired and too-new subscribe form tokens with coarse codes', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    process.env.NEWSLETTER_SUBSCRIBE_TOKEN_MIN_AGE_SECONDS = '5';
    const token = createSubscribeFormToken();
    const decoded = decodePayload(token);

    let tooNewError;
    let expiredError;

    try {
      verifySubscribeFormToken(token, { nowSeconds: decoded.iat });
    } catch (error) {
      tooNewError = error;
    }

    try {
      verifySubscribeFormToken(token, { nowSeconds: decoded.iat + 31 * 60 });
    } catch (error) {
      expiredError = error;
    }

    expect(tooNewError?.code).toBe('too_new_form_token');
    expect(expiredError?.code).toBe('expired_form_token');
  });

  it('rejects tampered subscribe form token signatures', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const token = createSubscribeFormToken();
    const [payload, signature] = token.split('.');
    const tamperedSignature = `${signature.slice(0, -1)}${signature.endsWith('a') ? 'b' : 'a'}`;

    let error;

    try {
      verifySubscribeFormToken(`${payload}.${tamperedSignature}`);
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error?.code).toBe('invalid_form_token');
  });

  it('creates unique confirmation tokens with normalized email, purpose, nonce, and optional subscriber version', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const subscriber = buildSubscriber({ unsubscribeTokenVersion: 4 });

    const firstToken = createNewsletterConfirmationToken(' Petya@Example.COM ', subscriber);
    const secondToken = createNewsletterConfirmationToken('petya@example.com', subscriber);
    const decoded = verifyNewsletterConfirmationToken(firstToken);

    expect(firstToken).not.toBe(secondToken);
    expect(decoded).toEqual({
      purpose: 'newsletter-confirm',
      email: 'petya@example.com',
      iat: expect.any(Number),
      nonce: expect.any(String),
      ver: 4,
    });
  });

  it('can bind confirmation tokens and public page URLs to an allowed newsletter locale', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const subscriber = buildSubscriber({ unsubscribeTokenVersion: 4 });
    const token = createNewsletterConfirmationToken(' Petya@Example.COM ', subscriber, {
      locale: 'en',
      localeChangeRequestVersion: 3,
    });
    const decoded = verifyNewsletterConfirmationToken(token);

    expect(decoded).toMatchObject({
      purpose: 'newsletter-confirm',
      email: 'petya@example.com',
      ver: 4,
      locale: 'en',
      localeVer: 3,
    });
    expect(createNewsletterConfirmationPageUrl(token, { locale: 'en' })).toBe(
      `https://happycolors.eu/en/newsletter/confirm#token=${encodeURIComponent(token)}`
    );
    expect(createUnsubscribePageUrl('unsubscribe-token', { locale: 'en' })).toBe(
      'https://happycolors.eu/en/newsletter/unsubscribe?token=unsubscribe-token'
    );
  });

  it('creates dedicated 30-day preferences tokens and localized fragment URLs', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const subscriber = buildSubscriber({ preferenceTokenVersion: 5 });

    const firstToken = createNewsletterPreferencesToken(subscriber);
    const secondToken = createNewsletterPreferencesToken(subscriber);
    const decoded = verifyNewsletterPreferencesToken(firstToken);

    expect(firstToken).not.toBe(secondToken);
    expect(decoded).toEqual({
      purpose: 'newsletter-preferences',
      sub: String(subscriber._id),
      ver: 5,
      iat: expect.any(Number),
      nonce: expect.any(String),
    });
    expect(createNewsletterPreferencesPageUrl(firstToken, { locale: 'en' })).toBe(
      `https://happycolors.eu/en/newsletter/preferences#token=${encodeURIComponent(firstToken)}`
    );
  });

  it('rejects tampered, wrong-purpose, and expired preferences tokens', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const token = createNewsletterPreferencesToken(buildSubscriber());
    const [payload, signature] = token.split('.');
    const decoded = decodePayload(token);
    const tamperedPayload = Buffer.from(JSON.stringify({ ...decoded, ver: decoded.ver + 1 })).toString('base64url');
    const wrongPurposePayload = Buffer.from(JSON.stringify({ ...decoded, purpose: 'newsletter-confirm' })).toString('base64url');

    let tamperedError;
    let wrongPurposeError;
    let expiredError;

    try {
      verifyNewsletterPreferencesToken(`${tamperedPayload}.${signature}`);
    } catch (error) {
      tamperedError = error;
    }

    try {
      verifyNewsletterPreferencesToken(`${wrongPurposePayload}.${signature}`);
    } catch (error) {
      wrongPurposeError = error;
    }

    try {
      verifyNewsletterPreferencesToken(token, { nowSeconds: decoded.iat + 31 * 24 * 60 * 60 });
    } catch (error) {
      expiredError = error;
    }

    expect(tamperedError?.code).toBe('invalid_preferences_token');
    expect(wrongPurposeError?.code).toBe('invalid_preferences_token');
    expect(expiredError?.code).toBe('expired_preferences_token');
  });

  it('rejects tampered, expired, wrong-purpose, unsubscribe, and subscribe form tokens at confirmation verification', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const confirmationToken = createNewsletterConfirmationToken('petya@example.com');
    const [payload, signature] = confirmationToken.split('.');
    const decoded = decodePayload(confirmationToken);
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...decoded, email: 'other@example.com' })
    ).toString('base64url');
    const wrongPurposePayload = Buffer.from(
      JSON.stringify({ ...decoded, purpose: 'newsletter-subscribe' })
    ).toString('base64url');
    const wrongPurposeToken = `${wrongPurposePayload}.${Buffer.from('bad').toString('base64url')}`;
    const subscribeToken = createSubscribeFormToken();
    const unsubscribeToken = createUnsubscribeToken(buildSubscriber());

    let tamperedError;
    let expiredError;
    let wrongPurposeError;
    let subscribeTokenError;
    let unsubscribeTokenError;

    try {
      verifyNewsletterConfirmationToken(`${tamperedPayload}.${signature}`);
    } catch (error) {
      tamperedError = error;
    }

    try {
      verifyNewsletterConfirmationToken(confirmationToken, { nowSeconds: decoded.iat + 25 * 60 * 60 });
    } catch (error) {
      expiredError = error;
    }

    try {
      verifyNewsletterConfirmationToken(wrongPurposeToken);
    } catch (error) {
      wrongPurposeError = error;
    }

    try {
      verifyNewsletterConfirmationToken(subscribeToken);
    } catch (error) {
      subscribeTokenError = error;
    }

    try {
      verifyNewsletterConfirmationToken(unsubscribeToken);
    } catch (error) {
      unsubscribeTokenError = error;
    }

    expect(tamperedError?.code).toBe('invalid_confirmation_token');
    expect(expiredError?.code).toBe('expired_confirmation_token');
    expect(wrongPurposeError?.code).toBe('invalid_confirmation_token');
    expect(subscribeTokenError?.code).toBe('invalid_confirmation_token');
    expect(unsubscribeTokenError?.code).toBe('invalid_confirmation_token');
  });

  it('builds confirmation page URLs with a fragment token and without CLIENT_URL fallback', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const previousClientUrl = process.env.CLIENT_URL;
    const previousPublicSiteUrl = process.env.NEWSLETTER_PUBLIC_SITE_URL;
    const previousNextPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.CLIENT_URL = 'http://localhost:3000';
    delete process.env.NEWSLETTER_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;

    try {
      const token = createNewsletterConfirmationToken('petya@example.com');
      const url = createNewsletterConfirmationPageUrl(token);

      expect(url).toBe(`https://happycolors.eu/bg/newsletter/confirm#token=${encodeURIComponent(token)}`);
      expect(url).not.toContain('?token=');
      process.env.NEWSLETTER_PUBLIC_SITE_URL = 'https://newsletter.example';
      expect(createNewsletterConfirmationPageUrl(token)).toBe(
        `https://newsletter.example/bg/newsletter/confirm#token=${encodeURIComponent(token)}`
      );
    } finally {
      process.env.CLIENT_URL = previousClientUrl;
      process.env.NEWSLETTER_PUBLIC_SITE_URL = previousPublicSiteUrl;
      process.env.NEXT_PUBLIC_SITE_URL = previousNextPublicSiteUrl;
    }
  });

  it('rejects local-looking confirmation URL configuration outside development and test', () => {
    process.env.NEWSLETTER_UNSUBSCRIBE_SECRET = 'unit-newsletter-secret';
    const previousNodeEnv = process.env.NODE_ENV;
    const previousPublicSiteUrl = process.env.NEWSLETTER_PUBLIC_SITE_URL;
    process.env.NODE_ENV = '';
    process.env.NEWSLETTER_PUBLIC_SITE_URL = 'http://localhost:3000';

    try {
      const token = createNewsletterConfirmationToken('petya@example.com');

      expect(() => createNewsletterConfirmationPageUrl(token)).toThrow(
        'Newsletter public site URL is not configured for confirmation links.'
      );
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      process.env.NEWSLETTER_PUBLIC_SITE_URL = previousPublicSiteUrl;
    }
  });
});
