import RegisterForm from './RegisterForm';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Регистрация',
  description:
    'Създай профил в Happy Colors и се включи в нашата цветна общност.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <RegisterForm />;
}
