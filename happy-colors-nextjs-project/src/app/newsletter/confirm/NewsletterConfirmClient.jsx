'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import useTranslations from '@/i18n/useTranslations';
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
  const { publicHref } = useLocaleNavigation();
  const { t } = useTranslations('newsletter.confirmPage');
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
      await confirmNewsletterSubscription(token);
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

  const hasToken = Boolean(token);

  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="newsletter-confirm-title">
        <h1 id="newsletter-confirm-title" className={styles.title}>
          {t('title')}
        </h1>

        {hasReadHash && hasToken ? (
          <>
            <p className={styles.copy}>{t('copy')}</p>
            <div className={styles.actions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={handleConfirm}
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
