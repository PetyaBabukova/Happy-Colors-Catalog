import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { isCatalogMode } from '@/utils/catalogMode';
import PaymentSuccessClient from './PaymentSuccessClient';

export default function PaymentSuccessPage() {
  if (isCatalogMode) redirect('/products');

  return (
    <Suspense fallback={null}>
      <PaymentSuccessClient />
    </Suspense>
  );
}

