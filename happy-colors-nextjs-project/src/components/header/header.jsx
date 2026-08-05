'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useProducts } from '@/context/ProductContext';
import { isCartoonsServiceEnabled } from '@/config/cartoonsFeature';
import { persistLocalePreference } from '@/i18n/browserLocale';
import useLocaleNavigation from '@/i18n/useLocaleNavigation';
import useTranslations from '@/i18n/useTranslations';
import { fetchAdminUsers } from '@/managers/usersAdminManager';
import { isCatalogMode } from '@/utils/catalogMode';
import styles from './header.module.css';

function HeaderRouteWatcher({ onRouteChange }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    onRouteChange();
  }, [onRouteChange, pathname, searchParamsKey]);

  return null;
}

function FlagIcon({ locale }) {
  if (locale === 'bg') {
    return (
      <svg className={styles.localeFlag} viewBox="0 0 28 20" aria-hidden="true" focusable="false">
        <rect width="28" height="20" rx="3" fill="#fff" />
        <path d="M0 6.67h28V20H0z" fill="#00966e" />
        <path d="M0 13.33h28V20H0z" fill="#d62612" />
        <rect width="28" height="20" rx="3" fill="none" stroke="rgba(0,0,0,.16)" />
      </svg>
    );
  }

  return (
    <svg className={styles.localeFlag} viewBox="0 0 28 20" aria-hidden="true" focusable="false">
      <rect width="28" height="20" rx="3" fill="#012169" />
      <path d="M0 0l28 20M28 0L0 20" stroke="#fff" strokeWidth="4" />
      <path d="M0 0l28 20M28 0L0 20" stroke="#c8102e" strokeWidth="2.4" />
      <path d="M14 0v20M0 10h28" stroke="#fff" strokeWidth="6" />
      <path d="M14 0v20M0 10h28" stroke="#c8102e" strokeWidth="3.4" />
      <rect width="28" height="20" rx="3" fill="none" stroke="rgba(0,0,0,.18)" />
    </svg>
  );
}

function LanguageSelector({ onNavigate }) {
  const selectorRef = useRef(null);
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const {
    enabledLocales,
    locale,
    localeDetails,
    localeRoutingEnabled,
    switchLocaleHref,
  } = useLocaleNavigation();
  const { t } = useTranslations('navigation');

  if (!localeRoutingEnabled || enabledLocales.length < 2) {
    return null;
  }

  const currentHref = `${pathname}${search ? `?${search}` : ''}`;
  const handleLocaleSelect = (enabledLocale) => {
    persistLocalePreference(enabledLocale);
    if (selectorRef.current) {
      selectorRef.current.open = false;
    }
    onNavigate();
  };

  return (
    <details ref={selectorRef} className={styles.localeSelector}>
      <summary aria-label={t('languageTrigger', { languageCode: locale.toUpperCase() })}>
        <FlagIcon locale={locale} />
        <span>{locale.toUpperCase()}</span>
      </summary>
      <ul className={styles.localeMenu} aria-label={t('languageMenuLabel')}>
        {enabledLocales.map((enabledLocale) => (
          <li key={enabledLocale}>
            <Link
              href={switchLocaleHref(currentHref, enabledLocale)}
              aria-current={enabledLocale === locale ? 'true' : undefined}
              onClick={() => {
                handleLocaleSelect(enabledLocale);
              }}
            >
              <FlagIcon locale={enabledLocale} />
              {t('languageOption', {
                languageCode: enabledLocale.toUpperCase(),
                languageName: localeDetails[enabledLocale].label,
              })}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

function getCategoryFilterValue(category) {
  return category?.filterSlug || category?.slug || category?.name || '';
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const { visibleCategories } = useProducts();
  const { getTotalItems } = useCart();
  const { publicHref } = useLocaleNavigation();
  const { dictionary, locale, t } = useTranslations('navigation');
  const [pendingReviewCount, setPendingReviewCount] = useState(0);

  const cartItemCount = getTotalItems();
  const isFullAdmin = user?.role === 'full_admin';
  const canCreateProduct =
    isFullAdmin || (user?.role === 'artist' && user?.artistStatus !== 'suspended');
  const userNavClassName = `${styles.userNav} ${styles.userNavVisible}`;
  const handleRouteChange = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);
  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);
  const handleMainNavListClick = useCallback((event) => {
    if (event.target.closest('a')) {
      setMobileMenuOpen(false);
    }
  }, []);
  useEffect(() => {
    if (!isFullAdmin) {
      setPendingReviewCount(0);
      return undefined;
    }

    let isCurrent = true;

    fetchAdminUsers()
      .then((items) => {
        if (!isCurrent) {
          return;
        }

        const total = Array.isArray(items)
          ? items.reduce((sum, item) => sum + (Number(item.pendingReviewCount) || 0), 0)
          : 0;
        setPendingReviewCount(total);
      })
      .catch(() => {
        if (isCurrent) {
          setPendingReviewCount(0);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [isFullAdmin]);

  return (
    <>
      <Suspense fallback={null}>
        <HeaderRouteWatcher onRouteChange={handleRouteChange} />
      </Suspense>

      <header className={styles.siteHeader}>
        <nav className={`${styles.mainNav} pageInline`}>
          <Link href={publicHref('/')}>
            <div className={styles.logoContainer}>
              <Image className={styles.logoImage} src="/logo_64pxH.svg" alt="logo" width={256} height={256} />
            </div>
          </Link>

          {!mobileMenuOpen && (
            <button
              type="button"
              className={styles.hamburgerBtn}
              aria-label={t('openMenu')}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu aria-hidden="true" size={32} strokeWidth={1.8} />
            </button>
          )}

          {mobileMenuOpen && (
            <button
              type="button"
              className={styles.closeMenuBtn}
              aria-label={t('closeMenu')}
              onClick={closeMobileMenu}
            >
              <X aria-hidden="true" size={24} strokeWidth={1.8} />
            </button>
          )}

          <ul
            className={`${styles.mainNavList} ${mobileMenuOpen ? styles.showMenu : ''}`}
            onClick={handleMainNavListClick}
          >
            <li><Link href={publicHref('/')}>{t('home')}</Link></li>

            <li className={styles.hasSubmenu}>
              <Link className={`${styles.menuItem} ${styles.menuItemLabel}`} href={publicHref('/products')}>
                {t('catalog')}
              </Link>
              {visibleCategories && visibleCategories.length > 0 && (
                <ul className={styles.subNavList}>
                  <li>
                    <Link href={publicHref('/products')}>{t('allProducts')}</Link>
                  </li>
                  {visibleCategories.map((cat) => {
                    const isCategoryTranslationPending =
                      locale === 'en' &&
                      cat?.contentLocale === 'bg' &&
                      cat?.translationPending === true;

                    return (
                      <li key={cat._id}>
                        <Link href={publicHref(`/products?category=${encodeURIComponent(getCategoryFilterValue(cat))}`)}>
                          <span lang={isCategoryTranslationPending ? 'bg' : undefined}>{cat.name}</span>
                          {isCategoryTranslationPending && (
                            <span className={styles.categoryTranslationBadge}>
                              {dictionary.products.translationPending}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>

            {isCartoonsServiceEnabled && <li><Link href={publicHref('/cartoons')}>{t('cartoons')}</Link></li>}
            <li><Link href={publicHref('/blog')}>{t('blog')}</Link></li>
            <li><Link href={publicHref('/aboutus')}>{t('about')}</Link></li>
            <li><Link href={publicHref('/faq')}>{t('faq')}</Link></li>
            <li><Link href={publicHref('/contacts')}>{t('contacts')}</Link></li>
          </ul>

          <form className={styles.searchForm} action={publicHref('/search')} method="get">
            <input type="text" name="q" placeholder={t('searchPlaceholder')} className={styles.searchInput} />
            <button type="submit" className={styles.searchBtn} aria-label={t('searchSubmit')}>
              <Image src="/search_icon_green.svg" alt="" width={16} height={16} />
            </button>
          </form>

          <Suspense fallback={null}>
            <LanguageSelector onNavigate={closeMobileMenu} />
          </Suspense>

          {user?.username ? (
            <p className={styles.userGreeting}>
              Здравей, {user.username} | <Link href="/users/logout">Изход</Link>
            </p>
          ) : null}

          {!isCatalogMode && (
            <Link href="/cart" className={styles.cartIconWrapper}>
              <Image className={styles.basketGreen} src="/basket_green.svg" alt={t('cart')} width={32} height={32} />
              {cartItemCount > 0 && (
                <span className={styles.cartBadge}>{cartItemCount}</span>
              )}
            </Link>
          )}
        </nav>

        {canCreateProduct ? (
          <ul className={userNavClassName}>
            {canCreateProduct && (
              <li><Link href="/products/create">Създай продукт</Link></li>
            )}
            {isFullAdmin && (
              <>
                <li><Link href="/translations">EN преводи</Link></li>
                <li><Link href="/homepage-featured">Любими продукти</Link></li>
                <li><Link href="/categories/create">Създай категория</Link></li>
                <li><Link href="/categories">Категории</Link></li>
                <li><Link href="/home-banners/create">Създай хиро банер</Link></li>
                <li><Link href="/cartoon-orders">Шарж поръчки</Link></li>
                <li><Link href="/blog/create">Създай блог статия</Link></li>
                <li><Link href="/analytics">Анализи</Link></li>
                <li>
                  <Link
                    href="/users/admin"
                    className={pendingReviewCount > 0 ? styles.pendingAdminLink : undefined}
                  >
                    Потребители
                  </Link>
                </li>
                <li><Link href="/newsletter/send">Newsletter</Link></li>
              </>
            )}
          </ul>
        ) : null}
      </header>
    </>
  );
}
