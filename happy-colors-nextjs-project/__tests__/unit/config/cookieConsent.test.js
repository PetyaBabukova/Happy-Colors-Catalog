import { describe, expect, it } from 'vitest';
import {
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  COOKIE_CONSENT_NAME,
  COOKIE_CONSENT_VERSION,
  createConsentValue,
  normalizeConsent,
  parseStoredConsent,
  readConsentCookie,
  serializeConsentCookie,
} from '@/config/cookieConsent';

describe('cookieConsent config helpers', () => {
  it('creates normalized consent values with necessary always enabled', () => {
    const consent = createConsentValue(
      { necessary: false, analytics: true, marketing: false },
      new Date('2026-05-18T08:00:00.000Z')
    );

    expect(consent).toEqual({
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: true,
      marketing: false,
      updatedAt: '2026-05-18T08:00:00.000Z',
    });
  });

  it('serializes the consent cookie with the documented security attributes', () => {
    const consent = createConsentValue(
      { analytics: true, marketing: true },
      new Date('2026-05-18T08:00:00.000Z')
    );
    const serialized = serializeConsentCookie(consent, { secure: true });

    expect(serialized).toContain(`${COOKIE_CONSENT_NAME}=`);
    expect(serialized).toContain('Path=/');
    expect(serialized).toContain('SameSite=Lax');
    expect(serialized).toContain(`Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}`);
    expect(serialized).toContain('Secure');
    expect(serialized).not.toContain('HttpOnly');
    expect(serialized).not.toContain('Domain=');
  });

  it('parses valid consent and normalizes tampered necessary values', () => {
    const stored = JSON.stringify({
      version: COOKIE_CONSENT_VERSION,
      necessary: false,
      analytics: true,
      marketing: false,
      updatedAt: '2026-05-18T08:00:00.000Z',
    });

    expect(parseStoredConsent(stored, { now: new Date('2026-05-18T09:00:00.000Z') })).toEqual({
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: true,
      marketing: false,
      updatedAt: '2026-05-18T08:00:00.000Z',
    });
  });

  it('rejects corrupt, outdated, and expired consent', () => {
    expect(parseStoredConsent('bad-json')).toBeNull();
    expect(
      normalizeConsent({
        version: COOKIE_CONSENT_VERSION - 1,
        necessary: true,
        updatedAt: '2026-05-18T08:00:00.000Z',
      })
    ).toBeNull();
    expect(
      parseStoredConsent(
        JSON.stringify({
          version: COOKIE_CONSENT_VERSION,
          necessary: true,
          analytics: true,
          marketing: true,
          updatedAt: '2025-01-01T00:00:00.000Z',
        }),
        { now: new Date('2026-05-18T08:00:00.000Z') }
      )
    ).toBeNull();
  });

  it('treats optional categories as off when GPC is present', () => {
    const stored = {
      version: COOKIE_CONSENT_VERSION,
      necessary: true,
      analytics: true,
      marketing: true,
      updatedAt: '2026-05-18T08:00:00.000Z',
    };

    expect(normalizeConsent(stored, { gpc: true })).toMatchObject({
      necessary: true,
      analytics: false,
      marketing: false,
    });
  });

  it('reads consent from a cookie string', () => {
    const consent = createConsentValue(
      { analytics: true },
      new Date('2026-05-18T08:00:00.000Z')
    );
    const cookieString = `other=value; ${COOKIE_CONSENT_NAME}=${encodeURIComponent(
      JSON.stringify(consent)
    )}`;

    expect(readConsentCookie(cookieString)).toMatchObject({
      necessary: true,
      analytics: true,
      marketing: false,
    });
  });
});
