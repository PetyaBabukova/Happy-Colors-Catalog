'use client';

import {
  COOKIE_POLICY_SECONDARY,
  COOKIE_POLICY_SUMMARY,
} from '@/config/cookieConsent';
import { useCookieConsent } from './CookieConsentContext';
import CookieSettingsModal from './CookieSettingsModal';
import styles from './CookieConsent.module.css';

export default function CookieConsentBanner() {
  const { showBanner, acceptAll, acceptNecessaryOnly, openSettings } = useCookieConsent();

  return (
    <>
      {showBanner && (
        <aside className={styles.banner} aria-label="Известие за бисквитки">
          <div className={styles.bannerText}>
            <p>{COOKIE_POLICY_SUMMARY}</p>
            <p>{COOKIE_POLICY_SECONDARY}</p>
          </div>
          <div className={styles.bannerActions}>
            <button type="button" className={styles.button} onClick={acceptAll}>
              Приемам всички
            </button>
            <button type="button" className={styles.secondaryButton} onClick={acceptNecessaryOnly}>
              Само необходими
            </button>
            <button type="button" className={styles.secondaryButton} onClick={openSettings}>
              Настройки
            </button>
          </div>
        </aside>
      )}
      <CookieSettingsModal />
    </>
  );
}
