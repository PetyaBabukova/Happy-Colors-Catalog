# Happy Colors - Product Videos Implementation Plan

**Дата:** 2026-04-18
**Статус:** Ready for execution
**Свързан документ:** `docs/DESIGN-DOC-PRODUCT-VIDEOS.md`
**Цел:** Да преведем одобрения дизайн в изпълним план по PR фази, файлове и зависимости

---

## Общо решение

Имплементацията следва тези фиксирани решения:
- продуктовите видеа са кратки `.mp4` файлове
- видеото е част от същата media box зона като снимките
- ако има видео, то е първият media slide
- видеото тръгва с `muted autoplay playsInline`
- при `ended` се преминава към image slideshow
- images остават на съществуващия image flow
- videos и poster images използват signed direct upload към GCS
- backend моделът за видео е `videos[]` с metadata, а не `videoUrls[]`

---

## PR Фази

## PR 0: Security Hardening and Upload Foundation

**Цел:** Да затворим pre-existing security рисковете и да подготвим upload основата, преди да започнем feature кода.

**Merge правило:** Този PR трябва да влезе в `main` преди всички останали.

### Файлове
- `happy-colors-nextjs-project/src/app/api/upload-image/route.js`
- `server/services/productsServices.js`
- `server/controllers/productsController.js`
- нов `server/config/productLimits.js`
- нов `happy-colors-nextjs-project/src/config/productLimits.js`
- при нужда нов signed upload route в `happy-colors-nextjs-project/src/app/api/...`
- при нужда нов helper за signed URL generation в Next app layer

### Промени
- harden на `/api/upload-image` със server-side MIME allowlist за images
- harden на `/api/upload-image` със server-side size limit за images
- auth check за image upload route-а
- magic-byte validation за image uploads
- whitelist на позволените полета при create/edit product service-ите
- премахване на mass assignment поведението в `createProduct` и `editProduct`
- добавяне на signed upload signing endpoint за videos и poster images
- фиксиране на response shape за signed upload flow
- създаване на shared limits config за:
  - `MAX_VIDEOS_PER_PRODUCT`
  - `MAX_VIDEO_UPLOAD_SIZE`
  - `MAX_VIDEO_DURATION_SECONDS`
- explicit infra задача: конфигуриране на GCS lifecycle rule за abandoned uploads преди merge на PR 2

### Изход от PR-а
- image upload route е сигурен
- create/edit backend не приема произволни полета
- има основа за direct upload на videos/posters
- lifecycle cleanup за abandoned uploads е покрит operationally

---

## PR 1: Product Video Backend Model and CRUD

**Цел:** Да добавим video data model и сървърна CRUD поддръжка без да нарушим image compatibility.

### Файлове
- `server/models/Product.js`
- `server/services/productsServices.js`
- `server/services/productImagesService.js`
- нов `server/services/productVideosService.js`
- `server/controllers/productsController.js`
- `server/helpers/gcsImageHelper.js`
- `server/config/productLimits.js`

### Промени
- добавяне на `videos` schema поле:
  - `url`
  - `posterUrl`
  - `mimeType`
  - `durationSeconds`
  - `uploadDate`
- server-side validation за:
  - максимум 3 видеа
  - `video/mp4` only
  - poster required
  - max duration 30 секунди
- update на `createProduct` да записва `videos`
- update на `editProduct` да update-ва `videos`
- отделен `deleteProductVideo` service
- `DELETE /products/:productId/video` route
- ownership validation, че video URL принадлежи на текущия продукт
- update на `deleteProduct`, така че да чисти и video assets от storage
- image flow остава backward compatible
- migration safety check за стари документи без `videos` поле
- verify, че legacy продукти се четат и сериализират коректно без `videos`

### Изход от PR-а
- продуктът вече поддържа `videos[]`
- backend CRUD покрива create/edit/delete requirements
- product delete не оставя orphaned video files

---

## PR 2: Owner Create/Edit/Delete Workflow

**Цел:** Да дадем на owner/admin пълен UI flow за качване и управление на видеа.

### Файлове
- `happy-colors-nextjs-project/src/components/products/ProductForm.jsx`
- `happy-colors-nextjs-project/src/components/products/create.module.css`
- `happy-colors-nextjs-project/src/managers/productsManager.js`
- `happy-colors-nextjs-project/src/managers/uploadManager.js`
- `happy-colors-nextjs-project/src/app/products/create/CreateProductClient.jsx`
- `happy-colors-nextjs-project/src/app/products/[productId]/edit/EditProductClient.jsx`
- `happy-colors-nextjs-project/src/utils/formValidations.js`
- `happy-colors-nextjs-project/src/config/productLimits.js`
- при нужда нов helper за video duration probing в `src/utils/` или `src/managers/`
- при нужда нов helper за signed upload orchestration в `src/managers/`

### Промени
- добавяне на video uploader в `ProductForm`
- добавяне на poster uploader за всяко видео
- client-side validation за:
  - `.mp4`
  - max 25 MB
  - max 30 секунди
  - max 3 видеа
  - poster required
- helper за video duration probing чрез временен `<video>` element и `loadedmetadata`
- direct upload orchestration за:
  - video file
  - poster image
- preview list за videos + posters
- delete action за отделно видео
- update на create submit payload да изпраща `videos`
- update на edit submit payload да изпраща `videos`
- инициализация на form state с `videos: []`
- create/edit/delete product flow-овете се разширяват според новото изискване

### Изход от PR-а
- owner може да качва видео и poster
- owner може да edit-ва и трие видеа
- create/edit forms работят с новия video model

---

## PR 3: Product Detail Media Box and Playback UX

**Цел:** Да реализираме новия media viewer UX в продуктовата страница.

### Файлове
- `happy-colors-nextjs-project/src/app/products/[productId]/ProductDetails.jsx`
- `happy-colors-nextjs-project/src/app/products/[productId]/details.module.css`
- при нужда нов helper hook в `happy-colors-nextjs-project/src/hooks/`
- при нужда нов helper в `happy-colors-nextjs-project/src/utils/`
- при нужда нов component в `happy-colors-nextjs-project/src/app/products/[productId]/`

### Промени
- изграждане на общ media slides масив от:
  - `imageUrls`
  - `videos`
- video slide като първи slide, ако има видео
- video element с:
  - `muted`
  - `autoplay`
  - `playsInline`
  - `preload="metadata"`
  - `poster`
- autoplay best-effort behavior
- fallback към poster + play при блокиран autoplay
- `prefers-reduced-motion` изключва autoplay
- pause на image slideshow, докато video slide е активен
- при `ended` преминаване към slideshow на изображенията
- pause/reset при излизане от video slide
- начално JSON-LD scaffold в PDP render layer, за да не се разделя video data flow между PR 3 и PR 4
- mobile optimization:
  - само активният video slide се mount-ва eagerly
  - останалите video slides се mount-ват lazy
  - при нужда отделен hook, например `useVideoSlideMount`

### Изход от PR-а
- една обща media box зона
- autoplay intro video UX
- плавен преход към image slideshow

---

## PR 4: SEO Integration

**Цел:** Да направим видеото видимо и полезно и за SEO/social layers, не само за UX.

### Файлове
- `happy-colors-nextjs-project/src/app/products/[productId]/page.js`
- `happy-colors-nextjs-project/src/app/products/[productId]/ProductDetails.jsx`
- `happy-colors-nextjs-project/src/lib/getProduct.js`
- при нужда `happy-colors-nextjs-project/src/config/siteSeo.js`

### Промени
- update на `generateMetadata` за Open Graph video metadata
- използване на `posterUrl` като video/social preview
- доизграждане на JSON-LD слоя върху scaffold-а от PR 3
- metadata да използва:
  - `name`
  - `description`
  - `thumbnailUrl`
  - `uploadDate`
  - `contentUrl`
- canonical product image остава основна image preview за останалите повърхности

### Изход от PR-а
- PDP има video-aware SEO
- social shares не разчитат на black frame

---

## PR 5: QA, Manual Verification, and Release Readiness

**Цел:** Да затворим regression риска и да подготвим feature-а за release.

### Файлове
- ако няма test framework: нов `docs/QA-CHECKLIST-PRODUCT-VIDEOS.md`
- при наличие на test framework: минимум backend regression тест и SEO render тест
- при нужда `docs/DESIGN-DOC-PRODUCT-VIDEOS.md` за финален status update

### Проверки
- create product само със снимки
- create product със снимки + видео + poster
- edit product с добавяне на видео
- edit product с update на poster
- edit product с премахване на всички видеа -> `videos: []`
- delete single video
- delete product с images + videos -> storage cleanup
- upload reject за:
  - invalid MIME
  - spoofed content
  - oversized file
  - duration over limit
  - unauthenticated upload
- PDP autoplay flow:
  - video autoplay muted
  - `ended` -> image slideshow
  - fallback при blocked autoplay
  - `prefers-reduced-motion`
- listing/cart:
  - няма video thumbnail leakage
- SEO:
  - JSON-LD наличен
  - OG video metadata наличен

### Minimum automation, ако има test framework
- mass-assignment regression test
- SEO render test за JSON-LD / metadata
- поне един backend validation test за video limits

### Изход от PR-а
- финален QA пакет
- готовност за release

---

## Файлов Мапинг По Отговорност

## Backend Core
- `server/models/Product.js`: schema за `videos[]`
- `server/services/productsServices.js`: whitelist, create/edit/delete integration
- `server/services/productVideosService.js`: delete single video logic
- `server/controllers/productsController.js`: route wiring
- `server/helpers/gcsImageHelper.js`: cleanup reuse

## Frontend Owner Flow
- `src/components/products/ProductForm.jsx`: UI, validation, preview, delete
- `src/managers/uploadManager.js`: signed upload orchestration
- `src/managers/productsManager.js`: payload shaping и delete calls
- `src/app/products/create/CreateProductClient.jsx`: initialValues
- `src/app/products/[productId]/edit/EditProductClient.jsx`: initialValues/edit flow

## Frontend PDP and SEO
- `src/app/products/[productId]/ProductDetails.jsx`: common media box, autoplay behavior
- `src/app/products/[productId]/details.module.css`: visual layer
- `src/app/products/[productId]/page.js`: metadata + OG
- `src/lib/getProduct.js`: product payload availability

---

## Зависимости Между PR-ите

1. `PR 0` е задължителен преди всички останали.
2. `PR 1` трябва да влезе преди `PR 2` и `PR 3`.
3. `PR 2` и `PR 3` не зависят пряко едно от друго и могат да се изпълняват паралелно след `PR 1`.
4. `PR 4` зависи от `PR 1` и `PR 3`, защото използва video metadata и PDP rendering.
5. `PR 5` е финален hardening pass след merge-ready implementation.

---

## Изрично Извън Scope За Първата Имплементация

- video thumbnails в listing cards
- captions като fully implemented feature
- transcoding pipeline
- automatic poster extraction от video frame
- analytics за video engagement

---

## Препоръчителен Ред За Реална Работа

1. `PR 0`
2. `PR 1`
3. `PR 2`
4. `PR 3`
5. `PR 4`
6. `PR 5`

Това е най-нискорисковият ред, защото security, schema и CRUD идват преди UI polish и SEO интеграцията.
