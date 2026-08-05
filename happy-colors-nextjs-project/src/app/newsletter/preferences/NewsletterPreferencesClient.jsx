'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n/config';
import useTranslations from '@/i18n/useTranslations';
import {
  exchangeNewsletterPreferencesToken,
  updateNewsletterPreferences,
} from '@/managers/newsletterManager';
import styles from '../confirm/newsletterConfirm.module.css';

function readTokenFromHash() {
  const hash = String(window.location.hash || '').replace(/^#/, '');
  const params = new URLSearchParams(hash);

  return String(params.get('token') || '').trim();
}

function getAllowedLocales(locales) {
  const allowedLocales = Array.isArray(locales)
    ? locales.filter((locale) => SUPPORTED_LOCALES.includes(locale))
    : [];

  return allowedLocales.length ? [...new Set(allowedLocales)] : [...SUPPORTED_LOCALES];
}

function resolveLocale(locale, allowedLocales, fallback = DEFAULT_LOCALE) {
  if (allowedLocales.includes(locale)) {
    return locale;
  }

  return allowedLocales.includes(fallback) ? fallback : allowedLocales[0];
}

export default function NewsletterPreferencesClient() {
  const { publicHref } = useLocaleNavigation();
  const { t } = useTranslations('newsletter.preferences');
  const exchangeTokenRef = useRef(null);
  const exchangeRequestRef = useRef(null);
  const tRef = useRef(t);
  const [hasReadHash, setHasReadHash] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [currentLocale, setCurrentLocale] = useState('');
  const [selectedLocale, setSelectedLocale] = useState('');
  const [availableLocales, setAvailableLocales] = useState([...SUPPORTED_LOCALES]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (exchangeTokenRef.current === null) {
      exchangeTokenRef.current = readTokenFromHash();

      if (window.location.hash) {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      }
    }

    const token = exchangeTokenRef.current;

    setHasReadHash(true);

    if (!token) {
      return;
    }

    let isMounted = true;

    setIsLoading(true);
    exchangeRequestRef.current ??= exchangeNewsletterPreferencesToken(token);
    exchangeRequestRef.current
      .then((data) => {
        if (!isMounted) {
          return;
        }

        const nextSessionToken = String(data?.sessionToken || '');
        const nextAvailableLocales = getAllowedLocales(data?.supportedLocales);
        const nextLocale = resolveLocale(data?.currentLocale, nextAvailableLocales);

        if (!nextSessionToken) {
          throw new Error('Missing newsletter preferences session token.');
        }

        setAvailableLocales(nextAvailableLocales);
        setSessionToken(nextSessionToken);
        setCurrentLocale(nextLocale);
        setSelectedLocale(nextLocale);
        setMessage('');
        setMessageType('');
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        setMessage(tRef.current('loadError'));
        setMessageType('error');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function handleLocaleChange(event) {
    setSelectedLocale(event.target.value);
    setMessage('');
    setMessageType('');
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!sessionToken || !availableLocales.includes(selectedLocale)) {
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageType('');

    try {
      const result = await updateNewsletterPreferences({
        sessionToken,
        locale: selectedLocale,
      });
      const nextLocale = availableLocales.includes(result?.currentLocale)
        ? result.currentLocale
        : selectedLocale;

      setCurrentLocale(nextLocale);
      setSelectedLocale(nextLocale);
      setMessage(t('success'));
      setMessageType('success');
    } catch {
      setMessage(t('saveError'));
      setMessageType('error');
    } finally {
      setIsSaving(false);
    }
  }

  const isReady = Boolean(sessionToken && currentLocale);
  const currentLocaleLabel = currentLocale ? t(`locales.${currentLocale}`) : '';

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="newsletter-preferences-title">
        <h1 id="newsletter-preferences-title" className={styles.title}>
          {t('title')}
        </h1>

        {!hasReadHash ? <p className={styles.copy}>{t('loading')}</p> : null}

        {hasReadHash && !isLoading && !isReady && !message ? (
          <p className={styles.copy}>{t('missingToken')}</p>
        ) : null}

        {isLoading ? <p className={styles.copy}>{t('loading')}</p> : null}

        {isReady ? (
          <form className={styles.form} onSubmit={handleSubmit}>
            <p className={styles.copy}>{t('current', { locale: currentLocaleLabel })}</p>
            <label className={styles.fieldLabel} htmlFor="newsletter-preferences-locale">
              {t('languageLabel')}
            </label>
            <select
              className={styles.select}
              id="newsletter-preferences-locale"
              value={selectedLocale}
              onChange={handleLocaleChange}
            >
              {availableLocales.map((locale) => (
                <option key={locale} value={locale}>
                  {t(`locales.${locale}`)}
                </option>
              ))}
            </select>
            <div className={styles.actions}>
              <button className={styles.primaryButton} type="submit" disabled={isSaving}>
                {isSaving ? t('saving') : t('save')}
              </button>
              <Link className={styles.secondaryLink} href={publicHref('/')}>
                {t('home')}
              </Link>
            </div>
          </form>
        ) : (
          <Link className={styles.secondaryLink} href={publicHref('/')}>
            {t('home')}
          </Link>
        )}

        {message ? (
          <p
            className={messageType === 'success' ? styles.successMessage : styles.errorMessage}
            role="status"
          >
            {message}
          </p>
        ) : null}
      </section>
    </main>
  );
}
