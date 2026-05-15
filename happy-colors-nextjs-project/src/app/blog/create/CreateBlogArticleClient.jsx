'use client';

import MessageBox from '@/components/ui/MessageBox';
import BlogArticleForm from '@/components/blog/BlogArticleForm';
import { useAuth } from '@/context/AuthContext';
import { createBlogArticle } from '@/managers/blogArticlesManager';
import { useRouter } from 'next/navigation';

export default function CreateBlogArticleClient() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <p>Зареждане...</p>;
  }

  if (!user) {
    return <MessageBox type="error" message="Трябва да сте логнати, за да създадете блог статия." />;
  }

  return (
    <BlogArticleForm
      onSubmit={async (values) => {
        await createBlogArticle(values);
        router.push('/blog');
        router.refresh();
      }}
      submitLabel="Създай статия"
      cancelHref="/blog"
    />
  );
}
