import NewsletterSubscribeForm from '@/components/newsletter/NewsletterSubscribeForm';
import CookieFooterLink from '@/components/privacy/CookieFooterLink';
import privacyStyles from '@/components/privacy/CookieConsent.module.css';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={privacyStyles.footerLeftBlock}>
        <p>© 2026 Happy Colors. Всички права запазени.</p>
        <CookieFooterLink />
      </div>

      <NewsletterSubscribeForm />

      <p className={styles.credit}>
        <a
          href="https://webcreativeteam.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Онлайн каталог от <b>webcreativeteam.com</b>
        </a>
      </p>
    </footer>
  );
}
