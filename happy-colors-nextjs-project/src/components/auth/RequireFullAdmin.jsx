'use client';

import MessageBox from '@/components/ui/MessageBox';
import { useAuth } from '@/context/AuthContext';

export default function RequireFullAdmin({
  children,
  message = 'Тази страница е достъпна само за full admin потребители.',
}) {
  const { user, loading } = useAuth();
  const isCheckingAuth = loading || user === undefined;

  if (isCheckingAuth) {
    return <p>Зареждане...</p>;
  }

  if (user?.role !== 'full_admin') {
    return <MessageBox type="error" message={message} />;
  }

  return children;
}
