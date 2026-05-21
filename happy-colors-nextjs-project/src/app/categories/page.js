import CategoriesClientPage from './CategoriesClientPage';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Управление на категории',
  description: 'Вътрешна страница за управление на категориите в Happy Colors.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CategoriesPage() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да управлявате категориите.">
      <CategoriesClientPage />
    </RequireAuth>
  );
}
