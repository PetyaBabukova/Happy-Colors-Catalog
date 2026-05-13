# Phase 1B Coverage Gap List

Date: 2026-04-29
Status: Historical Phase 1B diagnostic snapshot. The hard local coverage gate was later enabled after targeted server/frontend backfill.

## Historical Diagnostic Results

`npm run test:server:ci`

- Test result: 7 files passed, 22 tests passed.
- Historical coverage result at this phase: failed only on global thresholds.
- Current global coverage: 7.06% lines, 54.46% branches, 34.09% functions, 7.06% statements.

`npm run test:frontend:ci`

- Test result: 11 files passed, 36 tests passed.
- Historical coverage result at this phase: failed only on global thresholds.
- Current global coverage: 12.88% lines, 49.01% branches, 44.23% functions, 12.88% statements.

## Server Gaps

These areas are intentionally still low because they need integration tests with database/request boundaries:

- `server/controllers/*`
- `server/services/*`
- `server/models/*`
- `server/helpers/sendEmail.js`
- `server/utils/stripeClient.js`

Unit coverage added in Phase 1B covers the middleware layer:

- `server/middlewares/auth.js`
- `server/middlewares/paymentValidations.js`
- `server/middlewares/rateLimit.js`

## Frontend Gaps

These areas are intentionally still low because they need component, API route, or E2E coverage in later phases:

- `src/app/**` pages and route handlers
- `src/components/**`
- `src/context/**`
- `src/managers/**`
- `src/app/api/_lib/auth.js`
- `src/app/api/_lib/gcs.js`
- `src/app/api/_lib/mongo.js`
- `src/hooks/useSlideshow.js`
- `src/lib/getProduct.js`

Unit coverage added in Phase 1B covers high-value pure/security logic:

- `src/app/api/_lib/uploadDeleteToken.js`
- `src/app/api/_lib/uploadValidation.js`
- `src/utils/checkProductAccess.js`
- `src/utils/errorHandler.js`
- `src/utils/formSubmitHelper.js`
- `src/utils/videoMetadata.js`
- `src/hooks/useForm.js`

## Follow-Up

Superseded by later backend integration, frontend API/component, and targeted coverage backfill commits. `CI_COVERAGE=true` is now the hard local coverage gate through `npm run test:ci`; GitHub Actions CI wiring remains deferred by project decision.
