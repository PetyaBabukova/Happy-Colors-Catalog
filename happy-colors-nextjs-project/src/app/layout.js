// src/app/layout.js

import './globals.css';
import styles from './page.module.css';
import ClientLayout from './ClientLayout';
import { Roboto } from 'next/font/google';
import {
  metadataBaseUrl,
  shouldIndexSite,
} from '@/config/siteSeo';

const roboto = Roboto({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '500', '700'],
  display: 'swap',
});

export const metadata = {
  metadataBase: metadataBaseUrl,

  title: {
    default: 'Плетени играчки, аксесоари и декорация за дома | Happy Colors',
    template: '%s | Happy Colors',
  },

  description: 'Ръчно изработени плетени играчки, аксесоари и декорация за дома от Happy Colors – оригинални идеи за подарък, уют и красиви изделия с характер.',

  robots: {
    index: shouldIndexSite,
    follow: shouldIndexSite,
  },
  ...(shouldIndexSite
    ? {
        alternates: {
          canonical: '/',
        },
      }
    : {}),

  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="bg">
      <body className={roboto.className}>
        <ClientLayout>{children}</ClientLayout>
              <footer className={styles.footer}>
				<p>© 2026 Happy Colors. Всички права запазени.</p>
				<p><a href="https://webcreativeteam.com" target="_blank" rel="noopener noreferrer">Онлайн каталог от <b>webcreativeteam.com</b></a></p>
			</footer>
      </body>

    </html>
  );
}
