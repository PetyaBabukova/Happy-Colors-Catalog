'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import baseURL from '@/config';
import MessageBox from '@/components/ui/MessageBox';
import styles from '../checkout.module.css';

const SHIPPING_STORAGE_KEY = 'hc_shipping_choice';
const ORDER_DRAFT_KEY = 'hc_order_draft';
const PROCESSED_SESSIONS_KEY = 'hc_processed_stripe_sessions';

export default function PaymentSuccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = useMemo(
    () => searchParams?.get('session_id') || '',
    [searchParams]
  );

  const { clearCart } = useCart();
  const [message, setMessage] = useState('Потвърждаваме плащането...');
  const [isError, setIsError] = useState(false);
  const ranRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (ranRef.current) return;
    ranRef.current = true;

    if (!sessionId) {
      setIsError(true);
      setMessage('Липсва session_id. Моля, опитайте отново.');
      setTimeout(() => router.push('/products'), 4000);
      return;
    }

    try {
      const processedRaw = window.sessionStorage.getItem(PROCESSED_SESSIONS_KEY);
      const processedArr = processedRaw ? JSON.parse(processedRaw) : [];

      if (processedArr.includes(sessionId)) {
        setIsError(false);
        setMessage('Плащането вече е потвърдено. Благодарим ви!');
        setTimeout(() => router.push('/products'), 3000);
        return;
      }
    } catch {
      // ignore
    }

    fetch(`${baseURL}/payments/confirm?session_id=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) {
          throw new Error(data?.message || 'Плащането не можа да бъде потвърдено.');
        }

        setIsError(false);
        setMessage('Поръчката ви е приета. Ще се свържем с вас при първа възможност.');

        try {
          clearCart();
          window.localStorage.removeItem(ORDER_DRAFT_KEY);
          window.localStorage.removeItem(SHIPPING_STORAGE_KEY);
        } catch {
          // ignore
        }

        try {
          const processedRaw = window.sessionStorage.getItem(PROCESSED_SESSIONS_KEY);
          const arr = processedRaw ? JSON.parse(processedRaw) : [];
          if (!arr.includes(sessionId)) arr.push(sessionId);
          window.sessionStorage.setItem(PROCESSED_SESSIONS_KEY, JSON.stringify(arr));
        } catch {
          // ignore
        }

        setTimeout(() => router.push('/products'), 4000);
      })
      .catch((err) => {
        console.error('Confirm error:', err);
        setIsError(true);
        setMessage(
          err?.message ||
            'Възникна грешка при потвърждение на плащането. Моля, свържете се с нас.'
        );
        setTimeout(() => router.push('/products'), 5000);
      });
  }, [sessionId, router, clearCart]);

  return (
    <section className={styles.checkoutContainer}>
      <div style={{ marginTop: '40px' }}>
        <MessageBox type={isError ? 'error' : 'success'} message={message} />
      </div>
    </section>
  );
}
