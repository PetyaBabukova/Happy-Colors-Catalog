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

const DEFAULT_CTA_LABELS = {
  bg: 'Виж повече',
  en: 'View more',
};

const LOCALE_OPTIONS = [
  { value: 'bg', label: 'Български' },
  { value: 'en', label: 'English' },
];

function createEmptyLocaleContent(locale) {
  return {
    subject: '',
    ...initialEditorState,
    ctaLabel: DEFAULT_CTA_LABELS[locale],
  };
}

const initialFormState = {
  sourceType: 'custom',
  imageUrl: 'https://happycolors.eu/logo_64pxH.svg',
  ctaUrl: '/products',
  contentByLocale: {
    bg: createEmptyLocaleContent('bg'),
    en: createEmptyLocaleContent('en'),
  },
};

function buildPayload(formValues, selectedLocales) {
  const contentByLocale = selectedLocales.reduce((content, locale) => {
    content[locale] = formValues.contentByLocale[locale];
    return content;
  }, {});

  return {
    contentByLocale,
    sourceType: formValues.sourceType || 'custom',
    locales: selectedLocales,
    ...(formValues.sourceId ? { sourceId: formValues.sourceId } : {}),
  };
}

function countSelectedSubscribers(counts, selectedLocales) {
  return selectedLocales.reduce((total, locale) => total + Number(counts?.[locale] || 0), 0);
}

function labelForLocale(locale) {
  return LOCALE_OPTIONS.find((option) => option.value === locale)?.label || locale.toUpperCase();
}

function mergePrefillContent(currentContentByLocale, prefill) {
  return LOCALE_OPTIONS.reduce((contentByLocale, option) => {
    const locale = option.value;
    const prefillContent = prefill?.contentByLocale?.[locale] || (locale === 'bg' ? prefill : null);

    if (!prefillContent) {
      return contentByLocale;
    }

    const currentContent = currentContentByLocale[locale] || createEmptyLocaleContent(locale);

    return {
      ...contentByLocale,
      [locale]: {
        ...currentContent,
        subject: prefillContent.subject || '',
        contentHtml: prefillContent.contentHtml || '<p></p>',
        contentJson: prefillContent.contentJson || currentContent.contentJson,
        contentText: prefillContent.contentText || '',
        ctaLabel: prefillContent.ctaLabel || currentContent.ctaLabel,
      },
    };
  }, currentContentByLocale);
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
  const [activeContentLocale, setActiveContentLocale] = useState('bg');
  const activeContent = formValues.contentByLocale[activeContentLocale] || formValues.contentByLocale.bg;

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
          sourceType: source,
          sourceId: prefill.sourceId || id,
          imageUrl: prefill.imageUrl || current.imageUrl,
          ctaUrl: prefill.ctaUrl || current.ctaUrl,
          contentByLocale: mergePrefillContent(current.contentByLocale, prefill),
        }));
        setActiveContentLocale('bg');
      } catch (error) {
        if (isMounted) {
          setStatus(error?.message || 'Не успяхме да заредим данните за източника.', 'error');
        }
      }
    }

    loadPrefill();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  function updateLocaleContent(locale, updates) {
    setFormValues((current) => ({
      ...current,
      contentByLocale: {
        ...current.contentByLocale,
        [locale]: {
          ...current.contentByLocale[locale],
          ...updates,
        },
      },
    }));
  }

  function updateSubject(value) {
    updateLocaleContent(activeContentLocale, { subject: value });
  }

  function updateEditor(value) {
    updateLocaleContent(activeContentLocale, value);
  }

  function updateCtaLabel(value) {
    updateLocaleContent(activeContentLocale, { ctaLabel: value });
  }

  function toggleLocale(locale) {
    setSelectedLocales((current) => {
      const nextLocales = current.includes(locale)
        ? current.filter((value) => value !== locale)
        : [...current, locale];

      if (!nextLocales.includes(activeContentLocale) && nextLocales.length > 0) {
        setActiveContentLocale(nextLocales[0]);
      }

      return nextLocales;
    });
  }

  function setStatus(nextMessage, nextType) {
    setMessage(nextMessage);
    setMessageType(nextType);
  }

  function validateForm() {
    if (selectedLocales.length === 0) {
      setStatus('Моля, изберете поне един език за кампанията.', 'error');
      return false;
    }

    for (const locale of selectedLocales) {
      const content = formValues.contentByLocale[locale];

      if (!content?.subject?.trim()) {
        setActiveContentLocale(locale);
        setStatus(`Моля, въведете тема на имейла за ${labelForLocale(locale)}.`, 'error');
        return false;
      }

      if (!String(content?.contentText || '').trim()) {
        setActiveContentLocale(locale);
        setStatus(`Моля, въведете съдържание на имейла за ${labelForLocale(locale)}.`, 'error');
        return false;
      }
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
            <div className={styles.localeTabs} role="tablist" aria-label="Съдържание по език">
              {LOCALE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="tab"
                  aria-selected={activeContentLocale === option.value}
                  className={`${styles.localeTab} ${activeContentLocale === option.value ? styles.localeTabActive : ''}`}
                  onClick={() => setActiveContentLocale(option.value)}
                >
                  {option.value.toUpperCase()}
                </button>
              ))}
            </div>
          </fieldset>

          <label className={styles.field}>
            <span>Тема ({activeContentLocale.toUpperCase()})</span>
            <input
              type="text"
              value={activeContent.subject}
              onChange={(event) => updateSubject(event.target.value)}
              maxLength={160}
              className={styles.input}
            />
          </label>

          <label className={styles.field}>
            <span>Бутон ({activeContentLocale.toUpperCase()})</span>
            <input
              type="text"
              value={activeContent.ctaLabel}
              onChange={(event) => updateCtaLabel(event.target.value)}
              maxLength={80}
              className={styles.input}
            />
          </label>

          <div className={styles.field}>
            <span>Съдържание ({activeContentLocale.toUpperCase()})</span>
            <RichTextEditor
              key={activeContentLocale}
              id={`newsletter-content-${activeContentLocale}`}
              value={activeContent.contentHtml}
              onChange={updateEditor}
            />
          </div>

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
              <dt>Бутони</dt>
              <dd>
                {selectedLocales.map((locale) => (
                  <span key={locale} className={styles.summaryLine}>
                    {locale.toUpperCase()}: {formValues.contentByLocale[locale]?.ctaLabel || DEFAULT_CTA_LABELS[locale]}
                  </span>
                ))}
              </dd>
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
