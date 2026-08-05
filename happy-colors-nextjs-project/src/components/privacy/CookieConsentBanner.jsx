'use client';

import useTranslations from '@/i18n/useTranslations';
import { useCookieConsent } from './CookieConsentContext';
import CookieSettingsModal from './CookieSettingsModal';
import styles from './CookieConsent.module.css';

export default function CookieConsentBanner() {
  const { t } = useTranslations('privacy');
  const { showBanner, acceptAll, acceptNecessaryOnly, openSettings } = useCookieConsent();

  return (
    <>
      {showBanner && (
        <aside className={styles.banner} aria-label={t('bannerAriaLabel')}>
          <div className={styles.bannerText}>
            <p>{t('summary')}</p>
            <p>{t('secondary')}</p>
          </div>
          <div className={styles.bannerActions}>
            <button type="button" className={styles.button} onClick={acceptAll}>
              {t('acceptAll')}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={acceptNecessaryOnly}>
              {t('necessaryOnly')}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={openSettings}>
              {t('settings')}
            </button>
          </div>
        </aside>
      )}
      <CookieSettingsModal />
    </>
  );
}
