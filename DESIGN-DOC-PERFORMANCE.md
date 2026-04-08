# Happy Colors — Performance Optimization Design Document

**Дата:** 2026-04-08
**Статус:** Чернова — чака одобрение преди имплементация
**Обхват:** Frontend performance, caching, asset optimization (без компресия на hero images — ще се направи ръчно)

---

## 1. Премахване на Font Awesome

**Проблем:** Font Awesome CSS (~60KB) се зарежда два пъти — веднъж чрез `@import` в `globals.css:3` и веднъж чрез `<link>` в `head.js:6-12`. Целият library се зарежда за **5 празни звездички** в `ProductDetails.jsx:95`.

**Решение:**
- Заменяме `<i className="fa-regular fa-star">` с inline SVG или Unicode символ `☆`
- Махаме `@import` от `globals.css:3`
- Махаме `<link>` от `head.js` (или целия `head.js`, ако не носи друго)

**Въпрос към екипа:** Звездичките се ползват за бъдещ рейтинг или са чисто визуални? Ако са декоративни, може и да се премахнат изцяло вместо да заменяме иконите.

**Усилие:** Ниско
**Ефект:** Голям — спестяваме ~60KB render-blocking CSS + 1 external request

---

## 2. Google Fonts: `@import` → `next/font/google`

**Проблем:** `globals.css:2` зарежда Roboto с `@import url(...)`. Това е render-blocking — браузърът спира рендъра, докато изтегли шрифта от Google.

**Решение:**
- Инсталираме шрифта чрез `next/font/google` в `layout.js`
- Шрифтът става self-hosted (без external request)
- Махаме `@import` реда от `globals.css`

```js
// layout.js
import { Roboto } from 'next/font/google';
const roboto = Roboto({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '500', '700'] });
// Прилагаме roboto.className на <html> или <body>
```

**Усилие:** Ниско
**Ефект:** Голям — елиминира render-blocking external request

---

## 3. `next/image` за продуктови снимки

**Проблем:** `ProductCard.jsx:13` и `ProductDetails.jsx:200` ползват обикновен `<img>` за продуктови изображения от външен URL (bucket). Това означава: без автоматичен lazy loading, без srcset/responsive sizes, без WebP конверсия.

**Решение:**
- Заменяме `<img>` с `next/image` в двата файла
- Конфигурираме `remotePatterns` в `next.config.js` за домейна на bucket-а
- Задаваме `sizes` prop за responsive поведение

**Въпрос към екипа:** От кой домейн идват продуктовите снимки? Трябва ми точният домейн за `remotePatterns` конфигурацията. Също: в ProductDetails има image carousel с динамичен `currentImageIndex` — трябва да внимаваме `next/image` да работи коректно при смяна на снимките.

**Усилие:** Средно
**Ефект:** Среден — автоматична оптимизация, lazy loading, responsive images

---

## 4. Двоен fetch в product details page

**Проблем:** `products/[productId]/page.js` прави **две идентични** заявки към `${baseURL}/products/${productId}` с `cache: 'no-store'` — веднъж в `generateMetadata` (ред 10) и веднъж в `ProductDetailsPage` (ред 44). С `no-store` Next.js **не дедуплицира** fetch-овете, така че backend-ът получава два заявки за всяко зареждане.

**Решение:**
Извличаме общ data-layer helper, който кешира резултата в рамките на един request чрез `React.cache()`:

```js
// lib/getProduct.js
import { cache } from 'react';
import baseURL from '@/config';

export const getProduct = cache(async (productId) => {
  const res = await fetch(`${baseURL}/products/${productId}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
});
```

И двете функции (`generateMetadata` и `ProductDetailsPage`) викат `getProduct(productId)` — React гарантира, че fetch-ът се изпълнява само веднъж.

**Усилие:** Ниско
**Ефект:** Среден — наполовина заявки за product details + по-бърз response

---

## 5. Caching стратегия: `no-store` → `revalidate`

**Проблем:** Почти всички server-side fetch-ове ползват `cache: 'no-store'`, което гарантира fresh data, но прави всяка страница бавна, защото винаги чака backend.

**Текущо състояние:**
| Файл | Ред | Endpoint | `no-store` |
|------|-----|----------|------------|
| `products/[productId]/page.js` | 10, 44 | `/products/:id` | Да |
| `productsManager.js` | 136 | `/products` | Да |
| `search/page.js` | 24 | `/search` | Да |
| `contacts/page.js` | 21 | `/products/:id` | Да |

**Предложение:**
| Endpoint | Предложен cache | Обосновка |
|----------|-----------------|-----------|
| `/products/:id` | `revalidate: 60` | Продуктите не се променят всяка секунда. 60 сек. е безопасно. |
| `/products` (листинг) | `revalidate: 60` | Същата логика. |
| `/search` | `no-store` (запазваме) | Търсенето трябва да е винаги актуално. |
| `/products/:id` в contacts | `revalidate: 60` | Само за заглавие/линк — не е критично. |

**Въпрос към екипа:** GPT предлага 60-300 секунди. Аз предлагам 60 за начало — достатъчно кратко, че промените да се виждат бързо след редакция, но достатъчно дълго за кеширане. Какво мислите?

**Допълнителен въпрос:** При редакция на продукт, искате ли on-demand revalidation (`revalidatePath`/`revalidateTag`), за да виждате промените веднага? Това би изисквало допълнителна работа в API route-овете.

**Усилие:** Ниско
**Ефект:** Среден — значително по-бързо зареждане на каталог и product pages

---

## 6. Home page: `'use client'` → Server Component

**Проблем:** `page.js` (home) е маркирана с `'use client'`, но **не ползва нито един hook, browser API, или state**. Единственото съдържание е статичен JSX с `Link` компоненти. Това изпраща излишен JavaScript към браузъра.

**Решение:**
- Махаме `'use client'` от `page.js`
- Страницата става server component и се рендерира на сървъра
- `Link` от `next/link` работи и в server components, така че няма нужда от промени

**Усилие:** Минимално (махане на 1 ред)
**Ефект:** Нисък-среден — по-малък JS bundle за home page

---

## 7. Замяна на `setTimeout` за навигация с custom hook

**Проблем:** Открих **9 употреби на `setTimeout`** за "покажи съобщение → изчакай → навигирай". Тези pattern-и са в:
- `payment-success/page.jsx` — 4 пъти (редове 46, 57, 93, 102)
- `payment-cancel/page.jsx` — 1 път (ред 20)
- `ContactForm.jsx` — 2 пъти (редове 45, 55)
- `checkoutManager.js` — 1 път (ред 284)
- `useForm.js` — 1 път (ред 14)

**Какъв е проблемът с `setTimeout` за навигация:**
- Не е декларативен — скрива намерението
- Ако компонентът се unmount-не преди timeout-а, може да предизвика state update на unmounted component
- Не е тестваем лесно
- Не се интегрира с React lifecycle

**Предложение:** Създаваме custom hook `useDelayedRedirect`:

```js
// hooks/useDelayedRedirect.js
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function useDelayedRedirect(path, delay, shouldRedirect) {
  const router = useRouter();
  const timerRef = useRef(null);

  useEffect(() => {
    if (!shouldRedirect) return;

    timerRef.current = setTimeout(() => {
      router.push(path);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [shouldRedirect, path, delay, router]);
}
```

**Въпрос към екипа:** Този hook все още ползва `setTimeout` вътрешно, но го капсулира с правилен cleanup. Алтернативата е CSS анимация с `onAnimationEnd` callback, но това е по-сложно и може да не е оправдано. Какво предпочитате:
- **Вариант А:** `useDelayedRedirect` hook (капсулира setTimeout с cleanup)
- **Вариант Б:** CSS transition на MessageBox + `onTransitionEnd` за навигация (чист, но по-сложен)
- **Вариант В:** Оставяме както е, само добавяме cleanup където липсва (минимална промяна)

**Отделен въпрос:** `useForm.js:14` — auto-clear на error/success след 4 секунди с `setTimeout`. Това е UX решение. Искате ли да го запазим или потребителят сам да затваря съобщенията?

**Усилие:** Средно
**Ефект:** Нисък (performance), Висок (code quality и maintainability)

---

## 8. `head.js` — дублирана и остаряла конфигурация

**Проблем:** `head.js` дублира metadata, който вече е дефиниран в `layout.js` чрез Next.js `metadata` export. В App Router, `metadata` export е препоръчителният начин. `head.js` е Pages Router pattern и може да предизвика конфликти.

**Решение:**
- Изтриваме `head.js` (след като махнем Font Awesome link-а от т.1)
- Metadata-та вече е покрита от `layout.js`

**Усилие:** Минимално
**Ефект:** Нисък — чистота, без дублиране

---

## 9. Header loading state

**Проблем (GPT):** Header-ът рендерира `null` докато чака `/users/me` (`header.js:20`). GPT предлага header да има initial render и auth да "дообновява" user частите.

**Моето мнение:** Това е **UX подобрение**, не performance. Самият `/users/me` fetch е бърз. Промяната обаче е полезна — потребителят ще вижда навигация веднага, без "мигане".

**Предложение:** Header-ът рендерира навигацията веднага. Само user-specific секцията (greeting, logout бутон) показва skeleton/placeholder докато `loading === true`.

**Въпрос към екипа:** Искате ли да имплементираме skeleton за user секцията или просто да скрием user бутоните докато заредят (без `return null` за целия header)?

**Усилие:** Средно
**Ефект:** Нисък (performance), Среден (UX)

---

## Теми, по които НЕ съм съгласен с GPT

### "Извадете category loading от глобалния layout"

GPT предлага categories да не се зареждат от `ProductProvider` в layout-а. **Не съм съгласен** — категориите се ползват в header навигацията, която е на **всяка страница**. Извадим ли ги от layout-а, ще трябва или да ги дублираме навсякъде, или header-ът да няма данни. Текущият подход (зареждане в context при mount) е правилен за този use case.

### "Backend filtering вместо in-memory"

Не мога да потвърдя без backend код. При малък каталог (~50-100 продукта) разликата е незначителна. Не бих приоритизирал за сега.

---

## Приоритизиран план за изпълнение

### Фаза 1 — Quick wins (очаквано усилие: ниско)
1. Махане на Font Awesome + замяна на звездичките
2. `next/font/google` за Roboto
3. Изтриване на `head.js`
4. Home page → server component

### Фаза 2 — Caching и fetch оптимизация (очаквано усилие: ниско)
5. `React.cache()` за дедупликация на product fetch
6. `revalidate: 60` за каталог и product details

### Фаза 3 — Image и UX подобрения (очаквано усилие: средно)
7. `next/image` за ProductCard и ProductDetails
8. Header loading state подобрение

### Фаза 4 — Code quality (очаквано усилие: средно)
9. `useDelayedRedirect` hook (или избраната алтернатива)

---

## Открити въпроси — чакат решение преди имплементация

| # | Въпрос | Нужен отговор от |
|---|--------|-----------------|
| Q1 | Звездичките в ProductDetails — декоративни или за бъдещ рейтинг? | Собственик |
| Q2 | Домейн на image bucket за `remotePatterns` конфигурация? | Собственик |
| Q3 | `revalidate: 60` приемливо ли е или искате on-demand revalidation? | Екип |
| Q4 | `setTimeout` подход: hook (А), CSS transition (Б), или запазване (В)? | Екип |
| Q5 | Auto-clear на form errors след 4 сек. — запазваме или потребителят затваря? | Собственик |
| Q6 | Header skeleton за user секция или просто скриване на бутоните? | Собственик |
