// happy-colors-nextjs-project/src/app/categories/[categoryId]/edit/page.js

import EditCategoryClient from './EditCategoryClient';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Редактиране на категория',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EditCategoryPage() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да редактирате категория.">
      <EditCategoryClient />
    </RequireAuth>
  );
}
