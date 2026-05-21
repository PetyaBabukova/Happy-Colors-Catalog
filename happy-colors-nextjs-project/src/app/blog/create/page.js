import CreateBlogArticleClient from './CreateBlogArticleClient';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Създай блог статия',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateBlogArticlePage() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да създадете блог статия.">
      <CreateBlogArticleClient />
    </RequireAuth>
  );
}
