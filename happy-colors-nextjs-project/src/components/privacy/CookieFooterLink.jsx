'use client';

import useTranslations from '@/i18n/useTranslations';
import { useCookieConsent } from './CookieConsentContext';
import styles from './CookieConsent.module.css';

export default function CookieFooterLink() {
  const { t } = useTranslations('privacy');
  const { openSettings } = useCookieConsent();

  return (
    <div className={styles.footerPrivacy}>
      <button type="button" className={styles.footerButton} onClick={openSettings}>
        {t('footerLink')}
      </button>
    </div>
  );
}
