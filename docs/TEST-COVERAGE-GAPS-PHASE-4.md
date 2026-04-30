# Phase 4 Coverage Gap List

Date: 2026-04-30
Status: Backend integration tests added; route tests pass, hard 80% server coverage gate remains deferred.

## Diagnostic Results

`cd server && npm run test:integration`

- Test result: 6 files passed, 19 tests passed.

`cd server && npm run test:ci`

- Test result: 13 files passed, 41 tests passed.
- Coverage result: fails only on global thresholds.
- Current global coverage: 52.03% lines, 60.27% branches, 55.33% functions, 52.03% statements.

## Coverage Improvement

Phase 1B server coverage was:

- 7.06% lines
- 54.46% branches
- 34.09% functions
- 7.06% statements

After Phase 4 backend integration tests:

- Lines increased to 52.03%.
- Functions increased to 55.33%.
- Controllers, models, product/category/user/search/order paths now receive real Express + Mongo coverage.

## Remaining Server Gaps

The largest remaining uncovered zones are intentionally not forced into this phase:

- `server/services/paymentsService.js`: Stripe session/webhook behavior is deferred to a Stripe-focused phase.
- `server/services/deliveryService.js`: full carrier behavior is deferred because Econt/Speedy setup is separate work.
- `server/helpers/sendEmail.js`: external email boundary is mocked in integration tests.
- `server/services/productImagesService.js` and `server/services/productVideosService.js`: storage cleanup endpoints need focused media deletion tests.
- Some controller error branches remain uncovered and can be backfilled as route regression cases.

## Follow-Up

Do not enable hard `CI_COVERAGE=true` enforcement yet. Keep it as a diagnostic gate until the deferred Stripe, delivery, email/storage boundary tests, and frontend component/API phases are in place.
