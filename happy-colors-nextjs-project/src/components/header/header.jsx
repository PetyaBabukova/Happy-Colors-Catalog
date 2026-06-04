'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import styles from './header.module.css';
import { useAuth } from '@/context/AuthContext';
import { useProducts } from '@/context/ProductContext';
import { useCart } from '@/context/CartContext';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useSearchParams } from 'next/navigation';
import { isCatalogMode } from '@/utils/catalogMode';
import { fetchAdminUsers } from '@/managers/usersAdminManager';
import { Menu, X } from 'lucide-react';

function HeaderRouteWatcher({ onRouteChange }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();

  useEffect(() => {
    onRouteChange();
  }, [onRouteChange, pathname, searchParamsKey]);

  return null;
}

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const { visibleCategories } = useProducts();
  const { getTotalItems } = useCart();
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
          <Link href="/">
            <div className={styles.logoContainer}>
              <Image className={styles.logoImage} src="/logo_64pxH.svg" alt="logo" width={256} height={256} />
            </div>
          </Link>

          {!mobileMenuOpen && (
            <button
              type="button"
              className={styles.hamburgerBtn}
              aria-label="Отвори менюто"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu aria-hidden="true" size={32} strokeWidth={1.8} />
            </button>
          )}

          {mobileMenuOpen && (
            <button
              type="button"
              className={styles.closeMenuBtn}
              aria-label="Затвори менюто"
              onClick={closeMobileMenu}
            >
              <X aria-hidden="true" size={24} strokeWidth={1.8} />
            </button>
          )}

          <ul
            className={`${styles.mainNavList} ${mobileMenuOpen ? styles.showMenu : ''}`}
            onClick={handleMainNavListClick}
          >
            <li><Link href="/">Начало</Link></li>

            <li className={styles.hasSubmenu}>
              <Link className={`${styles.menuItem} ${styles.menuItemLabel}`} href="/products">
                Каталог
              </Link>
              {visibleCategories && visibleCategories.length > 0 && (
                <ul className={styles.subNavList}>
                  <li>
                    <Link href="/products">Всички</Link>
                  </li>
                  {visibleCategories.map((cat) => (
                    <li key={cat._id}>
                      <Link href={`/products?category=${encodeURIComponent(cat.name)}`}>
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>

            <li><Link href="/aboutus">За Happy Colors</Link></li>
            <li><Link href="/faq">ЧЗВ</Link></li>
            <li><Link href="/blog">Блог</Link></li>
            {/* <li><Link href="/partners">За партньори</Link></li> */}
            <li><Link href="/contacts">Контакти</Link></li>
          </ul>

          <form className={styles.searchForm} action="/search" method="get">
            <input type="text" name="q" placeholder="Търсене" className={styles.searchInput} />
            <button type="submit" className={styles.searchBtn}>
              <Image src="/search_icon_green.svg" alt="search icon" width={16} height={16} />
            </button>
          </form>

          {user?.username ? (
            <p className={styles.userGreeting}>
              Здравей, {user.username} | <Link href="/users/logout">Изход</Link>
            </p>
          ) : (
            null
          )}

          {!isCatalogMode && (
            <Link href="/cart" className={styles.cartIconWrapper}>
              <Image className={styles.basketGreen} src="/basket_green.svg" alt="Количка" width={32} height={32} />
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
        <li><Link href="/home-banners/create">Създай хоум банер</Link></li>
        <li><Link href="/homepage-featured">Избери любими продукти</Link></li>
        <li><Link href="/blog/create">Създай блог статия</Link></li>
        <li><Link href="/categories/create">Създай категория</Link></li>
        <li><Link href="/categories">Категории</Link></li>
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
