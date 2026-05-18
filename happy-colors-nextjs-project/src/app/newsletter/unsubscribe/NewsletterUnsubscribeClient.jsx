'use client';

import Link from 'next/link';
import { useState } from 'react';
import { unsubscribeFromNewsletter } from '@/managers/newsletterManager';
import styles from './newsletterUnsubscribe.module.css';

export default function NewsletterUnsubscribeClient({ token }) {
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasToken = Boolean(String(token || '').trim());

  async function handleUnsubscribe() {
    if (!hasToken) {
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setMessageType('');

    try {
      const result = await unsubscribeFromNewsletter(token);
      setMessage(result?.message || 'Успешно се отписахте.');
      setMessageType('success');
    } catch (error) {
      setMessage(error?.message || 'Не успяхме да ви отпишем.');
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="newsletter-unsubscribe-title">
        <h1 id="newsletter-unsubscribe-title" className={styles.title}>
          Отписване от новини
        </h1>

        {hasToken ? (
          <>
            <p className={styles.copy}>
              Потвърдете, че искате да спрете да получавате новини от Happy Colors.
            </p>
            <div className={styles.actions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={handleUnsubscribe}
                disabled={isSubmitting || messageType === 'success'}
              >
                {isSubmitting ? 'Отписване...' : 'Отпиши ме'}
              </button>
              <Link className={styles.secondaryLink} href="/">
                Към началната страница
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className={styles.copy}>Линкът за отписване е невалиден или непълен.</p>
            <Link className={styles.secondaryLink} href="/">
              Към началната страница
            </Link>
          </>
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
