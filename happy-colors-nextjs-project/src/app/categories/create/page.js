import CreateCategory from '@/components/categories/CreateCategory';

export const metadata = {
  title: 'Създаване на категория',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateCategoryPage() {
  return (
    <section style={{ padding: '1rem' }}>
      <CreateCategory />
    </section>
  );
}
