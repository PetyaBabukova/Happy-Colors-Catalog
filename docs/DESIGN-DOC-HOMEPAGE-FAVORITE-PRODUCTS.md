# Happy Colors - Homepage Favorite Products Design Document

**Дата:** 2026-05-12
**Статус:** Updated after product decision: no user roles
**Обхват:** Ръчно избираеми продукти за homepage секцията "Най-любимите ви продукти"

---

## Цел

Homepage секцията "Най-любимите ви продукти" да показва ръчно избрани продукти, а не първите налични продукти от каталога.

В този проект няма user роли. Всеки логнат потребител се третира като trusted admin/operator за тези вътрешни CMS действия.

---

## Решение

Използваме product-backed curation:

- `Product.isHomepageFeatured`
- `Product.homepageFeaturedOrder`
- public read endpoint: `GET /products/homepage-featured`
- authenticated mutation endpoint: `PUT /products/homepage-featured`
- admin UI: `/homepage-featured`
- V1 лимит: 4 продукта

Homepage вече зарежда само curated продуктите чрез `getHomepageFeaturedProducts()`. Няма fallback към произволни първи продукти.

---

## UX

Логнатият потребител вижда линк "Избери любими продукти" в authenticated navigation.

Страницата `/homepage-featured`:

- показва горе избраните продукти;
- показва counter `избрани X / 4`;
- показва всички продукти с thumbnail, име, категория и availability;
- наличните продукти могат да се добавят;
- неналичните продукти не могат да се добавят като нови;
- ако вече избран продукт стане неналичен, той остава видим в admin списъка с warning и може да бъде махнат;
- избраните продукти се подреждат с бутони нагоре/надолу;
- save има confirmation и loading/disabled state.

Анонимен потребител се redirect-ва към `/users/login`.

---

## Backend

### Product Schema

```js
isHomepageFeatured: {
  type: Boolean,
  default: false,
  index: true,
},
homepageFeaturedOrder: {
  type: Number,
  default: 0,
},
```

Index:

```js
productSchema.index({ isHomepageFeatured: 1, homepageFeaturedOrder: 1, _id: 1 });
```

### API

```txt
GET /products/homepage-featured
PUT /products/homepage-featured
```

`GET` е публичен и връща само:

- `isHomepageFeatured: true`
- `availability !== 'unavailable'`
- сортирани по `homepageFeaturedOrder`, после `_id`
- максимум 4 продукта

`PUT` изисква `requireAuth` и приема:

```json
{ "productIds": ["..."] }
```

Празен масив е валиден и умишлено изчиства секцията.

Bulk update-ът валидира ids, лимит, duplicates, missing products и unavailable products. Записът използва Mongo transaction.

---

## Frontend

`productsManager.js` добавя:

```js
getHomepageFeaturedProducts()
updateHomepageFeaturedProducts(productIds)
```

Homepage:

- маха временната `getFavoriteProducts(products)` логика;
- спира да зарежда всички продукти само за тази секция;
- render-ва секцията само ако има curated products.

Revalidation:

```js
revalidateTag('products');
revalidateTag('homepage-featured-products');
revalidatePath('/products');
revalidatePath('/');
```

---

## Rollout

Преди deploy трябва да има избрани продукти, ако искаме секцията да се вижда веднага.

Добавен е seed script:

```txt
scripts/seedHomepageFeaturedProducts.js
```

Той избира първите 4 available продукта само ако все още няма нито един `isHomepageFeatured: true`.

---

## Acceptance Criteria

- Логнат потребител може да отвори `/homepage-featured`.
- Анонимен потребител не може да запазва селекция.
- Логнат потребител може да избере до 4 налични продукта.
- Логнат потребител може да подреди избраните продукти.
- Homepage показва избраните продукти в запазения ред.
- Homepage не показва unavailable избрани продукти.
- Homepage не fallback-ва към произволни първи продукти.
- Product card дизайнът остава същият като каталога.
