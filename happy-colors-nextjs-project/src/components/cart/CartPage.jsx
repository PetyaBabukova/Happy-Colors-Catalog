// happy-colors-nextjs-project/src/components/cart/CartPage.jsx

'use client';

import { useCart } from '@/context/CartContext';
import CartItem from './CartItem';
import styles from './Cart.module.css';
import Link from 'next/link';

export default function CartPage() {
  const {
    cartItems,
    clearCart,
    getTotalPrice,
  } = useCart();

  if (cartItems.length === 0) {
    return (
      <div className={styles.emptyCart} data-testid="empty-cart">
        <h2>Количката е празна</h2>
        <Link href="/products" className={styles.backToShop}>
          ← Обратно към магазина
        </Link>
      </div>
    );
  }

  return (
    <section className={styles.cartContainer}>
      <h1>Моята количка</h1>

      <div className={styles.cartItems}>
        {cartItems.map(item => (
          <CartItem key={item._id} item={item} />
        ))}
      </div>

      <div className={styles.summary}>
        <p>Обща сума: <strong>{getTotalPrice().toFixed(2)} €</strong></p>
        <button onClick={clearCart} className={styles.clearBtn} data-testid="clear-cart">
          Изчисти количката
        </button>
      </div>

      <div className={styles.cartActions}>
        <Link href="/checkout" className={styles.continueBtn} data-testid="checkout-link">
          Продължи
        </Link>
      </div>

    </section>
  );
}
