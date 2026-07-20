'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { COOKIE_CATEGORIES } from '@/config/cookieConsent';
import useTranslations from '@/i18n/useTranslations';
import { useCookieConsent } from './CookieConsentContext';
import styles from './CookieConsent.module.css';

function buildInitialSettings(consent) {
  return {
    analytics: Boolean(consent?.analytics),
    marketing: Boolean(consent?.marketing),
  };
}

export default function CookieSettingsModal() {
  const { t } = useTranslations('privacy');
  const {
    consent,
    isSettingsOpen,
    closeSettings,
    acceptAll,
    acceptNecessaryOnly,
    saveCustomConsent,
  } = useCookieConsent();
  const titleId = useId();
  const previousFocusRef = useRef(null);
  const modalRef = useRef(null);
  const [settings, setSettings] = useState(buildInitialSettings(consent));
  const [showPolicy, setShowPolicy] = useState(false);

  useEffect(() => {
    if (!isSettingsOpen) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    setSettings(buildInitialSettings(consent));
    setShowPolicy(false);

    const focusTimer = window.setTimeout(() => {
      modalRef.current?.focus();
    }, 0);

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeSettings();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [closeSettings, consent, isSettingsOpen]);

  if (!isSettingsOpen) {
    return null;
  }

  function updateSetting(categoryId, checked) {
    setSettings((current) => ({
      ...current,
      [categoryId]: checked,
    }));
  }

  return (
    <div className={styles.backdrop}>
      <section
        ref={modalRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.modalHeader}>
          <h2 id={titleId} className={styles.modalTitle}>
            {t('settingsTitle')}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeSettings}
            aria-label={t('closeSettings')}
          >
            x
          </button>
        </div>

        <p className={styles.modalIntro}>{t('settingsIntro')}</p>

        <div className={styles.categoryList}>
          {COOKIE_CATEGORIES.map((category) => {
            const checked = category.required || Boolean(settings[category.id]);
            const label = t(`categories.${category.id}.label`);

            return (
              <article key={category.id} className={styles.category}>
                <div className={styles.categoryHeader}>
                  <span className={styles.categoryName}>{label}</span>
                  <label
                    className={`${styles.toggle} ${
                      category.required ? styles.toggleDisabled : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      aria-label={label}
                      checked={checked}
                      disabled={category.required}
                      onChange={(event) => updateSetting(category.id, event.target.checked)}
                    />
                    {checked ? t('enabled') : t('disabled')}
                  </label>
                </div>
                <p className={styles.categoryDescription}>
                  {t(`categories.${category.id}.description`)}
                </p>
              </article>
            );
          })}
        </div>

        <div className={styles.policyToggleRow}>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setShowPolicy((current) => !current)}
            aria-expanded={showPolicy}
          >
            {t('policyTitle')}
          </button>
        </div>

        {showPolicy && (
          <section className={styles.policyPanel} aria-label={t('policyTitle')}>
            <p>{t('policyIntro')}</p>
            <ul>
              <li>{t('policyNecessary')}</li>
              <li>{t('policyFunctional')}</li>
              <li>{t('policyOptional')}</li>
            </ul>
            <p>{t('policyContact')}</p>
          </section>
        )}

        <div className={styles.modalActions}>
          <button type="button" className={styles.button} onClick={acceptAll}>
            {t('acceptAll')}
          </button>
          <button type="button" className={styles.secondaryButton} onClick={acceptNecessaryOnly}>
            {t('necessaryOnly')}
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => saveCustomConsent(settings)}
          >
            {t('saveChoice')}
          </button>
        </div>
      </section>
    </div>
  );
}
