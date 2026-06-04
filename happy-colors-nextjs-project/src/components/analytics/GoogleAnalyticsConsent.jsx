'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { hasGlobalPrivacyControl } from '@/config/cookieConsent';
import { useCookieConsent } from '@/components/privacy/CookieConsentContext';

export const GOOGLE_ANALYTICS_MEASUREMENT_ID = 'G-8Z6V7J6DN5';

const GOOGLE_ANALYTICS_INITIALIZED_KEY = '__happyColorsGoogleAnalyticsInitialized';

function buildPagePath(pathname, search) {
  return `${pathname || '/'}${search ? `?${search}` : ''}`;
}

function queueGtag() {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(arguments);
}

export default function GoogleAnalyticsConsent({
  enableAnalytics = false,
  measurementId = GOOGLE_ANALYTICS_MEASUREMENT_ID,
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() || '';
  const { consent } = useCookieConsent();
  const analyticsAllowed =
    enableAnalytics && Boolean(consent?.analytics) && !hasGlobalPrivacyControl();

  useEffect(() => {
    if (typeof window === 'undefined' || !measurementId) {
      return;
    }

    window[`ga-disable-${measurementId}`] = !analyticsAllowed;
  }, [analyticsAllowed, measurementId]);

  useEffect(() => {
    if (!analyticsAllowed || typeof window === 'undefined' || !measurementId) {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || queueGtag;
    window[GOOGLE_ANALYTICS_INITIALIZED_KEY] =
      window[GOOGLE_ANALYTICS_INITIALIZED_KEY] || {};

    if (!window[GOOGLE_ANALYTICS_INITIALIZED_KEY][measurementId]) {
      window.gtag('js', new Date());
      window.gtag('config', measurementId, { send_page_view: false });
      window[GOOGLE_ANALYTICS_INITIALIZED_KEY][measurementId] = true;
    }

    window.gtag('event', 'page_view', {
      send_to: measurementId,
      page_path: buildPagePath(pathname, search),
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [analyticsAllowed, measurementId, pathname, search]);

  if (!analyticsAllowed || !measurementId) {
    return null;
  }

  return (
    <Script
      id="google-analytics-gtag"
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
    />
  );
}
