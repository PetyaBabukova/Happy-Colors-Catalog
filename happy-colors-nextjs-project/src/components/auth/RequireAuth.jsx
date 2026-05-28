'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import MessageBox from '@/components/ui/MessageBox';
import { buildLoginRedirectUrl } from '@/utils/authRedirect';

const DEFAULT_MESSAGE =
  'Тази страница е достъпна само след вход. Пренасочваме Ви към формата за вход.';

export default function RequireAuth({
  children,
  message = DEFAULT_MESSAGE,
  requiredRole = null,
  roleMessage = message,
  redirectDelayMs = 1200,
}) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isCheckingAuth = loading || user === undefined;

  useEffect(() => {
    if (isCheckingAuth || user) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      router.replace(buildLoginRedirectUrl(currentPath, '/products'));
    }, redirectDelayMs);

    return () => window.clearTimeout(timerId);
  }, [isCheckingAuth, redirectDelayMs, router, user]);

  if (isCheckingAuth) {
    return <p>Зареждане...</p>;
  }

  if (!user) {
    return <MessageBox type="error" message={message} />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <MessageBox type="error" message={roleMessage} />;
  }

  return children;
}
