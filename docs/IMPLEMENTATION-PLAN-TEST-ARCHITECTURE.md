# Happy Colors - Test Architecture Implementation Plan

**Дата:** 2026-04-24
**Статус:** Reviewed by Opus - bugs + gaps отразени
**Свързан дизайн документ:** `docs/DESIGN-DOC-TEST-ARCHITECTURE.md`
**Цел:** Да въведем тестовата архитектура по малки, проверими фази, без да блокираме ежедневната разработка и без да включваме външни услуги в automated tests.

---

## Изпълнителен принцип

Дизайн документът описва крайната архитектура. Този план описва реда на имплементация.

Работим на малки локални commit-и:

1. infrastructure first
2. първи passing tests във всяка зона
3. coverage reporting
4. coverage gating
5. component/API/integration/e2e expansion

Не се опитваме да достигнем пълните 80% coverage в първия commit. Първо създаваме работеща инфраструктура, после качваме покритието фазово до target-а.

---

## Phase 0 - Baseline и безопасност

### Цел

Да имаме ясна начална точка и да не смесим тестовата инфраструктура с unrelated промени.

### Задачи

- Проверка на git status.
- Потвърждение, че `docs/DESIGN-DOC-TEST-ARCHITECTURE.md` е наличен.
- Проверка на текущите package scripts:
  - root `package.json`
  - `server/package.json`
  - `happy-colors-nextjs-project/package.json`
- Проверка на текущия frontend alias в `happy-colors-nextjs-project/jsconfig.json`.
- Проверка на текущия ESLint flat config.

### Команди

```powershell
git status --short
Get-Content package.json -Raw
Get-Content server\package.json -Raw
Get-Content happy-colors-nextjs-project\package.json -Raw
Get-Content happy-colors-nextjs-project\jsconfig.json -Raw
Get-Content happy-colors-nextjs-project\eslint.config.mjs -Raw
```

### Acceptance

- Няма unrelated changes, които да се смесват с тестовия план.
- Ако има unrelated changes, те се оставят недокоснати.

### Commit

Няма commit, освен ако не се открие нужна документационна поправка.

---

## Phase 1 - Vitest foundation и първи unit tests

### Цел

Да заработят fast local unit тестове за backend и frontend, без React component setup, без MongoDB и без Playwright.

### Dependencies

В `server/`:

```powershell
npm install --save-dev vitest@^2.0.0 @vitest/coverage-v8@^2.0.0 cross-env
```

В `happy-colors-nextjs-project/`:

```powershell
npm install --save-dev vitest@^2.0.0 @vitest/coverage-v8@^2.0.0 cross-env
```

### Файлове за създаване

Backend:

- `server/vitest.config.js`
- `server/__tests__/unit/utils/slugify.test.js`
- `server/__tests__/unit/utils/isOwner.test.js`
- `server/__tests__/unit/helpers/productVideoHelper.test.js`
- `server/__tests__/unit/helpers/gcsImageHelper.test.js`

Frontend:

- `happy-colors-nextjs-project/vitest.config.js`
- `happy-colors-nextjs-project/__tests__/unit/utils/normalizeImageUrls.test.js`
- `happy-colors-nextjs-project/__tests__/unit/utils/catalogMode.test.js`
- `happy-colors-nextjs-project/__tests__/unit/utils/productSeo.test.js`
- `happy-colors-nextjs-project/__tests__/unit/helpers/checkoutHelpers.test.js`
- `happy-colors-nextjs-project/__tests__/unit-jsdom/utils/`
- `happy-colors-nextjs-project/__tests__/unit-jsdom/hooks/`

Frontend Vitest projects:

- `unit`: node environment за pure utilities и helpers
- `unit-jsdom`: jsdom environment за DOM-touching utilities и hooks, без пълен component provider setup
- `components`: jsdom + React Testing Library setup
- `api`: node environment за Next.js API route handlers

### Package scripts

Root:

```json
{
  "test": "npm run test:server && npm run test:frontend",
  "test:server": "cd server && npm test",
  "test:server:unit": "cd server && npm run test:unit",
  "test:server:ci": "cd server && npm run test:ci",
  "test:frontend": "cd happy-colors-nextjs-project && npm test",
  "test:frontend:unit": "cd happy-colors-nextjs-project && npm run test:unit",
  "test:frontend:unit-jsdom": "cd happy-colors-nextjs-project && npm run test:unit-jsdom",
  "test:frontend:ci": "cd happy-colors-nextjs-project && npm run test:ci",
  "test:ci": "npm run test:server:ci && npm run test:frontend:ci"
}
```

Backend:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ci": "cross-env CI_COVERAGE=true vitest run --coverage",
  "test:unit": "vitest run --project unit"
}
```

Frontend:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ci": "cross-env CI_COVERAGE=true vitest run --coverage",
  "test:unit": "vitest run --project unit",
  "test:unit-jsdom": "vitest run --project unit-jsdom"
}
```

### Coverage config

Добавя се coverage block с:

- provider: `v8`
- `all: true`, така че untouched source файловете да влизат в denominator-а
- reporters: `text`, `html`, `lcov`
- thresholds only when `CI_COVERAGE === "true"`
- excludes според design doc-а

### Acceptance

```powershell
cd server
npm run test:unit
npm run test:coverage

cd ..\happy-colors-nextjs-project
npm run test:unit
npm run test:unit-jsdom
npm run test:coverage
```

`npm run test:ci` може да fail-ва в началото, ако coverage още е под target-а. Това е очаквано, докато Phase 1B/1C/4 не добавят достатъчно unit и integration coverage.

### Commit

```text
Add Vitest unit test foundation
```

---

## Phase 1B - Coverage threshold ramp до 80%

### Цел

Да вдигнем Vitest coverage максимално рано, без да твърдим, че само unit тестовете ще стигнат глобалния 80% threshold. Понеже използваме `coverage.all: true`, всички untouched source файлове влизат в denominator-а; реалният hard gate се включва след Phase 4, когато integration тестовете допълнят coverage-а за controllers/services.

### Задачи

Backend unit coverage:

- `server/middlewares/paymentValidations.js`
- `server/middlewares/rateLimit.js`
- `server/middlewares/auth.js`
- `server/helpers/productVideoHelper.js`
- `server/helpers/gcsImageHelper.js`
- `server/utils/slugify.js`
- `server/utils/isOwner.js`

Frontend unit coverage:

- `src/utils/errorHandler.js`
- `src/utils/checkProductAccess.js`
- `src/utils/formSubmitHelper.js`
- `src/utils/productSeo.js`
- `src/app/api/_lib/uploadDeleteToken.js`
- `src/app/api/_lib/uploadValidation.js`

Frontend unit-jsdom coverage:

- `src/utils/videoMetadata.js`
- `src/hooks/useForm.js`

### Middleware testing helper

Създава се shared helper:

- `server/__tests__/unit/_helpers/httpMocks.js`

Съдържа:

- `buildReq(overrides)`
- `buildRes()`
- `buildNext()`

### Acceptance

```powershell
npm run test:server:ci
npm run test:frontend:ci
```

Тези команди се пускат като diagnostic gate. Ако още fail-ват заради `coverage.all: true`, Phase 1B завършва с explicit coverage gap list, а hard CI gating се активира след Phase 4. Крайната цел остава:

- 80% lines
- 75% branches
- 80% functions
- 80% statements

`unit-jsdom` тестовете също трябва да минават и да се включват във frontend combined coverage-а.

### Commit

```text
Increase unit coverage and document coverage gaps
```

---

## Phase 1C - Coverage backfill checkpoint

### Цел

Да направим честна проверка на глобалния coverage denominator след първите unit тестове. С `coverage.all: true` е вероятно backend controllers/services да дърпат процента надолу, докато не дойдат integration тестовете във Phase 4.

### Задачи

- Пускане на `npm run test:coverage` в `server/` и frontend app-а.
- Идентифициране на най-големите uncovered zones.
- Решение дали даден uncovered файл трябва да получи unit тест веднага, или ще бъде покрит от integration/API/component тестове в следващите фази.
- Създаване на кратък coverage gap list в PR/commit message или в локална checklist бележка.

### Acceptance

- Има ясен списък кои файлове още дърпат coverage под threshold.
- Няма включен hard CI gate, ако coverage не може реалистично да мине преди Phase 4.
- Hard gate се включва веднъж след Phase 4, когато `server/` и `happy-colors-nextjs-project/` могат реалистично да покрият 80/75/80/80.

### Commit

```text
Document coverage backfill targets
```

---

## Phase 2 - Frontend component test foundation

### Цел

Да заработят React component tests с общ wrapper, router mock и predictable provider state.

### Dependencies

В `happy-colors-nextjs-project/`:

```powershell
npm install --save-dev @vitejs/plugin-react@^4.0.0 @testing-library/react@^16.0.0 @testing-library/jest-dom@^6.0.0 jsdom@^25.0.0 msw@^2.0.0
```

### Файлове за създаване

- `happy-colors-nextjs-project/__tests__/components/setup.js`
- `happy-colors-nextjs-project/__tests__/components/test-utils.jsx`
- `happy-colors-nextjs-project/__tests__/components/ui/MessageBox.test.jsx`
- `happy-colors-nextjs-project/__tests__/components/cart/CartItem.test.jsx`
- `happy-colors-nextjs-project/__tests__/components/products/ProductCard.test.jsx`

### Setup requirements

`setup.js`:

- import-ва `@testing-library/jest-dom/vitest`
- mock-ва `next/navigation`
- export-ва `setMockRouter`
- reset-ва mocks в `beforeEach`

`test-utils.jsx`:

- export-ва custom `render`
- wrap-ва Auth/Cart providers where possible
- приема `user`, `cartItems`, `authOverrides`, `cartOverrides`, `routerOverrides`, `mockRouterPush`
- re-export-ва Testing Library helpers

MSW:

- да се добави само ако първите component тестове имат нужда от HTTP mocking
- ако първите тестове са purely presentational, MSW setup може да се добави в следващ commit в същата фаза

### Package scripts

Frontend:

```json
{
  "test:components": "vitest run --project components"
}
```

Root:

```json
{
  "test:frontend:components": "cd happy-colors-nextjs-project && npm run test:components"
}
```

### Acceptance

```powershell
cd happy-colors-nextjs-project
npm run test:components
npm run test:ci
```

### Commit

```text
Add frontend component test foundation
```

---

## Phase 3 - Next.js API route tests

### Цел

Да покрием server-side API layer-а в Next.js, който не се покрива от Express integration тестовете.

### Файлове за създаване

- `happy-colors-nextjs-project/__tests__/api/setup.js`
- `happy-colors-nextjs-project/__tests__/api/uploads/sign.test.js`
- `happy-colors-nextjs-project/__tests__/api/uploads/delete.test.js`
- `happy-colors-nextjs-project/__tests__/api/offices/econt.test.js`
- `happy-colors-nextjs-project/__tests__/api/offices/speedy.test.js`
- `happy-colors-nextjs-project/__tests__/api/revalidate/products.test.js`

### Mock boundaries

- GCS helpers
- Mongo helper
- auth helper
- Econt/Speedy external APIs
- `next/cache` revalidation APIs

### Package scripts

Frontend:

```json
{
  "test:api": "vitest run --project api"
}
```

Root:

```json
{
  "test:frontend:api": "cd happy-colors-nextjs-project && npm run test:api"
}
```

### Acceptance

```powershell
cd happy-colors-nextjs-project
npm run test:api
npm run test:ci
```

### Commit

```text
Add Next API route tests
```

---

## Phase 4 - Backend integration tests

### Цел

Да тестваме Express route contracts с `supertest` и in-memory MongoDB, без реални Stripe/GCS/email/delivery calls.

### Dependencies

В `server/`:

```powershell
npm install --save-dev supertest@^7.0.0 mongodb-memory-server@^10.0.0
```

### Файлове за създаване

- `server/__tests__/integration/setup.js`
- `server/__tests__/integration/factories.js`
- `server/__tests__/integration/products.test.js`
- `server/__tests__/integration/categories.test.js`
- `server/__tests__/integration/users.test.js`
- `server/__tests__/integration/search.test.js`
- `server/__tests__/integration/contacts.test.js`
- `server/__tests__/integration/orders.test.js`

### Deferred или отделна mini-phase

- `paymentsController.js`
- Stripe webhook raw body/signature tests
- full delivery carrier behavior

Причина: Stripe и delivery test-mode setup са отделен effort и не трябва да блокират основните route contracts.

### Setup requirements

- `mongodb-memory-server` lifecycle
- Mongoose connect/disconnect
- `beforeEach` cleanup на collections
- rate limiter reset или middleware mock
- Stripe/GCS/email mocks
- factories:
  - `buildUser`
  - `buildCategory`
  - `buildProduct`
  - `buildOrder`
  - `buildCheckoutDraft`

### Package scripts

Backend:

```json
{
  "test:integration": "vitest run --project integration"
}
```

Root:

```json
{
  "test:server:integration": "cd server && npm run test:integration"
}
```

### Acceptance

```powershell
cd server
npm run test:integration
npm run test:ci
```

### Commit

```text
Add backend integration tests
```

---

## Phase 5 - Playwright smoke regression

### Цел

Да имаме реален browser smoke suite, който проверява най-важните user journeys през unified server.

### Dependencies

Root:

```powershell
npm install --save-dev @playwright/test@^1.45.0 dotenv@^16.0.0
npx playwright install
```

### Файлове за създаване

- `e2e/playwright.config.js`
- `e2e/global-setup.js`
- `e2e/tests/smoke.spec.js`
- `e2e/tests/products.spec.js`
- `e2e/tests/cart.spec.js`
- `.env.test.example` като версиониран template без секрети
- локален `.env.test`, който остава gitignored
- root `.gitignore` entry за `.env.test`
- root `.gitignore` entry за `e2e/.auth/`

### Package scripts

Root:

```json
{
  "test:e2e": "npx playwright test",
  "test:e2e:smoke": "npx playwright test --grep \"@smoke\"",
  "test:e2e:ui": "npx playwright test --ui",
  "test:all": "npm run test:ci && npm run test:e2e:smoke"
}
```

### Server strategy

Playwright стартира root unified server:

```powershell
npm run dev
```

или dedicated:

```powershell
npm run start:test
```

ако се добави такъв script.

### Environment

Необходима е test environment конфигурация:

- `MONGO_URI` към test database
- `JWT_SECRET` test secret
- dummy или test-mode Stripe values
- dummy GCS values или routes, които не trigger-ват GCS в smoke
- `CATALOG_MODE` ясно зададен

### Loading

`e2e/global-setup.js` зарежда `.env.test` чрез `dotenv.config({ path: '.env.test' })` като първа операция. Ако Playwright `webServer` се използва вместо manual server startup в global setup-а, `playwright.config.js` трябва също да зареди `.env.test` преди `webServer.command`, за да наследи server процесът правилните env vars. Root `server.js` остава environment-agnostic и production env loading-ът не се променя.

`.env.test.example` се commit-ва като template без секрети. Реалният `.env.test` остава локален/CI secret и не трябва да влиза в git.

### Auth strategy

- global setup login-ва owner/admin
- записва `e2e/.auth/owner.json`
- authenticated tests използват `storageState`
- `e2e/.auth/` е gitignored

### Smoke scenarios

Всички smoke сценарии са catalog-mode-agnostic; не изискват `@catalog-mode-sensitive` skip behavior.

- homepage loads `@smoke`
- products listing loads `@smoke @products`
- product details loads `@smoke @products`
- search page handles query or empty state `@smoke @search`
- cart page opens `@smoke @cart`

### Acceptance

```powershell
npm run test:e2e:smoke
npm run test:all
```

Проверка: test environment не зарежда production `.env`.

### Commit

```text
Add Playwright smoke regression suite
```

---

## Phase 6 - CI workflow

### Цел

Да добавим автоматична проверка за PR/push, без да правим full e2e suite задължителен за всяка малка промяна.

### Default provider

Препоръчителен default: GitHub Actions.

### Workflow tiers

Tier 1:

- install dependencies
- frontend lint
- `npm run test:ci`

Tier 2:

- `npm run test:server:integration`
- `npm run test:frontend:components`
- `npm run test:frontend:api`
- `npm run build`

Tier 3:

- `npm run test:e2e:smoke`
- trace/screenshot artifacts on failure

Tier 4 (nightly):

- `npm run test:e2e`
- schedule trigger: cron `0 2 * * *` (2 AM UTC)
- same trace/screenshot artifacts on failure
- notification channel или GitHub issue auto-create остава V2

### Файлове

- `.github/workflows/test.yml`

Workflow trigger-и:

- `on: pull_request`: Tiers 1 и 2
- `on: push` към `main`: Tiers 1, 2 и 3
- `on: schedule` с cron `0 2 * * *`: Tier 4

### Acceptance

- CI fail-ва при coverage drop под threshold.
- CI fail-ва при failing unit/component/API/integration tests.
- E2E smoke artifacts се пазят при failure.
- Tier 4 cron job е enabled в GitHub Actions UI след първи successful nightly run.

### Commit

```text
Add CI test workflow
```

---

## Phase 7 - Full regression expansion

### Цел

Да разширим Playwright suite-а от smoke към критични regression сценарии.

### Scenarios

Auth:

- register validation
- login success
- logout
- protected page redirects

Cart:

- add to cart
- increase/decrease quantity
- remove product
- cart persists after reload

Products:

- product listing filters/search
- product details media rendering
- owner create/edit/delete flow

Checkout:

- shipping validation
- delivery office lookup with mocked carrier behavior
- order submit happy path, когато test-mode strategy е готова

Admin/owner:

- create/edit category
- create/edit/delete product

### Acceptance

```powershell
npm run test:e2e
```

### Commit

```text
Expand Playwright regression coverage
```

---

## Explicit Deferred Work

Тези неща не блокират Phase 1:

- Stripe webhook raw body/signature full coverage
- Stripe payment end-to-end test-mode strategy
- full delivery carrier integration tests
- accessibility automation с `@axe-core/playwright` или `jest-axe`
- Playwright code coverage instrumentation
- full CI matrix across multiple OS/browser combinations

---

## Recommended First Implementation Slice

Първият реален implementation slice трябва да е само:

1. `server` Vitest install/config/scripts
2. frontend Vitest install/config/scripts
3. 2-3 backend pure unit tests
4. 2-3 frontend pure unit tests
5. coverage report без enforced threshold
6. локален commit

Това ще докаже, че test runner-ите работят в Windows repo-то, преди да добавяме React, MongoDB и Playwright complexity.

---

## Phase Completion Checklist

Преди да се счита фаза за приключена:

- релевантните tests минават локално
- `npm run test:ci` минава, след като coverage threshold-ът е включен като gate
- няма реални calls към Stripe, GCS, email, Econt или Speedy
- няма secrets в repo-то
- нови auth state файлове като `e2e/.auth/` са gitignored
- git status е чист след локален commit
