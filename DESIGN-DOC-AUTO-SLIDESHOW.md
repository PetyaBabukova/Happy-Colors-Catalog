# Happy Colors — Auto Slideshow Design Document

**Дата:** 2026-04-09
**Статус:** Чернова — чака одобрение
**Обхват:** Автоматична смяна на продуктови изображения в ProductDetails и ProductCard

---

## Цел

Когато продукт има повече от едно изображение, снимките да се сменят автоматично на всеки 3 секунди — както на продуктовата страница (ProductDetails), така и на листинг страницата (ProductCard).

---

## Текущо състояние

### ProductDetails
- Вече има ръчен carousel с prev/next бутони
- Логиката за `imageUrls`, `currentImageIndex`, `showPrevImage`, `showNextImage` е inline в компонента
- Ползва `next/image` с `fill`

### ProductCard
- Показва **само** `product.imageUrl` (първата снимка)
- Няма carousel логика
- Ползва `next/image` с `fill`
- Продуктът идва с `product.imageUrls` масив от backend-а, но той не се използва

---

## Предложение

### 1. Custom hook `useImageSlideshow`

Създаваме нов hook, който капсулира цялата slideshow логика — и автоматичната, и ръчната. Използва се и от двата компонента без дублиране на код.

**Файл:** `src/hooks/useImageSlideshow.js`

```js
import { useState, useEffect, useCallback, useRef } from 'react';

export default function useImageSlideshow(imageUrls, interval = 3000) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef(null);
  const hasMultiple = imageUrls.length > 1;

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (hasMultiple) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % imageUrls.length);
      }, interval);
    }
  }, [hasMultiple, imageUrls.length, interval]);

  // Стартиране и cleanup на auto-rotation
  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  // Ръчна навигация — рестартира таймера
  const showPrev = useCallback(() => {
    setCurrentIndex(prev => (prev === 0 ? imageUrls.length - 1 : prev - 1));
    resetTimer();
  }, [imageUrls.length, resetTimer]);

  const showNext = useCallback(() => {
    setCurrentIndex(prev => (prev + 1) % imageUrls.length);
    resetTimer();
  }, [imageUrls.length, resetTimer]);

  return { currentIndex, hasMultiple, showPrev, showNext };
}
```

**Ключови моменти:**
- `useRef` за interval ID — правилен cleanup при unmount
- `resetTimer` се извиква при ръчна навигация — потребителят натиска стрелка → таймерът рестартира от 0, без "скок" след секунда
- `interval` е параметър — може да се настрои per-component (3000ms по подразбиране)
- Hook-ът не знае нищо за UI — чиста separation of concerns

### 2. Нормализация на `imageUrls`

В момента ProductDetails нормализира `imageUrls` inline с `useMemo`. Същата логика ще трябва и в ProductCard. Вместо да я дублираме, извличаме utility функция.

**Файл:** `src/utils/normalizeImageUrls.js`

```js
export function normalizeImageUrls(product) {
  if (Array.isArray(product?.imageUrls) && product.imageUrls.length > 0) {
    return product.imageUrls.filter(Boolean);
  }
  if (product?.imageUrl) {
    return [product.imageUrl];
  }
  return [];
}
```

### 3. CSS fade transition

За плавна смяна на снимките добавяме CSS transition на opacity. Без JavaScript анимации — чист CSS.

**Подход:** `next/image` с `fill` не позволява лесно fade между две снимки (има само един `<Image>` елемент с динамичен `src`). Два варианта:

**Вариант А — Прост (промяна на src, без fade):**
- Просто сменяме `src` на `<Image>`. Снимката се подменя моментално.
- Предимства: Просто, няма допълнителен DOM, няма layout issues
- Недостатъци: Няма плавен преход

**Вариант Б — Fade с CSS transition:**
- Рендерираме **два** `<Image>` елемента — текущ и следващ, стекнати с `position: absolute`
- CSS `opacity` + `transition` за плавен fade
- При промяна на `currentIndex` текущият fade-out, следващият fade-in

```css
.slideImage {
  position: absolute;
  inset: 0;
  transition: opacity 0.6s ease;
}

.slideVisible {
  opacity: 1;
}

.slideHidden {
  opacity: 0;
}
```

**Моя препоръка:** Вариант А за ProductCard (листинг — много карти, по-леко за browser-а), Вариант Б за ProductDetails (единична страница, fade ще изглежда по-добре).

---

## Промени по файлове

### Нови файлове
| Файл | Описание |
|------|----------|
| `src/hooks/useImageSlideshow.js` | Custom hook за auto-rotate + ръчна навигация |
| `src/utils/normalizeImageUrls.js` | Нормализация на imageUrls от product обект |

### Променени файлове
| Файл | Промяна |
|------|---------|
| `src/app/products/[productId]/ProductDetails.jsx` | Заменяме inline carousel логиката с `useImageSlideshow` + `normalizeImageUrls`. Махаме `showPrevImage`, `showNextImage`, `currentImageIndex` state, `imageUrls` useMemo. Добавяме fade transition (Вариант Б). |
| `src/app/products/[productId]/details.module.css` | Добавяме `.slideImage`, `.slideVisible`, `.slideHidden` класове |
| `src/app/products/ProductCard.jsx` | Добавяме `useImageSlideshow` + `normalizeImageUrls`. Сменяме статичен `product.imageUrl` с `imageUrls[currentIndex]`. |
| `src/app/products/shop.module.css` | Без промени — `productImage` и `productImageContainer` вече поддържат стила |

### Непроменени файлове
- Backend, upload, product model — без промени
- Cart, checkout — `addToCart` ще продължи да ползва `mainImage` (текущо видимата снимка)

---

## Запазени функционалности

- Ръчна навигация с prev/next бутони в ProductDetails — **запазена**, рестартира auto-rotate
- Single image продукти — без slideshow, показва се единствената снимка
- Продукти без снимка — без промяна, показва се празно (както сега)
- `addToCart` — използва текущо видимата снимка, не се променя

---

## Въпроси за одобрение

| # | Въпрос |
|---|--------|
| Q1 | Интервал 3 секунди — подходящ ли е? Или предпочиташ по-бавно (4-5 сек.)? |
| Q2 | Fade transition за ProductDetails (Вариант Б) — одобряваш ли, или предпочиташ проста смяна без анимация (Вариант А) за двата компонента? |
| Q3 | ProductCard — при hover да спира ли auto-rotate (пауза), за да не се сменя снимката докато потребителят разглежда картата? |
