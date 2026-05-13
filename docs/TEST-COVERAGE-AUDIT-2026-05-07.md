# Test Coverage Audit - 2026-05-07

## Current Coverage

Coverage was measured with `coverage.all: true`, so untouched source files are included in the denominator.

Server:

- lines/statements: 52.49%
- branches: 63.73%
- functions: 56.31%

Frontend:

- lines: 20.77%
- statements: 20.79%
- branches: 63.45%
- functions: 54.46%

Branch coverage caveat: at this stage the branch percentages are less useful than lines/functions. With V8 and `coverage.all: true`, many untouched files contribute little or no branch denominator until they are imported. Branch percentage can move down as line coverage improves and previously untouched modules start being instrumented. Use lines/functions as the main progress signal for the next slices.

## Interpretation

The test infrastructure is working, but the 80/75/80/80 hard gate is not ready. The largest remaining denominator is concentrated in:

- frontend pages/components/managers that are not imported by unit/component/API tests
- backend payment/delivery/GCS/email service boundaries that were intentionally deferred
- large form and checkout flows where component tests are more valuable than shallow unit tests

## Highest-Value Server Backfill Targets

1. `server/services/paymentsService.js`
   - 5.35% lines, 0% functions
   - business-critical payment session/payment persistence logic
   - first step: test pure normalization/validation helpers where possible, then test Stripe/model orchestration with mocked boundaries

2. `server/services/paymentsWebhookService.js`
   - low coverage and business-critical payment finalization boundary
   - should be tested with mocked Payment/Order persistence and Stripe event payloads

3. `server/services/ordersServices.js`
   - line coverage is already relatively high through integration tests, but branch coverage still has important gaps
   - current branches: about 54%
   - focus on edge cases around cart normalization, payment method constraints, email failure handling, and invalid totals

4. `server/services/deliveryService.js`
   - 8.95% lines, 0% functions
   - business-critical carrier normalization/lookup logic
   - should be split into pure unit tests for request/response normalization before external-carrier integration tests

5. `server/services/userService.js`
   - line coverage is already good through integration tests, but branch coverage remains low
   - current branches: about 31%
   - focus on duplicate user, password/email invalid cases, missing JWT secret, and login failure paths

6. `server/services/productImagesService.js` and `server/services/productVideosService.js`
   - about 5% lines each
   - storage cleanup/security boundary logic
   - good unit-test candidates with mocked Product model and GCS helper

7. `server/helpers/sendEmail.js`
   - 0% lines
   - should stay mocked in integration tests; unit-test only the configuration/error branches if it can be done without real SMTP calls

## Highest-Value Frontend Backfill Targets

1. `src/components/products/ProductForm.jsx`
   - 0% lines, about 790 lines in denominator
   - highest-impact component denominator
   - tests should focus on initialization, field validation, image/video normalization, and submit behavior

2. `src/app/checkout/CheckoutClientPage.jsx`
   - 0% lines, about 593 lines
   - business-critical flow
   - likely needs component-level tests with mocked cart/auth/delivery managers

3. `src/app/products/[productId]/ProductDetails.jsx`
   - 0% lines, about 548 lines
   - e2e exercises it but Vitest coverage does not count Playwright
   - component tests should cover catalog vs non-catalog actions, add-to-cart, owner actions, and unavailable products

4. `src/managers/checkoutManager.js`, `src/managers/productsManager.js`, `src/managers/uploadManager.js`, `src/managers/userManager.js`
   - 0% lines
   - good unit-test targets because they combine fetch/router callbacks with testable business rules
   - `checkoutManager.js` should cover validation, cart total math, draft persistence, and payment method constraints, not only shallow fetch calls

5. `src/hooks/useImageSlideshow.js`
   - 0% lines, 252 lines
   - pure-ish hook behavior and good unit-jsdom candidate

## Recommended Backfill Order

Do not try to jump directly from 20-52% to 80% in one commit. Use reviewable slices:

1. Server payment/order/webhook slice
   - `paymentsService.js`
   - `paymentsWebhookService.js`
   - selected `ordersServices.js` branch gaps
   - highest business risk: money, order state, payment finalization

2. Server delivery/auth/storage boundary slice
   - `deliveryService.js`
   - selected `userService.js` branch gaps
   - `productImagesService.js`
   - `productVideosService.js`

3. Frontend manager utilities slice
   - `checkoutManager.js`
   - `productsManager.js`
   - `uploadManager.js`
   - `userManager.js`
   - gives useful coverage without rendering large UI forms

4. Frontend high-value component slice
   - `ProductDetails.jsx`
   - `useImageSlideshow.js`

5. Checkout/ProductForm component slice
   - larger and riskier; do after the test utilities from earlier component phases have proven stable

## Gate Decision

Keep `test:ci` as a diagnostic coverage command for now. Promote it to a hard required gate only when both projects are near:

- 80% lines
- 75% branches
- 80% functions
- 80% statements
