'use client';

import { useCookieConsent } from './CookieConsentContext';
import styles from './CookieConsent.module.css';

export default function CookieFooterLink() {
  const { openSettings } = useCookieConsent();

  return (
    <div className={styles.footerPrivacy}>
      <button type="button" className={styles.footerButton} onClick={openSettings}>
        Бисквитки и настройки за поверителност
      </button>
    </div>
  );
}
