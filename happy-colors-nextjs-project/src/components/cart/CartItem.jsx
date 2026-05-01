// happy-colors-nextjs-project/src/components/cart/CartItem.jsx

'use client';

import { useCart } from '@/context/CartContext';
import styles from './Cart.module.css';
import Image from 'next/image';

export default function CartItem({ item }) {
  const { removeFromCart, increaseQuantity, decreaseQuantity } = useCart();

  return (
    <div className={styles.cartItem}>
      <Image
        src={item.image}
        alt={item.title}
        width={80}
        height={80}
        className={styles.productImage}
      />

      <div className={styles.details}>
        <h4>{item.title}</h4>
        <p>Цена: {item.price.toFixed(2)} €</p>

        {/* ➕➖ Добавени бутони за количество */}
        <div className={styles.qtyControls}>
        <p>Количество: </p>
          <button
            className={styles.qtyBtn}
            aria-label="Намали количество"
            onClick={() => decreaseQuantity(item._id)}
          >
            –
          </button>

          <span className={styles.qtyNumber}>{item.quantity}</span>

          <button
            className={styles.qtyBtn}
            aria-label="Увеличи количество"
            onClick={() => increaseQuantity(item._id)}
          >
            +
          </button>
        </div>

        <p>Общо: {(item.price * item.quantity).toFixed(2)} €</p>
      </div>

      <button
        onClick={() => removeFromCart(item._id)}
        className={styles.removeBtn}
      >
        Премахни
      </button>
    </div>
  );
}
