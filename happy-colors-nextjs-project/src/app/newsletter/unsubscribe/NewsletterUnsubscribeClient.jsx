'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import useTranslations from '@/i18n/useTranslations';
import { unsubscribeFromNewsletter } from '@/managers/newsletterManager';
import styles from './newsletterUnsubscribe.module.css';

const SUCCESS_REDIRECT_DELAY_MS = 2500;

export default function NewsletterUnsubscribeClient({ token }) {
  const router = useRouter();
  const { publicHref } = useLocaleNavigation();
  const { t } = useTranslations('newsletter.unsubscribePage');
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
      await unsubscribeFromNewsletter(token);
      setMessage(t('success'));
      setMessageType('success');
      window.setTimeout(() => {
        router.replace(publicHref('/products'));
      }, SUCCESS_REDIRECT_DELAY_MS);
    } catch {
      setMessage(t('error'));
      setMessageType('error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="newsletter-unsubscribe-title">
        <h1 id="newsletter-unsubscribe-title" className={styles.title}>
          {t('title')}
        </h1>

        {hasToken ? (
          <>
            <p className={styles.copy}>{t('copy')}</p>
            <div className={styles.actions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={handleUnsubscribe}
                disabled={isSubmitting || messageType === 'success'}
              >
                {isSubmitting ? t('submitting') : t('submit')}
              </button>
              <Link className={styles.secondaryLink} href={publicHref('/')}>
                {t('home')}
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className={styles.copy}>{t('missingToken')}</p>
            <Link className={styles.secondaryLink} href={publicHref('/')}>
              {t('home')}
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
