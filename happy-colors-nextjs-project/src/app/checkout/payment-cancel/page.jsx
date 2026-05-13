// happy-colors-nextjs-project/src/app/checkout/payment-cancel/page.jsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isCatalogMode } from '@/utils/catalogMode';
import MessageBox from '@/components/ui/MessageBox';
import styles from '../checkout.module.css';

export default function PaymentCancelPage() {
  const router = useRouter();

  useEffect(() => {
    if (isCatalogMode) {
      router.push('/products');
      return undefined;
    }

    const t = setTimeout(() => {
      router.push('/checkout');
    }, 4000);

    return () => clearTimeout(t);
  }, [router]);

  if (isCatalogMode) {
    return null;
  }

  return (
    <section className={styles.checkoutContainer}>
      <div style={{ marginTop: '40px' }}>
        <MessageBox
          type="error"
          message="Плащането с карта беше прекъснато или отказано. Можете да опитате отново или да изберете друг метод на плащане."
        />
      </div>
    </section>
  );
}
