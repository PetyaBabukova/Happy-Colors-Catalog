# Happy Colors - Product Videos Design Document

**Дата:** 2026-04-18
**Статус:** Finalized after Claude review
**Обхват:** Добавяне на кратки autoplay продуктови видеа в същата media box зона на продуктовата страница, без да се нарушават съществуващите image flow-ове
**Решение:** Additive video model с отделен `videos` масив, direct upload за video assets и общ media viewer в ProductDetails

---

## Цел

Да позволим в продуктовите страници, освен изображения, да се качват и показват кратки видеа.

Решението трябва да:
- запази backward compatibility със съществуващите `imageUrl` и `imageUrls`
- не чупи текущата image slideshow логика
- не допуска видеа да се третират като изображения в cart, listing и detail flows
- затвори рисковете, които Claude маркира около upload security, cleanup и липса на тестове

---

## Контекст

В момента продуктите са изградени около image-only модел:
- `Product` schema пази `imageUrl` и `imageUrls`
- create/edit/delete flow работят само със снимки
- Next upload endpoint и upload manager са именувани и използвани като image-only
- продуктовата страница рендерира slideshow само с `next/image`
- delete flow има правило продуктът винаги да запазва поне едно изображение

Това прави добавянето на смесена media галерия твърде рисково на този етап. Затова избираме additive подход: видеата се добавят отделно от изображенията.

---

## Решение

Добавяме ново поле:

```js
videos: [
  {
    url: String,
    posterUrl: String,
    mimeType: String,
    durationSeconds: Number,
  }
]
```

Ключови правила:
- `imageUrl` и `imageUrls` остават image-only
- `videos` е отделен video-only масив с metadata за playback и SEO
- detail страницата използва една обща media box зона, в която images и videos се виждат като последователни media slides
- ако има видео, то е първият media slide и се държи като кратко intro към продукта
- upload, delete и validation за видео минават по отделен flow
- cart, product card и всички image utilities продължават да работят само със снимки

Това е най-добрият баланс между безопасност, effort и бъдеща разширяемост.

---

## Извън обхват

Следните неща не влизат в тази имплементация:
- drag-and-drop reordering между images и videos
- video thumbnails в product listing
- автоматично transcoding или compression pipeline
- автоматично caption generation
- сложен video analytics слой

Ако по-късно потрябва истинска unified media галерия, ще трябва отделен дизайн документ и миграционен план.

---

## Архитектурни принципи

1. Additive промяна вместо голям refactor
2. Image flows не се променят семантично
3. Upload сигурността се вдига преди да се отвори video upload
4. Cleanup на файлове в storage се третира като задължителна част от feature-а
5. Video rendering не се вкарва насила в `next/image` и image slideshow логиката
6. Payload-ите към backend се whitelist-ват, а не се записват чрез масово assign-ване
7. Feature-ът има server-side лимити за размер и брой видеа

---

## Засегнати зони

### Backend
- `server/models/Product.js`
- `server/services/productsServices.js`
- `server/services/productImagesService.js`
- нов `server/services/productVideosService.js`
- `server/controllers/productsController.js`
- `server/helpers/gcsImageHelper.js`

### Frontend
- `happy-colors-nextjs-project/src/components/products/ProductForm.jsx`
- `happy-colors-nextjs-project/src/managers/productsManager.js`
- `happy-colors-nextjs-project/src/managers/uploadManager.js`
- `happy-colors-nextjs-project/src/app/api/upload-image/route.js`
- нов signed upload route за video assets
- `happy-colors-nextjs-project/src/app/products/[productId]/ProductDetails.jsx`
- `happy-colors-nextjs-project/src/app/products/[productId]/details.module.css`

---

## Фази на имплементация

## Фаза 0: Security gate и техническа подготовка

Тази фаза е blocker за feature development. Не започваме качване на видеа, преди да я затворим.
Фаза 0 се изпълнява като отделен PR и трябва да бъде merged в `main` преди Phase 1+.

### Цели
- да премахнем риска upload endpoint-ът да работи като generic file host
- да изчистим naming-а, за да не въвежда грешки при video support
- да подготвим ясни validation правила

### Задачи
- добавяне на server-side MIME allowlist
- добавяне на server-side file size limit
- разделяне на допустимите image и video MIME типове
- добавяне на auth проверка за upload route-а, така че само логнат owner/admin да може да качва
- server-side magic-byte sniffing на файла, а не доверяване само на `file.name` и `file.type`
- добавяне на signed upload flow за video files и posters
- запазване на текущия `/api/upload-image` flow за снимки; video upload не replace-ва image upload endpoint-а
- mass assignment fix в create/edit service-ите чрез whitelist на позволените полета

### Решение
- за images: оставяме текущия `/api/upload-image` endpoint и го harden-ваме със server-side validation
- за videos и poster images: използваме direct upload към GCS чрез signed URLs, а не proxy през Next.js route
- поддържан video format за V1: `video/mp4` only
- video uploads за V1: максимум 25 MB
- video duration за V1: препоръчително до 15 секунди, hard limit 30 секунди
- poster image е required за всяко видео
- autoplay UX изисква видеата да бъдат кратки; ако в бъдеще се позволят по-дълги видеа, autoplay policy трябва да се преразгледа

### V1 concurrency limitations
- Rollback delete vs attach race: възможно е в много тесен прозорец един tab да провери, че upload-ът още не е attach-нат, а друг tab да запази продукта точно преди GCS delete. За V1 приемаме риска като нисковероятен; mitigation остава GCS lifecycle rule и manual recovery при broken asset.
- Parallel reuse race: два едновременни submit-а с един и същ video/poster URL могат теоретично да минат проверката преди някой от тях да save-не. Истинско затваряне изисква distributed lock или Mongo unique/index стратегия върху media asset URL-ите, което е извън V1 scope.
- `/api/uploads/delete` използва short-lived delete token и attached-asset guard, но не е transactional lock около Mongo + GCS. Attached product delete остава през server-side product/video delete flow.

### Deliverable
- сигурен upload flow, който приема само позволени image/video файлове
- direct upload решение за видео, съвместимо с hosting ограниченията
- отделен security PR, merged преди да започне video feature branch integration
- create/edit endpoints, които вече не разчитат на mass assignment

---

## Фаза 1: Data model и storage cleanup

### Цели
- да добавим video support без да нарушим image compatibility
- да гарантираме, че delete operations не оставят orphaned blobs

### Задачи
- добавяне на `videos` към `Product` schema
- добавяне на server-side `maxVideoCount` правило, например максимум 3 видеа на продукт
- запазване на `imageUrl` и `imageUrls` без промяна в поведението
- update на product delete flow, така че при изтриване на продукт да се трият и видеата от GCS
- добавяне на video-specific delete service
- отделен endpoint за delete на видео, например `DELETE /products/:productId/video`
- замяна на mass assignment подхода с whitelist на позволените fields при create/edit
- metadata validation за `posterUrl`, `mimeType` и `durationSeconds`

### Забележка
- не трябва да използваме `deleteProductImage` за video delete
- current image delete rule изисква поне едно оставащо изображение; това правило не е приложимо към видео
- `editProduct` не трябва да записва произволни полета чрез `Object.assign(product, req.body)`-подобен flow
- `deleteProductVideo` трябва да валидира, че подаденият `videoUrl` принадлежи на `product.videos`, преди да трие от GCS

### Deliverable
- schema и delete flow, които поддържат видео без storage leakage

---

## Фаза 2: Product form и owner workflow

### Цели
- owner/admin да може да качва, вижда и трие видеа отделно от снимките

### Задачи
- добавяне на video uploader в `ProductForm.jsx`
- video input приема само `.mp4`
- добавяне на uploader за poster image към всяко видео
- отделни client-side messages за допустим размер, формат и duration
- preview списък на качените видеа
- отделен бутон за изтриване на видео
- update на submit payload-а, така че да изпраща `videos`
- инициализация на `videos` винаги като масив `[]`, никога като празен string
- update на generic form validation така, че `videos` да не се третира като required поле
- create/edit/delete product flow-овете изрично се разширяват според новия video requirement

### UX правила
- video upload не променя `imageUrl` и `imageUrls`
- create flow може да допуска продукт без видео
- image requirement остава същият, ако бизнес правилото продължава да изисква поне едно изображение
- ако има лимит от 3 видеа, UI го показва ясно и client-side блокира качване над лимита
- owner-ът трябва да вижда poster preview за всяко видео
- ако видео е без poster, submit-ът се блокира
- video metadata се пази така, че ProductDetails да може да рендерира autoplay/fallback behavior без допълнителни заявки

### Известен gap
- при create mode качени, но непотвърдени файлове могат да останат orphaned, ако потребителят напусне формата преди save
- препоръчано mitigation за първа версия: GCS lifecycle rule за автоматично чистене на неприкрепени uploads
- алтернатива за по-късна итерация: отделен pending uploads механизъм

### Deliverable
- стабилен owner flow за create/edit/delete на видеа

---

## Фаза 3: Product details rendering

### Цели
- клиентът да вижда кратките видеа в detail страницата
- да не се нарушава работата на съществуващата image галерия
- да използваме една обща media box зона, а не отделна video секция под галерията

### Задачи
- създаване на общ media slides масив в `ProductDetails.jsx`, който комбинира `imageUrls` и `videos`
- ако има видео, то става първият slide в media box-а
- рендериране на video slide с `<video muted autoplay playsInline preload="metadata" poster=\"...\">`
- image slideshow да се pause-ва, докато video slide е активен
- при `ended` на видеото viewer-ът да преминава към slideshow на изображенията
- fallback към poster + play, ако autoplay бъде блокиран от браузъра
- respect за `prefers-reduced-motion`: без autoplay, показва се poster + play
- responsive CSS за mobile и desktop
- само първият active video slide се mount-ва eagerly; останалите video елементи се mount-ват lazy при navigation или visibility trigger
- на mobile video slides извън viewport не трябва да инициират metadata заявки предварително
- автоматично pause/reset на видео при смяна към друг slide

### UX правила
- media box-ът е общ за images и videos
- ако има видео, то е първото нещо, което клиентът вижда
- video autoplay е разрешен само като `muted autoplay playsInline`
- без auto-play със звук
- когато видеото свърши, започва image slideshow
- ако потребителят ръчно навигира към video slide, видеото се pause-ва/reset-ва при излизане от него
- `ProductCard`, cart и listing остават image-only
- ако autoplay не тръгне, UX деградира до poster + play бутон

### Deliverable
- detail страница с една media box зона, autoplay intro video и плавен преход към slideshow на изображенията

### Accessibility gap за V1
- captions support чрез `<track kind="captions">` не е blocker за първа версия, но остава explicit known gap
- при липса на captions трябва поне да има описателен текст/fallback около видеото

---

## Фаза 4: Regression safety и тестове

### Цели
- да намалим регресиите в най-рисковите точки
- да покрием критичните сценарии, които Claude маркира

### Минимален тестов пакет
- create product само със снимки
- create product със снимки и видеа
- create product със снимки, видео и poster
- edit product чрез добавяне на ново видео
- edit product не вкарва video URL в `imageUrls`
- edit product обновява коректно `videos[].posterUrl`
- delete само на видео
- delete на продукт с видеа и проверка, че и video blob-овете се чистят
- upload reject при невалиден MIME type
- upload reject при spoofed MIME type и несъответстващо съдържание
- upload reject при oversized video
- upload reject при duration над лимита
- upload reject при unauthenticated user
- product details render без видео
- product details render с едно и с няколко видеа
- video autoplay стартира muted и при `ended` се преминава към image slideshow
- fallback към poster + play при блокиран autoplay
- `prefers-reduced-motion` изключва autoplay
- потвърждение, че listing и cart продължават да използват image thumbnails
- negative test: `addToCart` никога не получава video URL за thumbnail
- test за лимита на броя видеа на продукт
- edit product с премахване на всички видеа води до `videos: []`, а не до `undefined`
- ProductDetails SEO render: JSON-LD, OG video tags и poster metadata присъстват коректно

### Ако няма автоматизирани тестове
Задължително подготвяме manual QA checklist и я изпълняваме преди merge.

### Deliverable
- тестове или поне формализиран QA checklist за release readiness

---

## Claude-flagged рискове и как ги адресираме

## Риск 1: Липса на server-side MIME и size validation

**Сериозност:** Critical

### Проблем
Текущият upload endpoint не валидира файловия тип и размера на сървърно ниво. Това е уязвимост и преди video support, но при видео става още по-рисково заради по-големи файлове и generic file upload поведение.

### Митигиране
- allowlist на поддържаните MIME типове
- server-side max size за image и отделен max size за video
- reject на всяка заявка извън allowlist-а
- magic-byte sniffing за валидация на реалния file type
- проверка за MIME/extension consistency
- auth check на upload route-а
- ясни error messages към клиента

### Статус в плана
- затваря се изцяло във Фаза 0

---

## Риск 2: Orphaned video files при delete на продукт

**Сериозност:** High

### Проблем
Current product delete flow чисти само image URL-ите. Ако добавим `videos` без update на cleanup logic, ще трупаме orphaned файлове в storage.

### Митигиране
- разширяване на `deleteProduct` да изтрива и `videos`
- разширяване на storage cleanup логиката да обхожда и `videos`, без да е задължително преименуване на helper-а във V1
- manual test и, ако е възможно, automated coverage за този сценарий

### Статус в плана
- затваря се във Фаза 1

---

## Риск 3: Видео да влезе в image-only utilities и rendering

**Сериозност:** High

### Проблем
Ако видео URL попадне в `imageUrls`, ще счупи `next/image`, текущия slideshow и cart thumbnail поведението.

### Митигиране
- стриктно разделяне: `imageUrls` за снимки, `videos` за видеа
- без промяна в `normalizeImageUrls`
- defensive guard на write слой, така че image utilities да не приемат video URL
- без промяна на cart thumbnail логиката да чете от video data
- review на create/edit payload shape

### Статус в плана
- архитектурно ограничение във всички фази

---

## Риск 4: Погрешно преизползване на image delete логиката

**Сериозност:** Medium

### Проблем
`deleteProductImage` съдържа image-specific business rule: продуктът трябва да пази поне едно изображение. Ако reuse-нем тази логика за видео, ще въведем дефектно поведение.

### Митигиране
- отделен `deleteProductVideo` service
- отделен route
- отделен client manager метод

### Статус в плана
- затваря се във Фаза 1 и Фаза 2

---

## Риск 5: Липса на тестово покритие

**Сериозност:** High

### Проблем
Промяната засяга schema, upload, delete и detail rendering. Без тестове има висок шанс за скрити регресии.

### Митигиране
- минимален test plan от Фаза 4
- при липса на автоматизирана среда: стъпков manual QA checklist
- review на diff преди merge
- security review на upload flow преди production rollout

### Статус в плана
- затваря се във Фаза 4

---

## SEO изисквания

### Цели
- видеата да носят SEO стойност, а не само UX стойност
- social sharing да има качествен preview вместо black frame

### Изисквания
- `ProductDetails` трябва да рендерира `VideoObject` JSON-LD за всяко продуктово видео
- минимални полета: `name`, `description`, `thumbnailUrl`, `uploadDate`, `contentUrl`
- Open Graph metadata трябва да включва `og:video`, `og:video:type` и подходящи размери, когато продуктът има видео
- `posterUrl` е required и служи едновременно за UX preview, social thumbnail и SEO thumbnail
- canonical product image остава основна image медия за listing, cart и базовите product previews

### Извън V1
- video sitemap
- автоматично генерирани thumbnail-и

---

## Предложени backend детайли

### Schema

```js
videos: [
  {
    url: String,
    posterUrl: String,
    mimeType: String,
    durationSeconds: Number,
    uploadDate: Date,
  }
]
```

### Product rules
- `maxVideoCount`: 3
- `maxImageUploadSize`: 5 MB
- `maxVideoUploadSize`: 25 MB
- `allowedVideoMimeTypes`: `video/mp4`
- `recommendedVideoDurationSeconds`: 15
- `maxVideoDurationSeconds`: 30
- video е optional
- poster е required за всяко видео
- image полетата остават mandatory според текущото бизнес правило

### CRUD scope
- `create product`: поддържа запис на `videos[]`
- `edit product`: поддържа добавяне, премахване и update на video metadata
- `delete video`: отделен flow с ownership validation
- `delete product`: трие image и video assets от storage

### Delete API
- запазваме `DELETE /products/:productId/image`
- добавяме `DELETE /products/:productId/video`
- video delete endpoint-ът валидира ownership на URL-а спрямо `product.videos`

### Storage helper
- за V1 не е задължително да rename-ваме `deleteImageFromGCS`, ако това разширява излишно diff-а
- `deleteProduct` трябва изрично да обхожда и `videos`, а не само `imageUrls`

### Payload sanitization
- create/edit service-ите whitelist-ват допустимите полета вместо да assign-ват целия request body
- примерни позволени полета: `title`, `description`, `price`, `category`, `availability`, `imageUrls`, `imageUrl`, `videos`

### Upload стратегия
- image upload route-ът се harden-ва, но остава съвместим със сегашните callers
- video upload използва signed URL flow към GCS
- poster upload може да използва същия signed upload механизъм

---

## Предложени frontend детайли

### ProductForm
- отделен video uploader
- отделен poster uploader за всяко видео
- отделен preview list за videos и posters
- отделен delete action
- визуализиран лимит: максимум 3 видеа
- validation за `.mp4`, размер, duration и poster presence

### ProductDetails
- една обща media box зона за images и videos
- ако има видео, то е първият media slide
- video player използва `muted autoplay playsInline preload="metadata" poster="..."`
- autoplay е без звук и е best-effort; при блокиран autoplay UI-то пада обратно до poster + play
- при `ended` viewer-ът преминава към image slideshow
- при `prefers-reduced-motion` autoplay се изключва

### Metadata integration
- metadata generator-ът и SEO layer-ът трябва да могат да използват `videos[].posterUrl`
- social preview не трябва да разчита на black frame от raw video

### Непроменено поведение
- `ProductCard` остава image-only
- cart thumbnail остава image-only
- image slideshow логиката остава image-centric и не приема raw video URL

---

## Миграция и backward compatibility

Не се изисква data migration за старите продукти.

Старите продукти:
- продължават да работят само със снимки
- ще имат празен `videos` масив
- няма да изискват промени в listing, cart или checkout

Новите продукти:
- могат да имат снимки и кратки видеа
- не променят meaning-а на старите image полета
- използват video metadata за autoplay, poster и SEO

---

## Rollout стратегия

1. Завършваме Фаза 0 като отделен security PR и го merge-ваме в `main`
2. Финализираме signed upload стратегията за videos и posters
3. Завършваме Фаза 1
4. Правим локална проверка на create/edit/delete flows
5. Имплементираме owner workflow в create/edit form
6. Имплементираме общата media box логика в ProductDetails
7. Добавяме SEO metadata и JSON-LD
8. Минаваме през тестовете и QA checklist
9. Пускаме feature-а

### Hosting бележка
- video uploads не трябва да минават като голям proxy payload през current Next route
- signed upload стратегията е част от решението, а не open question

Ако искаме допълнителна безопасност, video upload може временно да се скрие зад feature flag или да е достъпен първо само за owner role.

---

## Критерии за приемане

Feature-ът е готов, когато:
- owner може да качи поне едно кратко `.mp4` видео към продукт
- owner не може да качва над 3 видеа към продукт
- всяко видео има poster image
- detail страницата показва видеото в същата media box зона като изображенията
- при налично видео то тръгва autoplay като `muted playsInline` и при `ended` преминава към image slideshow
- `prefers-reduced-motion` изключва autoplay
- cart и listing не се опитват да рендерират видео като изображение
- create / edit / delete product flow-овете работят коректно с video requirement-а
- delete на продукт чисти и image, и video файловете от storage
- upload flow-ът reject-ва непозволени MIME типове, oversized файлове, прекалено дълги видеа и unauthenticated uploads
- ProductDetails рендерира коректно JSON-LD и OG video metadata
- имаме поне минимален тестов или QA пакет за regression safety

---

## Отворени решения

- дали в една обща media box зона видеото да е винаги първи slide, или това да е configurable по продукт
- дали hosting средата налага още по-нисък effective limit от планираните 25 MB
- дали captions support да влезе още във V1 или да остане explicit known gap

Тези решения не променят избрания архитектурен подход. Те са implementation details в рамките на същия модел.
