import NewsletterSubscribeForm from '@/components/newsletter/NewsletterSubscribeForm';
import CookieFooterLink from '@/components/privacy/CookieFooterLink';
import { getVerifiedSocialProfiles } from '@/config/publicSocialProfiles';
import Link from 'next/link';
import privacyStyles from '@/components/privacy/CookieConsent.module.css';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
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

function EtsyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="#f56400" />
      <path
        fill="#fff"
        d="M7.3 6.2h9.2l.4 3.1h-.8c-.5-1.3-1.1-1.8-2.7-1.8h-2.5v3.8h1.9c1 0 1.3-.4 1.5-1.5h.8v4.4h-.8c-.2-1.1-.5-1.6-1.5-1.6h-1.9v4.1h2.7c1.7 0 2.5-.6 3.1-2.2h.8l-.6 3.5H7.3v-.8c1-.2 1.2-.4 1.2-1.3V8.3c0-.9-.2-1.1-1.2-1.3v-.8Z"
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="2.5" y="5.8" width="19" height="12.4" rx="3.2" fill="#ff0033" />
      <path fill="#fff" d="M10.1 9.1v5.8l5.2-2.9-5.2-2.9Z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10" fill="#050505" />
      <path
        fill="#25f4ee"
        d="M13.3 5.2h2.1c.2 1.5 1 2.6 2.4 3.1v2.2c-.9 0-1.7-.3-2.4-.8v4.9c0 2.7-1.7 4.4-4.1 4.4-2.1 0-3.8-1.4-3.8-3.5 0-2.3 1.8-3.7 4.2-3.5v2.3c-.9-.2-1.7.3-1.7 1.1 0 .7.5 1.2 1.3 1.2.9 0 1.6-.6 1.6-1.9V5.2Z"
      />
      <path
        fill="#fe2c55"
        d="M14.2 5.2h1.2c.2 1.5 1 2.6 2.4 3.1v1.3c-1.5-.4-2.8-1.4-3.6-2.7v7.7c0 2.7-1.7 4.4-4.1 4.4-.4 0-.8-.1-1.2-.2.6.5 1.4.8 2.4.8 2.4 0 4.1-1.7 4.1-4.4v-4.9c.7.5 1.5.8 2.4.8V9.6c-1.4-.5-2.2-1.6-2.4-3.1h-1.2V5.2Z"
      />
      <path
        fill="#fff"
        d="M13 5.2h1.2v9.4c0 2.7-1.7 4.4-4.1 4.4-2.1 0-3.8-1.4-3.8-3.5 0-2.3 1.8-3.7 4.2-3.5v2.3c-.9-.2-1.7.3-1.7 1.1 0 .7.5 1.2 1.3 1.2.9 0 1.6-.6 1.6-1.9V5.2H13Z"
      />
    </svg>
  );
}

export default function Footer() {
  const { t } = useTranslations('footer');
  const { publicHref } = useLocaleNavigation();
  const year = new Date().getFullYear();
  const socialIcons = {
    facebook: FacebookIcon,
    instagram: InstagramIcon,
    etsy: EtsyIcon,
    youtube: YouTubeIcon,
    tiktok: TikTokIcon,
  };
  const socialLinks = getVerifiedSocialProfiles()
    .filter(({ service, labelKey }) => Boolean(socialIcons[service]) && Boolean(labelKey))
    .map(({ service, href, labelKey }) => ({
      href,
      label: t(labelKey),
      Icon: socialIcons[service],
    }));

  return (
    <footer className={styles.footer}>
      <div className={privacyStyles.footerLeftBlock}>
        <p>{t('copyright', { year })}</p>
        <CookieFooterLink />
      </div>

      <NewsletterSubscribeForm />

      <div className={styles.footerRight}>
        <nav className={styles.siteLinks} aria-label={t('siteNavLabel')}>
          <Link href={publicHref('/gifts')}>{t('giftsLabel')}</Link>
        </nav>

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
