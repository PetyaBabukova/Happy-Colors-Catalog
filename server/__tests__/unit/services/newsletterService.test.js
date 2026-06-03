import mongoose from 'mongoose';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createSubscribeFormToken,
  createUnsubscribeToken,
  verifySubscribeFormToken,
  verifyUnsubscribeToken,
} from '../../../services/newsletterService.js';

function buildSubscriber(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(),
    unsubscribeTokenVersion: 1,
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
});
