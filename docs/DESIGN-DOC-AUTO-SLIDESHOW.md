# Happy Colors — Auto Slideshow Design Document

**Дата:** 2026-04-09
**Статус:** ОДОБРЕН — консенсус постигнат между Opus, GPT и собственик
**Обхват:** Автоматична смяна на продуктови изображения в ProductDetails и ProductCard
**Забележка:** Video upload не е в обхвата — изисква отделен дизайн документ

---

## Цел

Когато продукт има повече от едно изображение, снимките да се сменят автоматично — на всеки 4 секунди в листинга и на всеки 5 секунди в продуктовата страница.

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

## Решения (Q1–Q3 — решени)

| # | Въпрос | Решение |
|---|--------|---------|
| Q1 | Интервал | ProductCard: **4000ms**, ProductDetails: **5000ms** |
| Q2 | Fade transition | **Вариант А** (проста смяна) за ProductCard, **Вариант Б** (fade) за ProductDetails |
| Q3 | Hover pause | **Да** — ProductCard спира auto-rotate при hover |

---

## Имплементация

### 1. Custom hook `useImageSlideshow`

Капсулира цялата slideshow логика — auto-rotate, ръчна навигация, pause/resume, accessibility, tab visibility и viewport visibility.

**Файл:** `src/hooks/useImageSlideshow.js`

**Интерфейс:**
```js
useImageSlideshow(imageUrls, interval, options?)
```

**Параметри:**
- `imageUrls` — масив от URL-и
- `interval` — интервал в ms (default: 4000)
- `options.observeRef` — опционален `ref` към реален DOM елемент (НЕ към `Link`). Когато е подаден, slideshow тръгва **само** когато елементът е видим в viewport (IntersectionObserver). Когато излезе от viewport — pause.
- `options.resetKey` — стабилен ключ за reset на slideshow state-а при смяна на продукта. Препоръчителна стойност: `product._id`.

**Return стойности:**
```js
{
  currentIndex,    // number — текущ индекс
  currentUrl,      // string — imageUrls[currentIndex]
  hasMultiple,     // boolean — дали има повече от 1 снимка
  showPrev,        // () => void — ръчна навигация назад
  showNext,        // () => void — ръчна навигация напред
  pause,           // () => void — пауза (hover)
  resume,          // () => void — продължаване (hover leave)
}
```

**Използване в компонентите:**

```jsx
// ProductCard — с viewport observer + hover pause
const containerRef = useRef(null);
const { currentUrl, pause, resume } = useImageSlideshow(imageUrls, 4000, {
  observeRef: containerRef,
  resetKey: product._id,
});
// containerRef се закача на productImageContainer div-а (реален DOM елемент)

// ProductDetails — без observer, с fade
const { currentIndex, hasMultiple, showPrev, showNext }
  = useImageSlideshow(imageUrls, 5000, { resetKey: product._id });
// currentIndex определя кой кадър е slideVisible
```

**State модел — `useReducer`:**

Hook-ът ползва `useReducer` вместо отделни `useState`. Това е предвидимо в React Strict Mode и позволява чиста навигация напред/назад. При смяна на `imageUrls` (нов продукт) hook-ът dispatch-ва `reset` и връща `currentIndex` до 0.

```js
function slideReducer(state, action) {
  switch (action.type) {
    case 'next':
      return { currentIndex: (state.currentIndex + 1) % action.length };
    case 'prev':
      return { currentIndex: state.currentIndex === 0 ? action.length - 1 : state.currentIndex - 1 };
    case 'reset':
      return { currentIndex: 0 };
    default:
      return state;
  }
}
```

**Пълна имплементация на hook-а:**

```js
import { useReducer, useEffect, useCallback, useRef, useMemo } from 'react';

function slideReducer(state, action) {
  switch (action.type) {
    case 'next':
      return { currentIndex: (state.currentIndex + 1) % action.length };
    case 'prev':
      return { currentIndex: state.currentIndex === 0 ? action.length - 1 : state.currentIndex - 1 };
    case 'reset':
      return { currentIndex: 0 };
    default:
      return state;
  }
}

export default function useImageSlideshow(imageUrls, interval = 4000, options = {}) {
  const { observeRef, resetKey } = options;
  const [state, dispatch] = useReducer(slideReducer, { currentIndex: 0 });
  const timerRef = useRef(null);
  const pausedRef = useRef(false);
  const inViewportRef = useRef(!observeRef);
  const hasMultiple = imageUrls.length > 1;

  // Reset при смяна на продукта
  useEffect(() => {
    dispatch({ type: 'reset' });
  }, [resetKey]);

  // prefers-reduced-motion (non-reactive — достатъчно за production use)
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (!hasMultiple || pausedRef.current || prefersReducedMotion || !inViewportRef.current) return;
    timerRef.current = setInterval(() => {
      dispatch({ type: 'next', length: imageUrls.length });
    }, interval);
  }, [hasMultiple, imageUrls.length, interval, prefersReducedMotion, clearTimer]);

  // Стартиране и cleanup
  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  // Pause при скрит таб
  useEffect(() => {
    function handleVisibility() {
      if (document.hidden) {
        clearTimer();
      } else if (!pausedRef.current && inViewportRef.current) {
        startTimer();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [startTimer, clearTimer]);

  // IntersectionObserver — само когато е подаден observeRef
  useEffect(() => {
    if (!observeRef?.current) return;
    const el = observeRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        inViewportRef.current = entry.isIntersecting;
        if (entry.isIntersecting && !pausedRef.current) {
          startTimer();
        } else {
          clearTimer();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [observeRef, startTimer, clearTimer]);

  // Ръчна навигация
  const showPrev = useCallback(() => {
    dispatch({ type: 'prev', length: imageUrls.length });
    startTimer();
  }, [imageUrls.length, startTimer]);

  const showNext = useCallback(() => {
    dispatch({ type: 'next', length: imageUrls.length });
    startTimer();
  }, [imageUrls.length, startTimer]);

  // Pause / Resume (hover)
  const pause = useCallback(() => {
    pausedRef.current = true;
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    pausedRef.current = false;
    if (inViewportRef.current) startTimer();
  }, [startTimer]);

  const currentUrl = imageUrls[state.currentIndex] || '';

  return {
    currentIndex: state.currentIndex,
    currentUrl,
    hasMultiple,
    showPrev, showNext,
    pause, resume,
  };
}
```

**Ключови моменти:**
- **`useReducer`** вместо `useState` — чист pattern, предвидим в Strict Mode.
- `dispatch({ type: 'next', length })` — reducer изчислява новия индекс атомарно.
- `resetKey` позволява сигурен reset при смяна на продукта, без да разчитаме на identity-то на `imageUrls` масива.
- `observeRef` е опционален — ProductDetails не го ползва, ProductCard го подава
- IntersectionObserver с `threshold: 0.3` — slideshow тръгва когато поне 30% от картата е видима
- Hover pause (`pause`/`resume`) работи отгоре на viewport pause
- `visibilitychange` уважава и viewport state
- `prefers-reduced-motion` — non-reactive `useMemo`. Достатъчно за production — настройката на практика не се сменя по време на сесия. Бъдещо подобрение: `useEffect` + `matchMedia.addEventListener('change', ...)`.

### 2. Utility `normalizeImageUrls`

Извличаме съществуващата логика от ProductDetails в споделена функция.

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

### 3. Fade transition lifecycle (само за ProductDetails)

**Файл:** `src/app/products/[productId]/details.module.css`

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
  pointer-events: none;
}
```

**Как работи fade-ът — persistent DOM подход:**

Вместо mount/unmount на два `<Image>` елемента, рендерираме **всички** снимки стекнати с `position: absolute`. Елементите **персистират в DOM** и само сменят клас. Това гарантира реална CSS transition.

```jsx
{/* Вътре в .productDetailsMainImage контейнера */}
{imageUrls.map((url, index) => (
  <Image
    key={url}
    src={url}
    alt={product.title}
    fill
    sizes="(max-width: 768px) 90vw, (max-width: 1200px) 50vw, 40vw"
    className={`${styles.slideImage} ${index === currentIndex ? styles.slideVisible : styles.slideHidden}`}
    aria-hidden={index !== currentIndex}
    priority={index === 0}
    loading={index === 0 ? undefined : 'lazy'}
  />
))}
```

**Lifecycle:**
1. При mount: всички `<Image>` елементи се рендерират стекнати. Само index 0 е `slideVisible`, останалите са `slideHidden` (opacity: 0).
2. При смяна на `currentIndex`: предишният кадър получава `slideHidden` (opacity: 0), новият получава `slideVisible` (opacity: 1).
3. Тъй като елементите **не се mount/unmount**, а само сменят клас, CSS `transition: opacity 0.6s ease` се задейства коректно — реален crossfade.
4. Няма нужда от `transitionend` listener или cleanup — CSS transition е самодостатъчна.

**Защо persistent DOM:**
- Mount с `slideHidden` не дава transition (елементът се появява вече скрит)
- Conditional render (`{previousIndex !== currentIndex && ...}`) mount-ва/unmount-ва елементи — transitions не работят
- Persistent DOM: елементите са винаги там, само сменят opacity → transition работи
- При 2-4 снимки на продукт, overhead-ът е минимален

**Защо ProductCard НЕ ползва fade:**
- Листингът може да има 20-30 карти, всяка с 2-4 persistent `<Image>` елемента = 60-120 DOM nodes
- Простата смяна на `src` (единствен `<Image>`) е значително по-лека
- Визуално е достатъчно за thumbnail-и в листинг

---

## Промени по файлове

### Нови файлове
| Файл | Описание |
|------|----------|
| `src/hooks/useImageSlideshow.js` | Custom hook с `useReducer`: auto-rotate, ръчна навигация, pause/resume, reduced-motion, tab visibility, IntersectionObserver |
| `src/utils/normalizeImageUrls.js` | Нормализация на imageUrls от product обект |

### Променени файлове
| Файл | Промяна |
|------|---------|
| `src/app/products/[productId]/ProductDetails.jsx` | Заменяме inline carousel логика с `useImageSlideshow(imageUrls, 5000, { resetKey: product._id })` + `normalizeImageUrls`. Махаме `showPrevImage`, `showNextImage`, `currentImageIndex` state, `imageUrls` useMemo. Image секцията става `imageUrls.map()` с persistent DOM fade (всички снимки рендерирани, само текущата е `slideVisible`). Неактивните кадри получават `aria-hidden="true"`. |
| `src/app/products/[productId]/details.module.css` | Добавяме `.slideImage`, `.slideVisible`, `.slideHidden` класове. `.slideHidden` включва `pointer-events: none` за accessibility. |
| `src/app/products/ProductCard.jsx` | Добавяме `useImageSlideshow(imageUrls, 4000, { observeRef: containerRef, resetKey: product._id })` + `normalizeImageUrls`. `containerRef` се закача на `productImageContainer` div-а (реален DOM елемент, НЕ на `Link`). Добавяме `onMouseEnter={pause}`, `onMouseLeave={resume}` на контейнера. Сменяме `product.imageUrl` с `currentUrl`. Без fade — единствен `<Image>`, проста смяна на `src`. |
| `src/app/products/shop.module.css` | Без промени |

### Непроменени файлове
- Backend, upload, product model — без промени
- Cart, checkout — `addToCart` продължава да ползва текущо видимата снимка
- Ръчните prev/next бутони в ProductDetails — запазени

---

## Performance guards

### ProductCard viewport visibility
Auto-rotate **не** тръгва eagerly за всяка рендерирана карта. Вместо това:
- Slideshow стартира **само** когато картата влезе в viewport (IntersectionObserver, threshold 0.3)
- Slideshow спира когато картата излезе от viewport
- Hover pause работи отгоре на viewport pause
- Резултат: при 30 карти на страницата, само видимите 4-6 имат активен таймер

### Мрежово поведение
- В ProductCard: единствен `<Image>` с `priority={false}`. Зарежда се **само** текущият кадър. Браузърът не prefetch-ва следващите slideshow кадри — те се зареждат on-demand при смяна на `currentUrl`.
- В ProductDetails (persistent DOM): `priority={true}` **само** за index 0. Останалите кадри са `loading="lazy"`, но тъй като са стекнати в един и същи контейнер, браузърът **може** да ги зареди рано. При 2-4 снимки на продукт overhead-ът е минимален и приемлив.
- Това предотвратява ситуация, в която 30 карти с по 3 снимки генерират 90 image заявки при зареждане на listing страницата.

---

## Запазени функционалности

- Ръчна навигация с prev/next бутони в ProductDetails — **запазена**, рестартира auto-rotate
- Single image продукти — без slideshow, показва единствената снимка
- Продукти без снимка — без промяна
- `addToCart` — използва текущо видимата снимка
- `prefers-reduced-motion` — auto-rotate не тръгва, ръчната навигация работи

---

## Извън обхват

### Video upload
Изисква отделен дизайн документ, тъй като засяга:
- Data model (imageUrl/imageUrls → media модел или отделни videoUrl/videoUrls)
- Upload route (MIME type валидация, size limits)
- Product form UX
- Frontend rendering (`<video>` таг в carousel)
- Backend schema промени

Ще се планира отделно след приключване на slideshow имплементацията.
