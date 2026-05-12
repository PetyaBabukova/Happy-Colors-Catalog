# Happy Colors - Homepage Banners Implementation Plan

**Дата:** 2026-05-11
**Статус:** Ready for execution
**Свързан дизайн документ:** `docs/DESIGN-DOC-HOMEPAGE-BANNERS.md`
**Цел:** Да преведем одобрения homepage banner design в малки, проверими фази с ясен тестов пакет за новата homepage страница, banner CRUD flow-а и GCS cleanup поведението.

---

## Изпълнителен принцип

Работим на фази, които могат да се review-нат и тестват независимо:

1. Backend model/API/storage safety.
2. Frontend data managers/revalidation/admin form.
3. Homepage carousel и public layout.
4. Automated tests за backend, frontend components, API и e2e.
5. Manual QA и final review.

Не започваме с визуалния carousel преди backend contracts и cleanup правилата да са ясни. Това пази feature-а от orphaned images и stale homepage state.

---

## Фиксирани решения от дизайн документа

- Банерите са отделна Mongo колекция `HomeBanner`.
- `GET /home-banners` е публичен и връща active banners.
- `GET /home-banners/:bannerId`, `POST`, `PUT`, `DELETE` са authenticated-only.
- Всички authenticated users се третират като trusted site operators за V1.
- `owner` остава audit поле, но не е permission gate.
- Ако публична регистрация бъде включена, banner mutations трябва да минат към admin role check.
- Banner image edit е replacement flow, не product-like merge flow.
- Banner image upload използва signed/proxy upload с `objectName` и `deleteToken`.
- При create failure frontend чисти uploaded image чрез `deleteSignedUploadedFile`.
- При edit/delete backend чисти GCS image само ако URL-ът не се използва от друг banner/product/poster.
- Banner mutations invalidират `home-banners` cache tag и `revalidatePath('/')`.
- Homepage favorite products V1 показва до 8 available продукта чрез съществуващия `ProductCard`.
- `/faq` засега е минимална страница с heading.

---

## Решени design decisions

- `owner` остава audit-only поле във V1. Всички authenticated users са trusted site operators за banner CRUD.
- "Най-любимите ви продукти" остава V1 fallback от първите до 8 available продукта. Не добавяме `isFeatured` в тази имплементация.
- Delete confirmation използва `window.confirm` във V1.
- Cross-reference проверките включват image URLs, product video posters и product video URLs.
- Revalidation route-ът следва product revalidation pattern-а и е authenticated-only.
- Планът може да се изпълни като един feature PR или като фазови PR-и. Ако се работи с фазови PR-и, всяка фаза трябва да минава собствените си tests преди merge.

---

## Phase 0 - Baseline и предпазни проверки

### Цел

Да потвърдим началното състояние и да не смесим unrelated промени с feature implementation.

### Задачи

- Проверка на `git status`.
- Потвърждение, че `docs/DESIGN-DOC-HOMEPAGE-BANNERS.md` е наличен и одобрен.
- Преглед на текущите upload, auth, product card и revalidation patterns.
- Преглед на текущите test commands и съществуващите test suites.

### Команди

```powershell
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" status --short
Get-Content docs\DESIGN-DOC-HOMEPAGE-BANNERS.md -Raw
Get-Content happy-colors-nextjs-project\src\managers\uploadManager.js -Raw
Get-Content happy-colors-nextjs-project\src\app\api\revalidate\products\route.js -Raw
Get-Content happy-colors-nextjs-project\src\app\products\ProductCard.jsx -Raw
Get-Content happy-colors-nextjs-project\src\context\AuthContext.jsx -Raw
```

### Acceptance

- Известни са всички dirty/untracked файлове.
- Няма unrelated промени, които да се редактират.
- Feature scope-ът е потвърден спрямо design doc-а.

---

## Phase 1 - Backend HomeBanner model, service и API

### Цел

Да създадем server-side contract за homepage banners, включително validation, auth, rate limiting и storage cleanup safety.

### Файлове

Нови:

```txt
server/models/HomeBanner.js
server/services/homeBannersService.js
server/controllers/homeBannersController.js
```

Променени:

```txt
server/routes.js
```

Тестове:

```txt
server/__tests__/unit/services/homeBannersService.test.js
server/__tests__/integration/homeBanners.test.js
```

### Задачи

- Добавяне на `HomeBanner` schema:
  - `title`
  - `description`
  - `ctaLabel`
  - `ctaHref`
  - `imageUrl`
  - `sortOrder`
  - `isActive`
  - `owner`
  - timestamps
- Service whitelist за позволените fields.
- Internal path validation за `ctaHref`.
- Storage URL validation за `imageUrl`.
- Public `getActiveHomeBanners()` със sort `{ sortOrder: 1, createdAt: 1 }`.
- Authenticated `getHomeBannerById()`.
- Authenticated `createHomeBanner(data, userId)`.
- Authenticated `editHomeBanner(bannerId, data, userId)`.
- Authenticated `deleteHomeBanner(bannerId, userId)`.
- Audit-only запис на `owner`.
- Cross-reference check преди GCS delete:
  - other `HomeBanner.imageUrl`;
  - `Product.imageUrl`;
  - `Product.imageUrls`;
  - `Product.videos.posterUrl`;
  - `Product.videos.url`.
- Update на product delete cleanup, така че product asset да не се трие от GCS, ако същият URL все още се използва от `HomeBanner.imageUrl`.
- GCS cleanup след успешен DB save/delete.
- Controller routes:
  - `GET /home-banners`
  - `GET /home-banners/:bannerId`
  - `POST /home-banners`
  - `PUT /home-banners/:bannerId`
  - `DELETE /home-banners/:bannerId`
- `requireAuth` за single-get и mutation routes.
- Rate limiter за banner mutation routes.
- Mount в `server/routes.js`.

### Backend unit tests

`server/__tests__/unit/services/homeBannersService.test.js`

Покритие:

- `createHomeBanner` записва само allowed fields.
- `createHomeBanner` игнорира `owner` от request body и използва `userId`.
- `createHomeBanner` reject-ва липсващ `title`.
- `createHomeBanner` reject-ва липсващ `ctaLabel`.
- `createHomeBanner` reject-ва липсващ `ctaHref`.
- `createHomeBanner` reject-ва липсващ `imageUrl`.
- `createHomeBanner` reject-ва unsafe CTA:
  - `https://example.com`;
  - `//example.com`;
  - `javascript:alert(1)`;
  - `data:text/html,...`.
- `createHomeBanner` приема `/search?q=животинки`.
- `createHomeBanner` reject-ва `imageUrl` от wrong GCS bucket.
- `createHomeBanner` reject-ва `javascript:`, `data:` и `file:` imageUrl schemes, включително когато `GCS_BUCKET_NAME` липсва.
- `editHomeBanner` reject-ва `imageUrl` от wrong GCS bucket.
- `editHomeBanner` reject-ва unsafe imageUrl schemes.
- `getActiveHomeBanners` връща само `isActive: true`.
- `getActiveHomeBanners` сортира по `sortOrder`, после `createdAt`.
- `editHomeBanner` update-ва title/CTA/sort/isActive.
- `editHomeBanner` не прави GCS delete, ако imageUrl не е сменен.
- `editHomeBanner` прави GCS delete за стар imageUrl, ако URL-ът не се използва другаде.
- `editHomeBanner` пропуска GCS delete, ако старият imageUrl се използва от друг banner.
- `editHomeBanner` пропуска GCS delete, ако старият imageUrl се използва от product image.
- `editHomeBanner` пропуска GCS delete, ако старият imageUrl се използва от product video poster.
- `editHomeBanner` пропуска GCS delete, ако старият imageUrl се използва от product video URL.
- `deleteHomeBanner` трие документа.
- `deleteHomeBanner` чисти GCS image, ако URL-ът не се използва другаде.
- `deleteHomeBanner` пропуска GCS delete, ако URL-ът се използва другаде.
- `deleteProduct` не трие product asset от GCS, ако URL-ът се използва от `HomeBanner.imageUrl`.
- not found cases връщат 404-style error.

### Backend integration tests

`server/__tests__/integration/homeBanners.test.js`

Покритие:

- Public `GET /home-banners` връща active banners.
- Public `GET /home-banners/:id` връща 401.
- Unauthenticated `POST /home-banners` връща 401.
- Authenticated `POST /home-banners` създава banner.
- Authenticated `PUT /home-banners/:id` редактира banner.
- Authenticated `DELETE /home-banners/:id` трие banner.
- Unsafe CTA request връща 400.
- Rate limiter е конфигуриран за mutation routes, ако test infra позволява стабилна проверка.

### Acceptance

- Backend routes работят през съществуващия root router.
- Public homepage може да чете active banners.
- Не може да се създава/редактира/трие без auth.
- Storage cleanup не трие shared assets.
- Product delete не чупи banner image, ако по погрешка е използван shared URL.
- Backend tests за phase-а минават.

---

## Phase 2 - Frontend managers, revalidation и admin form

### Цел

Да добавим frontend admin workflow за създаване и редактиране на banner-и, без още да сменяме homepage hero layout-а.

### Файлове

Нови:

```txt
happy-colors-nextjs-project/src/managers/homeBannersManager.js
happy-colors-nextjs-project/src/components/home-banners/HomeBannerForm.jsx
happy-colors-nextjs-project/src/components/home-banners/HomeBannerForm.module.css
happy-colors-nextjs-project/src/app/home-banners/create/page.js
happy-colors-nextjs-project/src/app/home-banners/[bannerId]/edit/page.js
happy-colors-nextjs-project/src/app/api/revalidate/home-banners/route.js
```

Променени:

```txt
happy-colors-nextjs-project/src/components/header/header.jsx
```

Тестове:

```txt
happy-colors-nextjs-project/__tests__/unit-jsdom/managers/homeBannersManager.test.js
happy-colors-nextjs-project/__tests__/components/home-banners/HomeBannerForm.test.jsx
happy-colors-nextjs-project/__tests__/unit/app/revalidateHomeBanners.test.js
happy-colors-nextjs-project/__tests__/components/layout/Header.test.jsx
```

### Задачи

- Добавяне на `getHomeBanners()`.
- Добавяне на `getHomeBannerById(bannerId)`.
- Добавяне на `createHomeBanner(values)`.
- Добавяне на `editHomeBanner(bannerId, values)`.
- Добавяне на `deleteHomeBanner(bannerId)`.
- След successful create/edit/delete:
  - call към `/api/revalidate/home-banners`;
  - redirect/refresh според flow-а.
- Revalidation route:
  - използва `requireApiAuth(request)`;
  - връща 401 за unauthenticated request;
  - `revalidateTag('home-banners')`;
  - `revalidatePath('/')`;
  - връща JSON success.
- `HomeBannerForm`:
  - полета за title, description, ctaLabel, ctaHref, image, sortOrder, isActive;
  - използва `uploadSignedFile({ kind: 'image', file })`;
  - пази `objectName` и `deleteToken` за rollback;
  - при failed create чисти upload-а чрез `deleteSignedUploadedFile`;
  - при edit с ново изображение изпраща новия `imageUrl`, backend чисти стария;
  - показва preview на текущото/новото изображение;
  - показва validation/upload/submit errors.
- Create page:
  - render-ва form;
  - при success redirect към `/`.
- Edit page:
  - fetch-ва banner по id;
  - render-ва form с initial values;
  - при success redirect към `/`.
- Header authenticated nav:
  - добавя "Създай хоум банер" към user nav.

### Frontend manager tests

Покритие:

- `getHomeBanners` fetch-ва правилния endpoint с cache tag options, ако е server-side manager.
- `createHomeBanner` изпраща `POST /home-banners` с credentials.
- `editHomeBanner` изпраща `PUT /home-banners/:id`.
- `deleteHomeBanner` изпраща `DELETE /home-banners/:id`.
- mutation success trigger-ва revalidation call.
- non-ok response хвърля смислена грешка.

### Revalidation route tests

Покритие:

- unauthenticated request връща 401.
- route извиква `revalidateTag('home-banners')`.
- route извиква `revalidatePath('/')`.
- route връща success response.

### HomeBannerForm component tests

Покритие:

- render-ва празна create form.
- render-ва initial values в edit mode.
- submit без required fields показва error или маркира invalid fields.
- image upload използва `uploadSignedFile({ kind: 'image', file })`.
- successful create submit извиква `onSubmit` с `imageUrl`.
- failed create след successful upload извиква `deleteSignedUploadedFile`.
- edit без нов image запазва текущия `imageUrl`.
- edit с нов image изпраща новия `imageUrl`.
- isActive checkbox/toggle променя стойността.
- sortOrder input изпраща number.

### Header tests

Покритие:

- authenticated user вижда "Създай хоум банер".
- unauthenticated user не вижда authenticated nav.
- link-ът води към `/home-banners/create`.

### Acceptance

- Логнат user може да отвори create/edit pages.
- Формата качва banner image през signed/proxy upload.
- Failed create не оставя known uploaded image без cleanup.
- Header navigation има новата позиция.
- Revalidation route е наличен и покрит с test.
- Revalidation route не позволява unauthenticated cache busting.
- `HomeBannerForm.module.css` е създаден преди component tests и form styles render-ват без missing CSS module error.

---

## Phase 3 - Homepage carousel и public page layout

### Цел

Да заменим текущия голям static hero image с compact banner carousel и да добавим intro, favorite products и FAQ секциите.

### Файлове

Нови:

```txt
happy-colors-nextjs-project/src/app/HomeHeroCarousel.jsx
happy-colors-nextjs-project/src/app/HomeHeroCarousel.module.css
happy-colors-nextjs-project/src/app/faq/page.js
```

Променени:

```txt
happy-colors-nextjs-project/src/app/page.js
happy-colors-nextjs-project/src/app/page.module.css
```

Тестове:

```txt
happy-colors-nextjs-project/__tests__/components/home/HomeHeroCarousel.test.jsx
happy-colors-nextjs-project/__tests__/components/home/HomePage.test.jsx
happy-colors-nextjs-project/__tests__/components/home/FaqPage.test.jsx
```

### Задачи

- `page.js` става server component, който fetch-ва:
  - active banners;
  - products.
- Добавяне на homepage metadata.
- Премахване на текущия `85vh` hero image.
- Добавяне на `HomeHeroCarousel`.
- Fallback banner при empty/error banners.
- Intro text секция под carousel-а със сегашния текст.
- Favorite products section:
  - H2 "Най-любимите ви продукти";
  - до 8 available products;
  - използва съществуващия `ProductCard`;
  - без duplicating card markup.
- FAQ section:
  - H2 link "Често задавани въпроси";
  - href `/faq`.
- Minimal `/faq/page.js`.
- Carousel behavior:
  - supports 1, 2, 10 banners;
  - prev/next controls;
  - dots;
  - optional auto-rotate;
  - pause on hover/focus;
  - reduced motion disables auto-rotate;
  - CTA link uses `banner.ctaHref`;
  - admin edit/delete icons only when `loading === false` and `user` exists;
  - delete uses `window.confirm`;
  - cancelled delete does not call API;
  - successful delete refreshes/removes banner state.

### Homepage component tests

`HomeHeroCarousel.test.jsx`

Покритие:

- renders fallback when banners array is empty.
- renders first banner title, description and CTA.
- CTA points to `/search?q=животинки`.
- supports single banner without broken prev/next behavior.
- next button moves to next banner.
- prev button moves to previous banner.
- dots select expected banner.
- public user does not see edit/delete controls.
- auth loading state does not show admin controls.
- authenticated user sees edit/delete controls.
- edit icon href is `/home-banners/:id/edit`.
- delete asks for confirmation.
- cancelled delete does not call `deleteHomeBanner`.
- confirmed delete calls `deleteHomeBanner`.
- reduced motion prevents auto-rotation if timer behavior is testable.

`HomePage.test.jsx`

Покритие:

- homepage exports metadata с title, description и canonical `/`.
- homepage renders carousel.
- homepage renders intro text below carousel.
- homepage renders H2 "Най-любимите ви продукти".
- homepage renders ProductCard links to `/products/:id`.
- homepage limits favorite products to 8 available products.
- homepage does not render unavailable products in favorite section.
- homepage renders FAQ H2 link to `/faq`.

`FaqPage.test.jsx`

Покритие:

- `/faq` page renders heading "Често задавани въпроси".

### CSS/layout checks

- Hero height е compact:
  - desktop около 360-460px;
  - mobile около 320px.
- Text не overflow-ва при дълги Bulgarian titles.
- CTA остава видим на mobile.
- Admin icons не покриват CTA.
- Product cards използват същите card styles като `/products`.

### Acceptance

- Homepage визуално отговаря на новата структура.
- Няма huge hero image.
- Carousel работи с variable banner count.
- Public/admin behavior е коректно.
- Favorite products и FAQ секциите са налични.
- Component tests за homepage минават.

---

## Phase 4 - End-to-end tests за новата homepage

### Цел

Да покрием реалните user flows през browser: public homepage, authenticated banner management, edit/delete controls и FAQ link.

### Файлове

Нови или променени:

```txt
e2e/tests/homepage.spec.js
e2e/tests/helpers/shop.js
```

При нужда:

```txt
e2e/global-setup.js
server/__tests__/integration/factories.js
```

### E2E scenarios

#### Public homepage

- Отваря `/`.
- Вижда compact carousel.
- Вижда CTA на активния banner.
- CTA към `/search?q=животинки` отваря search page с резултати или поне правилния URL.
- Вижда intro секцията под carousel-а.
- Вижда "Най-любимите ви продукти".
- Product card click води към `/products/:id`.
- Вижда FAQ link.
- FAQ link води към `/faq`.
- `/faq` показва heading.

#### Responsive homepage

- Desktop viewport:
  - carousel не е full viewport height;
  - favorite products са в grid/flex layout;
  - controls не overlap-ват CTA.
- Mobile viewport:
  - carousel остава usable;
  - text не излиза извън container;
  - CTA е достъпен;
  - product cards са stacked/usable.

#### Authenticated homepage controls

- Login като trusted operator.
- Отваря `/`.
- Вижда edit/delete icons върху banner.
- Edit icon води към `/home-banners/:id/edit`.
- Cancelled delete не премахва banner.
- Confirmed delete премахва banner от homepage след refresh/revalidation.

#### Create banner flow

- Login.
- Отваря authenticated nav.
- Клик "Създай хоум банер".
- Попълва title, description, ctaLabel, ctaHref.
- Качва test image.
- Submit.
- Redirect към `/`.
- Новият banner се вижда в carousel.

#### Edit banner flow

- Login.
- Отваря edit page от homepage icon.
- Променя title/CTA.
- По възможност сменя image с test image.
- Submit.
- Redirect към `/`.
- Новите данни се виждат.

#### Delete banner flow

- Login.
- Създава или използва test banner.
- Клик delete.
- Confirm.
- Banner вече не се вижда в carousel.

### E2E data strategy

Предпочитано:

- Използване на test database fixtures.
- Seed на поне:
  - 2 active home banners;
  - 1 inactive banner;
  - 9 products, от които поне 1 unavailable;
  - trusted operator user.

За upload tests:

- Използване на малък локален fixture image.
- Ако GCS не е наличен в e2e среда, mock/stub на upload route или маркиране на upload e2e като manual-only.

### Acceptance

- Public homepage e2e минава.
- Authenticated controls e2e минава, ако test auth flow е стабилен.
- Upload-dependent e2e е automated само ако test storage средата е контролируема.
- Ако storage не може да се автоматизира надеждно, има manual QA checklist за create/edit image replacement/delete cleanup.

---

## Phase 5 - Storage cleanup verification

### Цел

Да докажем, че banner images не пълнят bucket-а при edit/delete и че shared assets не се трият погрешно.

### Automated tests

Backend service tests трябва да mock-нат `deleteImageFromGCS`.

Покритие:

- edit image A -> image B:
  - DB пази image B;
  - `deleteImageFromGCS(image A)` е извикан.
- edit image A -> image B, но image A се използва от друг banner:
  - DB пази image B;
  - `deleteImageFromGCS` не е извикан.
- delete banner с image A:
  - DB документът е изтрит;
  - `deleteImageFromGCS(image A)` е извикан.
- delete banner с shared image A:
  - DB документът е изтрит;
  - `deleteImageFromGCS` не е извикан.
- failed create след signed upload:
  - frontend извиква `deleteSignedUploadedFile(objectName, deleteToken)`.
- product delete с asset, използван от `HomeBanner.imageUrl`:
  - product document се трие;
  - shared GCS asset не се трие;
  - test-ът документира защита срещу product/banner shared URL асиметрия.

### Manual QA

Ако има staging bucket:

1. Създай banner с image A.
2. Потвърди, че image A е в bucket-а.
3. Edit banner и качи image B.
4. Потвърди, че image B е в bucket-а.
5. Потвърди, че image A е изтрита.
6. Delete banner.
7. Потвърди, че image B е изтрита.
8. Повтори с два banner-а, които сочат към един и същ image URL, и потвърди, че shared image не се трие при delete на единия.
9. Ако има test product, който сочи към същия image URL като banner, изтрий product-а и потвърди, че banner image остава наличен.

### Acceptance

- Cleanup логиката е автоматично покрита.
- Manual QA има ясни стъпки за реален bucket.
- Product-delete асиметрията е затворена или поне защитена с test, който предотвратява счупване на banner image при shared URL.

---

## Phase 6 - Final verification и review

### Цел

Да затворим feature-а с local verification, diff review и ясен release readiness checklist.

### Команди

Root/backend/frontend tests според обхвата на направените промени:

```powershell
npm test
npm run build
npm run test:coverage
```

Ако се работи само във frontend subproject:

```powershell
Set-Location happy-colors-nextjs-project
npm run test:components
npm run test:unit
npm run build
```

Ако се работи само в server:

```powershell
Set-Location server
npm test
```

E2E:

```powershell
npx playwright test e2e/tests/homepage.spec.js
```

### External review

След implementation diff:

```powershell
git diff | claude -p "Review this git diff for bugs, regressions, security issues, and missing tests. Give concise, actionable findings with file paths and line references where possible."
```

При нужда втори pass:

```powershell
codex exec --full-auto -m gpt-5.4 "Review the current implementation for bugs, regressions, security issues, and missing tests. Give concise, actionable findings with file paths and line references where possible."
```

### Final acceptance checklist

- Public homepage не показва admin controls.
- Authenticated homepage показва edit/delete controls след auth loading.
- Create banner работи.
- Edit banner работи.
- Delete banner има confirmation.
- Delete cancellation не прави API call.
- Banner CTA links работят, включително Cyrillic query `/search?q=животинки`.
- Intro text е под carousel-а.
- Favorite products секцията показва до 8 available ProductCard карти.
- Product cards водят към product detail pages.
- FAQ link води към `/faq`.
- `/faq` не връща 404.
- GCS cleanup tests минават.
- Revalidation след mutations работи.
- Build минава.
- Relevant unit/component/integration/e2e tests минават или има ясно документирана причина за skipped storage-dependent tests.

---

## Test Suite Summary

### Backend unit

```txt
server/__tests__/unit/services/homeBannersService.test.js
```

Фокус:

- validation;
- whitelist;
- CTA safety;
- active/sort behavior;
- image replacement cleanup;
- delete cleanup;
- shared asset protection.

### Backend integration

```txt
server/__tests__/integration/homeBanners.test.js
```

Фокус:

- route auth;
- public list;
- authenticated CRUD;
- unsafe input rejection.

### Frontend unit/jsdom

```txt
happy-colors-nextjs-project/__tests__/unit-jsdom/managers/homeBannersManager.test.js
happy-colors-nextjs-project/__tests__/unit/app/revalidateHomeBanners.test.js
```

Фокус:

- manager request shape;
- error handling;
- revalidation tag/path.

### Frontend components

```txt
happy-colors-nextjs-project/__tests__/components/home-banners/HomeBannerForm.test.jsx
happy-colors-nextjs-project/__tests__/components/home/HomeHeroCarousel.test.jsx
happy-colors-nextjs-project/__tests__/components/home/HomePage.test.jsx
happy-colors-nextjs-project/__tests__/components/home/FaqPage.test.jsx
happy-colors-nextjs-project/__tests__/components/layout/Header.test.jsx
```

Фокус:

- form behavior;
- upload rollback;
- carousel behavior;
- public vs authenticated controls;
- homepage sections;
- FAQ route;
- authenticated nav item.

### E2E

```txt
e2e/tests/homepage.spec.js
```

Фокус:

- public homepage journey;
- responsive layout;
- authenticated create/edit/delete journey;
- FAQ navigation;
- product card navigation.

---

## Rollout Strategy

Този feature може да се изпълни като един feature PR или като отделни фазови PR-и.

Препоръка:

1. Ако backend и frontend се разработват от един човек в един branch, дръж всичко в един feature PR, но прави локални checkpoints след всяка фаза.
2. Ако ще има review след всяка голяма стъпка, раздели на фазови PR-и:
   - PR 1: backend model/API/storage safety;
   - PR 2: frontend admin form/revalidation;
   - PR 3: homepage layout/carousel/FAQ;
   - PR 4: e2e and cleanup verification.

Фазов merge ред:

1. Merge Phase 1 backend after tests.
2. Merge Phase 2 admin form after component/manager tests.
3. Merge Phase 3 homepage layout after component tests and local visual check.
4. Add/merge Phase 4 e2e coverage.
5. Run Phase 5 storage cleanup verification.
6. Run final build/test/review.

Ако feature-ът трябва да бъде скрит временно, може да се добави прост fallback: ако няма active banners, homepage показва fallback static banner към `/products`. Това позволява backend/admin да се deploy-нат преди реалното съдържание да е въведено.
