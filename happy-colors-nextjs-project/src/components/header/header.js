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

  const cartItemCount = getTotalItems();
  const userNavClassName = `${styles.userNav} ${user ? styles.userNavVisible : styles.userNavHidden}`;
  const handleRouteChange = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <HeaderRouteWatcher onRouteChange={handleRouteChange} />
      </Suspense>

      <header className="header">
        <nav className={styles.mainNav}>
          <Link href="/">
            <div className={styles.logoContainer}>
              <Image className={styles.logoImage} src="/logo_64pxH.svg" alt="logo" width={256} height={256} />
            </div>
          </Link>

          {!mobileMenuOpen && (
            <button
              className={styles.hamburgerBtn}
              aria-label="Отвори менюто"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Image src="/hamburger.svg" alt="Меню" width={64} height={64} />
            </button>
          )}

          <ul className={`${styles.mainNavList} ${mobileMenuOpen ? styles.showMenu : ''}`}>
            <li><Link href="/">Начало</Link></li>

            <li className={styles.hasSubmenu}>
              {mobileMenuOpen ? (
                <span className={styles.menuItemLabel}>Каталог</span>
              ) : (
                <Link className={styles.menuItem} href="/products">Каталог</Link>
              )}
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
            {/* <li><Link href="/blog">Блог</Link></li> */}
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
      </header>

      <ul className={userNavClassName}>
        <li><Link href="/products/create">Създай продукт</Link></li>
        <li><Link href="/categories/create">Създай категория</Link></li>
        <li><Link href="/categories">Категории</Link></li>
      </ul>
    </>
  );
}
