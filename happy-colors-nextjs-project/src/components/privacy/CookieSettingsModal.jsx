'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { COOKIE_CATEGORIES } from '@/config/cookieConsent';
import { useCookieConsent } from './CookieConsentContext';
import styles from './CookieConsent.module.css';

function buildInitialSettings(consent) {
  return {
    analytics: Boolean(consent?.analytics),
    marketing: Boolean(consent?.marketing),
  };
}

export default function CookieSettingsModal() {
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
            Настройки за бисквитки
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeSettings}
            aria-label="Затвори настройките за бисквитки"
          >
            ×
          </button>
        </div>

        <p className={styles.modalIntro}>
          Happy Colors обработва данни чрез бисквитки и подобни технологии според избора ви
          и описаните по-долу категории.
        </p>

        <div className={styles.categoryList}>
          {COOKIE_CATEGORIES.map((category) => {
            const checked = category.required || Boolean(settings[category.id]);

            return (
              <article key={category.id} className={styles.category}>
                <div className={styles.categoryHeader}>
                  <span className={styles.categoryName}>{category.label}</span>
                  <label
                    className={`${styles.toggle} ${
                      category.required ? styles.toggleDisabled : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      aria-label={category.label}
                      checked={checked}
                      disabled={category.required}
                      onChange={(event) => updateSetting(category.id, event.target.checked)}
                    />
                    {checked ? 'Включени' : 'Изключени'}
                  </label>
                </div>
                <p className={styles.categoryDescription}>{category.description}</p>
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
            Политика за бисквитки
          </button>
        </div>

        {showPolicy && (
          <section className={styles.policyPanel} aria-label="Политика за бисквитки">
            <p>
              Бисквитките и подобните технологии помагат на сайта да работи коректно,
              сигурно и според избора ви.
            </p>
            <ul>
              <li>
                Необходимите технологии поддържат основна и сигурна работа на сайта,
                включително административен достъп и запазване на избора за бисквитки.
              </li>
              <li>
                Функционално локално или сесийно съхранение може да се използва в
                технически или бъдещи клиентски потоци, без сайтът да изисква публичен
                профил или завършване на поръчка.
              </li>
              <li>
                Аналитичните и маркетинговите технологии се използват само след ваше
                съгласие.
              </li>
            </ul>
            <p>
              Можете да промените избора си по всяко време от линка във футъра.
              За въпроси: happy.colors.bg@gmail.com.
            </p>
          </section>
        )}

        <div className={styles.modalActions}>
          <button type="button" className={styles.button} onClick={acceptAll}>
            Приемам всички
          </button>
          <button type="button" className={styles.secondaryButton} onClick={acceptNecessaryOnly}>
            Само необходими
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => saveCustomConsent(settings)}
          >
            Запази избора
          </button>
        </div>
      </section>
    </div>
  );
}
