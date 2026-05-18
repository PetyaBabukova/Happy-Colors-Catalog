import RequireAuth from '@/components/auth/RequireAuth';
import AuthenticatedRedirect from '@/components/auth/AuthenticatedRedirect';

export const metadata = {
  title: 'Потребители',
  robots: {
    index: false,
    follow: false,
  },
};

export default function Users() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да отворите тази страница.">
      <AuthenticatedRedirect
        to="/products"
        message="Пренасочване към продуктите..."
      />
    </RequireAuth>
  )
}
