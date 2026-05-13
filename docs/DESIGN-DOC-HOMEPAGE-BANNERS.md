# Happy Colors - Homepage Banners Design Document

**Дата:** 2026-05-11
**Статус:** Approved by Opus review; risk notes addressed
**Обхват:** Нова homepage структура с управляем hero carousel, кратка текстова секция, любими продукти, FAQ линк и CRUD flow за homepage банери

---

## Цел

Да заменим текущия голям homepage hero image с по-компактен carousel от управляеми банери. Банерите трябва да могат да се създават, редактират и трият от логнат потребител, а изображенията им да се почистват от GCS bucket-а при замяна или изтриване.

Новата homepage подредба трябва да бъде:

1. Hero carousel с различни category банери и CTA към каталога или search страницата.
2. Кратка текстова секция със сегашния homepage intro текст.
3. Секция с карти "Най-любимите ви продукти", използваща същите ProductCard карти като `/products`.
4. H2 линк "Често задавани въпроси", който води към `/faq`.

---

## Потребителски изисквания

### Homepage layout

- Да се премахне текущият огромен hero image.
- Да се добави carousel с нормална височина, в който се въртят различни hero банери.
- Банерите да са за различни категории или теми.
- Всеки банер да има CTA, който води до съответната категория или търсене в каталога.
- Пример: банер "Животинки" води към `/search?q=животинки`.
- Броят банери не е постоянен: може да са 2, може да са 10.
- Под carousel-а да остане кратката текстова информация; текущият текст засега е правилният.
- Под текстовата секция да има секция с карти, озаглавена "Най-любимите ви продукти".
- Картите да изглеждат като картите в `/products`.
- Всяка продуктова карта да води към продуктовата страница.
- Да има H2 заглавие/линк "Често задавани въпроси", което води към `/faq`.
- `/faq` засега може да съдържа само heading, за да няма 404.

### Banner management

- Да има форма за създаване и редактиране на homepage банери.
- Формата да е достъпна само за логнат потребител.
- В authenticated users navigation да има позиция "Създай хоум банер".
- За логнат потребител върху банерите да има edit икона, например молив.
- Edit иконата да води към формата за редактиране на съответния банер.
- За логнат потребител до edit иконата да има delete икона.
- При delete да има потвърждение, че потребителят наистина иска да изтрие банера.
- Да се създаде нова database колекция за банерите.
- При edit със сменено изображение старото изображение да се изтрива от bucket-а.
- При delete на банер изображението да се изтрива от bucket-а.
- Целта е bucket-ът да не се препълва с orphaned изображения.

---

## Текущ контекст

### Frontend

- Homepage е в `happy-colors-nextjs-project/src/app/page.js`.
- Текущият hero използва `homepage_background_mobile.webp` и `homepage_background_laptop.webp`.
- Product listing картите са в `src/app/products/ProductCard.jsx` и стиловете им са в `src/app/products/shop.module.css`.
- `ProductCard` вече е clickable `Link` към `/products/${product._id}`.
- Authenticated navigation е в `src/components/header/header.jsx`.
- Upload helper-и има в `src/managers/uploadManager.js`.

### Backend

- Product CRUD pattern-ът вече е установен чрез:
  - `server/models/Product.js`
  - `server/services/productsServices.js`
  - `server/controllers/productsController.js`
  - `server/routes.js`
- Auth guard-ът е `requireAuth` от `server/middlewares/auth.js`.
- GCS delete helper-ът е `deleteImageFromGCS` в `server/helpers/gcsImageHelper.js`.
- Product delete вече чисти product image/video assets от storage.

---

## Предложено решение

Добавяме отделен "homepage banners" модул, вместо да hardcode-ваме банерите в `page.js`.

Модулът включва:

- нов Mongo модел `HomeBanner`;
- нов backend service;
- нов backend controller;
- нов route mount в `server/routes.js`;
- cache revalidation route за homepage banners;
- frontend manager за CRUD заявки;
- reusable `HomeBannerForm`;
- create/edit страници;
- `HomeHeroCarousel` client компонент;
- минимална `/faq` страница.

---

## Data Model

Нов файл:

```txt
server/models/HomeBanner.js
```

Предложена schema:

```js
const homeBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 240,
    },
    ctaLabel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    ctaHref: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);
```

### Field rules

- `title`, `ctaLabel`, `ctaHref`, `imageUrl` са задължителни.
- `description` е optional.
- `sortOrder` определя реда в carousel-а.
- `isActive=false` позволява скриване без изтриване.
- `owner` пази кой е създал банера като audit информация.

### Permission model

За V1 всички authenticated users се третират като site admins за homepage banner CRUD.

Причина:

- изискването е controls/forms да са достъпни за логнат потребител;
- сайтът изглежда като single-owner/admin workflow;
- ако правим per-banner ownership, логнат потребител би виждал edit/delete икони, но може да получи 403 при клик върху чужд banner;
- `owner` остава полезно audit поле, но не блокира edit/delete.

Ако по-късно се добавят реални роли, banner service-ът трябва да премине от "any authenticated user" към `admin`/`owner` role check.

V1 приема, че регистрацията и достъпът до authenticated user account-и са ограничени до trusted operators. Ако публична регистрация някога бъде включена, banner mutation routes трябва да добавят admin role check преди release.

### CTA href validation

`ctaHref` трябва да допуска само internal paths:

- трябва да започва с `/`;
- не трябва да започва с `//`;
- не трябва да съдържа protocol като `https://`, `javascript:`, `data:`;
- примерни валидни стойности:
  - `/products`
  - `/products?category=Животинки`
  - `/search?q=животинки`

Това предотвратява open redirect и опасни URL схеми.

---

## Backend API

Нов controller:

```txt
server/controllers/homeBannersController.js
```

Нов service:

```txt
server/services/homeBannersService.js
```

Route mount:

```js
router.use('/home-banners', homeBannersController);
```

### Routes

```txt
GET    /home-banners
GET    /home-banners/:bannerId
POST   /home-banners
PUT    /home-banners/:bannerId
DELETE /home-banners/:bannerId
```

### Access

- `GET /home-banners` е публичен и връща само active банери по default.
- `GET /home-banners/:bannerId` използва `requireAuth`, защото V1 consumer-ът е edit page.
- `POST`, `PUT`, `DELETE` използват `requireAuth`.
- Banner mutation routes трябва да имат rate limiter, подобен на съществуващия pattern в `server/routes.js`, за да не може компрометиран authenticated session да spam-ва database/storage.

### Sorting

`GET /home-banners` връща банерите сортирани по:

```js
{ sortOrder: 1, createdAt: 1 }
```

Така броят банери остава произволен и carousel-ът няма нужда от специална логика.

### Cache revalidation

Homepage banner fetch-ът трябва да използва Next cache tag, например:

```js
next: {
  revalidate: 60,
  tags: ['home-banners'],
}
```

След успешен create/edit/delete frontend manager-ът трябва да invalidира този cache чрез нов route:

```txt
happy-colors-nextjs-project/src/app/api/revalidate/home-banners/route.js
```

Route-ът използва:

```js
revalidateTag('home-banners');
revalidatePath('/');
```

Причина:

- homepage е server-rendered и може да сервира stale carousel data;
- admin flow трябва да показва промените веднага след redirect към `/`;
- това следва вече използвания product revalidation pattern.
- `revalidatePath('/')` покрива route cache edge cases и следва belt-and-suspenders pattern-а от product revalidation.

---

## Backend Service Rules

### Create

- Whitelist на позволените полета.
- Validate required fields.
- Validate `ctaHref` като internal path.
- Validate `imageUrl` като GCS URL от текущия bucket, ако `GCS_BUCKET_NAME` е конфигуриран.
- Записва `owner` от `req.user._id`.

### Edit

- Намира банера по id.
- Проверява, че request-ът е authenticated.
- Не проверява per-banner ownership във V1; всички authenticated users са site admins за този модул.
- Whitelist на позволените полета.
- Validate `ctaHref`, ако се подава.
- Ако `imageUrl` се сменя:
  - запомня стария URL;
  - записва новия URL;
  - след успешен `save()` проверява дали старият image URL не се използва от друг banner или product;
  - ако не се използва другаде, изтрива старото изображение от GCS чрез `deleteImageFromGCS(oldImageUrl)`.
- Ако `imageUrl` не се сменя, storage не се пипа.

### Delete

- Намира банера по id.
- Проверява, че request-ът е authenticated.
- Не проверява per-banner ownership във V1; всички authenticated users са site admins за този модул.
- Запомня `imageUrl`.
- Трие Mongo документа.
- След успешното триене на документа проверява дали image URL не се използва от друг banner или product.
- Ако URL-ът не се използва другаде, изтрива изображението от GCS.
- GCS delete използва `ignoreNotFound` behavior през съществуващия helper, така че липсващ файл да не чупи flow-а.

### Cleanup ordering

При edit/delete първо се променя database state, после се чисти storage.

Причина:

- ако storage delete мине първи, а database save/delete се провали, ще остане банер със счупено изображение;
- ако database операцията мине, а storage cleanup fail-не, потребителското поведение остава вярно, а storage leak може да се логне и поправи.

### Difference from product image edit

Въпреки че owner requirement-ът казва "като продуктите", banner image edit трябва нарочно да се различава от текущия product edit flow.

Текущият product edit flow merge-ва image arrays и е additive. Homepage banner има точно едно основно изображение, затова edit със сменено изображение е replacement flow:

- новото изображение заменя старото;
- старото се чисти от storage след успешен save;
- не копираме product image merge логиката.

---

## Frontend Architecture

### Homepage page

`src/app/page.js` става server component, който зарежда:

- active home banners чрез `getHomeBanners()`;
- products чрез съществуващия `getProducts()`.

След това подава:

```jsx
<HomeHeroCarousel banners={banners} />
<HomepageIntro />
<FavoriteProducts products={favoriteProducts} />
<FaqHomeLink />
```

Тези supporting секции могат да бъдат inline helper компоненти в `page.js` във V1, за да не се раздува файловата структура. Ако станат по-сложни, се изнасят в `src/components/home/`.

Homepage трябва да добави и `metadata` export:

```js
export const metadata = {
  title: 'Плетени играчки, аксесоари и декорация за дома',
  description: 'Ръчно изработени плетени изделия от Happy Colors.',
  alternates: {
    canonical: '/',
  },
};
```

### HomeHeroCarousel

Нов client компонент:

```txt
src/app/HomeHeroCarousel.jsx
src/app/HomeHeroCarousel.module.css
```

Отговорности:

- показва произволен брой банери;
- prev/next navigation;
- dots;
- optional auto-rotate;
- pause при hover/focus;
- `prefers-reduced-motion` изключва auto-rotate;
- CTA link към `banner.ctaHref`;
- admin actions при логнат user:
  - edit link;
- delete button с confirm.

Компонентът може да използва съществуващия `useImageSlideshow` hook само ако следва неговия track-based модел (`trackIndex`, cloned first/last slide, `handleTrackTransitionEnd`). Ако homepage carousel-ът не използва този модел, да се направи малък local hook само за banner index, auto-rotate, pause/resume и reduced-motion.

Решение за V1: използваме отделен lightweight carousel state в `HomeHeroCarousel`, за да не coupling-ваме homepage hero към product media slideshow internals.

### Auth visibility

За admin иконите carousel-ът използва:

```js
const { user, loading } = useAuth();
```

Ако `loading === false` и `user?.username` или `user?._id` е наличен:

- показва edit и delete controls;
- иначе показва само публичния banner UI.

Така няма hydration/loading flash на admin controls.

### Delete confirmation

V1 може да използва:

```js
window.confirm('Сигурни ли сте, че искате да изтриете този хоум банер?')
```

По-късно може да се замени с custom modal, но confirm е достатъчен за първата версия.

### Banner form

Нов компонент:

```txt
src/components/home-banners/HomeBannerForm.jsx
```

Полета:

- `title`
- `description`
- `ctaLabel`
- `ctaHref`
- `image`
- `sortOrder`
- `isActive`

В create mode:

- потребителят избира image file;
- frontend качва файла чрез upload manager;
- submit изпраща `imageUrl` към backend.

В edit mode:

- формата показва текущото изображение;
- ако се избере нов файл, качва новото изображение;
- submit изпраща новия `imageUrl`;
- backend чисти стария `imageUrl` след успешен save.

### Routes

Нови frontend страници:

```txt
src/app/home-banners/create/page.js
src/app/home-banners/[bannerId]/edit/page.js
```

Create page:

- render-ва `HomeBannerForm`;
- при успешен submit redirect към `/`.

Edit page:

- fetch-ва банера по id;
- render-ва `HomeBannerForm initialValues={banner}`;
- при успешен submit redirect към `/`.

### Navigation

В `src/components/header/header.jsx` authenticated nav получава:

```jsx
<li><Link href="/home-banners/create">Създай хоум банер</Link></li>
```

---

## Favorite Products Section

Заглавие:

```txt
Най-любимите ви продукти
```

V1 източник:

- взимаме продуктите от `getProducts()`;
- филтрираме unavailable продуктите;
- показваме фиксиран максимум от 8 продукта.

Препоръка за V1:

```js
const FAVORITE_PRODUCTS_LIMIT = 8;

const favoriteProducts = allProducts
  .filter((product) => product.availability !== 'unavailable')
  .slice(0, FAVORITE_PRODUCTS_LIMIT);
```

Known gap:

- Няма реален "favorite" флаг или analytics.
- Текущият Product model няма `createdAt` timestamp, затова V1 не може надеждно да сортира по newest-first без schema промяна.
- Selection order следва текущия backend product order.
- Ако бизнесът иска ръчно избрани любими продукти, следваща стъпка е `isFeatured` или `homepageRank` поле в Product schema.

Reasoning:

- Това пази V1 scoped.
- Не променя product model.
- Позволява да пуснем layout-а и banner CMS-а без втори admin flow за featured продукти.

### Favorite products layout

Секцията използва същия визуален card design като `/products`, но може да има homepage wrapper:

- max-width container като останалото съдържание;
- responsive grid/flex, който показва до 4 карти на desktop и 1 карта на mobile;
- без nested cards;
- използва `ProductCard`, без fork на card markup-а.

---

## FAQ Page

Нов файл:

```txt
src/app/faq/page.js
```

Минимално съдържание:

```jsx
export const metadata = {
  title: 'Често задавани въпроси',
};

export default function FaqPage() {
  return <h1>Често задавани въпроси</h1>;
}
```

Homepage link:

```jsx
<Link href="/faq">
  <h2>Често задавани въпроси</h2>
</Link>
```

Препоръчана позиция:

- след "Най-любимите ви продукти";
- така FAQ стои като логична следваща помощна секция, без да прекъсва основния purchase discovery flow.

---

## Styling and UX

### Hero carousel size

Предложени размери:

```css
.heroCarousel {
  min-height: 360px;
  max-height: 460px;
}

@media (max-width: 768px) {
  .heroCarousel {
    min-height: 320px;
  }
}
```

Това заменя текущото `min-height: 85vh`.

### Banner composition

- Пълноширок банер, не card вътре в card.
- Изображението е реалният visual background.
- Текстът и CTA стоят върху банера с overlay за четимост.
- CTA е видим и keyboard-focusable.
- Admin иконите са малки, горе вдясно, извън основния CTA.

### Accessibility

- Prev/next buttons имат `aria-label`.
- Dots имат `aria-label` и `aria-current`.
- Auto-rotate спира при hover/focus.
- `prefers-reduced-motion` спира автоматичното въртене.
- Delete confirm не се trigger-ва от CTA click.
- Admin controls не пречат на публичния banner link/CTA.

---

## Upload Strategy

### Preferred V1

За banner изображенията V1 трябва да използва signed/proxy upload flow:

```js
uploadSignedFile({ kind: 'image', file })
```

Причина:

- response-ът връща `publicUrl`, `objectName` и `deleteToken`;
- при failed create frontend може да изчисти новокачения файл;
- това избягва orphaned images при upload success + API failure;
- старият `uploadImageToBucket(file)` връща само `imageUrl` и не е достатъчен за rollback.

### Create failure cleanup

Ако frontend качи изображение, но `POST /home-banners` fail-не:

- frontend чисти чрез `deleteSignedUploadedFile(objectName, deleteToken)`;
- ако cleanup fail-не, показва error/log, но не блокира потребителя;
- не използваме стария `uploadImageToBucket` за banner create/edit.

---

## Security Considerations

### Auth

- Create/edit/delete pages не трябва да разчитат само на UI скриване.
- Backend routes `POST`, `PUT`, `DELETE` задължително минават през `requireAuth`.
- Service layer проверява authenticated user context преди edit/delete.
- Per-banner ownership не се enforce-ва във V1; всички authenticated users са site admins за този модул.

### Mass assignment

Home banner service-ът трябва да whitelist-ва полетата:

```js
title
description
ctaLabel
ctaHref
imageUrl
sortOrder
isActive
```

Не се приема `owner` от request body.

### CTA safety

`ctaHref` трябва да е internal path, за да няма:

- open redirect;
- `javascript:` links;
- външни phishing destinations от admin mistake.

### Storage URL ownership

При create/edit трябва да валидираме, че `imageUrl` е от разрешения GCS bucket.

Ако `GCS_BUCKET_NAME` липсва в dev/test:

- backend пак трябва да reject-ва unsafe schemes като `javascript:`, `data:`, `file:`;
- frontend rendering трябва да приема само `https://storage.googleapis.com/...` или known local placeholder assets;
- не трябва да render-ваме произволен external image URL от database.

Това не е перфектна ownership гаранция, но намалява риска някой да attach-не произволен external или unsafe URL.

### Cross-reference before storage delete

Преди `deleteImageFromGCS(imageUrl)` при banner edit/delete service-ът трябва да провери дали image URL-ът не се използва още от:

- друг `HomeBanner`;
- `Product.imageUrl`;
- `Product.imageUrls`;
- product video posters.

Ако URL-ът се използва другаде, database операцията остава успешна, но storage delete се пропуска.

Known asymmetry:

- Banner edit/delete ще пази product assets чрез cross-reference check.
- Текущият product delete flow не знае за `HomeBanner` и би изтрил shared product image, ако същият URL е използван и от banner.
- На практика banner изображенията трябва да се качват отделно, но ако implementer-и искат пълна защита, follow-up е product storage cleanup да проверява и `HomeBanner.imageUrl` преди GCS delete.

---

## Error Handling

### Public homepage

- Ако `GET /home-banners` fail-не, homepage не трябва да пада.
- Показва fallback static banner към `/products`.

### Empty banners

Ако няма active банери:

- показва се fallback banner със site-level съобщение и CTA към `/products`.

### Delete

При успешен delete:

- carousel state се reset-ва към валиден индекс;
- страницата се refresh-ва или локалният списък се обновява.

При неуспешен delete:

- показва се кратка error message;
- банерът остава видим.

---

## Affected Files

### Backend new files

```txt
server/models/HomeBanner.js
server/services/homeBannersService.js
server/controllers/homeBannersController.js
```

### Backend changed files

```txt
server/routes.js
```

### Frontend new files

```txt
happy-colors-nextjs-project/src/app/HomeHeroCarousel.jsx
happy-colors-nextjs-project/src/app/HomeHeroCarousel.module.css
happy-colors-nextjs-project/src/components/home-banners/HomeBannerForm.jsx
happy-colors-nextjs-project/src/managers/homeBannersManager.js
happy-colors-nextjs-project/src/app/home-banners/create/page.js
happy-colors-nextjs-project/src/app/home-banners/[bannerId]/edit/page.js
happy-colors-nextjs-project/src/app/faq/page.js
happy-colors-nextjs-project/src/app/api/revalidate/home-banners/route.js
```

### Frontend changed files

```txt
happy-colors-nextjs-project/src/app/page.js
happy-colors-nextjs-project/src/app/page.module.css
happy-colors-nextjs-project/src/components/header/header.jsx
```

### Optional test files

```txt
server/__tests__/unit/services/homeBannersService.test.js
server/__tests__/integration/homeBanners.test.js
happy-colors-nextjs-project/__tests__/components/home-banners/HomeBannerForm.test.jsx
happy-colors-nextjs-project/__tests__/components/home/HomeHeroCarousel.test.jsx
```

---

## Implementation Phases

### Phase 1: Backend banner model and API

- Add `HomeBanner` model.
- Add service with create/edit/delete/list/get.
- Add controller routes.
- Mount `/home-banners`.
- Add mutation rate limiter.
- Add validation for required fields and safe internal `ctaHref`.
- Make `GET /home-banners/:bannerId` authenticated.
- Add GCS cleanup on edit/delete.
- Add cross-reference check before GCS delete.
- Add unit/integration tests for CRUD and cleanup behavior.

### Phase 2: Frontend managers and admin form

- Add `homeBannersManager.js`.
- Add `/api/revalidate/home-banners` route.
- Invalidate `home-banners` cache after create/edit/delete.
- Add `HomeBannerForm`.
- Add create page.
- Add edit page.
- Add "Създай хоум банер" to authenticated navigation.
- Use signed/proxy image upload with delete metadata.
- Handle upload success/failure cleanup with `deleteSignedUploadedFile`.

### Phase 3: Homepage carousel

- Replace large hero image with `HomeHeroCarousel`.
- Load active banners from backend.
- Add fallback banner.
- Show edit/delete icons only for authenticated users.
- Add delete confirmation and refresh behavior.

### Phase 4: Homepage supporting sections

- Move current intro text under carousel.
- Add "Най-любимите ви продукти" using existing `ProductCard`.
- Add FAQ H2 link.
- Add minimal `/faq` page.

### Phase 5: Verification

- Run relevant frontend and backend tests.
- Run build.
- Do a browser smoke test:
  - public homepage;
  - authenticated homepage with edit/delete icons;
  - create banner;
  - edit banner with image replacement;
  - delete banner and verify image cleanup behavior;
  - `/faq` link.

---

## Test Plan

### Backend

- `GET /home-banners` returns active banners sorted by `sortOrder`.
- `GET /home-banners/:bannerId` rejects unauthenticated requests.
- `POST /home-banners` rejects unauthenticated requests.
- `POST /home-banners` rejects missing title/cta/image.
- `POST /home-banners` rejects unsafe `ctaHref`.
- `POST /home-banners` uses rate limiting.
- `PUT /home-banners/:id` deletes old image when imageUrl changes.
- `PUT /home-banners/:id` does not delete storage when imageUrl is unchanged.
- `PUT /home-banners/:id` skips GCS delete if old imageUrl is still referenced.
- `DELETE /home-banners/:id` rejects unauthenticated requests.
- `DELETE /home-banners/:id` deletes the banner document and calls GCS cleanup.
- `DELETE /home-banners/:id` skips GCS delete if imageUrl is still referenced.
- `/api/revalidate/home-banners` invalidates `home-banners` cache tag and `revalidatePath('/')`.

### Frontend

- Public users see carousel without admin icons.
- Logged-in users see edit/delete icons only after auth loading is complete.
- Edit icon links to `/home-banners/[bannerId]/edit`.
- Delete asks for confirmation before request.
- Cancelled delete does not call the API.
- `HomeBannerForm` uploads an image and submits expected payload.
- `HomeBannerForm` uses signed/proxy upload and cleans up uploaded image when create fails.
- Banner mutations trigger homepage banner cache revalidation.
- Homepage renders ProductCard links in "Най-любимите ви продукти".
- FAQ link points to `/faq`.

### Manual QA

- Check desktop and mobile hero height.
- Check carousel with 1, 2, and 10 banners.
- Check long Bulgarian titles do not overflow.
- Check CTA links with Cyrillic query params, especially `/search?q=животинки`.
- Store CTA hrefs as readable decoded internal paths; Next `Link` handles Cyrillic query params when rendering/navigating.
- Check keyboard tab order through carousel controls and CTA.

---

## Risks and Mitigations

### Risk: Orphaned banner images

Mitigation:

- backend cleanup on edit/delete;
- frontend cleanup for failed create when signed upload returns delete metadata;
- logging for failed GCS delete.

### Risk: Broken homepage if API fails

Mitigation:

- `getHomeBanners()` catches errors and returns `[]`;
- carousel renders fallback banner.

### Risk: Admin icons interfering with CTA

Mitigation:

- separate positioned action buttons;
- `event.stopPropagation()` for delete;
- edit is separate link with clear accessible label.

### Risk: unsafe CTA links

Mitigation:

- server-side internal-path validation.

### Risk: Favorite products are not truly "favorite"

Mitigation:

- V1 documents this as curated fallback;
- future product `isFeatured` field can replace the selection logic.

---

## Acceptance Criteria

- Homepage no longer uses the huge `85vh` static hero image.
- Homepage renders a compact carousel from active `HomeBanner` records.
- Carousel supports variable banner count without code changes.
- Every banner has CTA to its configured internal path.
- Current intro text appears below the carousel.
- "Най-любимите ви продукти" appears below intro text and uses existing `ProductCard` design.
- Product cards link to product detail pages.
- "Често задавани въпроси" is an H2 link to `/faq`.
- `/faq` exists and renders a heading.
- Logged-in user can access "Създай хоум банер" from authenticated navigation.
- Logged-in user can create and edit homepage banners.
- Logged-in user sees edit/delete icons on homepage banners.
- Delete requires confirmation.
- Replacing a banner image deletes the old image from GCS after successful save.
- Deleting a banner deletes its image from GCS after successful database delete.
- Banner image cleanup skips deletion when the same image URL is still referenced by another banner or product.
- Public users cannot create, edit, or delete banners through the API.
- Homepage banner changes are visible after mutation redirect because `home-banners` cache is revalidated.
- Relevant tests/build pass before release.

---

## Open Questions for Opus Review

1. Should `owner` stay as audit-only in V1, or should we remove it until real roles exist?
2. Should "Най-любимите ви продукти" remain V1 fallback from first available products, or should we add a product `isFeatured` field in a later phase?
3. Is `window.confirm` acceptable for V1 delete confirmation, or should the first implementation include a custom modal?
4. Should image cross-reference checks include product video posters, or only banner/product image fields?
