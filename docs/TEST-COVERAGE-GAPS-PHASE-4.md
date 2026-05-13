# Phase 4 Coverage Gap List

Date: 2026-04-30
Status: Historical Phase 4 backend integration snapshot. The hard local coverage gate was later enabled after targeted server/frontend backfill.

## Historical Diagnostic Results

`cd server && npm run test:integration`

- Test result: 6 files passed, 21 tests passed.

`cd server && npm run test:ci`

- Test result: 13 files passed, 43 tests passed.
- Historical coverage result at this phase: failed only on global thresholds.
- Current global coverage: 52.49% lines, 63.73% branches, 56.31% functions, 52.49% statements.

## Coverage Improvement

Phase 1B server coverage was:

- 7.06% lines
- 54.46% branches
- 34.09% functions
- 7.06% statements

After Phase 4 backend integration tests:

- Lines increased to 52.49%.
- Functions increased to 56.31%.
- Controllers, models, product/category/user/search/order paths now receive real Express + Mongo coverage.

## Remaining Server Gaps

The largest remaining uncovered zones are intentionally not forced into this phase:

- `server/services/paymentsService.js`: Stripe session/webhook behavior is deferred to a Stripe-focused phase.
- `server/services/deliveryService.js`: full carrier behavior is deferred because Econt/Speedy setup is separate work.
- `server/helpers/sendEmail.js`: external email boundary is mocked in integration tests.
- `server/services/productImagesService.js` and `server/services/productVideosService.js`: storage cleanup endpoints need focused media deletion tests.
- Some controller error branches remain uncovered and can be backfilled as route regression cases.

## Follow-Up

Superseded by later server payment/storage, frontend component/API, and targeted coverage backfill commits. `CI_COVERAGE=true` is now the hard local coverage gate through `npm run test:ci`; GitHub Actions CI wiring remains deferred by project decision.
