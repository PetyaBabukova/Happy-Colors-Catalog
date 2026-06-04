'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmNewsletterSubscription } from '@/managers/newsletterManager';
import styles from './newsletterConfirm.module.css';

const SUCCESS_REDIRECT_DELAY_MS = 3000;

function readTokenFromHash() {
  const hash = String(window.location.hash || '').replace(/^#/, '');
  const params = new URLSearchParams(hash);

  return String(params.get('token') || '').trim();
}

export default function NewsletterConfirmClient() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [hasReadHash, setHasReadHash] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const nextToken = readTokenFromHash();

    setToken(nextToken);
    setHasReadHash(true);

    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  async function handleConfirm() {
    if (!token) {
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    setMessageType('');

    try {
      const result = await confirmNewsletterSubscription(token);
      setMessage(result?.message || 'Абонаментът ви е потвърден успешно.');
      setMessageType('success');
      window.setTimeout(() => {
        router.replace('/products');
      }, SUCCESS_REDIRECT_DELAY_MS);
    } catch (error) {
      setMessage(
        error?.message ||
          'Линкът за потвърждение е невалиден или изтекъл. Моля, изпратете формата за абонамент отново.'
      );
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const hasToken = Boolean(token);

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="newsletter-confirm-title">
        <h1 id="newsletter-confirm-title" className={styles.title}>
          Потвърждение на абонамент
        </h1>

        {hasReadHash && hasToken ? (
          <>
            <p className={styles.copy}>
              Потвърдете абонамента си за новини от Happy Colors.
            </p>
            <div className={styles.actions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || messageType === 'success'}
              >
                {isSubmitting ? 'Потвърждаване...' : 'Потвърди абонамента'}
              </button>
              <Link className={styles.secondaryLink} href="/">
                Към началната страница
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className={styles.copy}>Линкът за потвърждение е невалиден или непълен.</p>
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
