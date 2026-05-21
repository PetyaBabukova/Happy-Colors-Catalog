import EditBlogArticleClient from './EditBlogArticleClient';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Редактирай блог статия',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function EditBlogArticlePage({ params }) {
  const { articleId } = await params;

  return (
    <RequireAuth message="Трябва да сте логнати, за да редактирате блог статия.">
      <EditBlogArticleClient articleId={articleId} />
    </RequireAuth>
  );
}
