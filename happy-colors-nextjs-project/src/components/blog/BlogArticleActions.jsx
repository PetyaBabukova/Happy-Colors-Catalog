'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { archiveBlogArticle } from '@/managers/blogArticlesManager';
import styles from './blogPublic.module.css';

export default function BlogArticleActions({ articleId }) {
  const { user } = useAuth();
  const router = useRouter();
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
      await archiveBlogArticle(articleId);
      router.push('/blog');
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
        <button type="button" onClick={handleDelete} disabled={Boolean(busyAction)}>
          {busyAction === 'delete' ? 'Изтриване...' : 'Изтрий'}
        </button>
      </div>
      {error && <p className={styles.articleActionError}>{error}</p>}
    </div>
  );
}
