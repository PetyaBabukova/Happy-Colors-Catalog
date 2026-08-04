import RequireAuth from '@/components/auth/RequireAuth';
import TranslationsClientPage from './TranslationsClientPage';

export const metadata = {
  title: 'EN преводи',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function TranslationsPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const targetEntityType =
    typeof resolvedSearchParams?.entityType === 'string' ? resolvedSearchParams.entityType : '';
  const targetEntityId =
    typeof resolvedSearchParams?.entityId === 'string' ? resolvedSearchParams.entityId : '';

  return (
    <RequireAuth
      message="Трябва да сте логнати, за да управлявате EN преводите."
      requiredRole="full_admin"
      roleMessage="Тази страница е достъпна само за full admin потребители."
    >
      <TranslationsClientPage
        targetEntityType={targetEntityType}
        targetEntityId={targetEntityId}
      />
    </RequireAuth>
  );
}
