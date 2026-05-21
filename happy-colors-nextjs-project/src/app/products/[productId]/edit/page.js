// happy-colors-nextjs-project/src/app/products/[productId]/edit/page.js

import EditProductClient from './EditProductClient';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Редактиране на продукт',
  robots: {
    index: false,
    follow: false,
  },
};

export default function EditProductPage({ params }) {
  return (
    <RequireAuth message="Трябва да сте логнати, за да редактирате продукт.">
      <EditProductClient params={params} />
    </RequireAuth>
  );
}
