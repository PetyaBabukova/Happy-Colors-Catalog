# Happy Colors - Homepage Favorite Products Implementation Plan

**Дата:** 2026-05-12
**Статус:** Updated after product decision: no user roles

---

## Решение

Имплементацията следва правилото на проекта: няма роли. Всеки логнат потребител е trusted admin за CMS действията.

Feature-ът добавя:

- product fields `isHomepageFeatured` и `homepageFeaturedOrder`;
- `GET /products/homepage-featured`;
- authenticated `PUT /products/homepage-featured`;
- `/homepage-featured` admin page;
- homepage integration чрез `getHomepageFeaturedProducts()`;
- seed script за първоначална селекция.

---

## Phase 1 - Backend

Файлове:

```txt
server/models/Product.js
server/config/homepageFeaturedProducts.js
server/services/productsServices.js
server/controllers/productsController.js
server/__tests__/integration/products.test.js
server/__tests__/integration/setup.js
```

Задачи:

- add schema fields and index;
- add `HOMEPAGE_FEATURED_PRODUCTS_LIMIT = 4`;
- add `getHomepageFeaturedProducts()`;
- add `updateHomepageFeaturedProducts(productIds)`;
- add routes above `/:productId`;
- protect `PUT` with `requireAuth`;
- use transaction for unset/set bulk update;
- allow empty `productIds: []` as intentional clear.

Tests:

- public GET returns selected available products;
- route is not caught by `/:productId`;
- anonymous PUT returns 401;
- authenticated PUT saves selection;
- empty selection clears all;
- unavailable product is rejected;
- deleted featured product disappears from GET.

---

## Phase 2 - Frontend Data And Homepage

Файлове:

```txt
happy-colors-nextjs-project/src/managers/productsManager.js
happy-colors-nextjs-project/src/app/api/revalidate/products/route.js
happy-colors-nextjs-project/src/app/page.js
happy-colors-nextjs-project/__tests__/unit/managers/productsManager.test.js
happy-colors-nextjs-project/__tests__/api/revalidate/products.test.js
```

Задачи:

- add `getHomepageFeaturedProducts()`;
- add `updateHomepageFeaturedProducts(productIds)`;
- add cache tags `products` and `homepage-featured-products`;
- revalidate `/` and `/products`;
- homepage stops fetching all products for favorites;
- homepage hides section when curated list is empty.

---

## Phase 3 - Admin UI

Файлове:

```txt
happy-colors-nextjs-project/src/app/homepage-featured/page.js
happy-colors-nextjs-project/src/app/homepage-featured/HomepageFeaturedClient.jsx
happy-colors-nextjs-project/src/app/homepage-featured/HomepageFeatured.module.css
happy-colors-nextjs-project/src/components/header/header.jsx
happy-colors-nextjs-project/__tests__/components/homepage-featured/HomepageFeaturedClient.test.jsx
happy-colors-nextjs-project/__tests__/components/layout/Header.test.jsx
```

Задачи:

- add authenticated navigation link "Избери любими продукти";
- redirect anonymous users to `/users/login`;
- list selected products and all products;
- allow add/remove/reorder;
- block new unavailable selections;
- allow removing unavailable already-selected products;
- add confirmation and loading state for save.

---

## Phase 4 - Rollout

Seed script:

```txt
scripts/seedHomepageFeaturedProducts.js
```

Поведението:

- ако вече има featured продукти, не прави нищо;
- иначе избира първите 4 available продукта;
- задава order от 0 до 3.

---

## Verification

Required checks:

```bash
cd server && npm test
cd happy-colors-nextjs-project && npm test
cd happy-colors-nextjs-project && npm run build
```

Manual QA:

- login;
- open `/homepage-featured`;
- select 1, 2, and 4 products;
- save;
- verify homepage;
- verify empty selection hides section;
- verify catalog grid remains unchanged.
