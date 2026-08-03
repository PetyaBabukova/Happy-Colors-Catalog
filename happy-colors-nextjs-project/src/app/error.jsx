'use client';

import PublicStatusPage from '@/components/ui/PublicStatusPage';

export default function AppError({ reset }) {
  return (
    <PublicStatusPage
      titleKey="errors.genericTitle"
      descriptionKey="errors.genericDescription"
      onRetry={reset}
    />
  );
}
