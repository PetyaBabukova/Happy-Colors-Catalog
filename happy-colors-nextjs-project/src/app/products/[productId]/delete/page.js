// happy-colors-nextjs-project/src/app/products/[productId]/delete/page.js

import DeleteProductClient from './DeleteProductClient';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Изтриване на продукт',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeleteProductPage({ params }) {
  return (
    <RequireAuth message="Трябва да сте логнати, за да изтриете продукт.">
      <DeleteProductClient params={params} />
    </RequireAuth>
  );
}
