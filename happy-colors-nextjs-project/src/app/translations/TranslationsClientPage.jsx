'use client';

import { useEffect, useMemo, useState } from 'react';
import MessageBox from '@/components/ui/MessageBox';
import {
  acceptCurrentTranslation,
  approveTranslationDraft,
  generateTranslation,
  getTranslationQueue,
  rejectTranslationDraft,
  saveManualTranslation,
} from '@/managers/translationsManager';
import styles from './translations.module.css';

const ENTITY_LABELS = {
  product: 'Продукт',
  category: 'Категория',
  blogArticle: 'Блог статия',
  homeBanner: 'Банер',
};

const STATUS_LABELS = {
  current: 'Актуален EN превод',
  missing: 'Липсва EN превод',
  needs_decision: 'BG е променен',
  pending_review: 'EN чернова за преглед',
  outdated_draft: 'Остаряла EN чернова',
};

const FIELD_CONFIG = {
  product: [
    { name: 'title', label: 'EN заглавие', type: 'text' },
    { name: 'description', label: 'EN описание', type: 'textarea' },
  ],
  category: [{ name: 'name', label: 'EN име', type: 'text' }],
  blogArticle: [
    { name: 'title', label: 'EN заглавие', type: 'text' },
    { name: 'contentHtml', label: 'EN HTML съдържание', type: 'textarea' },
    { name: 'heroImageAlt', label: 'EN alt текст', type: 'text' },
    { name: 'seoTitle', label: 'EN SEO title', type: 'text' },
    { name: 'seoDescription', label: 'EN SEO description', type: 'textarea' },
  ],
  homeBanner: [
    { name: 'title', label: 'EN заглавие', type: 'text' },
    { name: 'description', label: 'EN описание', type: 'textarea' },
    { name: 'ctaLabel', label: 'EN CTA текст', type: 'text' },
  ],
};

function buildManualPayload(item, fields) {
  const payload = {
    expectedSourceRevision: item.sourceRevision,
    fields,
  };

  if (item.activation === 'draft') {
    payload.expectedDraftRevision = item.draftRevision || 0;
  } else {
    payload.expectedTranslationRevision = item.translationRevision || 0;
  }

  return payload;
}

function buildDraftPayload(item) {
  return {
    expectedSourceRevision: item.sourceRevision,
    expectedDraftRevision: item.draftRevision || 0,
  };
}

function buildAcceptPayload(item) {
  return {
    expectedSourceRevision: item.sourceRevision,
    expectedTranslationRevision: item.translationRevision || 0,
  };
}

function getItemKey(item) {
  return `${item.entityType}:${item.entityId}:${item.locale}`;
}

function buildInitialFields(item, fields) {
  const source = item.draft || item.translation || {};

  return fields.reduce((acc, field) => {
    acc[field.name] = source[field.name] || '';
    return acc;
  }, {});
}

function getManualToggleLabel(item, isEditing) {
  if (isEditing) {
    return 'Затвори редакцията';
  }

  return item.translationRevision > 0 || item.draftRevision > 0
    ? 'Редактирай EN'
    : 'Ръчен превод';
}

function getManualSaveLabel(item) {
  if (item.activation === 'draft' && (item.translationRevision > 0 || item.draftRevision > 0)) {
    return 'Запази промените';
  }

  return item.activation === 'draft' ? 'Запази EN чернова' : 'Запази EN';
}

export default function TranslationsClientPage({
  targetEntityType = '',
  targetEntityId = '',
}) {
  const [queue, setQueue] = useState({ items: [], unresolvedCount: 0 });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [draftFields, setDraftFields] = useState({});
  const [autoOpenedTargetKey, setAutoOpenedTargetKey] = useState('');

  const items = useMemo(() => queue.items || [], [queue.items]);

  async function loadQueue({ preserveMessage = false } = {}) {
    setLoading(true);
    if (!preserveMessage) {
      setMessage('');
      setMessageType('');
    }

    try {
      setQueue(
        await getTranslationQueue({
          locale: 'en',
          entityType: targetEntityType,
          entityId: targetEntityId,
        })
      );
    } catch (error) {
      setMessage(error?.message || 'Не успяхме да заредим опашката за преводи.');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, [targetEntityId, targetEntityType]);

  useEffect(() => {
    setEditingId('');
    setAutoOpenedTargetKey('');
  }, [targetEntityId, targetEntityType]);

  useEffect(() => {
    if (!targetEntityType || !targetEntityId || editingId || autoOpenedTargetKey) {
      return;
    }

    const targetItem = items.find(
      (item) => item.entityType === targetEntityType && item.entityId === targetEntityId
    );

    if (!targetItem) {
      return;
    }

    const fields = FIELD_CONFIG[targetItem.entityType] || [];
    const itemKey = getItemKey(targetItem);

    setDraftFields((current) => ({
      ...current,
      [itemKey]: current[itemKey] || buildInitialFields(targetItem, fields),
    }));
    setEditingId(itemKey);
    setAutoOpenedTargetKey(itemKey);
  }, [autoOpenedTargetKey, editingId, items, targetEntityId, targetEntityType]);

  function updateDraftField(itemKey, fieldName, value) {
    setDraftFields((current) => ({
      ...current,
      [itemKey]: {
        ...(current[itemKey] || {}),
        [fieldName]: value,
      },
    }));
  }

  function toggleEditing(item, fields) {
    const itemKey = getItemKey(item);

    if (editingId === itemKey) {
      setEditingId('');
      return;
    }

    setDraftFields((current) => ({
      ...current,
      [itemKey]: current[itemKey] || buildInitialFields(item, fields),
    }));
    setEditingId(itemKey);
  }

  async function runAction(item, action) {
    const actionId = `${item.entityType}:${item.entityId}:${action}`;
    setBusyId(actionId);
    setMessage('');
    setMessageType('');

    try {
      if (action === 'accept') {
        await acceptCurrentTranslation({
          entityType: item.entityType,
          entityId: item.entityId,
          locale: item.locale,
          ...buildAcceptPayload(item),
        });
      } else if (action === 'approve') {
        await approveTranslationDraft({
          entityType: item.entityType,
          entityId: item.entityId,
          locale: item.locale,
          ...buildDraftPayload(item),
        });
      } else if (action === 'reject') {
        await rejectTranslationDraft({
          entityType: item.entityType,
          entityId: item.entityId,
          locale: item.locale,
          ...buildDraftPayload(item),
        });
      } else if (action === 'generate') {
        await generateTranslation({
          entityType: item.entityType,
          entityId: item.entityId,
          locale: item.locale,
          ...(item.activation === 'draft' ? buildDraftPayload(item) : buildAcceptPayload(item)),
        });
      } else if (action === 'save') {
        await saveManualTranslation({
          entityType: item.entityType,
          entityId: item.entityId,
          locale: item.locale,
          ...buildManualPayload(item, draftFields[getItemKey(item)] || {}),
        });
        setEditingId('');
        setDraftFields((current) => {
          const next = { ...current };
          delete next[getItemKey(item)];
          return next;
        });
      }

      setMessage(
        action === 'save' && item.activation === 'draft'
          ? 'Корекциите са запазени като EN чернова за преглед.'
          : 'Промяната е запазена.'
      );
      setMessageType('success');
      await loadQueue({ preserveMessage: true });
    } catch (error) {
      setMessage(error?.message || 'Промяната не беше запазена.');
      setMessageType('error');
    } finally {
      setBusyId('');
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <h1>EN преводи</h1>
          <p>Опашка за публично съдържание, което липсва, чака решение или има чернова.</p>
        </div>
        <button type="button" onClick={loadQueue} disabled={loading}>
          Обнови
        </button>
      </section>

      {targetEntityType && targetEntityId ? (
        <MessageBox
          type="info"
          message="Управление на английския превод за избрания запис."
        />
      ) : null}

      {message ? <MessageBox type={messageType || 'info'} message={message} /> : null}

      <section className={styles.summary} aria-live="polite">
        <strong>{queue.unresolvedCount || 0}</strong>
        <span>нерешени EN задачи</span>
      </section>

      {loading ? <p>Зареждане...</p> : null}

      {!loading && items.length === 0 ? (
        <MessageBox type="success" message="Няма нерешени EN преводи." />
      ) : null}

      <div className={styles.list}>
        {items.map((item) => {
          const itemKey = getItemKey(item);
          const itemBusyPrefix = `${item.entityType}:${item.entityId}:`;
          const isBusy = busyId.startsWith(itemBusyPrefix);
          const isEditing = editingId === itemKey;
          const fields = FIELD_CONFIG[item.entityType] || [];

          return (
            <article key={`${item.entityType}-${item.entityId}`} className={styles.item}>
              <div className={styles.itemHeader}>
                <div>
                  <span className={styles.type}>{ENTITY_LABELS[item.entityType] || item.entityType}</span>
                  <h2>{item.label || 'Без заглавие'}</h2>
                </div>
                <span className={styles.status}>{STATUS_LABELS[item.status] || item.status}</span>
              </div>

              <dl className={styles.meta}>
                <div>
                  <dt>Source revision</dt>
                  <dd>{item.sourceRevision}</dd>
                </div>
                <div>
                  <dt>EN revision</dt>
                  <dd>{item.translationRevision || 0}</dd>
                </div>
                <div>
                  <dt>Draft revision</dt>
                  <dd>{item.draftRevision || 0}</dd>
                </div>
              </dl>

              <div className={styles.actions}>
                {item.translationRevision > 0 && item.status !== 'current' && !item.draftRevision ? (
                  <button
                    type="button"
                    onClick={() => runAction(item, 'accept')}
                    disabled={isBusy}
                  >
                    Приеми текущия EN
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => runAction(item, 'generate')}
                  disabled={isBusy}
                >
                  Генерирай EN
                </button>
                {item.status === 'pending_review' ? (
                  <button
                    type="button"
                    onClick={() => runAction(item, 'approve')}
                    disabled={isBusy}
                  >
                    Одобри чернова
                  </button>
                ) : null}
                {item.draftRevision > 0 ? (
                  <button
                    type="button"
                    onClick={() => runAction(item, 'reject')}
                    disabled={isBusy}
                  >
                    Отхвърли чернова
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => toggleEditing(item, fields)}
                  disabled={isBusy}
                >
                  {getManualToggleLabel(item, isEditing)}
                </button>
              </div>

              {isEditing ? (
                <div className={styles.editor}>
                  {fields.map((field) => {
                    const value = draftFields[itemKey]?.[field.name] || '';

                    return (
                      <label key={field.name} className={styles.field}>
                        <span>{field.label}</span>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={value}
                            onChange={(event) => updateDraftField(itemKey, field.name, event.target.value)}
                            rows={field.name === 'contentHtml' ? 8 : 4}
                          />
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={(event) => updateDraftField(itemKey, field.name, event.target.value)}
                          />
                        )}
                      </label>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => runAction(item, 'save')}
                    disabled={isBusy}
                  >
                    {getManualSaveLabel(item)}
                  </button>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </main>
  );
}
