# Happy Colors - Mobile Optimization Design Document

**Дата:** 2026-04-14  
**Статус:** Draft for review  
**Обхват:** Mobile-first performance optimization for homepage, about page, header/navigation, and product carousels  
**Свързани документи:** `DESIGN-DOC-PERFORMANCE.md`, `DESIGN-DOC-AUTO-SLIDESHOW.md`

---

## Цел

Да подобрим осезаемо mobile performance-а на сайта, без broad refactor и без архитектурни промени, които не са нужни в този етап.

Търсим най-вече:

- по-бързо първоначално визуализиране на началния екран на мобилни устройства
- по-малко излишен network/CPU/memory натиск при зареждане
- по-добра дисциплина в mobile rendering path-а
- запазване на autoplay в продуктовите карусели
- подготовка на `home` hero секцията за бъдещ carousel, без да го имплементираме сега
- консистентно carousel поведение:
  - autoplay да се движи само напред
  - manual drag/swipe на продуктовата страница да работи и в двете посоки

---

## Контекст

След предишните оптимизации desktop performance-ът е добър, но mobile experience-ът изостава. Най-вероятните причини в текущото приложение са комбинация от:

- тежки hero/banner изображения
- CSS background изображения, които не позволяват добър responsive asset selection
- сравнително скъп visual/render path за above-the-fold секции
- product carousels, които на мобилни устройства са по-чувствителни към animation, image decode и gesture handling overhead

Собственикът вече е подготвил нови mobile/laptop WebP assets в `public/`:

- `homepage_background_laptop.webp`
- `homepage_background_mobile.webp`
- `aboutUs_Hero_banner_laptop.webp`
- `aboutUs_Hero_banner_mobile.webp`

Допълнително ново продуктово условие:

- в бъдещ етап `home` hero секцията ще трябва да стане carousel

Това означава, че текущата hero оптимизация не трябва да заключва home секцията в твърде "single-image-only" markup.

---

## Текущо състояние

### Home hero

В момента home hero секцията ползва CSS background image в `src/app/page.module.css`:

- `background-image: url('/homepage_background_cropped.png');`

Недостатъци:

- няма автоматичен responsive image selection
- няма прецизен контрол върху mobile срещу desktop asset
- above-the-fold изображението не е структурирано като future-carousel-ready media layer

### About hero

`src/app/aboutus/page.js` в момента подава inline background image:

- `backgroundImage: "url('/aboutUs_Hero_banner.png')"`

Недостатъци:

- липсва responsive asset selection
- липсва по-прецизен контрол върху render path-а

### Header / navigation

`src/components/header/header.js` е client component и държи:

- mobile menu state
- auth-dependent rendering
- categories submenu
- search form
- cart badge

Това е функционално нормално, но mobile performance ползата от промени тук трябва да се разглежда реалистично. Header фазата не е основният performance lever в този scope.

### Product carousels

Вече имаме работещ slideshow hook в `src/hooks/useImageSlideshow.js`.

Текущите важни характеристики:

- autoplay е активен
- loop логиката е налична
- ProductDetails поддържа drag/swipe
- ProductCard поддържа autoplay

Функционално това е добра база. Новата задача не е да измисляме carousel от нулата, а да фиксираме правилната mobile-aware стратегия за двата различни случая:

- `ProductDetails` като rich interaction carousel
- `ProductCard` като lightweight listing carousel

---

## Потвърдени решения

### 1. Hero/banner assets

Избираме вече подготвените отделни mobile/laptop WebP файлове като основен подход.

Това е правилният избор за този проект, защото:

- дава реален и директен performance ефект
- не изисква нов media pipeline
- не въвежда спорна архитектура
- използва вече налични assets

Финално решение за current phase:

- `home` hero: responsive DOM media слой, структуриран като future-carousel-ready shell
- `about` hero: статичен responsive hero

### 2. Carousel behavior

Поведение, което искаме да е официално заложено:

- autoplay: винаги се движи само в една посока, напред
- manual navigation on `ProductDetails`:
  - drag/swipe наляво -> next
  - drag/swipe надясно -> previous
  - бутоните prev/next остават двупосочни
- `ProductCard`:
  - autoplay остава
  - няма drag/swipe за listing view

### 3. Carousel architecture split

Финално решение:

- `ProductDetails`: clone/sliding-track подход остава допустим и оправдан
- `ProductCard`: clone/sliding-track подход не е желан; целта е опростен, по-лек rendering path

Причина:

- detail page има реално UX основание за по-богат carousel
- listing page умножава overhead-а по всички карти

---

## Предложение

Работата се разделя на 4 ясни фази.

### Фаза 1 - Hero image optimization

#### 1.1 Home hero да мине към responsive `<picture>` в future-carousel-ready shell

Вместо CSS `background-image`, home hero секцията трябва да рендерира responsive media в markup-а.

Препоръчван подход:

- вътре в hero секцията рендерираме `<picture>`
- за mobile използваме `homepage_background_mobile.webp`
- за laptop/desktop използваме `homepage_background_laptop.webp`
- текстовото съдържание остава отделен overlay слой
- media слоят се структурира така, че по-късно да може да приеме масив от hero slides, а не само един asset

За този конкретен случай `<picture>` е по-добрият избор от `next/image`, защото:

- това е hero/layout media, не типичен content image
- получаваме ясен breakpoint-based asset selection чрез `<source media="...">`
- можем да ползваме `fetchpriority="high"` за above-the-fold изображението
- запазваме лесно визуално поведение тип `cover`
- не усложняваме ненужно future hero carousel adaptation

Важно:

- в този scope **не** имплементираме hero carousel
- имплементираме single-slide shell, готов за бъдещо разширяване

Какво означава "future-carousel-ready shell" на практика:

- `heroSection` остава root контейнерът
- вътре има отделен `heroMedia` слой
- вътре в `heroMedia` за момента има единствен `<picture>`
- `heroContent` остава отделен overlay/content слой

Примерна целева структура:

```jsx
<section className={styles.heroSection}>
  <div className={styles.heroMedia}>
    <picture>
      <source media="(max-width: 768px)" srcSet="/homepage_background_mobile.webp" />
      <source media="(min-width: 769px)" srcSet="/homepage_background_laptop.webp" />
      <img src="/homepage_background_laptop.webp" alt="" fetchPriority="high" />
    </picture>
  </div>

  <div className={styles.heroContent}>
    ...
  </div>
</section>
```

Това е достатъчната "готовност" за бъдещ carousel. Когато carousel-ът дойде, `heroMedia` просто ще приеме множество slides вместо един.

Какво изрично НЕ правим сега:

- не вкарваме carousel state/hooks в home hero
- не създаваме slide wrapper компоненти "за всеки случай"
- не добавяме transition CSS, което сега не се ползва
- не въвеждаме допълнителна abstraction layer без текуща нужда

#### 1.2 About hero да мине към статичен responsive `<picture>` pattern

Същата логика прилагаме и за about page:

- mobile: `aboutUs_Hero_banner_mobile.webp`
- laptop/desktop: `aboutUs_Hero_banner_laptop.webp`

Разлика спрямо home:

- `about` hero не се future-proof-ва за carousel на този етап
- тук правим директен статичен responsive hero

#### 1.3 Performance guard

И за двата hero случая:

- само above-the-fold изображението на текущата страница получава high-priority поведение
- не preload-ваме едновременно mobile и laptop assets
- не въвеждаме втори декоративен image layer

---

### Фаза 2 - Header/mobile polish

Тази фаза вече не се разглежда като major performance phase. Това е secondary polish phase.

#### 2.1 Auth loading guard

Записваме като guard:

- основната навигация винаги трябва да се вижда веднага
- auth-specific елементи могат да се появят след това

Забележка:

- това вече е до голяма степен подобрено
- не го третираме като голям нов performance win

#### 2.2 Logo sizing polish

Не е нужен нов asset, ако текущото лого е SVG и изглежда добре.

Тук оптимизацията е по-скоро:

- по-малък реален размер на mobile
- да не караме layout-а да резервира повече място от необходимо

Препоръчителни render размери:

- mobile: около `120-140px` ширина
- desktop: около `180-220px` ширина

Изрично НЕ включваме като задължителна performance задача:

- submenu conditional rendering

Причина:

- очакваният measurable performance ефект е минимален
- не искаме да вкарваме излишна условна логика без ясен practical win

---

### Фаза 3 - Product carousel performance refinement

Тази фаза не измисля carousel-а отново. Тя стъпва на вече работещия `useImageSlideshow`, но официално разделя detail и listing поведението.

#### 3.1 Официализираме правилото за посоките

Hook-ът и компонентите трябва да спазват следната логика:

- autoplay dispatch-ва само `next`
- manual interactions на `ProductDetails` могат да dispatch-ват и `prev`, и `next`

#### 3.2 ProductDetails остава по-богатият carousel

`ProductDetails` трябва да поддържа:

- swipe left -> next
- swipe right -> prev
- mouse drag left/right със същото mapping
- prev/next бутони

Autoplay не трябва да "обръща" посоката, когато минава от последния към първия кадър.

Допустим и препоръчван подход тук:

- визуално непрекъснат loop с clone/sliding-track стратегия
- autoplay винаги върви към следващия logical кадър
- при стигане до clone edge track-ът snap-ва незабележимо обратно към canonical позиция след `transitionend`

Причина да приемем този подход тук:

- има реално UX основание
- `ProductDetails` е единична инстанция на страница
- overhead-ът е приемлив спрямо UX печалбата

#### 3.3 ProductCard се опростява обратно

За listing view:

- autoplay остава
- pause on hover може да остане за desktop
- viewport-aware start/stop остава задължителен
- drag/swipe не добавяме
- clone/sliding-track не използваме
- рендерираме единствен image елемент и сменяме текущия URL

Това е важно performance решение. Не трябва да пренасяме цялата сложност на `ProductDetails` върху listing карти.

Изрична корекция спрямо текущата имплементация:

- ако `ProductCard` в момента ползва clone/track вариант, в тази фаза той трябва да се опрости обратно

#### 3.4 Mobile-specific guard за ProductDetails

На мобилни устройства carousel-ът е по-чувствителен към натоварване. Затова държим следното:

- не preload-ваме всички кадри eagerly
- не вкарваме излишни layered visual effects
- gesture handling остава само на detail page
- animation timing остава умерено

Препоръка:

- `ProductCard` autoplay interval: `4000ms`
- `ProductDetails` autoplay interval: `5000ms`

---

### Фаза 4 - Broader mobile rendering cleanup

Това е последна, минимална фаза.

#### 4.1 Да намалим CSS background dependence за large visual surfaces

Където имаме големи hero площи, предпочитаме реални изображения в markup, вместо CSS backgrounds, когато изображението е above-the-fold и content-critical.

Не го разширяваме към цялото приложение. Само:

- home hero
- about hero

#### 4.2 Да държим mobile-first spacing по-консервативен

При mobile layout:

- по-малки image containers
- по-малко вертикално раздуване
- без излишни overlay ефекти

Това не е отделен redesign, а performance-friendly polishing.

---

## Имплементационен план

### Файлове за промяна

#### Фаза 1

- `happy-colors-nextjs-project/src/app/page.js`
- `happy-colors-nextjs-project/src/app/page.module.css`
- `happy-colors-nextjs-project/src/app/aboutus/page.js`
- `happy-colors-nextjs-project/src/app/aboutus/about.module.css`

#### Фаза 2

- `happy-colors-nextjs-project/src/components/header/header.js`
- `happy-colors-nextjs-project/src/components/header/header.module.css`

#### Фаза 3

- `happy-colors-nextjs-project/src/hooks/useImageSlideshow.js`
- `happy-colors-nextjs-project/src/app/products/ProductCard.jsx`
- `happy-colors-nextjs-project/src/app/products/[productId]/ProductDetails.jsx`
- `happy-colors-nextjs-project/src/app/products/shop.module.css`
- `happy-colors-nextjs-project/src/app/products/[productId]/details.module.css`

### Последователност

1. Hero assets migration
2. Header/mobile polish
3. Carousel behavior split and mobile performance guard review
4. Regression pass on mobile layouts

Това е най-безопасният ред, защото:

- първо прибираме най-големия performance win от hero assets
- после правим само минимален header polish
- накрая валидираме carousel split-а спрямо вече работещия hook

---

## Какво НЕ правим в този scope

- не правим нова media библиотека
- не правим backend refactor
- не местим categories data flow към server architecture в тази фаза
- не правим нов carousel framework
- не пипаме `ProductCard` с drag/swipe
- не махаме autoplay
- не имплементираме home hero carousel в този scope

---

## Рискове и mitigation

### Риск 1 - Hero migration да счупи съществуващия layout

Mitigation:

- пазим същата визуална композиция
- сменяме само начина, по който фонът се рендерира
- за `home` подготвяме shell, който по-късно може да приеме carousel без ново structural разместване

### Риск 2 - Header polish да промени UX неочаквано

Mitigation:

- не променяме информационната архитектура
- променяме само дребни presentation/detail аспекти

### Риск 3 - Carousel loop логиката да стане крехка

Mitigation:

- стъпваме на текущия hook, а не пишем нов carousel engine
- описваме ясно separation:
  - autoplay = only next
  - `ProductDetails` manual = next or prev
  - `ProductCard` = simpler autoplay-only rendering path

### Риск 4 - Излишен mobile decode/load pressure от carousel images

Mitigation:

- `ProductCard` остава лек
- viewport guarding остава
- gesture logic остава само на `ProductDetails`

---

## Acceptance criteria

- Home page използва отделни mobile/laptop WebP hero assets
- About page използва отделни mobile/laptop WebP hero assets
- Home hero markup е подготвен за бъдещ carousel, без самият carousel да е имплементиран сега
- Mobile first paint е видимо по-бърз на home и about
- Header polish не въвежда regressions и не претендира за голям performance win
- Product carousel autoplay върви само напред
- `ProductDetails` позволява manual swipe/drag в двете посоки
- `ProductCard` не добавя drag/swipe complexity и не ползва clone/track overhead
- Няма regression в desktop behavior-а

---

## Моето мнение

Това е добър, реалистичен scope.

Най-голямата реална полза ще дойде от:

1. смяната на hero assets към отделни mobile/laptop файлове
2. дисциплина в carousel поведението, без да правим по-тежка listing страницата
3. минимален header polish, без да го надценяваме като performance lever

Ако трябва да приоритизираме строго по ефект/риск:

1. Hero assets
2. Carousel refinement review
3. Header mobile polish

---

## Prompt for Claude Review

Ако искаме външно мнение от Claude, това е готовият prompt:

```md
Review this design document for a Next.js ecommerce/catalog project.

Goals:
- improve mobile performance without broad refactor
- use separate mobile/laptop hero assets already prepared as WebP files
- make the home hero future-carousel-ready, but do not implement the hero carousel in this phase
- keep autoplay in product carousels
- autoplay must always move forward
- manual drag/swipe on product details must work in both directions
- product listing cards should stay lighter than product details

Please review for:
1. architectural consistency
2. hidden performance risks on mobile
3. unnecessary complexity
4. any unclear implementation details
5. whether the proposed scope is appropriately minimal

Important constraints:
- no backend refactor in this phase
- no broad cleanup
- no phase-2 architecture change
- keep separation of responsibilities
- avoid duplicating logic

Document:

[PASTE DESIGN-DOC-MOBILE-OPTIMIZATION.md HERE]
```
