import RequireAuth from '@/components/auth/RequireAuth';
import CartoonOrdersClientPage from './CartoonOrdersClientPage';

export const metadata = {
  title: 'Шарж поръчки',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CartoonOrdersPage() {
  return (
    <RequireAuth
      message="Трябва да сте логнати като администратор, за да управлявате шарж поръчките."
      requiredRole="full_admin"
      roleMessage="Тази страница е достъпна само за full admin потребители."
    >
      <CartoonOrdersClientPage />
    </RequireAuth>
  );
}
