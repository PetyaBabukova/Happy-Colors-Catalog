'use client';

import { useState } from 'react';
import { subscribeToNewsletter } from '@/managers/newsletterManager';
import styles from './NewsletterSubscribeForm.module.css';

const initialFormState = {
  email: '',
  consent: false,
  website: '',
};

export default function NewsletterSubscribeForm() {
  const [formValues, setFormValues] = useState(initialFormState);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    try {
      const result = await subscribeToNewsletter({
        email: formValues.email,
        consent: formValues.consent,
        website: formValues.website,
      });

      setFormValues(initialFormState);
      setMessage(result?.message || 'Успешно се абонирахте.');
      setMessageType(result?.status === 'already_subscribed' ? 'error' : 'success');
    } catch (error) {
      setMessage('Не успяхте да се абонирате. Моля опитайте по-късно.');
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
