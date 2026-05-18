import CreateCategory from '@/components/categories/CreateCategory';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Създаване на категория',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateCategoryPage() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да създадете категория.">
      <section style={{ padding: '1rem' }}>
        <CreateCategory />
      </section>
    </RequireAuth>
  );
}
