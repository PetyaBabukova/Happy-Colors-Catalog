import CreateBlogArticleClient from './CreateBlogArticleClient';
import RequireAuth from '@/components/auth/RequireAuth';
import RequireFullAdmin from '@/components/auth/RequireFullAdmin';

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
      <RequireFullAdmin message="Само full admin може да създава блог статии.">
        <CreateBlogArticleClient />
      </RequireFullAdmin>
    </RequireAuth>
  );
}
