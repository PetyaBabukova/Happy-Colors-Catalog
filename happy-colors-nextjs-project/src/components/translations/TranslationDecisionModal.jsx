'use client';

import { CheckCircle, Languages, XCircle } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import styles from './TranslationDecisionModal.module.css';

export default function TranslationDecisionModal({
  decision,
  entityLabel = 'product',
  busyAction = '',
  error = '',
  onYes,
  onNo,
  onDismiss,
}) {
  const titleId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onDismiss?.();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onDismiss]);

  if (!decision) {
    return null;
  }

  const isBusy = Boolean(busyAction);

  return (
    <div className={styles.overlay} role="presentation">
      <section
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className={styles.iconWrap} aria-hidden="true">
          <Languages size={24} />
        </div>
        <h2 id={titleId}>The Bulgarian text has changed.</h2>
        <p>
          Do you want to update the English translation for this {entityLabel}?
        </p>
        <p className={styles.meta}>
          Source revision {decision.sourceRevision}; current EN revision{' '}
          {decision.translationRevision || 0}.
        </p>
        <p className={styles.helper}>
          Yes generates and validates a new EN translation. No keeps the current
          EN text and accepts it for this Bulgarian revision.
        </p>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onNo} disabled={isBusy}>
            <XCircle size={18} aria-hidden="true" />
            {busyAction === 'no' ? 'Saving...' : 'No, keep current EN'}
          </button>
          <button type="button" className={styles.primary} onClick={onYes} disabled={isBusy}>
            <CheckCircle size={18} aria-hidden="true" />
            {busyAction === 'yes' ? 'Generating...' : 'Yes, update EN'}
          </button>
        </div>

        <button type="button" className={styles.laterButton} onClick={onDismiss} disabled={isBusy}>
          Decide later in /translations
        </button>
      </section>
    </div>
  );
}
