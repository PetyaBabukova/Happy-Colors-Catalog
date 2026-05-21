// happy-colors-nextjs-project/src/app/categories/delete/page.js

import RequireAuth from '@/components/auth/RequireAuth';
import AuthenticatedRedirect from '@/components/auth/AuthenticatedRedirect';

export const metadata = {
  title: 'Изтриване на категория',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeleteCategoryPage() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да изтриете категория.">
      <AuthenticatedRedirect
        to="/categories"
        message="Пренасочване към управлението на категории..."
      />
    </RequireAuth>
  );
}
