import RequireAuth from '@/components/auth/RequireAuth';
import AnalyticsClientPage from './AnalyticsClientPage';

export const metadata = {
  title: 'Анализи',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AnalyticsPage() {
  return (
    <RequireAuth
      message="Трябва да сте логнати като администратор, за да преглеждате анализите."
      requiredRole="full_admin"
      roleMessage="Тази страница е достъпна само за full admin потребители."
    >
      <AnalyticsClientPage />
    </RequireAuth>
  );
}
