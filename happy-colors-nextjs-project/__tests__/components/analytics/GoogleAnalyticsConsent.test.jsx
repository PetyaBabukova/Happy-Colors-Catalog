import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import {
  COOKIE_CONSENT_NAME,
  createConsentValue,
} from '@/config/cookieConsent';
import { CookieConsentProvider } from '@/components/privacy/CookieConsentContext';
import GoogleAnalyticsConsent, {
  GOOGLE_ANALYTICS_MEASUREMENT_ID,
} from '@/components/analytics/GoogleAnalyticsConsent';
import { setMockNavigation } from '../setup.js';

vi.mock('next/script', () => ({
  default: ({ id, src, strategy }) => (
    <script id={id} src={src} data-strategy={strategy} />
  ),
}));

function clearConsentCookie() {
  document.cookie = `${COOKIE_CONSENT_NAME}=; Path=/; Max-Age=0`;
}

function setConsentCookie(values) {
  const consent = createConsentValue(values, new Date('2026-05-27T08:00:00.000Z'));

  document.cookie = `${COOKIE_CONSENT_NAME}=${encodeURIComponent(
    JSON.stringify(consent)
  )}; Path=/`;
}

function resetAnalyticsGlobals() {
  delete window.dataLayer;
  delete window.gtag;
  delete window.__happyColorsGoogleAnalyticsInitialized;
  delete window[`ga-disable-${GOOGLE_ANALYTICS_MEASUREMENT_ID}`];
}

function getGoogleAnalyticsScript() {
  return document.querySelector(
    `script[src="https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_MEASUREMENT_ID}"]`
  );
}

function renderGoogleAnalytics({ enableAnalytics = true } = {}) {
  return render(
    <CookieConsentProvider>
      <GoogleAnalyticsConsent enableAnalytics={enableAnalytics} />
    </CookieConsentProvider>
  );
}

describe('GoogleAnalyticsConsent', () => {
  afterEach(() => {
    clearConsentCookie();
    resetAnalyticsGlobals();
    delete navigator.globalPrivacyControl;
    vi.clearAllMocks();
  });

  it('does not load Google Analytics before analytics consent is granted', async () => {
    renderGoogleAnalytics();

    await waitFor(() => {
      expect(window[`ga-disable-${GOOGLE_ANALYTICS_MEASUREMENT_ID}`]).toBe(true);
    });
    expect(getGoogleAnalyticsScript()).not.toBeInTheDocument();
    expect(window.dataLayer).toBeUndefined();
  });

  it('loads Google Analytics and queues a page view after analytics consent', async () => {
    setConsentCookie({ analytics: true, marketing: false });
    setMockNavigation({
      pathname: '/products',
      searchParams: new URLSearchParams('category=toys'),
    });

    renderGoogleAnalytics();

    await waitFor(() => {
      expect(getGoogleAnalyticsScript()).toBeInTheDocument();
      expect(window[`ga-disable-${GOOGLE_ANALYTICS_MEASUREMENT_ID}`]).toBe(false);
      expect(window.dataLayer).toEqual(
        expect.arrayContaining([
          ['config', GOOGLE_ANALYTICS_MEASUREMENT_ID, { send_page_view: false }],
          [
            'event',
            'page_view',
            expect.objectContaining({
              page_path: '/products?category=toys',
            }),
          ],
        ])
      );
    });
  });

  it('does not load Google Analytics outside production even with consent', async () => {
    setConsentCookie({ analytics: true, marketing: false });

    renderGoogleAnalytics({ enableAnalytics: false });

    await waitFor(() => {
      expect(window[`ga-disable-${GOOGLE_ANALYTICS_MEASUREMENT_ID}`]).toBe(true);
    });
    expect(getGoogleAnalyticsScript()).not.toBeInTheDocument();
    expect(window.dataLayer).toBeUndefined();
  });

  it('respects Global Privacy Control even when stored consent allows analytics', async () => {
    Object.defineProperty(navigator, 'globalPrivacyControl', {
      configurable: true,
      value: true,
    });
    setConsentCookie({ analytics: true, marketing: true });

    renderGoogleAnalytics();

    await waitFor(() => {
      expect(window[`ga-disable-${GOOGLE_ANALYTICS_MEASUREMENT_ID}`]).toBe(true);
    });
    expect(getGoogleAnalyticsScript()).not.toBeInTheDocument();
    expect(window.dataLayer).toBeUndefined();
  });

  it('queues page views for client-side route changes without reinitializing GA', async () => {
    setConsentCookie({ analytics: true, marketing: false });
    setMockNavigation({ pathname: '/products', searchParams: new URLSearchParams() });

    const { rerender } = renderGoogleAnalytics();

    await waitFor(() => {
      expect(window.dataLayer).toEqual(
        expect.arrayContaining([
          [
            'event',
            'page_view',
            expect.objectContaining({
              page_path: '/products',
            }),
          ],
        ])
      );
    });

    setMockNavigation({
      pathname: '/aboutus',
      searchParams: new URLSearchParams('from=nav'),
    });
    rerender(
      <CookieConsentProvider>
        <GoogleAnalyticsConsent enableAnalytics />
      </CookieConsentProvider>
    );

    await waitFor(() => {
      const configEvents = window.dataLayer.filter((item) => item[0] === 'config');
      const pageViewEvents = window.dataLayer.filter(
        (item) => item[0] === 'event' && item[1] === 'page_view'
      );

      expect(configEvents).toHaveLength(1);
      expect(pageViewEvents).toHaveLength(2);
      expect(pageViewEvents.at(-1)[2]).toMatchObject({
        page_path: '/aboutus?from=nav',
      });
    });
  });
});
