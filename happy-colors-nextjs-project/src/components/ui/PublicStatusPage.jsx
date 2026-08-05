'use client';

import { Home, RotateCcw } from 'lucide-react';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import useTranslations from '@/i18n/useTranslations';
import styles from './PublicStatusPage.module.css';

export function PublicStatusPageView({
  title,
  description,
  homeHref,
  homeLabel,
  retryLabel,
  statusCode,
  onRetry,
}) {
  return (
    <section className={styles.statusPage} aria-labelledby="public-status-title">
      {statusCode ? <p className={styles.statusCode}>{statusCode}</p> : null}
      <h1 id="public-status-title" className={styles.title}>
        {title}
      </h1>
      <p className={styles.description}>{description}</p>
      <div className={styles.actions}>
        {onRetry ? (
          <button className={styles.primaryAction} type="button" onClick={onRetry}>
            <RotateCcw aria-hidden="true" size={19} />
            <span>{retryLabel}</span>
          </button>
        ) : null}
        <a className={styles.secondaryAction} href={homeHref}>
          <Home aria-hidden="true" size={19} />
          <span>{homeLabel}</span>
        </a>
      </div>
    </section>
  );
}

export default function PublicStatusPage({
  titleKey,
  descriptionKey,
  statusCode,
  onRetry,
}) {
  const { publicHref } = useLocaleNavigation();
  const { t } = useTranslations();

  return (
    <PublicStatusPageView
      title={t(titleKey)}
      description={t(descriptionKey)}
      homeHref={publicHref('/')}
      homeLabel={t('navigation.home')}
      retryLabel={t('common.retry')}
      statusCode={statusCode}
      onRetry={onRetry}
    />
  );
}
