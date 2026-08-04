'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import { deleteBlogArticle } from '@/managers/blogArticlesManager';
import styles from './blogPublic.module.css';

export default function BlogArticleActions({ articleId }) {
  const { user } = useAuth();
  const router = useRouter();
  const { publicHref } = useLocaleNavigation();
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');

  if (!user || !articleId) {
    return null;
  }

  const handleDelete = async () => {
    if (!window.confirm('Сигурни ли сте, че искате да изтриете тази блог статия?')) {
      return;
    }

    setError('');
    setBusyAction('delete');

    try {
      await deleteBlogArticle(articleId);
      router.push(publicHref('/blog'));
      router.refresh();
    } catch (err) {
      setError(err.message || 'Неуспешно изтриване на статията.');
    } finally {
      setBusyAction('');
    }
  };

  return (
    <div className={styles.articleActions}>
      <div className={styles.articleActionsRow}>
        <Link href={`/blog/${articleId}/edit`} className={styles.articleActionLink}>
          Редактирай
        </Link>
        <Link
          href={`/translations?entityType=blogArticle&entityId=${encodeURIComponent(articleId)}`}
          className={styles.articleActionLink}
        >
          EN превод
        </Link>
        <Link
          href={`/newsletter/send?source=blog&id=${articleId}`}
          className={`${styles.articleActionLink} ${styles.newsletterActionLink}`}
        >
          Изпрати новини
        </Link>
        <button type="button" onClick={handleDelete} disabled={Boolean(busyAction)}>
          {busyAction === 'delete' ? 'Изтриване...' : 'Изтрий'}
        </button>
      </div>
      {error && <p className={styles.articleActionError}>{error}</p>}
    </div>
  );
}
