'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import RichTextEditor from '@/components/blog/RichTextEditor';
import {
  getBlogNewsletterPrefill,
  getProductNewsletterPrefill,
  getNewsletterSendStatus,
  sendNewsletterTest,
  sendNewsletterToSubscribers,
} from '@/managers/newsletterSendManager';
import styles from './newsletterSend.module.css';

const initialEditorState = {
  contentHtml: '<p></p>',
  contentJson: {
    type: 'doc',
    content: [{ type: 'paragraph' }],
  },
  contentText: '',
};

const initialFormState = {
  subject: '',
  ...initialEditorState,
  sourceType: 'custom',
  imageUrl: 'https://happycolors.eu/logo_64pxH.svg',
  ctaUrl: '/products',
  ctaLabel: 'Виж повече',
};

const LOCALE_OPTIONS = [
  { value: 'bg', label: 'Български' },
  { value: 'en', label: 'English' },
];

function buildPayload(formValues, selectedLocales) {
  return {
    subject: formValues.subject,
    contentHtml: formValues.contentHtml,
    contentJson: formValues.contentJson,
    contentText: formValues.contentText,
    sourceType: formValues.sourceType || 'custom',
    locales: selectedLocales,
    ...(formValues.sourceId ? { sourceId: formValues.sourceId } : {}),
  };
}

function countSelectedSubscribers(counts, selectedLocales) {
  return selectedLocales.reduce((total, locale) => total + Number(counts?.[locale] || 0), 0);
}

export default function NewsletterSendClient() {
  const searchParams = useSearchParams();
  const [formValues, setFormValues] = useState(initialFormState);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeSubscribers, setActiveSubscribers] = useState(null);
  const [activeSubscribersByLocale, setActiveSubscribersByLocale] = useState({ bg: 0, en: 0 });
  const [selectedLocales, setSelectedLocales] = useState(['bg', 'en']);

  useEffect(() => {
    const source = searchParams?.get('source');
    const id = searchParams?.get('id');

    if (!['blog', 'product'].includes(source) || !id) {
      return undefined;
    }

    let isMounted = true;

    async function loadPrefill() {
      setStatus('', '');

      try {
        const prefill =
          source === 'blog'
            ? await getBlogNewsletterPrefill(id)
            : await getProductNewsletterPrefill(id);

        if (!isMounted) {
          return;
        }

        setFormValues((current) => ({
          ...current,
          subject: prefill.subject || '',
          contentHtml: prefill.contentHtml || '<p></p>',
          contentJson: prefill.contentJson || current.contentJson,
          contentText: prefill.contentText || '',
          sourceType: source,
          sourceId: prefill.sourceId || id,
          imageUrl: prefill.imageUrl || current.imageUrl,
          ctaUrl: prefill.ctaUrl || current.ctaUrl,
          ctaLabel: prefill.ctaLabel || current.ctaLabel,
        }));
      } catch (error) {
        if (isMounted) {
          setStatus(error?.message || 'Не успяхме да заредим данните за продукта.', 'error');
        }
      }
    }

    loadPrefill();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  function updateSubject(value) {
    setFormValues((current) => ({
      ...current,
      subject: value,
    }));
  }

  function updateEditor(value) {
    setFormValues((current) => ({
      ...current,
      ...value,
    }));
  }

  function toggleLocale(locale) {
    setSelectedLocales((current) =>
      current.includes(locale) ? current.filter((value) => value !== locale) : [...current, locale]
    );
  }

  function setStatus(nextMessage, nextType) {
    setMessage(nextMessage);
    setMessageType(nextType);
  }

  function validateForm() {
    if (!formValues.subject.trim()) {
      setStatus('Моля, въведете тема на имейла.', 'error');
      return false;
    }

    if (!String(formValues.contentText || '').trim()) {
      setStatus('Моля, въведете съдържание на имейла.', 'error');
      return false;
    }

    if (selectedLocales.length === 0) {
      setStatus('Моля, изберете поне един език за кампанията.', 'error');
      return false;
    }

    return true;
  }

  async function handleTestSend() {
    setStatus('', '');

    if (!validateForm()) {
      return;
    }

    setIsSendingTest(true);

    try {
      const result = await sendNewsletterTest(buildPayload(formValues, selectedLocales));
      setStatus(result?.message || 'Тестовият имейл е изпратен.', 'success');
    } catch (error) {
      setStatus(error?.message || 'Не успяхме да изпратим тестовия имейл.', 'error');
    } finally {
      setIsSendingTest(false);
    }
  }

  async function handleOpenConfirm() {
    setStatus('', '');

    if (!validateForm()) {
      return;
    }

    setIsLoadingStatus(true);

    try {
      const result = await getNewsletterSendStatus();
      const counts = result?.activeSubscribersByLocale || { bg: Number(result?.activeSubscribers || 0), en: 0 };
      const count = countSelectedSubscribers(counts, selectedLocales);
      setActiveSubscribers(count);
      setActiveSubscribersByLocale(counts);

      if (count === 0) {
        setStatus('Няма активни абонати за избраните езици.', 'info');
        return;
      }

      setConfirmOpen(true);
    } catch (error) {
      setStatus(error?.message || 'Не успяхме да заредим броя активни абонати.', 'error');
    } finally {
      setIsLoadingStatus(false);
    }
  }

  async function handleConfirmSend() {
    setIsSendingBroadcast(true);
    setStatus('', '');

    try {
      const result = await sendNewsletterToSubscribers(buildPayload(formValues, selectedLocales));
      const failed = Number(result?.failed || 0);

      if (failed > 0) {
        setStatus(
          `Изпращането завърши с ${failed} неуспешни имейла. Изпратен е отчет до имейла на сайта.`,
          'warning'
        );
      } else {
        setStatus(result?.message || 'Имейлът е изпратен до абонатите.', 'success');
      }

      setConfirmOpen(false);
    } catch (error) {
      setStatus(error?.message || 'Не успяхме да изпратим имейла до абонатите.', 'error');
    } finally {
      setIsSendingBroadcast(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <h1>Изпращане на новини</h1>
      </section>

      <section className={styles.layout} aria-label="Форма за изпращане на новини">
        <div className={styles.formColumn}>
          <label className={styles.field}>
            <span>Тема</span>
            <input
              type="text"
              value={formValues.subject}
              onChange={(event) => updateSubject(event.target.value)}
              maxLength={160}
              className={styles.input}
            />
          </label>

          <div className={styles.field}>
            <span>Съдържание</span>
            <RichTextEditor
              id="newsletter-content"
              value={formValues.contentHtml}
              onChange={updateEditor}
            />
          </div>

          <fieldset className={styles.localeField}>
            <legend>Езици на кампанията</legend>
            <div className={styles.localeOptions}>
              {LOCALE_OPTIONS.map((option) => (
                <label key={option.value} className={styles.localeOption}>
                  <input
                    type="checkbox"
                    checked={selectedLocales.includes(option.value)}
                    onChange={() => toggleLocale(option.value)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {message ? (
            <p className={`${styles.message} ${styles[messageType] || ''}`} role="status">
              {message}
            </p>
          ) : null}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={handleTestSend}
              disabled={isSendingTest || isSendingBroadcast || isLoadingStatus}
            >
              {isSendingTest ? 'Изпращане...' : 'Изпрати тест'}
            </button>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={handleOpenConfirm}
              disabled={isSendingTest || isSendingBroadcast || isLoadingStatus}
            >
              {isLoadingStatus ? 'Проверка...' : 'Изпрати до абонати'}
            </button>
          </div>
        </div>

        <aside className={styles.summary} aria-label="Резюме">
          <dl>
            <div>
              <dt>Изображение</dt>
              <dd>{formValues.imageUrl}</dd>
            </div>
            <div>
              <dt>Линк</dt>
              <dd>{formValues.ctaUrl}</dd>
            </div>
            <div>
              <dt>Бутон</dt>
              <dd>{formValues.ctaLabel}</dd>
            </div>
            <div>
              <dt>Езици</dt>
              <dd>
                {selectedLocales
                  .map((locale) => LOCALE_OPTIONS.find((option) => option.value === locale)?.label)
                  .filter(Boolean)
                  .join(', ') || 'Няма избрани'}
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      {confirmOpen ? (
        <div className={styles.modalOverlay} role="presentation">
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="newsletter-confirm-title"
          >
            <h2 id="newsletter-confirm-title">Потвърждение</h2>
            <p>
              Сигурни ли сте, че искате да изпратите този имейл до {activeSubscribers} активни
              абонати?
            </p>
            <p className={styles.localeCounts}>
              {LOCALE_OPTIONS.filter((option) => selectedLocales.includes(option.value))
                .map((option) => `${option.label}: ${Number(activeSubscribersByLocale?.[option.value] || 0)}`)
                .join(' · ')}
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setConfirmOpen(false)}
                disabled={isSendingBroadcast}
              >
                Отказ
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleConfirmSend}
                disabled={isSendingBroadcast}
              >
                {isSendingBroadcast ? 'Изпращане...' : 'Потвърждавам'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
