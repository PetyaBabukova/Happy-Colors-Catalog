// app/cart/page.js

import { redirect } from 'next/navigation';
import { isCatalogMode } from '@/utils/catalogMode';
import CartPage from '@/components/cart/CartPage';

export const metadata = {
  title: 'Количка',
  description: 'Количка с избраните продукти в Happy Colors (Хепи Колорс).',
  robots: {
    index: false,
    follow: false,
  },
};

export default function Cart() {
  if (isCatalogMode) redirect('/products');

  return <CartPage />;
}
