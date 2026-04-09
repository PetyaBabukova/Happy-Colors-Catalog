# Happy Colors — Performance Optimization Design Document

**Дата:** 2026-04-08
**Статус:** ОДОБРЕН — консенсус постигнат между Opus, GPT и собственик
**Обхват:** Frontend performance, caching, asset optimization
**Забележка:** Hero image компресия се прави ръчно от собственика, извън този план

---

## Фаза 1 — Images (high impact)

### 1.1 `next/image` за продуктови снимки

**Проблем:** `ProductCard.jsx:13` и `ProductDetails.jsx:200` ползват обикновен `<img>` за продуктови изображения от Google Cloud Storage. Без lazy loading, srcset, WebP конверсия.

**Решение:**
- Заменяме `<img>` с `next/image` в двата файла
- `remotePatterns` вече е конфигуриран в `next.config.mjs:46-57` (`storage.googleapis.com/happycolors-store/**`)
- Задаваме `sizes` prop за responsive поведение
- В ProductDetails carousel: `next/image` работи с динамичен `src` — при смяна на `currentImageIndex` просто се подава нов URL

**Файлове за промяна:**
- `src/app/products/ProductCard.jsx`
- `src/app/products/[productId]/ProductDetails.jsx`

**Усилие:** Средно
**Ефект:** Висок

---

## Фаза 2 — Render-blocking assets

### 2.1 Премахване на Font Awesome

**Проблем:** Font Awesome CSS (~60KB) се зарежда **два пъти** — чрез `@import` в `globals.css:3` и чрез `<link>` в `head.js:6-12`. Целият library се зарежда за 5 декоративни звездички в `ProductDetails.jsx:95`.

**Решение:**
- Заменяме `<i className="fa-regular fa-star">` с inline SVG звезди (леки, без external dependency)
- Махаме `@import` от `globals.css:3`
- Махаме Font Awesome `<link>` от `head.js`

**Решение по Q1:** Звездичките са за бъдещ рейтинг/коментари. Заменяме ги с SVG, което ще служи като визуална основа за бъдещата функционалност. Font Awesome не се запазва.

**Файлове за промяна:**
- `src/app/globals.css`
- `src/app/products/[productId]/ProductDetails.jsx`

**Усилие:** Ниско
**Ефект:** Голям

### 2.2 Google Fonts: `@import` → `next/font/google`

**Проблем:** `globals.css:2` зарежда Roboto с `@import url(...)`. Render-blocking — браузърът спира рендъра докато изтегли шрифта.

**Решение:**
- `next/font/google` в `layout.js` — шрифтът става self-hosted
- Махаме `@import` реда от `globals.css`

```js
// layout.js
import { Roboto } from 'next/font/google';
const roboto = Roboto({ subsets: ['latin', 'cyrillic'], weight: ['300', '400', '500', '700'] });
// Прилагаме roboto.className на <body>
```

**Файлове за промяна:**
- `src/app/layout.js`
- `src/app/globals.css`

**Усилие:** Ниско
**Ефект:** Голям

### 2.3 Изтриване на `head.js`

**Проблем:** `head.js` е Pages Router pattern. Дублира metadata от `layout.js`. В App Router е излишен и може да предизвика конфликти.

**Решение:**
- Изтриваме `head.js` (след като Font Awesome е махнат в 2.1)
- Metadata-та вече е покрита от `layout.js` export

**Файлове за промяна:**
- `src/app/head.js` (изтриване)

**Усилие:** Минимално
**Ефект:** Нисък — чистота, без дублиране

---

## Фаза 3 — Data fetching оптимизация

### 3.1 Дедупликация на fetch в product details

**Проблем:** `products/[productId]/page.js` прави две идентични заявки — ред 10 за `generateMetadata` и ред 44 за `ProductDetailsPage`. С `no-store` Next.js не дедуплицира.

**Решение:**
- `React.cache()` wrapper — и двете функции викат обща `getProduct()`, React гарантира еднократно изпълнение

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

**Риск:** Много нисък. Промяната е изолирана в един файл. Rollback е тривиален.

**Файлове за промяна:**
- Нов: `src/lib/getProduct.js`
- `src/app/products/[productId]/page.js`

**Усилие:** Ниско
**Ефект:** Среден

### 3.2 Caching: `no-store` → `revalidate: 60`

**Проблем:** Server-side fetch-ове ползват `cache: 'no-store'` навсякъде — всяка страница чака backend.

**План:**
| Endpoint | Сега | Ново | Обосновка |
|----------|------|------|-----------|
| `/products/:id` | `no-store` | `revalidate: 60` | Продуктите не се променят всяка секунда |
| `/products` (листинг) | `no-store` | `revalidate: 60` | Същата логика |
| `/search` | `no-store` | `no-store` (запазваме) | Търсенето трябва да е актуално |
| `/products/:id` в contacts | `no-store` | `revalidate: 60` | Само за заглавие — не е критично |

**Решение по Q3:** `revalidate: 60` за начало. On-demand revalidation не се вкарва в тази фаза. Ако 60 сек. delay при редакция е проблем — ще добавим по-късно.

**Риск:** Нисък. Не засяга SEO (Google вижда пълен HTML и при двата режима). Най-лошият случай — до 60 сек. delay за промени. Лесно обратимо.

**Файлове за промяна:**
- `src/app/products/[productId]/page.js` (покрито от 3.1)
- `src/managers/productsManager.js`
- `src/app/contacts/page.js`

**Усилие:** Ниско
**Ефект:** Среден

### 3.3 Home page → Server Component

**Проблем:** `page.js` (home) е `'use client'` без нито един hook, state или browser API. Излишен JS отива към браузъра.

**Решение:**
- Махаме `'use client'`
- `Link` от `next/link` работи в server components

**Файлове за промяна:**
- `src/app/page.js`

**Усилие:** Минимално
**Ефект:** Нисък-среден

---

## Фаза 4 — Header UX подобрение

### 4.1 Header loading state

**Проблем:** Header-ът рендерира `null` докато чака `/users/me` (`header.js:20`). Потребителят вижда празно пространство.

**Решение по Q6:** По-простият вариант — header рендерира навигацията веднага, скрива user-specific бутоните (greeting, logout) докато `loading === true`. Без skeleton, без `return null`.

**Файлове за промяна:**
- `src/components/header/header.js`

**Усилие:** Средно
**Ефект:** Нисък (performance), Среден (UX)

---

## Deferred — извън текущия план

### setTimeout cleanup (code quality)

**Решение по Q4:** Вариант В — запазваме текущите `setTimeout`, добавяме cleanup (`clearTimeout` в `useEffect` return) където липсва. Не е performance тема, ще се направи при подходящ повод.

**Решение по Q5:** Auto-clear на form errors след 4 сек. се запазва. Работещо UX решение, не е performance проблем.

### Backend product filtering

GPT потвърди, че `productsServices.js:27` филтрира in-memory, не в Mongo query. Проблемът е реален, но е **backend scope** — не влиза във frontend performance план. Ще се адресира отделно.

### Categories server-side loading

Потенциал за оптимизация има, но е **архитектурна промяна** — пренареждане на data flow между server/client boundaries. В текущата архитектура Header е client component, `ClientLayout` държи три provider-а. Промяната не е quick win. Ще се планира отделно, ако се окаже нужна.

---

## Резюме

| Фаза | Задачи | Усилие | Ефект |
|-------|--------|--------|-------|
| 1 | `next/image` за ProductCard + ProductDetails | Средно | Висок |
| 2 | Font Awesome, next/font, head.js | Ниско | Голям |
| 3 | React.cache, revalidate: 60, home → SC | Ниско | Среден |
| 4 | Header loading state | Средно | Среден (UX) |
| Deferred | setTimeout cleanup, backend filtering, categories SSR | — | — |

**Всички въпроси (Q1–Q6) са решени. Планът е готов за изпълнение.**
