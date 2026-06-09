'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle, ExternalLink, RefreshCw, Save } from 'lucide-react';
import MessageBox from '@/components/ui/MessageBox';
import { useAuth } from '@/context/AuthContext';
import {
  completeCartoonOrder,
  fetchCartoonOrders,
  updateCartoonOrderAdminNotes,
  updateCartoonOrderStatuses,
} from '@/managers/cartoonOrdersManager';
import styles from './cartoonOrders.module.css';

const STATUS_LABELS = {
  ordered: 'Поръчано',
  designApproved: 'Одобрен дизайн',
  paid: 'Платено',
};

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleDateString('bg-BG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function replaceOrder(orders, updatedOrder) {
  return orders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order));
}

export default function CartoonOrdersClientPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [notesDrafts, setNotesDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isFullAdmin = user?.role === 'full_admin';

  const loadOrders = useCallback(async () => {
    if (!isFullAdmin) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await fetchCartoonOrders({ includeArchived });
      const nextOrders = Array.isArray(data) ? data : [];

      setOrders(nextOrders);
      setNotesDrafts(
        nextOrders.reduce((acc, order) => {
          acc[order._id] = order.adminNotes || '';
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err.message || 'Неуспешно зареждане на шарж поръчките.');
    } finally {
      setLoading(false);
    }
  }, [includeArchived, isFullAdmin]);

  useEffect(() => {
    if (!authLoading) {
      loadOrders();
    }
  }, [authLoading, loadOrders]);

  const openOrdersCount = useMemo(
    () => orders.filter((order) => !order.archivedAt).length,
    [orders]
  );

  async function handleStatusChange(order, key, checked) {
    setSavingId(order._id);
    setError('');
    setMessage('');

    try {
      const updatedOrder = await updateCartoonOrderStatuses(order._id, {
        ...order.statuses,
        [key]: checked,
      });

      setOrders((prev) => replaceOrder(prev, updatedOrder));
      setMessage('Статусът е обновен.');
    } catch (err) {
      setError(err.message || 'Неуспешно обновяване на статуса.');
    } finally {
      setSavingId('');
    }
  }

  async function handleSaveNotes(order) {
    setSavingId(order._id);
    setError('');
    setMessage('');

    try {
      const updatedOrder = await updateCartoonOrderAdminNotes(
        order._id,
        notesDrafts[order._id] || ''
      );

      setOrders((prev) => replaceOrder(prev, updatedOrder));
      setNotesDrafts((prev) => ({ ...prev, [updatedOrder._id]: updatedOrder.adminNotes || '' }));
      setMessage('Бележките са запазени.');
    } catch (err) {
      setError(err.message || 'Неуспешно запазване на бележките.');
    } finally {
      setSavingId('');
    }
  }

  async function handleComplete(order) {
    const confirmed = window.confirm(
      'Да маркирам ли поръчката като завършена? Качените клиентски снимки ще бъдат изтрити.'
    );

    if (!confirmed) {
      return;
    }

    setSavingId(order._id);
    setError('');
    setMessage('');

    try {
      const updatedOrder = await completeCartoonOrder(order._id);

      setOrders((prev) => replaceOrder(prev, updatedOrder));
      setNotesDrafts((prev) => ({ ...prev, [updatedOrder._id]: updatedOrder.adminNotes || '' }));
      setMessage('Поръчката е завършена и снимките са изтрити.');
    } catch (err) {
      setError(err.message || 'Неуспешно приключване на поръчката.');
    } finally {
      setSavingId('');
    }
  }

  if (authLoading) {
    return <p className="pageInline">Зареждане...</p>;
  }

  if (!isFullAdmin) {
    return (
      <MessageBox
        type="error"
        message="Тази страница е достъпна само за full admin потребители."
      />
    );
  }

  return (
    <section className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h1>Шарж поръчки</h1>
          <p>{openOrdersCount} активни поръчки</p>
        </div>

        <div className={styles.toolbar}>
          <label className={styles.archiveToggle}>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(event) => setIncludeArchived(event.target.checked)}
            />
            Покажи архивирани
          </label>
          <button type="button" className={styles.secondaryButton} onClick={loadOrders}>
            <RefreshCw size={18} aria-hidden="true" /> Обнови
          </button>
        </div>
      </div>

      {message ? <div className={styles.message}>{message}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {loading ? <p className={styles.emptyState}>Зареждане на поръчките...</p> : null}
      {!loading && orders.length === 0 ? (
        <p className={styles.emptyState}>Няма шарж поръчки за показване.</p>
      ) : null}

      <div className={styles.orderList}>
        {orders.map((order) => {
          const isSaving = savingId === order._id;
          const isCompleted = Boolean(order.completedAt);
          const customer = order.customer || {};
          const productSnapshot = order.productSnapshot || {};
          const photos = Array.isArray(order.photos) ? order.photos : [];
          const activePhotos = photos.filter((photo) => !photo.deletedAt);

          return (
            <article key={order._id} className={styles.orderItem}>
              <div className={styles.orderSummary}>
                <div>
                  <h2>{customer.name || 'Клиент без име'}</h2>
                  <p>
                    {customer.email || '-'}
                    {customer.phone ? ` · ${customer.phone}` : ''}
                  </p>
                  <p className={styles.metaLine}>
                    {productSnapshot.title || 'Продукт без заглавие'} · {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className={styles.orderState}>
                  {isCompleted ? (
                    <span className={styles.archivedBadge}>
                      <Archive size={16} aria-hidden="true" /> Архивирана
                    </span>
                  ) : (
                    <span className={styles.openBadge}>Активна</span>
                  )}
                  {order.requiresAdminAttention ? (
                    <span className={styles.attentionBadge}>Внимание</span>
                  ) : null}
                </div>
              </div>

              <p className={styles.brief}>{customer.message || 'Няма описание.'}</p>

              <div className={styles.statusGrid}>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <label key={key} className={styles.statusToggle}>
                    <input
                      type="checkbox"
                      checked={order.statuses?.[key] === true}
                      disabled={isSaving || isCompleted}
                      onChange={(event) => handleStatusChange(order, key, event.target.checked)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <div className={styles.photos}>
                <h3>Снимки</h3>
                {activePhotos.length > 0 ? (
                  <ul>
                    {activePhotos.map((photo) => (
                      <li key={photo.objectName}>
                        {photo.readUrl ? (
                          <a href={photo.readUrl} target="_blank" rel="noreferrer">
                            <ExternalLink size={16} aria-hidden="true" />
                            {photo.originalName || photo.objectName}
                          </a>
                        ) : (
                          <span>{photo.originalName || photo.objectName}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Снимките са изтрити.</p>
                )}
              </div>

              <div className={styles.notesRow}>
                <label htmlFor={`notes-${order._id}`}>Админ бележки</label>
                <textarea
                  id={`notes-${order._id}`}
                  value={notesDrafts[order._id] || ''}
                  maxLength={2000}
                  disabled={isSaving}
                  onChange={(event) =>
                    setNotesDrafts((prev) => ({
                      ...prev,
                      [order._id]: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => handleSaveNotes(order)}
                  disabled={isSaving}
                >
                  <Save size={18} aria-hidden="true" /> Запази
                </button>
              </div>

              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.completeButton}
                  onClick={() => handleComplete(order)}
                  disabled={isSaving || isCompleted}
                >
                  <CheckCircle size={18} aria-hidden="true" />
                  {isCompleted ? 'Завършена' : 'Завършена'}
                </button>
                {isCompleted ? (
                  <span className={styles.metaLine}>Приключена на {formatDate(order.completedAt)}</span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
