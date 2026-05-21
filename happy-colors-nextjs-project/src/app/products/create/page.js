// happy-colors-nextjs-project/src/app/products/create/page.js

import CreateProductClient from './CreateProductClient';
import RequireAuth from '@/components/auth/RequireAuth';

export const metadata = {
  title: 'Създаване на продукт',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CreateProductPage() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да създадете продукт.">
      <CreateProductClient />
    </RequireAuth>
  );
}
