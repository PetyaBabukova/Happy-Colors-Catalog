# Happy Colors - Test Architecture Implementation Plan

**Дата:** 2026-05-08
**Статус:** Updated after coverage backfill - hard local coverage gate passing, CI workflow deferred
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

### Current implementation status

Completed locally:

- Phase 0 - baseline inspection
- Phase 1 - Vitest foundation and first unit tests
- Phase 1B - unit coverage ramp and documented coverage gaps
- Phase 1C - folded into Phase 1B as explicit coverage gap documentation
- Phase 2 - frontend component test foundation
- Phase 3 - Next.js API route tests
- Phase 4 - backend integration tests
- Phase 5 - Playwright smoke regression, including Opus-reviewed hardening

Explicitly deferred for now:

- Phase 6 - CI workflow

Next active work:

1. full Playwright regression expansion
2. business-critical deferred test areas where feasible without real external service calls
3. CI workflow only after project decision re-enables it

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

Phase 1 adds the Vitest-focused root scripts. E2E scripts are added later in Phase 5.

```json
{
  "test": "npm run test:server && npm run test:frontend",
  "test:server": "cd server && npm test",
  "test:server:unit": "cd server && npm run test:unit",
  "test:server:coverage": "cd server && npm run test:coverage",
  "test:server:ci": "cd server && npm run test:ci",
  "test:frontend": "cd happy-colors-nextjs-project && npm test",
  "test:frontend:unit": "cd happy-colors-nextjs-project && npm run test:unit",
  "test:frontend:unit-jsdom": "cd happy-colors-nextjs-project && npm run test:unit-jsdom",
  "test:frontend:coverage": "cd happy-colors-nextjs-project && npm run test:coverage",
  "test:frontend:ci": "cd happy-colors-nextjs-project && npm run test:ci",
  "test:coverage": "npm run test:server:coverage && npm run test:frontend:coverage",
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

Current state after later coverage backfill: `npm run test:ci` is expected to pass with the 80/75/80/80 thresholds enabled for both server and frontend.

Use `npm run test:coverage` when the goal is to inspect the HTML/text coverage report during local work. Use `npm run test:ci` when the goal is to enforce the configured thresholds and get the same hard local gate that Phase 6 will eventually wire into CI.

### Commit

```text
Add Vitest unit test foundation
```

---

## Phase 1B - Coverage threshold ramp до 80%

Status: completed as coverage ramp plus gap documentation. Later coverage backfill raised both server and frontend above the 80/75/80/80 threshold, so `test:ci` is now the hard local coverage gate.

Traceability: the final local gate was reached by the frontend coverage boundary work in `92b699e` and the server coverage/GCS hardening work in `6cd0760`, after the earlier component and server payment coverage commits.

### Цел

Да вдигнем Vitest coverage максимално рано, без да твърдим, че само unit тестовете ще стигнат глобалния 80% threshold. Понеже използваме `coverage.all: true`, всички untouched source файлове влизат в denominator-а. Реалният hard gate вече е включен локално след последващия coverage backfill.

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

Phase 1B разшири `videoMetadata` тестовете отвъд walking skeleton-а:

- `loadedmetadata` event resolve-ва с duration
- timeout path reject-ва с timeout error
- video error event reject-ва с error
- cleanup маха listeners/src и revoke-ва object URL
- settled guard не позволява double resolve/reject

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

Тези команди вече са hard local gate след последващия coverage backfill. Phase 1B завърши с explicit coverage gap list, а по-късните server/frontend backfill commits вдигнаха числата до target-а:

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

Status: completed. The explicit coverage gap documents (`docs/TEST-COVERAGE-GAPS-PHASE-1B.md` and later `docs/TEST-COVERAGE-GAPS-PHASE-4.md`) were the checkpoint output; later targeted backfill raised both server and frontend above the configured threshold.

### Цел

Да направим честна проверка на глобалния coverage denominator след първите unit тестове. С `coverage.all: true` е вероятно backend controllers/services да дърпат процента надолу, докато не дойдат integration тестовете във Phase 4.

### Historical output

- Coverage reports were run in `server/` and the frontend app.
- Най-големите uncovered zones бяха документирани в coverage gap docs.
- Част от uncovered зоните бяха покрити от Phase 4 integration tests; последващите targeted backfill commits довършиха локалния coverage gate.

### Acceptance

- Има исторически списък кои файлове дърпаха coverage под threshold преди targeted backfill-а.
- `npm run test:ci` минава локално с включени coverage thresholds; verified on 2026-05-08 after `6cd0760`.
- CI workflow остава deferred като отделно project decision, не заради coverage deficit.

### Commit

```text
Document coverage backfill targets
```

---

## Phase 2 - Frontend component test foundation

Status: completed.

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

- installed as part of the component-test dependency set
- not used by the initial presentational component tests
- remains available for future component tests that need HTTP-layer mocking

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

Status: completed.

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

Status: completed.

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
npm install --save-dev @playwright/test@^1.45.0
npx playwright install
```

Implementation note: `dotenv` remains a root production dependency because `server.js` imports it at runtime. Playwright itself is the dev dependency.

### Файлове за създаване

- `e2e/playwright.config.js`
- `e2e/global-setup.js`
- `e2e/tests/smoke.spec.js`
- `e2e/tests/products.spec.js`
- `e2e/tests/cart.spec.js`
- `e2e/tests/auth.spec.js`
- `.env.test.example` като версиониран template без секрети
- локален `.env.test`, който остава gitignored
- root `.gitignore` entry за `.env.test`
- root `.gitignore` entry за `e2e/.auth/`

### Package scripts

Root:

```json
{
  "test:e2e": "npx playwright test --config=e2e/playwright.config.js",
  "test:e2e:smoke": "npx playwright test --config=e2e/playwright.config.js --grep \"@smoke\"",
  "test:e2e:ui": "npx playwright test --config=e2e/playwright.config.js --ui",
  "test:all": "npm run test:ci && npm run test:e2e:smoke"
}
```

`test:all` uses the hard local Vitest coverage gate before the Playwright smoke run. Developers can still use `npm test` for a faster non-coverage loop during local iteration.

### Server strategy

Playwright стартира root unified server чрез `webServer.command`:

```powershell
npm run dev
```

`playwright.config.js` зарежда `.env.test` и подава test env vars към server процеса. `reuseExistingServer` остава `false`, за да не се използва случайно стар dev server с друга база.

### Environment

Необходима е test environment конфигурация:

- `MONGO_URI` към test database
- `JWT_SECRET` test secret
- dummy или test-mode Stripe values
- dummy GCS values или routes, които не trigger-ват GCS в smoke
- `CATALOG_MODE` ясно зададен
- `NEXT_PUBLIC_CATALOG_MODE` ясно зададен за frontend catalog-mode логиката

### Loading

`e2e/global-setup.js` зарежда `.env.test` чрез `dotenv.config({ path: '.env.test' })`. `playwright.config.js` също зарежда `.env.test` преди `webServer.command` и подава env vars към server процеса. Root `server.js` остава environment-agnostic и production env loading-ът не се променя.

`.env.test.example` се commit-ва като template без секрети. Реалният `.env.test` остава локален/CI secret и не трябва да влиза в git.

### Auth strategy

- global setup seeds deterministic owner/category/product documents
- owner/category/product use fixed ObjectIds to avoid stale cached product links across repeated e2e runs
- global setup writes `e2e/.auth/owner.json`
- authenticated tests използват `storageState`
- `e2e/.auth/` е gitignored
- auth token TTL is 4 hours to avoid debug/slow-run expiry flakes
- token signing is local HS256 test scaffolding in `e2e/global-setup.js` and must stay in sync with the app auth token contract

### E2E hardening decisions

- `reuseExistingServer` stays `false`, so Playwright always starts the test server with `.env.test` instead of accidentally reusing a dev server connected to another database.
- The test DB guard only allows non-test database names when `E2E_ALLOW_NON_TEST_DB=yes-i-know-this-can-delete-data`.
- The smoke cart test exercises a real add-to-cart flow in non-catalog mode and verifies the seeded product appears in the cart.
- The add-to-cart action uses `data-testid="add-to-cart-button"` to avoid order-based button selectors.

### Smoke scenarios

Smoke scenarios are catalog-mode-aware and do not use `@catalog-mode-sensitive` skip behavior. The cart smoke branches explicitly based on catalog mode.

- homepage loads `@smoke`
- products listing loads `@smoke @products`
- product details loads `@smoke @products`
- search page handles query or empty state `@smoke @search`
- cart flow loads or redirects safely; in non-catalog mode it adds the seeded product to the cart and verifies it appears there `@smoke @cart`

Additional Phase 5 critical check:

- seeded owner auth state works through `/api/users/me` `@critical @auth`

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

Status: deferred for now by project decision. Do not start this phase until CI is explicitly re-enabled.

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

- When Phase 6 is implemented, Tier 1 must run `npm run test:ci` with the existing 80/75/80/80 thresholds.
- Coverage failure behavior is already active locally through `test:ci`; Phase 6 only wires that existing gate into GitHub Actions.
- CI fail-ва при failing unit/component/API/integration tests.
- E2E smoke artifacts се пазят при failure.
- Tier 4 cron job е enabled в GitHub Actions UI след първи successful nightly run.

### Commit

```text
Add CI test workflow
```

---

## Phase 7 - Full regression expansion

Status: in progress. Initial critical regression slice completed for auth, cart, and owner product controls.

### Цел

Да разширим Playwright suite-а от smoke към критични regression сценарии.

### Scenarios

Auth:

- register validation
- login success - completed
- invalid login rejection - completed
- logout clears browser/API session - completed
- protected page redirects

Cart:

- add to cart is covered by smoke; expand with edge cases
- increase/decrease quantity - completed
- remove product - completed
- cart persists after reload - completed

Products:

- product listing filters/search
- product details media rendering
- owner edit/delete controls visible for owned seeded product - completed
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

Тези неща не блокират current coverage/regression work:

- Stripe webhook raw body/signature full coverage
- Stripe payment end-to-end test-mode strategy
- full delivery carrier integration tests
- accessibility automation с `@axe-core/playwright` или `jest-axe`
- Playwright code coverage instrumentation
- full CI matrix across multiple OS/browser combinations

---

## Historical First Implementation Slice

Този slice вече е изпълнен в Phase 1. Той доказа, че Vitest runner-ите работят в Windows repo-то, преди да добавим React, MongoDB и Playwright complexity.

---

## Phase Completion Checklist

Преди да се счита фаза за приключена:

- релевантните tests минават локално
- няма реални calls към Stripe, GCS, email, Econt или Speedy
- няма secrets в repo-то
- нови auth state файлове като `e2e/.auth/` са gitignored
- git status е чист след локален commit

Coverage gate checklist:

- `npm run test:ci` минава с включен coverage threshold
- coverage drop под threshold fail-ва hard gate-а
