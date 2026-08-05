'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import MessageBox from '@/components/ui/MessageBox';
import BlogArticleForm from '@/components/blog/BlogArticleForm';
import { useAuth } from '@/context/AuthContext';
import { editBlogArticle, getAdminBlogArticleById } from '@/managers/blogArticlesManager';

export default function EditBlogArticleClient({ articleId }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [article, setArticle] = useState(null);
  const [error, setError] = useState('');
  const [loadingArticle, setLoadingArticle] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoadingArticle(false);
      return;
    }

    let active = true;

    getAdminBlogArticleById(articleId)
      .then((data) => {
        if (active) setArticle(data);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Неуспешно зареждане на блог статията.');
      })
      .finally(() => {
        if (active) setLoadingArticle(false);
      });

    return () => {
      active = false;
    };
  }, [articleId, user]);

  if (loading || loadingArticle) {
    return <p>Зареждане...</p>;
  }

  if (!user) {
    return <MessageBox type="error" message="Трябва да сте логнати, за да редактирате блог статия." />;
  }

  if (error) {
    return <MessageBox type="error" message={error} />;
  }

  if (!article) {
    return <MessageBox type="error" message="Блог статията не беше намерена." />;
  }

  return (
    <BlogArticleForm
      initialValues={article}
      mode="edit"
      onSubmit={async (values) => {
        await editBlogArticle(articleId, values);
        router.push(`/blog/${articleId}`);
        router.refresh();
      }}
      submitLabel="Запази"
      cancelHref={`/blog/${articleId}`}
      headerActions={(
        <Link href={`/translations?entityType=blogArticle&entityId=${encodeURIComponent(articleId)}`}>
          EN превод
        </Link>
      )}
    />
  );
}
