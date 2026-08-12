# Happy Colors - Phase 1 Cleanup Ownership Decisions

Date: 2026-08-07
Branch: `single-deploy-refactor`
Status: Draft for Opus review and owner approval

This is a local working artifact. `docs/` is gitignored, so this file is not durable until the owner chooses git force-add or an approved external record.

No code changes, deletions, moves, or import migrations are approved by this document alone.

## 1. Gates From Phase 0

Phase 0 inventory quality was reviewed by Claude Opus 4.8. Opus found no blocking inventory gaps after the final corrections.

Still open before any code implementation batch:

- durable record strategy: pending owner decision;
- reversible baseline: pending owner-approved checkpoint commit, checkpoint branch, or external snapshot;
- owner approval for these Phase 1 decisions: pending;
- Opus review of this Phase 1 report: pending.

The owner asked on 2026-08-07 to continue and to use only Opus after each phase.

## 2. Decision Rules

- Public `/bg/...` and `/en/...` route architecture remains unchanged.
- Root deploy remains `node server.js`.
- The paused performance task remains frozen.
- Product detail caching remains deferred.
- Cookie-forwarding/authenticated fetches must remain `cache: 'no-store'`.
- Express remains the business API owner unless a route has a concrete Next runtime requirement.
- Next may own routes that require Next APIs, browser-to-Next multipart/form handling, or an already established Next-only integration, but the rationale must be recorded per route.
- Root `shared/` is allowed only for pure cross-runtime code or narrow Node-only primitives with runtime-specific loaders and direct tests.

## 3. Ownership Decisions By Family

### 3.1 Revalidation

Canonical owner:

- Next owns route entrypoints that call `revalidatePath` or `revalidateTag`.
- Express services own mutation workflows and call domain revalidation helpers after relevant changes.

Decisions:

| Surface | Decision | Rationale | Required tests |
| --- | --- | --- | --- |
| `src/app/api/revalidate/**/route.js` | Keep | Accepted canonical Next-owned surfaces because they call Next cache APIs. Keep route files thin and surface-specific. | Frontend revalidation API tests; `apiRouteOwnership.test.js`; `unifiedRouting.test.js`. |
| `src/app/api/revalidate/_lib/localizedPaths.js` | Keep | Next-only helper because it imports `next/cache` and must revalidate legacy plus localized paths. | `localizedRevalidationPaths.test.js`. |
| `src/app/api/revalidate/_lib/revalidateRoute.js` | Keep, with boundary | Same-runtime Next helper for auth/rate-limit/body boilerplate. It must not own product/blog/home-banner business invalidation policy. | Existing route tests plus focused tests for invalid/missing secret, rate limit, body parse failure. |
| `server/helpers/revalidateProducts.js` | Keep | Product/category/translation services should import the domain helper, not the generic helper. | `revalidateProducts.test.js`; product/category/translation integration tests. |
| `server/helpers/revalidateBlog.js` | Keep | Blog/translation services should import the domain helper, preserving domain ownership. | `revalidateBlog.test.js`; blog/translation integration tests. |
| `server/helpers/revalidateSurfaces.js` | Keep only with direct branch coverage | Generic same-layer fetch/error helper is acceptable only while both product and blog domain helpers use it and every meaningful branch is tested directly or through proven wrapper coverage. | Add/confirm direct fetch/error tests or prove domain wrapper tests cover all meaningful branches. |

Verification note for `revalidateRoute.js`:

- `products/route.js` still declares product/category/homepage/cartoon-gallery tags plus product/list/home/cartoon/sitemap paths.
- `blog/route.js` still declares blog tags plus blog index/article/sitemap paths.
- `home-banners/route.js` still declares the home-banner tag and home localized paths.
- `cartoon-hero-banners/route.js` still declares the cartoon-hero-banner tag and cartoon localized paths.
- Therefore `_lib/revalidateRoute.js` can remain as request boilerplate only; it is not the owner of per-surface invalidation policy.

First implementation batch candidate:

- Revalidation is not the first code batch unless owner wants route work first. It has multiple surfaces and review sensitivity.

### 3.2 Non-Revalidation Next API Routes

Canonical owner:

- Express owns business behavior.
- Next route files may remain when they protect browser-to-Next request handling, Node-only Next API integration, or a deliberate same-origin browser adapter that cannot be replaced without route churn.

Decisions:

| Route | Decision | Canonical owner | Rationale / next action |
| --- | --- | --- | --- |
| `src/app/api/offices/econt/route.js` | Move/Merge candidate | Express delivery controller/service | It only proxies to `baseURL/delivery/econt/offices`. Existing Express owner already validates city and talks to Econt. Prefer migrating checkout caller to Express-owned `/api/delivery/econt/offices` through unified routing, then delete proxy route after tests. |
| `src/app/api/offices/speedy/route.js` | Move/Merge candidate | Express delivery controller/service | Same as Econt. Also add explicit route ownership assertion for `/api/offices/speedy` before deleting or rerouting, because current ownership tests only mention Econt. |
| `src/app/api/analytics/summary/route.js` | Move | Express analytics controller/service | Reading Google Analytics env is not a Next-only runtime requirement. Create or move to an Express analytics owner before treating this as permanent. Until then, retain route only as existing behavior, not as an accepted owner. |
| `src/app/api/blog/images/route.js` | Keep with explicit exception | Next upload adapter plus shared pure validation | Retain as a same-origin browser-to-Next multipart upload adapter to avoid an extra browser-to-Express upload path while the frontend upload manager is Next-integrated. It must not own blog business persistence. Move/split reusable storage-name and validation predicates out of mixed shared code. |
| `src/app/api/upload-image/route.js` | Merge candidate into upload family | Next upload adapter | This is a legacy/simple image upload route. Review callers; if `uploadManager` can use `/api/uploads/proxy` for products/images without behavior loss, migrate and delete this route. |
| `src/app/api/uploads/sign/route.js` | Keep with explicit exception | Next upload adapter | Retain as a same-origin browser-to-Next signed-upload adapter integrated with the frontend upload manager. Extract pure kind/path validation if duplicated with proxy/delete routes. |
| `src/app/api/uploads/proxy/route.js` | Keep with explicit exception | Next upload adapter | Retain as the same-origin multipart proxy upload adapter for home-banner/product assets while upload flows are Next-integrated. Consolidate kind/path validation with `sign` and `delete`. |
| `src/app/api/uploads/delete/route.js` | Move persisted-content policy; keep adapter only with exception | Express storage/content authorization service plus Next rollback adapter | The raw products/blogarticles Mongo reads are business persistence policy and must move to an Express/service owner or pure backend helper. The Next route may remain only as the temporary upload rollback adapter after it delegates policy. |
| `src/app/api/cartoon-orders/upload-session/route.js` | Keep with explicit exception | Next upload session adapter plus pure/Node helper owners | Retain as a same-origin browser-to-Next upload session adapter for cookie setting, no-store response, temporary tokens, and upload manager integration. Move/split shared guard core env access. |
| `src/app/api/cartoon-orders/uploads/route.js` | Keep with explicit exception | Next upload adapter plus session/quota helper owners | Retain as a same-origin multipart upload adapter tied to temporary upload sessions. Session/quota policy must have clear helper ownership and direct tests. |
| `src/app/api/cartoon-orders/uploads/cleanup/route.js` | Keep with explicit exception | Next upload cleanup adapter plus session/quota helper owners | Retain as a same-origin cleanup adapter tied to temporary upload-session tokens. Preserve idempotency/lock tests and storage-not-found behavior. |

Route ownership tests:

- Add `/api/offices/speedy` to `apiRouteOwnership.test.js` when office proxy cleanup starts.
- Do not rely on default-Next behavior as route ownership proof. Every retained Next API route needs a recorded rationale.
- Delivery mount is already present: `server/routes.js` mounts `deliveryController` at `/delivery`, and `server/server.js` mounts the root routes router. Office proxy deletion must still prove replacement `/api/delivery/...` calls through unified routing before route files are removed.
- Office proxy migration must preserve or consciously accept the current fallback error-message behavior. The proxy coerces `offices` to an array and supplies Bulgarian fallback messages when the Express response has no message. `checkoutManager` tests should cover success and `{ message, offices: [] }` failure shape before deletion.

Required route tests:

| Surface | Required focused tests before/after cleanup |
| --- | --- |
| Office proxy move | `checkoutManager` office fetch tests; `happy-colors-nextjs-project/__tests__/api/offices/econt.test.js`; `speedy.test.js` until deletion; add `/api/offices/speedy` to `apiRouteOwnership.test.js`; delivery controller/service tests. |
| Analytics move | Existing `analytics/summary.test.js`, `googleAnalytics.test.js`, plus new Express analytics controller/service tests if moved. |
| Blog image upload | `happy-colors-nextjs-project/__tests__/api/blog/images.test.js`; upload validation/GCS helper tests. |
| Legacy/product image upload | `uploadManager.test.js`; `upload-image` route tests if retained until migration. |
| Signed/proxy/delete uploads | `uploads/sign.test.js`; `uploads/proxy.test.js`; `uploads/delete.test.js`; upload delete token tests; persisted-content policy tests after move. |
| Cartoon upload session/upload/cleanup | `cartoon-orders/uploadSession.test.js`; `uploads.test.js`; `uploadsCleanup.test.js`; `uploadSessionStore.test.js`; quota/guard/token tests. |

Recommended first route batch:

- Office proxy cleanup is the lowest-risk route ownership batch because Express already owns the delivery behavior and callers are narrow.

### 3.3 Root `shared/`

Canonical owner:

- Pure cross-runtime constants/predicates can stay in root `shared/`.
- Node-only shared primitives can stay only if they do not read env directly and wrappers provide runtime-specific loaders.
- Mixed modules must be split or moved.

Decisions:

| Module | Decision | Rationale | Tests |
| --- | --- | --- | --- |
| `shared/authConstants.js` | Keep | Edge-safe constant used by middleware, auth hint, and auth helpers. | Import/edge-safety test or coverage through auth session/middleware tests. |
| `shared/config/productLimits.js` | Keep | Pure cross-runtime constants used by frontend UI/API and backend validation. | Direct config/import test plus affected upload/product tests. |
| `shared/productOwnership.js` | Keep | Pure ownership predicates used by frontend/server wrappers. | Add direct unit tests for id normalization and manage checks. |
| `shared/cartoonOrderUploadTokenCore.js` | Keep as Node-only shared primitive, gated by tests | It already receives `getTokenSecret` from wrappers and does not read env directly. Keep Node-only classification; never import into middleware/client. This is not finalized until direct tests exist. | Add direct tests for purpose/session/object/content/size/expiration/signature mismatch branches. |
| `shared/authCore.js` | Split/Move | Currently mixes pure role helpers with Node crypto/JWT and direct `process.env.JWT_SECRET` reading. Planned owner: one pure root shared role module for role/status normalization and serialization, plus one Node-only JWT primitive with injected secret loader. Server/Next wrappers consume those owners; they do not duplicate role logic. | Direct tests after split for role helpers and JWT primitive. |
| `shared/cartoonUploadGuardsCore.js` | Split/Move | Reads guard env/secrets directly. Shared core must receive runtime-specific env/secret loaders or move into runtime wrappers. | Direct tests after loader injection/split. |
| `shared/gcsCore.js` | Split/Move | Mixes pure URL/object-name validation with Node `path`/`crypto` object-name helpers and direct env fallback. Planned owner: pure root shared GCS URL/object-name predicates used by server and Next; runtime wrappers own bucket/env/storage setup and object generation where Node APIs are required. | Direct tests for pure validation and object-name branches after split. |

Recommended first shared batch:

- Do not start with `authCore.js`; it touches auth and middleware-adjacent behavior.
- Start with `productOwnership.js` direct tests or office proxy cleanup first.
- If starting shared cleanup, `shared/gcsCore.js` is high-value but should be a dedicated reviewed batch because uploads and services depend on it.
- Inline upload object-name allowlists, including `uploads/delete` `isAllowedObjectName` and test mocks that duplicate cartoon photo object-name validation, should migrate to the chosen pure GCS/object-name predicate owner during the GCS batch.

### 3.4 Compatibility Wrappers

Canonical owner:

- Runtime wrappers stay when they preserve an established import path or protect env/request/cookie/storage boundaries.
- Wrapper chains should not remain when they only add indirection.

Decisions:

| Wrapper family | Decision | Rationale |
| --- | --- | --- |
| Product limits wrappers: `server/config/productLimits.js`, `src/config/productLimits.js` | Keep | They are stable runtime import boundaries over pure shared constants and keep callers out of long root-relative shared imports. |
| Ownership wrappers: `server/utils/isOwner.js`, `src/utils/isOwner.js` | Keep for now | They preserve established server/frontend utility paths. Add direct shared tests before deciding whether wrapper tests are enough. |
| Server roles: `server/utils/userRoles.js` | Keep boundary, change internals after `authCore` split | Server models/services/controllers already treat this as the role utility owner. It should not remain a thin export from mixed `authCore.js` after cleanup. |
| Next API auth wrapper: `src/app/api/_lib/auth.js` | Keep boundary, change internals after `authCore` split | It owns Next request cookies, Mongo loading, and admin/artist API authorization response shape. |
| Upload token wrappers | Keep | They inject runtime-specific secret loading around a Node-only shared primitive. |
| Cartoon guard wrappers | Keep boundary, change internals after guard core split | They should inject env/secret/cookie handling instead of importing shared code that reads env directly. |
| GCS wrappers/helpers | Keep runtime wrappers, split shared core | Next `_lib/gcs.js` owns Next env/storage setup. `server/helpers/gcsImageHelper.js` owns backend storage workflows. Shared code should hold only pure predicates or Node-only primitives with no direct env fallback. |

### 3.5 Frontend Managers

Canonical owner:

- Managers remain endpoint-specific thin request adapters.
- Shared manager helpers are allowed only for URL/query/fetch option mechanics.

Decisions:

| Surface | Decision | Rationale | Tests |
| --- | --- | --- | --- |
| `src/managers/requestUtils.js` | Keep | Used by four public managers; tags/cache choices remain visible at call sites. | `requestUtils.test.js`; manager tests. |
| Public managers using `getPublicServerFetchOptions` | Keep with explicit tags | Products/blog/categories/home banners should keep endpoint paths and cache tags at call sites. | Existing manager tests plus no-store regression tests. |
| Authenticated/cookie-forwarding managers | Keep `cache: 'no-store'` inline | Do not hide auth/cache policy inside a generic API client. | Manager tests for no-store where present. |

### 3.6 Auth, Session Hint, Middleware

Canonical owner:

- Frontend auth state stays in `AuthContext`/`AuthWrapper`.
- Root layout may pass a non-sensitive session hint.
- Middleware must import only edge-safe code.

Decisions:

| Surface | Decision | Rationale | Tests |
| --- | --- | --- | --- |
| `src/context/authSessionHint.js` | Keep | Small non-sensitive cookie-presence helper; avoids anonymous public visits calling `/users/me`. | `authSessionHint.test.js`; app context tests. |
| `src/app/layout.js`, `AuthWrapper.jsx`, `AuthContext.jsx` | Keep behavior, review provider boundaries later | Anonymous session hint behavior is a real UX fix and should not be regressed during cleanup. | App context tests; auth shell tests. |
| `src/middleware.js` i18n/auth imports | Keep with edge-safety guard | Current imports are edge-safe, but Phase 2 auth/i18n edits must re-run import scan/build. | Middleware tests/build when touched. |

### 3.7 Blog Repair Guard

Canonical owner:

- Blog UI composition stays in existing page/components/content modules.

Decisions:

| Surface | Decision | Rationale |
| --- | --- | --- |
| `src/app/blog/page.jsx`, `src/app/(localized)/[locale]/blog/page.js` | Keep | Public route convention files; localized routes remain unchanged. |
| `BlogArticleDetails.jsx`, `src/content/publicPages/blog.js` | Keep | Protect restored blog design and full article rendering. |
| Blog tests | Keep | Regression guard for behavior restored during emergency fix. |

No blog UI cleanup should happen until visual parity checks are planned.

### 3.8 Backend Services, Controllers, Models, Validators, Middlewares

Canonical owner:

- Express services own business workflows.
- Controllers remain thin request/response coordinators.
- Models/schemas own persistence shape.
- Middlewares own request pipeline concerns.

Decisions:

| Area | Decision | Rationale |
| --- | --- | --- |
| Product/category/blog/translation services touched by revalidation | Keep services as canonical owners | They should call domain helpers for revalidation and should not import generic Next route helpers. |
| Delivery controller/service | Keep as canonical owner; merge office proxies into this route family | Econt/Speedy business integration already lives here. |
| Contact message length constants | Defer | Duplicate frontend/server constants need a separate validation/config decision; do not fold into product limits automatically. |
| Server middlewares outside auth | Defer | No current cleanup batch touches them. Scan before middleware cleanup. |
| Models/schemas | Defer | No file moves/deletions until backend ownership batch. |

### 3.9 UI, Hooks, Contexts, Styles, Content, Tests

Decisions:

| Area | Decision | Rationale |
| --- | --- | --- |
| Hooks `useForm`, `useImageSlideshow` | Defer | No current touched behavior; scan before UI/client-state cleanup. |
| CSS modules | Defer | Do not consolidate styles without visual parity checks. |
| Public content modules | Defer except blog keep | Content cleanup should be separate from route/cache/shared cleanup. |
| Test factories/mocks/setup | Defer | Consolidate only if it improves clarity without hiding scenario intent. |

## 4. Phase 1 Exception Log Draft

These records are draft implementation constraints, not approval to start code changes. Owner approval remains pending.

Owner ratification note: P1-EX-001, P1-EX-002, P1-EX-003, P1-EX-005, P1-EX-006, and P1-EX-007 rely on a deliberate same-origin browser-to-Next upload integration exception. Express can technically own multipart uploads, so these are not canonical Next ownership decisions; they remain pending owner approval with removal/revalidation conditions.

```text
Exception ID: P1-EX-001
Owner: happy-colors-nextjs-project/src/app/api/blog/images/route.js
Canonical owner: Next same-origin upload adapter plus pure shared validation and Express blog persistence
Rationale: Retain a same-origin browser-to-Next multipart upload entrypoint integrated with the existing frontend upload manager, avoiding a second browser upload path while preserving Express ownership of blog persistence.
Scope: Temporary blog hero/thumbnail image upload to GCS and delete-token return.
Callers: uploadManager blog image upload flow; blog article form tests.
Runtime constraints: Node runtime only; imports Next request/formData handling and Next GCS/env adapter; must not import Express models.
Tests: happy-colors-nextjs-project/__tests__/api/blog/images.test.js; upload validation/GCS helper tests.
Removal or revalidation condition: Revisit when upload architecture is unified or if Express multipart upload becomes the selected owner.
Owner approval: Pending.

Exception ID: P1-EX-002
Owner: happy-colors-nextjs-project/src/app/api/uploads/sign/route.js
Canonical owner: Next same-origin signed-upload adapter plus pure shared validation
Rationale: Retain same-origin signed upload policy generation for frontend-managed direct browser uploads while storage/env setup stays in the Next adapter.
Scope: Product video/poster signed GCS policy generation and delete-token return.
Callers: uploadManager/product form signed upload flow.
Runtime constraints: Node runtime only; GCS signing and env loading stay in Next _lib wrapper.
Tests: happy-colors-nextjs-project/__tests__/api/uploads/sign.test.js; upload delete token tests; product manager/form tests where touched.
Removal or revalidation condition: Revisit if upload signing moves to Express or a separate upload service.
Owner approval: Pending.

Exception ID: P1-EX-003
Owner: happy-colors-nextjs-project/src/app/api/uploads/proxy/route.js
Canonical owner: Next same-origin multipart upload adapter plus pure shared validation
Rationale: Retain current same-origin multipart proxy upload path for home-banner/product assets while frontend upload flows are Next-integrated.
Scope: Home-banner images, product videos, and poster proxy uploads.
Callers: uploadManager proxy upload flow; home banner/product forms.
Runtime constraints: Node runtime only; route must delegate reusable kind/path validation and not own backend persistence rules.
Tests: happy-colors-nextjs-project/__tests__/api/uploads/proxy.test.js; uploadManager tests; touched form tests.
Removal or revalidation condition: Revisit after signed/direct upload path can cover all callers or Express upload ownership is selected.
Owner approval: Pending.

Exception ID: P1-EX-004
Owner: happy-colors-nextjs-project/src/app/api/uploads/delete/route.js
Canonical owner: Express/storage-content authorization policy plus temporary Next rollback adapter
Rationale: The route may remain only as the upload rollback adapter for files created by Next upload routes. Persisted-content lookup policy must move out of this route into an Express/backend owner before the exception is accepted.
Scope: Delete-token-protected rollback deletion for not-yet-persisted upload objects.
Callers: uploadManager delete flow; product/blog/home-banner forms.
Runtime constraints: Node runtime only; no raw business collection policy should remain in the route after cleanup.
Tests: happy-colors-nextjs-project/__tests__/api/uploads/delete.test.js; direct tests for moved persisted-content policy; upload delete token tests.
Removal or revalidation condition: Revisit after upload routes are consolidated; remove route if rollback deletion moves to Express.
Owner approval: Pending.

Exception ID: P1-EX-005
Owner: happy-colors-nextjs-project/src/app/api/cartoon-orders/upload-session/route.js
Canonical owner: Next same-origin cartoon upload session adapter plus session/guard helpers
Rationale: Retain same-origin upload-session creation tied to browser guard cookies, no-store response handling, and temporary upload tokens.
Scope: Cartoon order reference-photo upload session creation.
Callers: cartoonOrdersManager and contact form cartoon upload flow.
Runtime constraints: Node runtime only; guard/token helpers must not read shared env directly after cleanup.
Tests: cartoon-orders/uploadSession.test.js; auth/session/guard/token tests as touched.
Removal or revalidation condition: Revisit if cartoon upload flow moves fully into Express or a dedicated upload service.
Owner approval: Pending.

Exception ID: P1-EX-006
Owner: happy-colors-nextjs-project/src/app/api/cartoon-orders/uploads/route.js
Canonical owner: Next same-origin cartoon multipart upload adapter plus session/quota helper owners
Rationale: Retain same-origin multipart upload for temporary cartoon reference photos tied to session tokens, quota reservations, and browser guard cookies.
Scope: Reference photo storage write, session append, quota reservation confirmation, and upload confirmation token return.
Callers: cartoonOrdersManager and contact form cartoon upload flow.
Runtime constraints: Node runtime only; quota/session policy helpers need clear ownership and direct tests.
Tests: cartoon-orders/uploads.test.js; uploadSessionStore.test.js; quota/guard/token/GCS tests.
Removal or revalidation condition: Revisit if Express or a dedicated upload service owns temporary upload sessions.
Owner approval: Pending.

Exception ID: P1-EX-007
Owner: happy-colors-nextjs-project/src/app/api/cartoon-orders/uploads/cleanup/route.js
Canonical owner: Next same-origin cartoon upload cleanup adapter plus session/quota helper owners
Rationale: Retain cleanup endpoint tied to temporary upload-session and confirmation tokens while preserving idempotency/lock behavior.
Scope: Reference photo cleanup, lock acquisition/release, byte-gauge release, and quota decrement.
Callers: cartoonOrdersManager cleanup flow; contact form cleanup flow.
Runtime constraints: Node runtime only; storage-not-found handling and cleanup idempotency must remain tested.
Tests: cartoon-orders/uploadsCleanup.test.js; uploadSessionStore.test.js; quota/guard/token/GCS tests.
Removal or revalidation condition: Revisit if temporary cartoon upload ownership moves out of Next.
Owner approval: Pending.
```

## 5. Proposed Batch Order

1. Baseline/durable record setup: no code cleanup starts until owner chooses record strategy and reversible baseline.
2. Shared pure tests: add direct tests for `shared/productOwnership.js`, `shared/config/productLimits.js`, and `shared/cartoonOrderUploadTokenCore.js`. This is the lowest runtime-risk first code batch.
3. Office proxy cleanup: migrate checkout office calls to Express-owned delivery endpoints, add `/api/offices/speedy` ownership assertion, confirm `/api/delivery/...` through unified routing, and delete Next office proxies only after tests pass. This route-ownership batch requires Opus review.
4. Split mixed shared modules: `gcsCore.js`, `cartoonUploadGuardsCore.js`, then `authCore.js` in separate reviewed batches.
5. Revalidation helper branch coverage: decide whether `revalidateSurfaces.js` remains and add direct tests if it does.
6. Analytics route move or owner-ratified exception: create/move to Express analytics owner, or explicitly retain the Next route as a documented exception if adding a new Express analytics surface would add more ownership noise than it removes. This should not be grouped with uploads.
7. Upload route helper consolidation and `uploads/delete` persisted-policy move: only after shared GCS/token/guard ownership is cleaner.
8. Manager request utility cleanup/no-store verification.
9. Blog/auth/UI/style/test utility cleanup batches.

## 6. Phase 1 Acceptance Checklist

- One planned owner exists for each audited behavior family.
- Every retained wrapper has a reason.
- Every root `shared/` module has Keep, Move, or Node-only retained decision.
- Every retained Next API route has a runtime or integration rationale.
- No deletion or move starts until durable record and reversible baseline are resolved.
- Opus review of this report has no unresolved blocking findings.
- Owner approves the first code batch order.

## 7. Opus Review History

### Claude Opus Phase 1 Review - 2026-08-07

Model ID: `claude-opus-4-8`

Reviewed target: `AGENTS.md`, cleanup design document, cleanup implementation plan, Phase 0 inventory, and this Phase 1 ownership decision report.

Review artifact: Claude CLI output in the current Codex conversation transcript.

Owner approval reference: owner asked to continue and to use only Opus after each phase on 2026-08-07.

Outcome: Opus raised material findings:

- analytics route did not have a valid Next-runtime ownership rationale;
- `uploads/delete` kept business persistence reads in a Next route too softly;
- upload routes needed explicit same-origin browser-to-Next rationale or move decisions;
- office proxy move was valid but deletion must confirm delivery mount/reachability;
- `authCore.js` role helpers needed a single planned owner;
- `cartoonOrderUploadTokenCore.js` keep decision must remain gated by direct tests;
- GCS object-name predicate ownership and duplicate inline allowlists needed a planned owner;
- retained Next routes needed named tests and exception records;
- `revalidateRoute.js` keep decision needs verification that route files keep surface-specific ownership;
- batch order should put low-risk shared tests before route ownership changes and mark route changes Opus-gated.

These findings were incorporated into this revision and require follow-up Opus review.

### Claude Opus Phase 1 Follow-Up Review - 2026-08-07

Model ID: `claude-opus-4-8`

Reviewed target: revised Phase 1 ownership decision report after Opus findings.

Review artifact: Claude CLI output in the current Codex conversation transcript.

Owner approval reference: owner asked to continue and to use only Opus after each phase on 2026-08-07.

Outcome: Opus verified that all ten prior findings were resolved and found no blocking findings. It confirmed the delivery mount/reachability facts and the route ownership rationale. It raised three non-blocking material decision notes:

- office proxy migration should preserve or explicitly accept fallback error-message behavior;
- upload-route exceptions rely on deliberate same-origin integration convenience and need owner ratification;
- analytics `Move` would create a new Express surface, so owner may choose either that move or an explicit exception if that is less noisy.

These notes were incorporated into this revision for the relevant future batches.
