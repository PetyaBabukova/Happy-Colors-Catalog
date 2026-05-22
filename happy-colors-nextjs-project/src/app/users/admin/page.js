import RequireAuth from '@/components/auth/RequireAuth';
import UsersAdminClientPage from './UsersAdminClientPage';

export const metadata = {
  title: 'Управление на потребители',
  robots: {
    index: false,
    follow: false,
  },
};

export default function UsersAdminPage() {
  return (
    <RequireAuth message="Трябва да сте логнати като администратор, за да управлявате потребители.">
      <UsersAdminClientPage />
    </RequireAuth>
  );
}
