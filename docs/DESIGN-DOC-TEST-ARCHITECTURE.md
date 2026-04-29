# Happy Colors - Test Architecture Design Document

**Дата:** 2026-04-29
**Статус:** Reviewed by Opus round 2 - 80% coverage и component setup gap-ове отразени
**Обхват:** Unit тестове, UI/component тестове, backend integration тестове, Next.js API route тестове и regression/e2e сценарии за Happy Colors
**Цел:** Да въведем тестова архитектура, която позволява бърза локална проверка по модул и надежден regression пакет преди merge/release

---

## Цел

Happy Colors в момента няма тестова инфраструктура. Проектът има root package, отделен Express/Mongoose backend в `server/` и Next.js 15 frontend в `happy-colors-nextjs-project/`.

Тестовата архитектура трябва да даде:

- бързи unit тестове за чиста бизнес логика и helpers
- UI/component тестове за React client компоненти
- backend integration тестове срещу Express routes и in-memory MongoDB
- тестове за Next.js API route handlers под `happy-colors-nextjs-project/src/app/api/`
- Playwright regression/e2e сценарии за основните потребителски flow-ове
- възможност да се пуска само релевантният тестов сет при локална промяна
- единна команда за пълна проверка преди merge

---

## Принципи

1. Тестовете се разделят по слой и по ownership зона: `server`, `frontend`, `frontend-api`, `e2e`.
2. Локалните промени трябва да имат кратка команда за focused run.
3. Unit тестовете не стартират реален server, MongoDB, Stripe, GCS или email.
4. Integration тестовете проверяват реалните HTTP договори чрез `supertest`, но външните услуги остават mock-нати.
5. E2E тестовете проверяват реалните user journeys през браузър, но трябва да са тагнати и делими.
6. Тестовите данни се създават през factories и setup helpers, не чрез production data.
7. Test scripts трябва да са Windows-friendly и да използват двойни кавички при нужда.
8. Next.js API routes не се губят между frontend component тестовете и Express integration тестовете; те имат отделен тестов слой.

---

## Избрани инструменти

### Backend

**Vitest**

Причини:

- проектът е ESM (`"type": "module"`)
- работи добре с modern Node и Express 5
- по-лесен ESM mocking от Jest в този repo контекст
- бърз watch mode за локална работа

**supertest**

Използва се за route/integration тестове срещу `createExpressApp()` от `server/server.js`, без да се стартира реален listener.

**mongodb-memory-server**

Използва се за backend integration тестове, които имат нужда от реални Mongoose модели, но без локална или remote MongoDB зависимост.

### Frontend

**Vitest + React Testing Library + jest-dom**

Използват се за:

- pure utility тестове
- manager тестове с mocked `fetch`
- client component тестове
- context/component interaction тестове

**jsdom**

Препоръчителният първи избор е `jsdom`, защото е най-съвместимият стандартен environment за React Testing Library. Ако suite-ът стане осезаемо бавен, може да се оцени преминаване към `happy-dom` за част от component тестовете.

**MSW**

Default подходът за frontend тестове, които mock-ват HTTP layer-а, е MSW (Mock Service Worker). Това дава realistic request/response matching, работи в unit и component тестове и може да се използва и в Playwright за focused network mocking. `vi.spyOn(globalThis, 'fetch')` остава приемлив за тривиални single-call unit тестове, но не е default за component flow-ове.

### Regression/e2e

**Playwright**

Причини:

- стабилен cross-browser e2e runner
- добра Windows поддръжка
- лесно тагване чрез `--grep`
- поддържа parallel execution, traces, screenshots и video artifacts
- подходящ за smoke suite и full regression suite

---

## Folder Layout

```text
server/
  __tests__/
    unit/
      utils/
      services/
      middlewares/
      helpers/
    integration/
      setup.js
      factories.js
      products.test.js
      users.test.js
      categories.test.js
      search.test.js
  vitest.config.js

happy-colors-nextjs-project/
  __tests__/
    unit/
      utils/
      managers/
      helpers/
      hooks/
    api/
      uploads/
      offices/
      revalidate/
    components/
      cart/
      products/
      ui/
      header/
      app/
        auth/
        checkout/
        categories/
        contacts/
      test-utils.jsx
  vitest.config.js

e2e/
  tests/
    smoke.spec.js
    products.spec.js
    cart.spec.js
    auth.spec.js
    categories.spec.js
    checkout.spec.js
    search.spec.js
  fixtures/
    products.js
    users.js
  playwright.config.js
```

Тестовете не се colocate-ват вътре в `src/app/`, за да не се смесват с Next.js App Router структурата. За frontend component тестове `__tests__/components/` mirror-ва реалните component зони, включително client components, които физически живеят в `src/app/`.

Next.js API route handlers под `src/app/api/` се тестват отделно в `__tests__/api/`, защото не са част от Express backend-а и не се покриват от React component тестовете.

---

## Component Test Setup

`happy-colors-nextjs-project/__tests__/components/test-utils.jsx` трябва да експортира custom `render()` helper. Целта е всеки component тест да получава еднакъв provider setup, без да reimplement-ва Auth/Cart/router boilerplate.

Helper-ът:

- wrap-ва `children` в нужните context providers: Auth, Cart и други shared providers, когато компонентът ги изисква
- mock-ва `next/navigation` router behavior през predictable overrides
- приема override props като `user`, `cartItems`, `routerOverrides`, `mockRouterPush`
- re-export-ва всичко от `@testing-library/react` за удобство

Примерен skeleton:

```jsx
import { vi } from 'vitest';
import { render as rtlRender } from '@testing-library/react';
import { AuthContext } from '@/context/AuthContext';
import { CartContext } from '@/context/CartContext';
import { setMockRouter } from './setup';

export * from '@testing-library/react';

export function render(
  ui,
  {
    user = null,
    cartItems = [],
    authOverrides = {},
    cartOverrides = {},
    routerOverrides = {},
    mockRouterPush = vi.fn(),
  } = {}
) {
  const authValue = {
    user,
    loading: false,
    ...authOverrides,
  };

  const cartValue = {
    cartItems,
    addToCart: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
    increaseQuantity: vi.fn(),
    decreaseQuantity: vi.fn(),
    getTotalItems: () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    getTotalPrice: () => cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    ...cartOverrides,
  };

  setMockRouter({
    push: mockRouterPush,
    ...routerOverrides,
  });

  return rtlRender(
    <AuthContext.Provider value={authValue}>
      <CartContext.Provider value={cartValue}>{ui}</CartContext.Provider>
    </AuthContext.Provider>
  );
}
```

Реалната имплементация трябва да съвпадне с export-ите на текущите context modules. `setMockRouter` е test helper, който управлява mock-а на `next/navigation`, ако компонентът използва router hooks. Ако някой context не export-ва provider/context по начин, удобен за тестове, това се решава с малка testability промяна, не с copy/paste wrapper-и във всеки тест.

---

## Script Architecture

### Root `package.json`

```json
{
  "scripts": {
    "test": "npm run test:server && npm run test:frontend",
    "test:server": "cd server && npm test",
    "test:server:unit": "cd server && npm run test:unit",
    "test:server:integration": "cd server && npm run test:integration",
    "test:frontend": "cd happy-colors-nextjs-project && npm test",
    "test:frontend:unit": "cd happy-colors-nextjs-project && npm run test:unit",
    "test:frontend:api": "cd happy-colors-nextjs-project && npm run test:api",
    "test:frontend:components": "cd happy-colors-nextjs-project && npm run test:components",
    "test:e2e": "npx playwright test",
    "test:e2e:smoke": "npx playwright test --grep \"@smoke\"",
    "test:ci": "npm run test:server:ci && npm run test:frontend:ci",
    "test:server:ci": "cd server && npm run test:ci",
    "test:frontend:ci": "cd happy-colors-nextjs-project && npm run test:ci",
    "test:all": "npm run test:ci && npm run test:e2e"
  }
}
```

### `server/package.json`

```json
{
  "scripts": {
    "dev": "nodemon dev-server.js",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ci": "cross-env CI_COVERAGE=true vitest run --coverage",
    "test:watch": "vitest",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration"
  }
}
```

### `happy-colors-nextjs-project/package.json`

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:ci": "cross-env CI_COVERAGE=true vitest run --coverage",
    "test:watch": "vitest",
    "test:unit": "vitest run --project unit",
    "test:api": "vitest run --project api",
    "test:components": "vitest run --project components"
  }
}
```

Бележка: тестовата архитектура не трябва да сменя lint strategy като страничен ефект. Запазваме текущия `next lint` script в дизайна. Ако при имплементация Next.js 15 откаже тази команда, тогава отделна малка промяна трябва да премине към `eslint .` и да валидира, че `eslint.config.mjs` запазва `next/core-web-vitals` правилата.

---

## Vitest Projects

Използваме Vitest projects вместо ad-hoc tags за unit/component/integration делението. Folder-ът определя слоя, което намалява риска тестове да бъдат погрешно тагнати.

### Backend example

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        name: 'unit',
        test: {
          environment: 'node',
          include: ['__tests__/unit/**/*.test.js'],
        },
      },
      {
        name: 'integration',
        test: {
          environment: 'node',
          include: ['__tests__/integration/**/*.test.js'],
          setupFiles: ['__tests__/integration/setup.js'],
        },
      },
    ],
  },
});
```

### Frontend example

```js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        name: 'unit',
        test: {
          environment: 'node',
          include: ['__tests__/unit/**/*.test.js'],
        },
      },
      {
        name: 'components',
        test: {
          environment: 'jsdom',
          include: ['__tests__/components/**/*.test.jsx'],
          setupFiles: ['__tests__/components/setup.js'],
        },
      },
      {
        name: 'api',
        test: {
          environment: 'node',
          include: ['__tests__/api/**/*.test.js'],
          setupFiles: ['__tests__/api/setup.js'],
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
});
```

Този alias трябва да съвпада с текущия `jsconfig.json`, който дефинира `@/*` към `./src/*`. Не използваме `'/src'`, защото това е filesystem root path и ще се счупи на Windows.

---

## Coverage Requirements

Coverage е explicit acceptance requirement, не optional reporting. V1 целта е 80% покритие за Vitest-based тестовете. Playwright coverage не влиза във V1, защото browser/e2e coverage изисква отделна instrumentation стратегия и остава V2 тема.

### Tooling

- `@vitest/coverage-v8` се добавя към `server/` и `happy-colors-nextjs-project/`
- `cross-env` се добавя като dev dependency, за да може `test:ci` да включва threshold gating Windows-friendly
- Playwright coverage не се измерва във V1

### Thresholds

Threshold-ите се прилагат отделно във всеки `vitest.config.js`:

- lines: 80
- branches: 75
- functions: 80
- statements: 80

Branches threshold-ът е 75%, защото някои error fallback-ове и defensive branches са трудни за trigger без artificial state.

### Per-project scope

Няма единен глобален monorepo threshold. Измерването е отделно:

- `server/`: unit + integration combined coverage
- `happy-colors-nextjs-project/`: unit + components + api combined coverage

Така backend coverage не може да компенсира слаб frontend coverage, и обратно.

### Reporters

Coverage reporters:

- `text`: за CI log
- `html`: за локално разглеждане
- `lcov`: за CI integration и бъдещи badge/report tools

### Excluded paths

Тези файлове не влизат в coverage знаменателя:

- `__tests__/**`
- `**/*.config.{js,mjs}`
- `src/app/**/{layout,page,not-found,error}.js`
- `**/*.d.ts`
- `server/dev-server.js`
- `happy-colors-nextjs-project/next.config.mjs`

Next.js `layout`, `page`, `not-found` и `error` files се exclude-ват само когато са boilerplate/minimal wiring. Ако някой от тях започне да съдържа реална бизнес логика, логиката трябва да се изнесе в testable helper или файлът да се върне в coverage.

### CI gating

- локално `npm test` пуска coverage report, но не fail-ва при threshold drop
- локално `npm test` остава fast local run без coverage instrumentation
- локално `npm run test:coverage` пуска coverage report без threshold gating
- `npm run test:ci` enforce-ва threshold-ите и fail-ва Tier 1 при drop
- CI използва `npm run test:ci`, не `npm test`

Примерен coverage block:

```js
const enforceCoverage = process.env.CI_COVERAGE === 'true';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: enforceCoverage
        ? {
            lines: 80,
            branches: 75,
            functions: 80,
            statements: 80,
          }
        : undefined,
      exclude: [
        '__tests__/**',
        '**/*.config.{js,mjs}',
        'src/app/**/{layout,page,not-found,error}.js',
        '**/*.d.ts',
        'server/dev-server.js',
        'happy-colors-nextjs-project/next.config.mjs',
      ],
    },
  },
});
```

Този coverage блок се поставя в същия `test` object, който съдържа `projects` array-а в реалните `vitest.config.js` файлове.

При `server/` config-а frontend-only exclude-ите са harmless, но може да се съкратят локално за по-чист config. При frontend config-а `server/dev-server.js` е harmless.

---

## Focused Local Runs

Целта е разработчикът да не пуска всички тестове за малка локална промяна.

### Примери

Промяна в backend utility:

```powershell
cd server
npm run test:unit -- slugify
```

Промяна в backend route/service за продукти:

```powershell
cd server
npm run test:integration -- products
```

Промяна във frontend helper:

```powershell
cd happy-colors-nextjs-project
npm run test:unit -- checkoutHelpers
```

Промяна в cart UI:

```powershell
cd happy-colors-nextjs-project
npm run test:components -- cart
```

Промяна в Next.js API route за uploads/offices:

```powershell
cd happy-colors-nextjs-project
npm run test:api -- uploads
```

Промяна в реален user flow:

```powershell
npx playwright test e2e/tests/cart.spec.js
```

Smoke regression:

```powershell
npm run test:e2e:smoke
```

Пълна проверка преди merge:

```powershell
npm run test:all
```

---

## Test Data Strategy

### Factories вместо shared mutable fixtures

Backend:

```js
export function buildProduct(overrides = {}) {
  return {
    title: 'Тестов продукт',
    description: 'Описание за тест',
    price: 29.99,
    imageUrl: 'https://example.com/product.webp',
    imageUrls: ['https://example.com/product.webp'],
    availability: 'available',
    ...overrides,
  };
}

export function buildCheckoutDraft(overrides = {}) {
  return {
    cartItems: [],
    shipping: {
      name: 'Тестов клиент',
      phone: '0888123456',
      city: 'София',
    },
    ...overrides,
  };
}
```

Frontend:

```js
export function buildCartProduct(overrides = {}) {
  return {
    _id: 'product-1',
    title: 'Тестов продукт',
    price: 29.99,
    imageUrl: 'https://example.com/product.webp',
    quantity: 1,
    ...overrides,
  };
}
```

Factories се ползват за всяка test зона, за да няма споделено mutable състояние между тестове.

### External service boundaries

Тези зависимости се mock-ват в unit/component/integration тестовете:

- Stripe client
- Google Cloud Storage helpers
- nodemailer/sendEmail
- delivery/shipping APIs: Econt and Speedy
- browser `fetch` във frontend manager тестове
- `next/navigation` hooks в client component тестове
- localStorage/sessionStorage при cart/auth tests
- in-memory rate limiter state при Express integration тестове

Default подходът за frontend HTTP mocking е MSW. Това важи за manager, component и browser-oriented tests, които имат повече от един request или зависят от response shape. За тривиални single-call unit тестове `vi.spyOn(globalThis, 'fetch')` е позволен, но не трябва да става default pattern.

### Middleware Testing Pattern

Middleware unit тестовете остават в Phase 1, но не са pure function тестове. Те използват lightweight `req`/`res`/`next` mocks вместо допълнителна `node-mocks-http` зависимост в началото.

Пример:

```js
function buildReq(overrides = {}) {
  return {
    headers: {},
    body: {},
    params: {},
    cookies: {},
    ...overrides,
  };
}

function buildRes() {
  const res = {
    statusCode: 200,
  };

  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);

  return res;
}

function buildNext() {
  return vi.fn();
}
```

За rate limiter тестове module-level state трябва да се reset-ва в `beforeEach`, или самият middleware да expose-не test-only reset helper. В route integration тестове, които не тестват rate limiting, limiter-ът може да бъде mock-нат целият.

### Backend integration DB

За integration тестове:

- `mongodb-memory-server` стартира isolated MongoDB instance
- Mongoose connection се отваря в setup
- collections се чистят в `beforeEach` чрез drop/delete на всички test collections
- connection се затваря в teardown
- custom rate limiter state трябва да се reset-ва между тестове или middleware-ът да се mock-ва, за да няма flaky 429 отговори

Default-ът е `beforeEach` cleanup, защото е по-надежден срещу test-order coupling, дори да е малко по-бавен. Изключение се допуска само за тестове, които explicit reuse-ват seed данни в рамките на един file; те трябва ясно да документират file-level lifecycle и да чистят в `afterAll`.

### Next.js API route tests

`happy-colors-nextjs-project/src/app/api/` е отделен server-side слой, който не се покрива от Express `supertest` тестовете. Той включва upload, delete/proxy, offices lookup, revalidation и shared `_lib` modules.

Покритие:

- `api/uploads/sign/route.js`: auth, MIME/size validation, signed URL contract, mocked GCS
- `api/uploads/delete/route.js`: delete token validation, attached asset guard, mocked GCS
- `api/uploads/proxy/route.js`: proxy validation и error handling
- `api/upload-image/route.js`: legacy image upload validation
- `api/offices/econt/route.js` и `api/offices/speedy/route.js`: mocked carrier APIs и error states
- `api/revalidate/products/route.js`: token/auth guard и revalidation call contract
- `_lib/auth.js`, `_lib/env.js`, `_lib/gcs.js`, `_lib/mongo.js`, `_lib/uploadDeleteToken.js`, `_lib/uploadValidation.js`: unit-level tests where practical

Подход:

- route handler functions се import-ват директно и се извикват с `Request`/`NextRequest` test doubles
- GCS, Mongo, carrier APIs и `revalidatePath` се mock-ват на module boundary
- ако даден route handler е твърде свързан с Next runtime, fallback-ът е Playwright/API-level smoke тест, но това трябва да е explicit exception, не default

---

## Regression/E2E Strategy

Playwright тестовете се разделят по file и по tag.

Regression suite-ът се състои от Playwright e2e тестове, тагнати с `@smoke` и `@critical`. Другите тагове (`@products`, `@cart`, `@auth`, `@checkout`) са под-сетове за focused regression run.

### Tags

- `@smoke`: минимален suite за PR
- `@critical`: критични бизнес flow-ове
- `@products`: продуктови flow-ове
- `@cart`: cart flow-ове
- `@auth`: login/register/logout
- `@checkout`: checkout/payment flow
- `@catalog-mode-sensitive`: тестове, които трябва да се skip-нат при `CATALOG_MODE="true"`

### Example

```js
test('products listing loads @smoke @products', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByRole('heading')).toBeVisible();
});

test('cart quantity can be changed @critical @cart', async ({ page }) => {
  // ...
});
```

### E2E server startup

Playwright трябва да стартира root unified server чрез `npm run dev` или dedicated `npm run start:test`, не отделни Express и Next процеси. Root `server.js` mount-ва Express под `/api` и оставя Next.js да обслужва останалите routes на същия port.

Изисквания за test environment:

- `MONGO_URI` трябва да сочи към отделна test database; root `server.js` прекратява процеса, ако липсва
- `JWT_SECRET` трябва да е dummy test secret
- Stripe, GCS, email и delivery credentials не трябва да са production credentials
- checkout/payment тестовете трябва да използват Stripe test-mode/mocked flow или да бъдат извън smoke suite
- Playwright global setup трябва да seed-ва минимални продукти/потребители и да чисти test data след run

V1 вариант:

- локално E2E използва `.env.test` или CI secrets с test database
- външните услуги се избягват в `@smoke`
- пълните checkout/payment тестове остават в `@checkout` и изискват отделна test-mode конфигурация

### Authentication

Authenticated Playwright тестовете използват `storageState` pattern.

Решение:

- global setup login-ва owner/admin веднъж
- cookies/localStorage се записват в `e2e/.auth/owner.json`
- authenticated specs използват `test.use({ storageState: 'e2e/.auth/owner.json' })`
- DB seed за test products/categories остава отделен global setup step
- auth setup-ът е decoupled от data seed-а, за да не се логва всеки spec наново

### Regression Scenarios V1

Smoke suite:

- homepage loads
- products listing loads
- product details page loads
- search page returns controlled result or empty state
- cart page opens

Product regression:

- listing renders image, title, price and availability
- product details renders gallery/media area
- unavailable product cannot be ordered if that is current business behavior
- product create/edit owner flow, when test auth setup is available

Cart regression:

- add product to cart
- increase quantity
- decrease quantity
- remove product
- clear cart
- cart persists through reload via localStorage

Auth regression:

- register validation errors
- login success
- logout clears authenticated UI state
- protected create/edit pages redirect or block unauthenticated user

Checkout regression:

- shipping form validation
- delivery office lookup with mocked/stubbed API where possible
- order submit happy path if `CATALOG_MODE` is not active
- checkout tests are skipped when catalog mode is active

Admin/owner regression:

- create category
- edit category
- create product
- edit product
- delete product

---

## CI Strategy

### Tier 1: Fast checks

Runs on every push and PR:

- frontend lint
- backend unit tests with coverage threshold enforcement
- frontend unit tests with coverage threshold enforcement
- fail if `server/` or `happy-colors-nextjs-project/` drops below the configured coverage thresholds

Target: under 60 seconds after dependencies are installed.

### Tier 2: Integration and components

Runs on every PR:

- backend integration tests with `mongodb-memory-server`
- Next.js API route tests
- frontend component tests
- root build if the PR touches app/server integration boundaries

Target: under 3 minutes.

### Tier 3: E2E smoke

Runs on PRs to main/release branches:

- `npm run test:e2e:smoke`
- Playwright trace retained on failure

Target: under 5 minutes.

### Tier 4: Full regression

Runs:

- nightly
- before release
- manually on demand

Command:

```powershell
npm run test:e2e
```

---

## Migration Plan

### Phase 1: Foundation and pure unit tests

Deliverables:

- install Vitest in `server/`
- install Vitest in `happy-colors-nextjs-project/`
- install `@vitest/coverage-v8` in both packages
- install `cross-env` where `test:ci` scripts need Windows-friendly env variables
- add package scripts
- add `vitest.config.js` files
- add first tests for pure functions

Initial candidates:

- `server/utils/slugify.js`
- `server/utils/isOwner.js`
- `server/middlewares/paymentValidations.js`
- `server/middlewares/rateLimit.js`
- `server/middlewares/auth.js` с mocked JWT
- `server/helpers/productVideoHelper.js`
- `server/helpers/gcsImageHelper.js`
- `happy-colors-nextjs-project/src/utils/normalizeImageUrls.js`
- `happy-colors-nextjs-project/src/utils/catalogMode.js`
- `happy-colors-nextjs-project/src/utils/formValidations.js`
- `happy-colors-nextjs-project/src/utils/errorHandler.js`
- `happy-colors-nextjs-project/src/utils/checkProductAccess.js`
- `happy-colors-nextjs-project/src/utils/formSubmitHelper.js`
- `happy-colors-nextjs-project/src/utils/productSeo.js`
- `happy-colors-nextjs-project/src/utils/videoMetadata.js`
- `happy-colors-nextjs-project/src/hooks/useForm.js`
- `happy-colors-nextjs-project/src/helpers/checkoutHelpers.js`
- `happy-colors-nextjs-project/src/app/api/_lib/uploadDeleteToken.js`
- `happy-colors-nextjs-project/src/app/api/_lib/uploadValidation.js`

Acceptance:

- `npm run test:server:unit` passes
- `npm run test:frontend:unit` passes

### Phase 2: Backend integration tests

Deliverables:

- install `supertest`
- install `mongodb-memory-server`
- add integration setup/teardown
- test route contracts for products, categories, users, search, contacts, orders, payments and delivery
- explicitly cover `CheckoutDraft` lifecycle where checkout/order flows depend on it
- test Stripe webhook only with raw body + valid signature setup, or mark webhook integration as deferred until Stripe test-mode strategy is ready
- mock Stripe, GCS, email and delivery carrier boundaries
- reset or mock rate limiter state between route tests

Acceptance:

- `npm run test:server:integration` passes without external services

### Phase 3: Frontend component and Next.js API route tests

Deliverables:

- install React Testing Library dependencies
- install MSW for frontend HTTP mocking
- add component setup file
- mock `next/navigation`, managers and browser APIs where needed
- add tests for UI, cart, header and product components
- add tests for client components that live in `src/app/`, including auth, checkout, categories and contacts
- add `api` Vitest project for `src/app/api/` route handlers
- mock GCS, Mongo, delivery carrier APIs and `next/cache` revalidation calls for API route tests

Acceptance:

- `npm run test:frontend:components` passes
- `npm run test:frontend:api` passes

### Phase 4: Playwright smoke regression

Deliverables:

- install Playwright at root
- add `e2e/playwright.config.js`
- add smoke tests
- configure Playwright to start the root unified `server.js` on one port
- document `.env.test` requirements for `MONGO_URI`, `JWT_SECRET`, catalog mode and dummy external service credentials
- add `e2e/.auth/` to `.gitignore`, because Playwright `storageState` files contain authenticated cookies/localStorage
- add trace/screenshot artifacts on failure

Acceptance:

- `npm run test:e2e:smoke` passes locally

### Phase 5: Full regression suite

Deliverables:

- add auth, cart, products, checkout and owner/admin flows
- tag all tests
- add skip/guard behavior for catalog mode
- document local commands in README or QA checklist

Acceptance:

- `npm run test:all` passes before release

---

## Risks and Mitigations

### Risk: ESM mocking differences

Vitest mocking is not identical to Jest. Tests must use `vi.mock()` and avoid Jest-specific patterns.

Mitigation:

- add examples in first tests
- keep external dependency mocks at clear module boundaries

### Risk: Next.js App Router server components

React Testing Library should focus on client components. Server components and route-level rendering should be covered through Playwright or narrower utility tests.

Mitigation:

- component tests target files with `'use client'`
- page-level behavior is covered by e2e smoke/regression tests

### Risk: Real external services accidentally used in tests

Stripe, GCS, email and delivery carrier APIs should never be called in automated unit/component/integration tests.

Mitigation:

- mock service/client modules
- use dummy `.env.test`
- fail fast if required test env variables are missing

### Risk: Rate limiter state creates flaky integration tests

`server/middlewares/rateLimit.js` stores request counters in module-level memory. Reusing one Express app instance across tests can leak state and produce unexpected 429 responses.

Mitigation:

- expose a test-only reset helper, or
- mock the rate limiter middleware in route tests that do not specifically test rate limiting, and
- keep dedicated unit tests for the limiter behavior itself

### Risk: Stripe webhook tests need raw bodies

`/payments/webhook` uses `express.raw()` before `express.json()`. Normal JSON `supertest` calls are not enough for this endpoint.

Mitigation:

- webhook integration tests must send raw request bodies and valid Stripe test signatures
- if this setup is not ready in Phase 2, webhook coverage is explicitly deferred to a Stripe-specific test phase

### Risk: Express 5 async error behavior differs from Express 4

Express 5 catches rejected async route handlers automatically. Error-path route tests should assert the actual Express 5 behavior instead of adding legacy `express-async-errors` assumptions.

Mitigation:

- include service-layer rejection tests for representative routes
- keep error response shape assertions close to controller integration tests

### Risk: E2E suite becomes too slow

Full browser regression can become expensive.

Mitigation:

- keep `@smoke` minimal
- use tags and file-level ownership
- run full e2e nightly or before release, not on every local change

### Risk: Test data becomes brittle

Hardcoded shared fixtures can create hidden coupling.

Mitigation:

- use factory functions
- reset DB/browser state between tests
- keep e2e setup explicit per scenario

### Risk: ESLint does not know Vitest globals

Test files use globals such as `vi`, `describe`, `it`, `expect`, `beforeEach` and `afterEach`. Without an ESLint override, these can produce `no-undef` warnings.

Mitigation:

- update `eslint.config.mjs` with an override for `**/__tests__/**/*.{js,jsx}` and Vitest globals, or
- import the needed APIs explicitly from `vitest` in every test file

Example direction:

```js
import globals from 'globals';

{
  files: ['**/__tests__/**/*.{js,jsx}'],
  languageOptions: {
    globals: {
      ...globals.node,
      vi: 'readonly',
      describe: 'readonly',
      it: 'readonly',
      expect: 'readonly',
      beforeEach: 'readonly',
      afterEach: 'readonly',
      beforeAll: 'readonly',
      afterAll: 'readonly',
    },
  },
}
```

Алтернатива е `eslint-plugin-vitest`, ако искаме plugin-managed globals и Vitest-specific lint rules.

### Accessibility (deferred)

V1 does not include automated accessibility testing. This is not a blocker for the 80% coverage requirement, because axe-style checks validate accessibility behavior rather than code coverage.

V2 recommendation:

- add `@axe-core/playwright` for e2e accessibility checks, or `jest-axe` for component tests
- cover core navigational and form pages first: homepage, products, product details, cart, login/register and checkout
- keep accessibility checks as a separate CI signal from unit/component coverage

---

## Acceptance Criteria

Тестовата архитектура се счита за въведена, когато:

- root package има команди за server, frontend, e2e и full test run
- backend има unit и integration Vitest projects
- frontend има unit и component Vitest projects
- Next.js API routes имат отделен Vitest project или explicit deferred exceptions
- `server/` достига 80% lines/functions/statements и 75% branches
- `happy-colors-nextjs-project/` достига 80% lines/functions/statements и 75% branches
- CI Tier 1 fail-ва при coverage drop под threshold-а
- Playwright има smoke suite с тагове
- поне един реален тест съществува във всяка основна зона
- test data factories са налични за backend и frontend
- external services са mock-нати в automated tests
- има documented focused run commands
- `npm run test:all` е валидната release/pre-merge команда

---

## Open Decisions

1. CI provider: препоръчителният default е GitHub Actions, защото проектът вече е GitHub-oriented и Actions е стандартният low-friction вариант. Не блокира Phase 1, но трябва да се затвори преди Phase 4 acceptance.
2. Дали component environment остава `jsdom`, или след първия suite се измерва `happy-dom`.
3. Дали checkout e2e flow ще използва пълен mocked payment flow или ще остане smoke-level до отделна Stripe test strategy.
4. Дали E2E test database ще бъде локална MongoDB, Atlas test database или Playwright global setup с temporary database.
5. Stripe webhook integration: препоръката е separate Stripe-focused phase. Stripe test-mode setup е отделен effort и не трябва да блокира основните integration тестове във Phase 2.

Тези решения не блокират Phase 1. Те трябва да се затворят преди Phase 4.
