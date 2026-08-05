import NewsletterSubscribeForm from '@/components/newsletter/NewsletterSubscribeForm';
import CookieFooterLink from '@/components/privacy/CookieFooterLink';
import privacyStyles from '@/components/privacy/CookieConsent.module.css';
import useTranslations from '@/i18n/useTranslations';
import styles from './Footer.module.css';

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#1877f2"
        d="M15.1 8.2h2.4V4.5c-.4-.1-1.9-.2-3.6-.2-3.5 0-5.8 2.1-5.8 6v3.4H4.5v4.2h3.6V24h4.4v-6.1h3.5l.7-4.2h-4.2v-3c0-1.2.3-2.5 2.6-2.5Z"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="instagram-footer-gradient" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#feda75" />
          <stop offset="0.3" stopColor="#fa7e1e" />
          <stop offset="0.55" stopColor="#d62976" />
          <stop offset="0.78" stopColor="#962fbf" />
          <stop offset="1" stopColor="#4f5bd5" />
        </linearGradient>
      </defs>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.2" fill="url(#instagram-footer-gradient)" />
      <circle cx="12" cy="12" r="4.1" fill="none" stroke="#fff" strokeWidth="2" />
      <circle cx="17.4" cy="6.7" r="1.25" fill="#fff" />
    </svg>
  );
}

export default function Footer() {
  const { t } = useTranslations('footer');
  const year = new Date().getFullYear();
  const socialLinks = [
    {
      href: 'https://www.facebook.com/happycolors.studio',
      label: t('facebookLabel'),
      Icon: FacebookIcon,
    },
    {
      href: 'https://www.instagram.com/happycolors.crochet/',
      label: t('instagramLabel'),
      Icon: InstagramIcon,
    },
  ];

  return (
    <footer className={styles.footer}>
      <div className={privacyStyles.footerLeftBlock}>
        <p>{t('copyright', { year })}</p>
        <CookieFooterLink />
      </div>

      <NewsletterSubscribeForm />

      <div className={styles.footerRight}>
        <div className={styles.socialBlock}>
          <p className={styles.socialHeading}>{t('socialHeading')}</p>
          <nav className={styles.socialLinks} aria-label={t('socialNavLabel')}>
            {socialLinks.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={href}
                className={styles.socialLink}
                aria-label={label}
                title={label}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon />
              </a>
            ))}
          </nav>
        </div>

        <p className={styles.credit}>
          <a
            href="https://webcreativeteam.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t('creditPrefix')} <b>webcreativeteam.com</b>
          </a>
        </p>
      </div>
    </footer>
  );
}
