'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  COOKIE_CONSENT_BROADCAST_CHANNEL,
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_STORAGE_SYNC_KEY,
  createConsentValue,
  hasGlobalPrivacyControl,
  readConsentCookie,
  serializeConsentCookie,
} from '@/config/cookieConsent';

const CookieConsentContext = createContext(null);

function isProductionHttps() {
  return typeof window !== 'undefined' && window.location.protocol === 'https:';
}

function readBrowserConsent() {
  if (typeof document === 'undefined') {
    return null;
  }

  return readConsentCookie(document.cookie, { gpc: hasGlobalPrivacyControl() });
}

function writeBrowserConsent(consent) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = serializeConsentCookie(consent, { secure: isProductionHttps() });
}

function notifyConsentChange(consent, channel) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, {
      detail: consent,
    })
  );

  channel?.postMessage?.(consent);

  try {
    window.localStorage.setItem(
      COOKIE_CONSENT_STORAGE_SYNC_KEY,
      JSON.stringify({ updatedAt: Date.now() })
    );
  } catch {
    // Cross-tab sync is best effort; consent itself is stored in the cookie.
  }
}

export function CookieConsentProvider({ children }) {
  const channelRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [consent, setConsent] = useState(null);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  const showBanner = ready && !consent;

  const applyStoredConsent = useCallback((nextConsent) => {
    setConsent(nextConsent);
  }, []);

  const saveConsent = useCallback((values) => {
    const nextConsent = createConsentValue(values);

    writeBrowserConsent(nextConsent);
    setConsent(nextConsent);
    setSettingsOpen(false);
    notifyConsentChange(nextConsent, channelRef.current);
  }, []);

  const acceptAll = useCallback(() => {
    saveConsent({ analytics: true, marketing: true });
  }, [saveConsent]);

  const acceptNecessaryOnly = useCallback(() => {
    saveConsent({ analytics: false, marketing: false });
  }, [saveConsent]);

  const saveCustomConsent = useCallback(
    (values) => {
      saveConsent({
        analytics: Boolean(values?.analytics),
        marketing: Boolean(values?.marketing),
      });
    },
    [saveConsent]
  );

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    applyStoredConsent(readBrowserConsent());
    setReady(true);
  }, [applyStoredConsent]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') {
      return undefined;
    }

    const channel = new BroadcastChannel(COOKIE_CONSENT_BROADCAST_CHANNEL);
    channelRef.current = channel;

    channel.addEventListener('message', (event) => {
      applyStoredConsent(event.data || readBrowserConsent());
    });

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [applyStoredConsent]);

  useEffect(() => {
    function handleStorage(event) {
      if (event.key === COOKIE_CONSENT_STORAGE_SYNC_KEY) {
        applyStoredConsent(readBrowserConsent());
      }
    }

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, [applyStoredConsent]);

  const value = useMemo(
    () => ({
      ready,
      consent,
      showBanner,
      isSettingsOpen,
      acceptAll,
      acceptNecessaryOnly,
      saveCustomConsent,
      openSettings,
      closeSettings,
    }),
    [
      ready,
      consent,
      showBanner,
      isSettingsOpen,
      acceptAll,
      acceptNecessaryOnly,
      saveCustomConsent,
      openSettings,
      closeSettings,
    ]
  );

  return (
    <CookieConsentContext.Provider value={value}>{children}</CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  const context = useContext(CookieConsentContext);

  if (!context) {
    throw new Error('useCookieConsent must be used inside CookieConsentProvider.');
  }

  return context;
}
