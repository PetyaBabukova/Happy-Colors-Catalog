import { redirect } from 'next/navigation';
import { isCatalogMode } from '@/utils/catalogMode';
import CheckoutClientPage from './CheckoutClientPage';

export const metadata = {
  title: 'Завършване на поръчката',
  description: 'Страница за завършване на поръчка в Happy Colors (Хепи Колорс).',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  if (isCatalogMode) redirect('/products');

  return <CheckoutClientPage />;
}
