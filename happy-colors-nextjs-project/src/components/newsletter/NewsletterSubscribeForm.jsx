'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getNewsletterSubscribeToken,
  subscribeToNewsletter,
} from '@/managers/newsletterManager';
import { LOCALE_DETAILS, SUPPORTED_LOCALES } from '@/i18n/config';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import useTranslations from '@/i18n/useTranslations';
import styles from './NewsletterSubscribeForm.module.css';

const SUBSCRIBE_TOKEN_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 2100;

function createInitialFormState(locale) {
  return {
    email: '',
    consent: false,
    website: '',
    locale,
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function NewsletterSubscribeForm() {
  const { locale } = useLocaleNavigation();
  const { t } = useTranslations('newsletter');
  const [formValues, setFormValues] = useState(() => createInitialFormState(locale));
  const [formToken, setFormToken] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshFormToken = useCallback(async () => {
    const result = await getNewsletterSubscribeToken();
    const nextToken = String(result?.token || '');

    setFormToken(nextToken);
    return nextToken;
  }, []);

  useEffect(() => {
    refreshFormToken().catch(() => {
      setFormToken('');
    });
  }, [refreshFormToken]);

  useEffect(() => {
    setFormValues((current) => {
      if (current.locale) {
        return current;
      }

      return {
        ...current,
        locale,
      };
    });
  }, [locale]);

  function updateField(name, value) {
    setFormValues((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setMessageType('');

    if (!formValues.email.trim()) {
      setMessage(t('emailRequired'));
      setMessageType('error');
      return;
    }

    if (!formValues.consent) {
      setMessage(t('consentRequired'));
      setMessageType('error');
      return;
    }

    setIsSubmitting(true);

    async function submitWithToken(token) {
      return subscribeToNewsletter({
        email: formValues.email,
        consent: formValues.consent,
        website: formValues.website,
        formToken: token,
        locale: formValues.locale || locale,
      });
    }

    try {
      let token = formToken || (await refreshFormToken());
      let result;

      try {
        result = await submitWithToken(token);
      } catch (error) {
        if (error?.code === 'too_new_form_token') {
          await wait(SUBSCRIBE_TOKEN_RETRY_DELAY_MS);
          result = await submitWithToken(token);
        } else if (error?.code === 'invalid_form_token' || error?.code === 'expired_form_token') {
          token = await refreshFormToken();
          await wait(SUBSCRIBE_TOKEN_RETRY_DELAY_MS);
          result = await submitWithToken(token);
        } else {
          throw error;
        }
      }

      setFormValues(createInitialFormState(formValues.locale || locale));
      setMessage(result?.message || t('subscribeSuccess'));
      setMessageType('success');
      refreshFormToken().catch(() => {
        setFormToken('');
      });
    } catch (error) {
      setMessage(error?.message || t('subscribeError'));
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.copy}>
        <h2 className={styles.title}>{t('title')}</h2>
      </div>

      <fieldset className={styles.localeFieldset}>
        <legend className={styles.localeLegend}>{t('languageLabel')}</legend>
        <div className={styles.localeOptions}>
          {SUPPORTED_LOCALES.map((optionLocale) => (
            <label key={optionLocale} className={styles.localeOption}>
              <input
                type="radio"
                name="newsletter-locale"
                value={optionLocale}
                checked={formValues.locale === optionLocale}
                onChange={(event) => updateField('locale', event.target.value)}
              />
              <span>{LOCALE_DETAILS[optionLocale].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.submitRow}>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          aria-label="Email"
          autoComplete="email"
          value={formValues.email}
          onChange={(event) => updateField('email', event.target.value)}
          placeholder="you@example.com"
          className={styles.emailInput}
        />
        <button className={styles.submitButton} type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('submitting') : t('subscribe')}
        </button>
      </div>

      <input
        aria-hidden="true"
        autoComplete="off"
        className={styles.honeypot}
        name="website"
        tabIndex="-1"
        value={formValues.website}
        onChange={(event) => updateField('website', event.target.value)}
      />

      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={formValues.consent}
          onChange={(event) => updateField('consent', event.target.checked)}
        />
        <span>{t('consentLabel')}</span>
      </label>

      {message ? (
        <p
          className={messageType === 'success' ? styles.successMessage : styles.errorMessage}
          role="status"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
