'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  ExternalLink,
  RefreshCw,
  RotateCcw,
  Save,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import MessageBox from '@/components/ui/MessageBox';
import { useAuth } from '@/context/AuthContext';
import {
  completeCartoonOrder,
  fetchCartoonOrders,
  purgeOldCompletedCartoonOrders,
  rejectCartoonOrder,
  retryCartoonOrderNotifications,
  updateCartoonOrderAdminNotes,
  updateCartoonOrderStatuses,
  updateCartoonOrderWorkflow,
} from '@/managers/cartoonOrdersManager';
import styles from './cartoonOrders.module.css';

const STATUS_LABELS = {
  ordered: 'Поръчано',
  designApproved: 'Одобрен дизайн',
  paid: 'Платено',
};

const NOTIFICATION_LABELS = {
  admin: 'Админ',
  customer: 'Клиент',
};

const NOTIFICATION_STATUS_LABELS = {
  pending: 'изчаква',
  sent: 'изпратено',
  failed: 'грешка',
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

function getTimestamp(value) {
  const timestamp = new Date(value || 0).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function replaceOrder(orders, updatedOrder) {
  return orders.map((order) => (order._id === updatedOrder._id ? updatedOrder : order));
}

function getWorkflowStatus(order) {
  if (order?.completedAt) {
    return 'completed';
  }

  return ['inquiry', 'waiting', 'ordered', 'completed'].includes(order?.workflowStatus)
    ? order.workflowStatus
    : 'inquiry';
}

function getPhotoLabel(photo, index = 0) {
  return photo?.displayName || photo?.originalName || `Снимка ${index + 1}`;
}

function getNotificationChannels(order) {
  const notifications = order?.notifications || {};

  return ['admin', 'customer'].map((channel) => ({
    key: channel,
    label: NOTIFICATION_LABELS[channel],
    status: notifications[channel]?.status || 'pending',
    error: notifications[channel]?.error || '',
  }));
}

function hasRetryableNotifications(order) {
  return getNotificationChannels(order).some(
    (channel) => channel.status === 'failed' || channel.error
  );
}

function hasPhotoWarning(order) {
  return (order?.photos || []).some(
    (photo) => !photo.deletedAt && (photo.photoAccessStatus === 'unavailable' || photo.readUrlError)
  );
}

function OrderWarnings({ order }) {
  if (!order.requiresAdminAttention && !hasPhotoWarning(order)) {
    return null;
  }

  return (
    <span className={styles.warningBadge}>
      <AlertTriangle size={14} aria-hidden="true" />
      Нужно внимание
    </span>
  );
}

function NotificationStatus({ order }) {
  return (
    <div className={styles.notificationStatuses}>
      {getNotificationChannels(order).map((channel) => (
        <span
          key={channel.key}
          className={channel.status === 'failed' || channel.error ? styles.failedBadge : styles.infoBadge}
        >
          {channel.label}: {NOTIFICATION_STATUS_LABELS[channel.status] || channel.status}
        </span>
      ))}
    </div>
  );
}

function PhotoLinks({ order }) {
  const activePhotos = (order.photos || []).filter((photo) => !photo.deletedAt);

  if (activePhotos.length === 0) {
    return <span className={styles.mutedText}>Няма активни снимки</span>;
  }

  return (
    <ul className={styles.photoList}>
      {activePhotos.map((photo, index) => {
        const label = getPhotoLabel(photo, index);

        return (
          <li key={photo.photoId || `${order._id}-photo-${index}`}>
            {photo.readUrl ? (
              <a href={photo.readUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={14} aria-hidden="true" />
                {label}
              </a>
            ) : (
              <span className={styles.photoUnavailable}>
                <AlertTriangle size={14} aria-hidden="true" />
                {label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function CartoonOrdersClientPage() {
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [notesDrafts, setNotesDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const ordersRef = useRef([]);

  const isFullAdmin = user?.role === 'full_admin';

  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  const syncNotesDrafts = useCallback((nextOrders, { preserveDirtyDrafts = false } = {}) => {
    setNotesDrafts((prevDrafts) => {
      const previousNotesById = new Map(
        ordersRef.current.map((order) => [order._id, order.adminNotes || ''])
      );

      return nextOrders.reduce((acc, order) => {
        const serverNotes = order.adminNotes || '';
        const previousServerNotes = previousNotesById.get(order._id);
        const previousDraft = prevDrafts[order._id];
        const hasDirtyDraft =
          preserveDirtyDrafts &&
          previousDraft !== undefined &&
          previousServerNotes !== undefined &&
          previousDraft !== previousServerNotes;

        if (hasDirtyDraft) {
          acc[order._id] = previousDraft;
          return acc;
        }

        acc[order._id] = serverNotes;
        return acc;
      }, {});
    });
  }, []);

  const loadOrders = useCallback(async ({ preserveDirtyDrafts = false } = {}) => {
    if (!isFullAdmin) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await fetchCartoonOrders();
      const nextOrders = Array.isArray(data) ? data : [];

      setOrders(nextOrders);
      syncNotesDrafts(nextOrders, { preserveDirtyDrafts });
      setError('');
      return true;
    } catch (err) {
      setError(err.message || 'Неуспешно зареждане на шарж поръчките.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [isFullAdmin, syncNotesDrafts]);

  useEffect(() => {
    if (!authLoading) {
      loadOrders();
    }
  }, [authLoading, loadOrders]);

  const groupedOrders = useMemo(() => {
    const inquiries = [];
    const activeOrders = [];
    const completed = [];

    for (const order of orders) {
      const workflowStatus = getWorkflowStatus(order);

      if (workflowStatus === 'completed') {
        completed.push(order);
      } else if (workflowStatus === 'ordered') {
        activeOrders.push(order);
      } else {
        inquiries.push(order);
      }
    }

    inquiries.sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt));
    activeOrders.sort(
      (a, b) =>
        getTimestamp(a.orderedAt || a.createdAt) - getTimestamp(b.orderedAt || b.createdAt)
    );
    completed.sort(
      (a, b) =>
        getTimestamp(b.completedAt || b.archivedAt || b.updatedAt) -
        getTimestamp(a.completedAt || a.archivedAt || a.updatedAt)
    );

    return { inquiries, activeOrders, completed };
  }, [orders]);

  function startAction(action, orderId = 'bulk') {
    setActiveAction(`${action}:${orderId}`);
    setError('');
    setMessage('');
  }

  function finishAction() {
    setActiveAction('');
  }

  function isDashboardBusy() {
    return Boolean(activeAction);
  }

  async function refreshAfterPartialFailure(err) {
    if (err?.data?.partial === true) {
      await loadOrders({ preserveDirtyDrafts: true });
    }
  }

  async function saveDraftIfNeeded(order) {
    const draft = notesDrafts[order._id] || '';

    if (draft === (order.adminNotes || '')) {
      return order;
    }

    return updateCartoonOrderAdminNotes(order._id, draft);
  }

  async function handleWorkflow(order, workflowStatus, action) {
    startAction(action, order._id);

    try {
      await saveDraftIfNeeded(order);
      const updatedOrder = await updateCartoonOrderWorkflow(order._id, workflowStatus);

      setOrders((prev) => replaceOrder(prev, updatedOrder));
      setNotesDrafts((prev) => ({ ...prev, [updatedOrder._id]: updatedOrder.adminNotes || '' }));
      setMessage(
        workflowStatus === 'ordered'
          ? 'Запитването е преместено в поръчки.'
          : workflowStatus === 'waiting'
            ? 'Запитването е отбелязано като изчакващо.'
            : 'Запитването е върнато в активно състояние.'
      );
    } catch (err) {
      setError(err.message || 'Неуспешна промяна на работния статус.');
    } finally {
      finishAction();
    }
  }

  async function handleStatusChange(order, key, checked) {
    startAction(`status-${key}`, order._id);

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
      finishAction();
    }
  }

  async function handleSaveNotes(order) {
    startAction('saveNotes', order._id);

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
      finishAction();
    }
  }

  async function handleReject(order) {
    if (!window.confirm('Да откажа ли запитването? Клиентските снимки и записът ще бъдат изтрити.')) {
      return;
    }

    startAction('rejectInquiry', order._id);

    try {
      await rejectCartoonOrder(order._id);
      setOrders((prev) => prev.filter((item) => item._id !== order._id));
      setNotesDrafts((prev) => {
        const next = { ...prev };
        delete next[order._id];
        return next;
      });
      const refreshed = await loadOrders({ preserveDirtyDrafts: true });

      if (refreshed) {
        setMessage('Запитването е отказано и изтрито.');
      }
    } catch (err) {
      await refreshAfterPartialFailure(err);
      setError(err.message || 'Неуспешно отказване на запитването.');
    } finally {
      finishAction();
    }
  }

  async function handleComplete(order) {
    if (!window.confirm('Да отбележа ли поръчката като изпълнена? Клиентските снимки ще бъдат изтрити.')) {
      return;
    }

    startAction('completeOrder', order._id);

    try {
      await saveDraftIfNeeded(order);
      const updatedOrder = await completeCartoonOrder(order._id);

      setOrders((prev) => replaceOrder(prev, updatedOrder));
      setNotesDrafts((prev) => ({ ...prev, [updatedOrder._id]: updatedOrder.adminNotes || '' }));
      const refreshed = await loadOrders({ preserveDirtyDrafts: true });

      if (refreshed) {
        setMessage('Поръчката е изпълнена и снимките са изтрити.');
      }
    } catch (err) {
      await refreshAfterPartialFailure(err);
      setError(err.message || 'Неуспешно приключване на поръчката.');
    } finally {
      finishAction();
    }
  }

  async function handleRetryNotifications(order) {
    startAction('retryNotifications', order._id);

    try {
      const updatedOrder = await retryCartoonOrderNotifications(order._id);

      setOrders((prev) => replaceOrder(prev, updatedOrder));
      setMessage('Известията са изпратени повторно.');
    } catch (err) {
      setError(err.message || 'Неуспешно повторно изпращане на известията.');
    } finally {
      finishAction();
    }
  }

  async function handlePurge() {
    if (!window.confirm('Да изтрия ли изпълнените поръчки, по-стари от 6 месеца?')) {
      return;
    }

    startAction('purgeOldCompleted');

    try {
      const result = await purgeOldCompletedCartoonOrders();
      const refreshed = await loadOrders({ preserveDirtyDrafts: true });

      if (refreshed) {
        setMessage(`Изтрити стари изпълнени поръчки: ${Number(result?.deletedCount) || 0}.`);
      }
    } catch (err) {
      await refreshAfterPartialFailure(err);
      setError(err.message || 'Неуспешно изтриване на старите изпълнени поръчки.');
    } finally {
      finishAction();
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
    <main className={styles.wrapper}>
      <header className={styles.header}>
        <div>
          <h1>Шарж поръчки</h1>
          <p>
            {groupedOrders.inquiries.length} запитвания, {groupedOrders.activeOrders.length} активни
            поръчки
          </p>
        </div>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={loadOrders}
          disabled={loading || Boolean(activeAction)}
          data-action="refresh"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Обнови
        </button>
      </header>

      <div className={styles.feedback} aria-live="polite">
        {message ? <MessageBox type="success" message={message} /> : null}
        {error ? <MessageBox type="error" message={error} /> : null}
      </div>

      {loading && orders.length === 0 ? (
        <p className={styles.emptyState}>Зареждане на поръчките...</p>
      ) : null}

      <section className={styles.workflowSection} aria-labelledby="inquiries-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="inquiries-heading">Запитвания</h2>
            <p>Нови и изчакващи клиентски запитвания</p>
          </div>
          <span className={styles.count}>{groupedOrders.inquiries.length}</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.workflowTable}>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Съобщение</th>
                <th>Снимки и известия</th>
                <th>Подадено</th>
                <th>Админ бележки</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {groupedOrders.inquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>Няма текущи запитвания.</td>
                </tr>
              ) : (
                groupedOrders.inquiries.map((order) => {
                  const customer = order.customer || {};
                  const isWaiting = getWorkflowStatus(order) === 'waiting';
                  const isBusy = isDashboardBusy();

                  return (
                    <tr
                      key={order._id}
                      className={isWaiting ? styles.waitingRow : styles.inquiryRow}
                      data-workflow-status={isWaiting ? 'waiting' : 'inquiry'}
                    >
                      <td>
                        <strong>{customer.name || 'Клиент без име'}</strong>
                        {customer.email ? (
                          <a href={`mailto:${customer.email}`}>{customer.email}</a>
                        ) : (
                          <span>-</span>
                        )}
                        <span>{customer.phone || '-'}</span>
                        <OrderWarnings order={order} />
                      </td>
                      <td className={styles.messageCell}>{customer.message || 'Няма описание.'}</td>
                      <td>
                        <PhotoLinks order={order} />
                        <NotificationStatus order={order} />
                        {hasRetryableNotifications(order) ? (
                          <button
                            type="button"
                            className={styles.inlineButton}
                            onClick={() => handleRetryNotifications(order)}
                            disabled={isBusy}
                            data-action="retryNotifications"
                          >
                            <BellRing size={15} aria-hidden="true" />
                            Изпрати пак
                          </button>
                        ) : null}
                      </td>
                      <td>
                        <span>{formatDate(order.createdAt)}</span>
                        {isWaiting ? <span className={styles.waitingLabel}>Изчакване</span> : null}
                      </td>
                      <td>
                        <textarea
                          className={styles.notesInput}
                          aria-label={`Админ бележки за ${customer.name || 'клиент'}, запис ${order._id}`}
                          value={notesDrafts[order._id] || ''}
                          maxLength={2000}
                          disabled={isBusy}
                          onChange={(event) =>
                            setNotesDrafts((prev) => ({
                              ...prev,
                              [order._id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className={styles.inlineButton}
                          onClick={() => handleSaveNotes(order)}
                          disabled={isBusy}
                          data-action="saveNotes"
                        >
                          <Save size={15} aria-hidden="true" />
                          Запази бележки
                        </button>
                      </td>
                      <td>
                        <div className={styles.actionStack}>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            onClick={() => handleWorkflow(order, 'ordered', 'promoteToOrder')}
                            disabled={isBusy}
                            data-action="promoteToOrder"
                          >
                            <ShoppingBag size={16} aria-hidden="true" />
                            Поръчка
                          </button>
                          {isWaiting ? (
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() => handleWorkflow(order, 'inquiry', 'restoreInquiry')}
                              disabled={isBusy}
                              data-action="restoreInquiry"
                            >
                              <RotateCcw size={16} aria-hidden="true" />
                              Активирай
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={() => handleWorkflow(order, 'waiting', 'markWaiting')}
                              disabled={isBusy}
                              data-action="markWaiting"
                            >
                              <Clock3 size={16} aria-hidden="true" />
                              Изчакване
                            </button>
                          )}
                          <button
                            type="button"
                            className={styles.dangerButton}
                            onClick={() => handleReject(order)}
                            disabled={isBusy}
                            data-action="rejectInquiry"
                          >
                            <Trash2 size={16} aria-hidden="true" />
                            Откажи
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.workflowSection} aria-labelledby="orders-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="orders-heading">Поръчки</h2>
            <p>Активна работа, най-старите поръчки са първи</p>
          </div>
          <span className={styles.count}>{groupedOrders.activeOrders.length}</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.workflowTable}>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Съобщение</th>
                <th>Снимки и статуси</th>
                <th>Поръчано</th>
                <th>Админ бележки</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {groupedOrders.activeOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>Няма активни поръчки.</td>
                </tr>
              ) : (
                groupedOrders.activeOrders.map((order) => {
                  const customer = order.customer || {};
                  const isBusy = isDashboardBusy();

                  return (
                    <tr key={order._id} data-workflow-status="ordered">
                      <td>
                        <strong>{customer.name || 'Клиент без име'}</strong>
                        {customer.email ? (
                          <a href={`mailto:${customer.email}`}>{customer.email}</a>
                        ) : (
                          <span>-</span>
                        )}
                        <span>{customer.phone || '-'}</span>
                        <OrderWarnings order={order} />
                      </td>
                      <td className={styles.messageCell}>{customer.message || 'Няма описание.'}</td>
                      <td>
                        <PhotoLinks order={order} />
                        <div className={styles.statusList}>
                          {Object.entries(STATUS_LABELS).map(([key, label]) => (
                            <label key={key}>
                              <input
                                type="checkbox"
                                checked={order.statuses?.[key] === true}
                                disabled={isBusy}
                                onChange={(event) =>
                                  handleStatusChange(order, key, event.target.checked)
                                }
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        <NotificationStatus order={order} />
                        {hasRetryableNotifications(order) ? (
                          <button
                            type="button"
                            className={styles.inlineButton}
                            onClick={() => handleRetryNotifications(order)}
                            disabled={isBusy}
                            data-action="retryNotifications"
                          >
                            <BellRing size={15} aria-hidden="true" />
                            Изпрати пак
                          </button>
                        ) : null}
                      </td>
                      <td>{formatDate(order.orderedAt || order.createdAt)}</td>
                      <td>
                        <textarea
                          className={styles.notesInput}
                          aria-label={`Админ бележки за ${customer.name || 'клиент'}, запис ${order._id}`}
                          value={notesDrafts[order._id] || ''}
                          maxLength={2000}
                          disabled={isBusy}
                          onChange={(event) =>
                            setNotesDrafts((prev) => ({
                              ...prev,
                              [order._id]: event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className={styles.inlineButton}
                          onClick={() => handleSaveNotes(order)}
                          disabled={isBusy}
                          data-action="saveNotes"
                        >
                          <Save size={15} aria-hidden="true" />
                          Запази бележки
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.completeButton}
                          onClick={() => handleComplete(order)}
                          disabled={isBusy}
                          data-action="completeOrder"
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                          Изпълнена
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.workflowSection} aria-labelledby="completed-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="completed-heading">Изпълнени поръчки</h2>
            <p>Завършени поръчки със заличени клиентски снимки</p>
          </div>
          <span className={styles.count}>{groupedOrders.completed.length}</span>
        </div>

        <div className={styles.tableWrap}>
          <table className={`${styles.workflowTable} ${styles.completedTable}`}>
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Изпълнена на</th>
                <th>Състояние</th>
              </tr>
            </thead>
            <tbody>
              {groupedOrders.completed.length === 0 ? (
                <tr>
                  <td colSpan={3} className={styles.emptyCell}>Няма изпълнени поръчки.</td>
                </tr>
              ) : (
                groupedOrders.completed.map((order) => {
                  const isBusy = isDashboardBusy();

                  return (
                    <tr key={order._id} data-workflow-status="completed">
                      <td>
                        <strong>{order.customer?.name || 'Клиент без име'}</strong>
                      </td>
                      <td>{formatDate(order.completedAt || order.archivedAt)}</td>
                      <td>
                        <span className={styles.completedBadge}>
                          <CheckCircle2 size={14} aria-hidden="true" />
                          Снимките са изтрити
                        </span>
                        <OrderWarnings order={order} />
                        {hasRetryableNotifications(order) ? (
                          <>
                            <NotificationStatus order={order} />
                            <button
                              type="button"
                              className={styles.inlineButton}
                              onClick={() => handleRetryNotifications(order)}
                              disabled={isBusy}
                              data-action="retryNotifications"
                            >
                              <BellRing size={15} aria-hidden="true" />
                              Изпрати пак
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className={styles.purgeBar}>
        <div>
          <strong>Почистване на историята</strong>
          <span>Изтрива изпълнени поръчки, по-стари от 6 месеца.</span>
        </div>
        <button
          type="button"
          className={styles.dangerButton}
          onClick={handlePurge}
          disabled={Boolean(activeAction) || loading}
          data-action="purgeOldCompleted"
        >
          <Trash2 size={17} aria-hidden="true" />
          Изтрий стари
        </button>
      </footer>
    </main>
  );
}
