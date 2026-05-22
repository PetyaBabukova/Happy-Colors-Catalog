'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle, ExternalLink, FolderOpen, RefreshCw, Save, ShieldAlert, XCircle } from 'lucide-react';
import MessageBox from '@/components/ui/MessageBox';
import { useAuth } from '@/context/AuthContext';
import {
  approveAdminProduct,
  fetchAdminUserDossier,
  fetchAdminReviewProduct,
  fetchAdminUsers,
  rejectAdminProduct,
  updateAdminUser,
} from '@/managers/usersAdminManager';
import styles from './usersAdmin.module.css';

const ROLE_OPTIONS = [
  { value: 'customer', label: 'Клиент' },
  { value: 'artist', label: 'Артист' },
  { value: 'full_admin', label: 'Full admin' },
];

const ARTIST_STATUS_OPTIONS = [
  { value: 'pending', label: 'Изчаква' },
  { value: 'active', label: 'Активен' },
  { value: 'suspended', label: 'Спрян' },
];

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
  });
}

function buildDraft(user) {
  return {
    role: user.role || 'customer',
    artistStatus: user.artistStatus || 'pending',
  };
}

function getStatusLabel(status) {
  return ARTIST_STATUS_OPTIONS.find((option) => option.value === status)?.label || status;
}

export default function UsersAdminClientPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [users, setUsers] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [dossier, setDossier] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [detailsLoadingId, setDetailsLoadingId] = useState('');
  const [reviewProduct, setReviewProduct] = useState(null);
  const [reviewActionLoading, setReviewActionLoading] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isFullAdmin = currentUser?.role === 'full_admin';

  const loadUsers = useCallback(async () => {
    if (!isFullAdmin) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await fetchAdminUsers();
      const nextUsers = Array.isArray(data) ? data : [];
      setUsers(nextUsers);
      setDrafts(
        nextUsers.reduce((acc, item) => {
          acc[item._id] = buildDraft(item);
          return acc;
        }, {})
      );
    } catch (err) {
      setError(err.message || 'Неуспешно зареждане на потребителите.');
    } finally {
      setLoading(false);
    }
  }, [isFullAdmin]);

  useEffect(() => {
    if (!authLoading) {
      loadUsers();
    }
  }, [authLoading, loadUsers]);

  useEffect(() => {
    if (authLoading || !isFullAdmin || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const productId = params.get('reviewProduct');

    if (!productId) {
      return;
    }

    let isCurrent = true;
    setError('');

    fetchAdminReviewProduct(productId)
      .then((product) => {
        if (!isCurrent) {
          return;
        }

        setReviewProduct(product);
        const action = params.get('reviewAction');
        if (action === 'approve') {
          setMessage('Продуктът е зареден от имейла. Потвърдете одобрението с бутона "Одобри".');
        } else if (action === 'reject') {
          setMessage('Продуктът е зареден от имейла. Добавете причина и потвърдете отказа с бутона "Откажи".');
        } else if (action === 'postpone') {
          setMessage('Продуктът остава за по-късен преглед.');
        }
      })
      .catch((err) => {
        if (isCurrent) {
          setError(err.message || 'Неуспешно зареждане на продукта от имейла.');
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [authLoading, isFullAdmin]);

  const usersById = useMemo(
    () => new Map(users.map((item) => [item._id, item])),
    [users]
  );

  function updateDraft(userId, patch) {
    setDrafts((prev) => {
      const current = prev[userId] || buildDraft(usersById.get(userId) || {});
      const next = { ...current, ...patch };

      if (patch.role && patch.role !== 'artist') {
        next.artistStatus = 'pending';
      }

      return {
        ...prev,
        [userId]: next,
      };
    });
  }

  async function handleSave(targetUser) {
    const draft = drafts[targetUser._id] || buildDraft(targetUser);
    setSavingId(targetUser._id);
    setError('');
    setMessage('');

    try {
      const result = await updateAdminUser(targetUser._id, {
        role: draft.role,
        artistStatus: draft.role === 'artist' ? draft.artistStatus : undefined,
      });

      setUsers((prev) =>
        prev.map((item) =>
          item._id === targetUser._id
            ? { ...item, ...result.user, updatedAt: new Date().toISOString() }
            : item
        )
      );
      setDrafts((prev) => ({
        ...prev,
        [targetUser._id]: buildDraft(result.user),
      }));

      if (dossier?.user?._id === targetUser._id) {
        setDossier(await fetchAdminUserDossier(targetUser._id));
      }

      if (result.reminder?.error) {
        setMessage('Ролята е обновена, но имейлът с продуктите на спрения артист не беше изпратен.');
      } else if (result.reminder?.productCount > 0) {
        setMessage(`Ролята е обновена. Изпратен е имейл с ${result.reminder.productCount} продукт(а) за преглед.`);
      } else {
        setMessage('Потребителят е обновен.');
      }
    } catch (err) {
      setError(err.message || 'Неуспешно обновяване на потребителя.');
    } finally {
      setSavingId('');
    }
  }

  async function handleOpenDossier(targetUser) {
    setDetailsLoadingId(targetUser._id);
    setError('');

    try {
      setDossier(await fetchAdminUserDossier(targetUser._id));
    } catch (err) {
      setError(err.message || 'Неуспешно зареждане на потребителското досие.');
    } finally {
      setDetailsLoadingId('');
    }
  }

  async function refreshCurrentDossier() {
    if (dossier?.user?._id) {
      setDossier(await fetchAdminUserDossier(dossier.user._id));
    }
  }

  async function handleApproveProduct(product) {
    setReviewActionLoading(product._id);
    setError('');
    setMessage('');

    try {
      const updated = await approveAdminProduct(product._id);
      setReviewProduct(updated);
      setMessage('Продуктът е одобрен и публикуван.');
      await refreshCurrentDossier();
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Неуспешно одобряване на продукта.');
    } finally {
      setReviewActionLoading('');
    }
  }

  async function handleRejectProduct(product) {
    const reviewNote = window.prompt('Причина за отказа:');

    if (!reviewNote || reviewNote.trim() === '') {
      setError('Моля въведете причина за отказа.');
      return;
    }

    setReviewActionLoading(product._id);
    setError('');
    setMessage('');

    try {
      const updated = await rejectAdminProduct(product._id, reviewNote);
      setReviewProduct(updated);
      setMessage('Публикацията е отказана и продуктът е върнат към артиста за редакция.');
      await refreshCurrentDossier();
      await loadUsers();
    } catch (err) {
      setError(err.message || 'Неуспешен отказ за публикация.');
    } finally {
      setReviewActionLoading('');
    }
  }

  function handlePostponeProduct(product) {
    setReviewProduct(product);
    setMessage('Продуктът остава в опашката за по-късен преглед.');
  }

  function renderReviewActions(product) {
    if (product.publicationStatus !== 'pending_review') {
      return null;
    }

    return (
      <div className={styles.reviewActions}>
        <button
          className={styles.approveButton}
          type="button"
          onClick={() => handleApproveProduct(product)}
          disabled={reviewActionLoading === product._id}
        >
          <CheckCircle size={18} aria-hidden="true" /> Одобри
        </button>
        <button
          className={styles.detailsButton}
          type="button"
          onClick={() => handlePostponeProduct(product)}
          disabled={reviewActionLoading === product._id}
        >
          Отложи
        </button>
        <button
          className={styles.rejectButton}
          type="button"
          onClick={() => handleRejectProduct(product)}
          disabled={reviewActionLoading === product._id}
        >
          <XCircle size={18} aria-hidden="true" /> Откажи
        </button>
      </div>
    );
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
          <h1>Потребители</h1>
          <p>Роли, артист статуси и досиета с продуктова история.</p>
        </div>
        <button className={styles.refreshButton} type="button" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={18} aria-hidden="true" /> Обнови
        </button>
      </div>

      {message ? <div className={styles.message}>{message}</div> : null}
      {error ? <div className={styles.error}>{error}</div> : null}

      {reviewProduct ? (
        <section className={styles.reviewPanel}>
          <div>
            <h2>{reviewProduct.title}</h2>
            <p>
              Статус: <strong>{reviewProduct.publicationStatus}</strong>
            </p>
          </div>
          <div className={styles.reviewPanelActions}>
            <a href={`/products/${reviewProduct._id}/edit`} target="_blank" rel="noreferrer">
              <ExternalLink size={18} aria-hidden="true" /> Отвори
            </a>
            {renderReviewActions(reviewProduct)}
          </div>
        </section>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.usersTable}>
          <thead>
            <tr>
              <th>Потребител</th>
              <th>Роля</th>
              <th>Артист статус</th>
              <th>Продукти</th>
              <th>Създаден</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => {
              const draft = drafts[item._id] || buildDraft(item);
              const isSelf = item._id === currentUser?._id;
              const isDirty =
                draft.role !== item.role ||
                (draft.role === 'artist' && draft.artistStatus !== (item.artistStatus || 'pending'));

              return (
                <tr key={item._id}>
                  <td>
                    <div className={styles.userName}>{item.username}</div>
                    <div className={styles.userEmail}>{item.email}</div>
                    {isSelf ? <div className={styles.selfNote}>Това е вашият профил.</div> : null}
                  </td>
                  <td>
                    <select
                      className={styles.select}
                      value={draft.role}
                      onChange={(event) => updateDraft(item._id, { role: event.target.value })}
                      disabled={isSelf || savingId === item._id}
                    >
                      {ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className={styles.select}
                      value={draft.artistStatus}
                      onChange={(event) => updateDraft(item._id, { artistStatus: event.target.value })}
                      disabled={draft.role !== 'artist' || isSelf || savingId === item._id}
                    >
                      {ARTIST_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{item.productCount || 0}</td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.saveButton}
                        type="button"
                        onClick={() => handleSave(item)}
                        disabled={!isDirty || isSelf || savingId === item._id}
                        title={isSelf ? 'Не можете да махнете собствената си full admin роля.' : 'Запази'}
                      >
                        <Save size={18} aria-hidden="true" />
                        {savingId === item._id ? 'Запис...' : 'Запази'}
                      </button>
                      <button
                        className={styles.detailsButton}
                        type="button"
                        onClick={() => handleOpenDossier(item)}
                        disabled={detailsLoadingId === item._id}
                      >
                        <FolderOpen size={18} aria-hidden="true" />
                        {detailsLoadingId === item._id ? 'Отваряне...' : 'Досие'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {loading ? <p className={styles.emptyState}>Зареждане на потребители...</p> : null}
      {!loading && users.length === 0 ? <p className={styles.emptyState}>Няма потребители за показване.</p> : null}

      {dossier ? (
        <section className={styles.dossier}>
          <div className={styles.dossierHeader}>
            <div>
              <h2>{dossier.user.username}</h2>
              <p>
                {dossier.user.email} · {dossier.user.role}
                {dossier.user.artistStatus ? ` · ${getStatusLabel(dossier.user.artistStatus)}` : ''}
              </p>
            </div>
            <ShieldAlert size={28} aria-hidden="true" />
          </div>

          {dossier.products.length > 0 ? (
            <ul className={styles.productList}>
              {dossier.products.map((product) => (
                <li key={product._id} className={styles.productItem}>
                  <div>
                    <div className={styles.productTitle}>{product.title}</div>
                    <div className={styles.productMeta}>
                      <span className={styles.statusBadge}>{product.publicationStatus}</span>
                      <span>{product.availability}</span>
                      <span>Обновен: {formatDate(product.updatedAt)}</span>
                    </div>
                  </div>
                  <div className={styles.productActions}>
                  <a href={product.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={18} aria-hidden="true" /> Отвори
                  </a>
                    {renderReviewActions(product)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyState}>Този потребител все още няма продукти.</p>
          )}
        </section>
      ) : null}
    </section>
  );
}
