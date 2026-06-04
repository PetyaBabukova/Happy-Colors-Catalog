'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getNewsletterSubscribeToken,
  subscribeToNewsletter,
} from '@/managers/newsletterManager';
import styles from './NewsletterSubscribeForm.module.css';

const initialFormState = {
  email: '',
  consent: false,
  website: '',
};

const SUBSCRIBE_TOKEN_RETRY_DELAY_MS = process.env.NODE_ENV === 'test' ? 0 : 2100;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function NewsletterSubscribeForm() {
  const [formValues, setFormValues] = useState(initialFormState);
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
      setMessage('Моля, въведете email адрес.');
      setMessageType('error');
      return;
    }

    if (!formValues.consent) {
      setMessage('Моля, потвърдете съгласието си за получаване на новини.');
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

      setFormValues(initialFormState);
      setMessage(result?.message || 'Благодарим ви. Ако е необходимо потвърждение, ще получите имейл с линк за абонамента.');
      setMessageType('success');
      refreshFormToken().catch(() => {
        setFormToken('');
      });
    } catch (error) {
      setMessage(error?.message || 'Не успяхте да се абонирате. Моля опитайте по-късно.');
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.copy}>
        <h2 className={styles.title}>Получавай новини от Happy Colors</h2>
      </div>

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
          {isSubmitting ? 'Изпращане...' : 'Абонирай се'}
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
        <span>Съгласен съм да получавам новини от "Happy Colors"</span>
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
