# Happy Colors - Phase 0 Cleanup Inventory

Date: 2026-08-07
Branch: `single-deploy-refactor`
Scope: freeze, baseline, inventory, duplicate/ownership scan.

This is a local Phase 0 working artifact. `docs/` is gitignored, so this file is not a durable audit record until the owner chooses either git force-add or an approved external record.

No files were deleted or moved during this phase.

## 1. Baseline

- Branch confirmed with `git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" branch --show-current`: `single-deploy-refactor`.
- Plain git commands hit Windows dubious-ownership protection. Phase 0 commands used per-command `-c safe.directory=...`; global git config was not changed.
- Worktree baseline: 54 modified tracked files and 15 untracked files.
- Tracked diff stat: 54 files changed, 1360 insertions, 1355 deletions.
- Line-ending warnings were reported by git for many touched files: LF will be replaced by CRLF when Git touches them. No normalization changes were made.
- Reversible baseline checkpoint was not created because the plan requires owner approval for a checkpoint commit/branch or external snapshot.
- Durable record decision is pending because the task prompt still contains an unresolved placeholder.

## 2. Phase 0 Verification

Command:

```powershell
npm run test:server -- --run __tests__/unit/apiRouteOwnership.test.js __tests__/unit/unifiedRouting.test.js
```

Result:

- `server/__tests__/unit/apiRouteOwnership.test.js`: 54 tests passed.
- `server/__tests__/unit/unifiedRouting.test.js`: 12 tests passed.
- Total: 2 files passed, 66 tests passed.

## 3. Current Worktree Classification

Classification meanings follow the implementation plan: Keep, Merge, Move, Delete, Defer, Exception, Unrelated.

Phase 0 classifications are preliminary owner-decision inputs. No deletion or move is approved by this inventory alone.

| Path | Layer | Family | Classification | Phase 0 rationale |
| --- | --- | --- | --- | --- |
| `happy-colors-nextjs-project/__tests__/api/revalidate/blog.test.js` | Frontend API test | Revalidation | Defer | Regression guard for Next-owned revalidation; review with route helper consolidation before final keep/delete decision. |
| `happy-colors-nextjs-project/__tests__/api/revalidate/cartoonHeroBanners.test.js` | Frontend API test | Revalidation | Defer | Regression guard for Next-owned revalidation; review with route helper consolidation before final keep/delete decision. |
| `happy-colors-nextjs-project/__tests__/api/revalidate/homeBanners.test.js` | Frontend API test | Revalidation | Defer | Regression guard for Next-owned revalidation; review with route helper consolidation before final keep/delete decision. |
| `happy-colors-nextjs-project/__tests__/api/revalidate/products.test.js` | Frontend API test | Revalidation | Defer | Regression guard for Next-owned revalidation; review with route helper consolidation before final keep/delete decision. |
| `happy-colors-nextjs-project/__tests__/components/blog/BlogPage.test.jsx` | Frontend component test | Blog repair guard | Keep | Protects restored blog page behavior; do not remove to reduce file count. |
| `happy-colors-nextjs-project/__tests__/components/blog/BlogPublicComponents.test.jsx` | Frontend component test | Blog repair guard | Keep | Protects public blog/article rendering behavior. |
| `happy-colors-nextjs-project/__tests__/components/context/AppContexts.test.jsx` | Frontend component test | Auth/session/context | Defer | Protects anonymous auth/session behavior; review with context ownership before final keep/delete decision. |
| `happy-colors-nextjs-project/__tests__/components/translations/TranslationsClientPage.test.jsx` | Frontend component test | Translation UI | Defer | Touched test around backend-owned translation workflow; classify with translation behavior before edits. |
| `happy-colors-nextjs-project/__tests__/unit/lib/getProduct.test.js` | Frontend unit test | Product fetch/cache | Defer | Likely cache/no-store regression surface; keep until product manager ownership decision. |
| `happy-colors-nextjs-project/__tests__/unit/managers/blogArticlesManager.test.js` | Frontend manager test | Manager request utils | Defer | Guards manager URL/cache behavior; review with `requestUtils.js` before final keep/delete decision. |
| `happy-colors-nextjs-project/__tests__/unit/managers/categoriesManager.test.js` | Frontend manager test | Manager request utils | Defer | Guards manager URL/cache behavior; review with `requestUtils.js` before final keep/delete decision. |
| `happy-colors-nextjs-project/__tests__/unit/managers/productsManager.test.js` | Frontend manager test | Manager request utils | Defer | Guards manager URL/cache behavior; review with `requestUtils.js` before final keep/delete decision. |
| `happy-colors-nextjs-project/__tests__/unit/context/authSessionHint.test.js` | Frontend unit test | Auth/session hint | Keep | New regression guard for anonymous `/users/me` gating. |
| `happy-colors-nextjs-project/__tests__/unit/managers/requestUtils.test.js` | Frontend unit test | Manager request utils | Defer | Valid only if `requestUtils.js` remains after Phase 1 owner decision. |
| `happy-colors-nextjs-project/src/app/(localized)/[locale]/blog/page.js` | Frontend page | Blog repair guard | Keep | Localized public route must remain `/bg/...` and `/en/...`; page is convention-owned. |
| `happy-colors-nextjs-project/src/app/ClientLayout.jsx` | Frontend layout/client shell | Auth/session/context | Defer | Review with `AuthContext`, `AuthWrapper`, and provider ownership. |
| `happy-colors-nextjs-project/src/app/api/_lib/auth.js` | Next API helper | Auth wrapper | Defer | Next runtime adapter around shared auth; Phase 1 must decide whether env loading and request/cookie shape justify the boundary. |
| `happy-colors-nextjs-project/src/app/api/_lib/cartoonOrderUploadToken.js` | Next API helper | Upload token wrapper | Defer | Next runtime adapter around Node-only token core; keep only if runtime boundary is real. |
| `happy-colors-nextjs-project/src/app/api/_lib/cartoonUploadGuards.js` | Next API helper | Cartoon upload guards | Defer | Next adapter around guard core; shared core currently reads env/process and needs split/move decision. |
| `happy-colors-nextjs-project/src/app/api/_lib/gcs.js` | Next API helper | GCS wrapper | Defer | Next storage/env adapter; shared mixed pure/Node code should be split or justified. |
| `happy-colors-nextjs-project/src/app/api/revalidate/_lib/localizedPaths.js` | Next API helper | Revalidation | Keep | Accepted Next-only localized path helper because it imports `next/cache`; keep tested through localized revalidation paths. |
| `happy-colors-nextjs-project/src/app/api/revalidate/_lib/revalidateRoute.js` | Next API helper | Revalidation | Defer | Shared Next-only route boilerplate; Phase 1 must verify it does not hide per-route ownership. |
| `happy-colors-nextjs-project/src/app/api/analytics/summary/route.js` | Next API route | Analytics proxy | Defer | Next-owned route is business-adjacent and must get a runtime-only rationale or move/rewrite decision in Phase 1. |
| `happy-colors-nextjs-project/src/app/api/blog/images/route.js` | Next API route | Blog image upload | Defer | Next-owned upload route uses multipart/File/Storage helpers; Phase 1 must justify why Express cannot own it. |
| `happy-colors-nextjs-project/src/app/api/cartoon-orders/upload-session/route.js` | Next API route | Cartoon uploads | Defer | Next-owned route is excluded from Express by ownership tests; Phase 1 must record runtime-only rationale. |
| `happy-colors-nextjs-project/src/app/api/cartoon-orders/uploads/route.js` | Next API route | Cartoon uploads | Defer | Next-owned upload route uses Next request multipart handling and storage/session helpers; ownership rationale pending. |
| `happy-colors-nextjs-project/src/app/api/cartoon-orders/uploads/cleanup/route.js` | Next API route | Cartoon uploads | Defer | Next-owned cleanup route touches storage/session quota behavior; Phase 1 must review Express-vs-Next ownership. |
| `happy-colors-nextjs-project/src/app/api/offices/econt/route.js` | Next API route | Office lookup proxy | Defer | Next-owned proxy is business-adjacent; Phase 1 must justify runtime ownership or route through Express. |
| `happy-colors-nextjs-project/src/app/api/offices/speedy/route.js` | Next API route | Office lookup proxy | Defer | Next-owned proxy is business-adjacent; Phase 1 must justify runtime ownership or route through Express. |
| `happy-colors-nextjs-project/src/app/api/upload-image/route.js` | Next API route | Generic image upload | Defer | Next-owned upload route uses multipart/File/Storage helpers; Phase 1 must justify why Express cannot own it. |
| `happy-colors-nextjs-project/src/app/api/uploads/delete/route.js` | Next API route | Upload delete | Defer | Next-owned route uses Mongo/storage helpers and token verification; Phase 1 must review ownership drift. |
| `happy-colors-nextjs-project/src/app/api/uploads/proxy/route.js` | Next API route | Upload proxy | Defer | Next-owned upload proxy uses multipart/File/Storage helpers; Phase 1 must justify runtime ownership. |
| `happy-colors-nextjs-project/src/app/api/uploads/sign/route.js` | Next API route | Upload signing | Defer | Next-owned signed upload route uses GCS policy generation; Phase 1 must justify runtime ownership and helper boundaries. |
| `happy-colors-nextjs-project/src/app/api/revalidate/blog/route.js` | Next API route | Revalidation | Keep | Accepted Next-owned route because it calls `revalidatePath`/`revalidateTag`; route entrypoint is convention-owned. |
| `happy-colors-nextjs-project/src/app/api/revalidate/cartoon-hero-banners/route.js` | Next API route | Revalidation | Keep | Accepted Next-owned route because it calls `revalidateTag` and localized path revalidation. |
| `happy-colors-nextjs-project/src/app/api/revalidate/home-banners/route.js` | Next API route | Revalidation | Keep | Accepted Next-owned route because it calls `revalidateTag` and localized path revalidation. |
| `happy-colors-nextjs-project/src/app/api/revalidate/products/route.js` | Next API route | Revalidation | Keep | Accepted Next-owned route because it calls `revalidatePath`/`revalidateTag`; keep route thin. |
| `happy-colors-nextjs-project/src/app/blog/page.jsx` | Frontend page | Blog repair guard | Keep | Public legacy/non-localized page convention file; do not alter route architecture. |
| `happy-colors-nextjs-project/src/app/layout.js` | Frontend layout | Auth/session hint | Defer | Root layout now participates in session hint; review with auth shell tests. |
| `happy-colors-nextjs-project/src/components/blog/BlogArticleDetails.jsx` | Frontend component | Blog repair guard | Defer | Protect full article rendering; only consolidate after visual parity. |
| `happy-colors-nextjs-project/src/config/productLimits.js` | Frontend config wrapper | Product/upload limits | Defer | Frontend stable import boundary to shared constants; review with product limits family. |
| `happy-colors-nextjs-project/src/content/publicPages/blog.js` | Frontend content | Blog repair guard | Keep | Content owner for public blog copy. |
| `happy-colors-nextjs-project/src/context/AuthContext.jsx` | Frontend context | Auth/session hint | Defer | Established auth state owner; preserve anonymous gating behavior while reviewing ownership. |
| `happy-colors-nextjs-project/src/context/AuthWrapper.jsx` | Frontend context | Auth/session hint | Defer | Established auth wrapper; review provider boundaries before edits. |
| `happy-colors-nextjs-project/src/context/ProductContext.jsx` | Frontend context | Product state | Defer | Existing product context owner; classify with manager/cache changes. |
| `happy-colors-nextjs-project/src/context/authSessionHint.js` | Frontend context helper | Auth/session hint | Defer | Small non-sensitive cookie presence helper; Phase 1 must decide whether it is a stable helper or inline layout logic. |
| `happy-colors-nextjs-project/src/managers/blogArticlesManager.js` | Frontend manager | Manager request utils | Defer | Manager remains endpoint owner; verify helper does not hide cache/no-store decisions. |
| `happy-colors-nextjs-project/src/managers/categoriesManager.js` | Frontend manager | Manager request utils | Defer | Manager remains endpoint owner; verify helper does not hide cache/no-store decisions. |
| `happy-colors-nextjs-project/src/managers/homeBannersManager.js` | Frontend manager | Manager request utils | Defer | Manager remains endpoint owner; verify helper does not hide cache/no-store decisions. |
| `happy-colors-nextjs-project/src/managers/productsManager.js` | Frontend manager | Manager request utils | Defer | Manager remains endpoint owner; product detail caching must stay deferred. |
| `happy-colors-nextjs-project/src/managers/requestUtils.js` | Frontend manager helper | Manager request utils | Defer | Used by four managers; keep only if endpoint tags/cache choices stay explicit. |
| `happy-colors-nextjs-project/src/middleware.js` | Next middleware | Auth/session/i18n | Defer | Imports `shared/authConstants.js`, `@/i18n/config`, and `@/i18n/routing`; Phase 1 must verify all middleware imports stay edge-safe. |
| `happy-colors-nextjs-project/src/utils/isOwner.js` | Frontend utility wrapper | Ownership checks | Defer | Frontend stable wrapper around cross-runtime ownership predicate; wrapper decision pending. |
| `server/__tests__/integration/blogArticles.test.js` | Backend integration test | Blog revalidation/service | Defer | Protects Express service behavior and revalidation calls; final keep/delete decision belongs with blog service batch. |
| `server/__tests__/integration/categories.test.js` | Backend integration test | Product/category revalidation | Defer | Protects Express category behavior and product surface revalidation; final keep/delete decision belongs with category batch. |
| `server/__tests__/integration/products.test.js` | Backend integration test | Product service/revalidation | Defer | Protects Express product behavior and cache/no-store-adjacent invalidation; final keep/delete decision belongs with product batch. |
| `server/__tests__/integration/translations.test.js` | Backend integration test | Translation revalidation | Defer | Protects Express-owned translation workflow and product/blog invalidation; final keep/delete decision belongs with translation batch. |
| `server/__tests__/unit/helpers/revalidateProducts.test.js` | Backend unit test | Revalidation | Keep | Domain helper test; must remain if `revalidateSurfaces.js` is retained. |
| `server/__tests__/unit/helpers/revalidateBlog.test.js` | Backend unit test | Revalidation | Keep | New domain helper test; required before retaining blog revalidation helper. |
| `server/config/productLimits.js` | Backend config wrapper | Product/upload limits | Defer | Server stable import boundary to shared constants; review with product limits family. |
| `server/helpers/cartoonOrderUploadToken.js` | Backend helper wrapper | Upload token wrapper | Defer | Express helper boundary around Node-only shared token core; wrapper decision pending. |
| `server/helpers/cartoonUploadGuards.js` | Backend helper wrapper | Cartoon upload guards | Defer | Express helper boundary around guard core; shared core direct env access must be removed or justified. |
| `server/helpers/gcsImageHelper.js` | Backend helper | GCS/storage | Defer | Established backend storage owner; shared mixed code should not absorb DB/storage behavior. |
| `server/helpers/revalidateBlog.js` | Backend helper | Revalidation | Defer | Domain helper around generic fetch/error helper; keep if blog and translation services use it after branch coverage review. |
| `server/helpers/revalidateProducts.js` | Backend helper | Revalidation | Defer | Domain helper already used by product/category/translation services; final decision belongs with revalidation family. |
| `server/helpers/revalidateSurfaces.js` | Backend helper | Revalidation | Defer | Generic same-layer helper; keep only with direct tests or full domain-wrapper branch coverage. |
| `server/middlewares/auth.js` | Backend middleware | Auth wrapper | Defer | Established Express auth pipeline owner; now delegates JWT primitives and needs authCore split decision. |
| `server/services/blogArticlesService.js` | Backend service | Blog service/revalidation/GCS | Defer | Express business owner; shared utility imports need ownership review. |
| `server/services/categoryServices.js` | Backend service | Category service/revalidation | Defer | Express business owner; imports domain product revalidation helper. |
| `server/services/homeBannersService.js` | Backend service | Home banners service/GCS | Defer | Express business owner; shared GCS validation import requires review. |
| `server/services/productsServices.js` | Backend service | Product service/revalidation/limits | Defer | Express business owner; uses server config wrapper and domain revalidation helper. |
| `server/services/translation/translationService.js` | Backend service | Translation revalidation | Defer | Express business owner; imports product/blog domain revalidation helpers. |
| `server/utils/isOwner.js` | Backend utility wrapper | Ownership checks | Defer | Server stable wrapper around shared ownership predicate; wrapper decision pending. |
| `server/utils/userRoles.js` | Backend utility wrapper | Auth/roles | Defer | Server stable role utility boundary; currently delegates to Node-only `authCore.js`. |
| `shared/authConstants.js` | Root shared | Auth/session constant | Keep | Allowed edge-safe constant used by middleware, auth session hint, and Node auth core. Direct unit test need is low but import safety must stay verified. |
| `shared/authCore.js` | Root shared | Auth/roles/JWT | Move | Mixed role utilities plus Node crypto/JWT/env access; used by both runtimes but should be split so pure role predicates and Node JWT primitives have clear owners. Direct unit tests required for retained pieces. |
| `shared/cartoonOrderUploadTokenCore.js` | Root shared | Upload token core | Defer | Node-only crypto core used by Express and Next Node routes; needs explicit exception record and direct unit tests if retained. |
| `shared/cartoonUploadGuardsCore.js` | Root shared | Cartoon upload guards | Move | Node-only and reads `process.env`, including guard secret; shared core should receive runtime-specific loaders instead of owning env policy. Direct unit tests required for retained pure/Node pieces. |
| `shared/config/productLimits.js` | Root shared config | Product/upload limits | Keep | Allowed pure constants used by both runtimes; direct config/import tests required if retained. |
| `shared/gcsCore.js` | Root shared | GCS/storage utilities | Move | Mixed pure validation with Node-only `path`/`crypto` helpers and direct env fallback; split pure predicates from runtime env/storage helpers. Direct unit tests required for retained pieces. |
| `shared/productOwnership.js` | Root shared | Ownership predicates | Keep | Allowed pure cross-runtime ownership predicates used by server and frontend wrappers. Direct unit tests required if retained as root shared. |

## 4. Repo-Wide Duplicate And Ownership Scan

### 4.1 Root `shared/` import map

| Shared module | Importers found | Runtime classification | Phase 1 decision needed |
| --- | --- | --- | --- |
| `shared/authConstants.js` | `shared/authCore.js`, `server/middlewares/auth.js` via authCore, `happy-colors-nextjs-project/src/middleware.js`, `happy-colors-nextjs-project/src/context/authSessionHint.js` | Edge-safe | Keep as pure constant unless a stricter owner is chosen. |
| `shared/authCore.js` | `server/middlewares/auth.js`, `server/utils/userRoles.js`, `happy-colors-nextjs-project/src/app/api/_lib/auth.js` | Node-only, mixed auth/roles | Move/split. Role predicates and JWT crypto/env handling need clearer owners. Direct unit tests required for retained pieces. |
| `shared/cartoonOrderUploadTokenCore.js` | `server/helpers/cartoonOrderUploadToken.js`, `happy-colors-nextjs-project/src/app/api/_lib/cartoonOrderUploadToken.js` | Node-only | Defer. Potential exception only if wrappers own secret loading and direct unit tests cover the core. |
| `shared/cartoonUploadGuardsCore.js` | `server/helpers/cartoonUploadGuards.js`, `happy-colors-nextjs-project/src/app/api/_lib/cartoonUploadGuards.js` | Node-only and env-reading | Move/split. Shared code must receive runtime-specific secret/env loaders instead of reading guard secrets directly. |
| `shared/config/productLimits.js` | server config wrapper, frontend config wrapper, `shared/gcsCore.js`, `server/helpers/gcsImageHelper.js` | Edge-safe constants | Likely keep with wrapper-boundary decision. |
| `shared/gcsCore.js` | server GCS helper, server services, Next GCS helper | Mixed Node-only and pure validation with direct env fallback | Move/split. Pure validation should be separated from Node helpers and env-dependent bucket fallback. |
| `shared/productOwnership.js` | server `isOwner` wrapper, frontend `isOwner` wrapper | Edge-safe pure predicates | Likely keep with wrapper-boundary decision; direct unit tests required if retained. |

The pure shared modules above are classified `Keep` because the design allows edge-safe cross-runtime constants and pure predicates. Their records in Section 5 are retained-shared governance records, not a claim that the modules violate canonical ownership.

### 4.2 Revalidation ownership

- Next route files under `happy-colors-nextjs-project/src/app/api/revalidate/**/route.js` are convention-owned entrypoints and call `revalidatePath`/`revalidateTag`, so they are accepted canonical Next-owned surfaces once their rationale is recorded.
- `happy-colors-nextjs-project/src/app/api/revalidate/_lib/localizedPaths.js` imports `next/cache` and i18n helpers. It is Next-runtime-owned and must stay covered by localized revalidation path tests.
- `happy-colors-nextjs-project/src/app/api/revalidate/_lib/revalidateRoute.js` centralizes request auth/rate limit/body handling. Phase 1 must verify it does not hide surface-specific route ownership.
- `server/helpers/revalidateProducts.js` and `server/helpers/revalidateBlog.js` preserve domain helper names for Express services.
- `server/helpers/revalidateSurfaces.js` is currently used by both product and blog domain helpers. It can remain only if direct tests are added or the domain helper tests cover every meaningful fetch/error branch.
- Current imports confirm services call domain helpers, not `revalidateSurfaces.js` directly.

### 4.3 Non-Revalidation Next API Route Ownership

Phase 0 found these Next API route files outside revalidation:

| Route file | Current ownership signal | Phase 1 requirement |
| --- | --- | --- |
| `src/app/api/analytics/summary/route.js` | Next route using Next auth/Google Analytics helper. | Record runtime-only rationale or move/proxy through Express owner. |
| `src/app/api/blog/images/route.js` | Next multipart/File upload route using GCS helper. | Justify Next multipart/runtime ownership and backend business boundary. |
| `src/app/api/cartoon-orders/upload-session/route.js` | Next route explicitly excluded from Express by route ownership tests. | Record durable rationale for Next ownership and session-store boundary. |
| `src/app/api/cartoon-orders/uploads/route.js` | Next multipart/File upload route using storage, token, guard, quota, and session helpers. | Review for ownership drift; record why Express cannot own the workflow. |
| `src/app/api/cartoon-orders/uploads/cleanup/route.js` | Next cleanup route touching storage, token verification, session cleanup, and quota counters. | Review for ownership drift; record runtime-only rationale or migration plan. |
| `src/app/api/offices/econt/route.js` | Next proxy route to backend delivery office lookup. | Decide whether proxy belongs in Next or should be Express-owned/fronted differently. |
| `src/app/api/offices/speedy/route.js` | Next proxy route to backend delivery office lookup. | Decide whether proxy belongs in Next or should be Express-owned/fronted differently. |
| `src/app/api/upload-image/route.js` | Next multipart/File image upload route using GCS helper. | Justify Next upload runtime or classify as move candidate. |
| `src/app/api/uploads/delete/route.js` | Next route using Mongo, storage, and upload-delete token verification. | Review for backend ownership drift and storage authorization policy. |
| `src/app/api/uploads/proxy/route.js` | Next multipart/File upload proxy using GCS helper. | Justify Next upload runtime or classify as move candidate. |
| `src/app/api/uploads/sign/route.js` | Next route generating GCS signed upload policies. | Justify GCS signing in Next and record helper boundary. |

These routes are all `Defer` until Phase 1 records a runtime-only rationale, move decision, or explicit exception.

Route ownership test notes:

- `/api/offices/econt` has an explicit "routes away from Express" assertion; `/api/offices/speedy` currently relies on default-Next behavior and should get a matching assertion during the route ownership cleanup batch.
- `isBackendApiPath` is default-Next: unknown `/api/*` routes are not backend-owned unless explicitly listed as Express-owned. Phase 1 must not treat test presence alone as a durable ownership rationale for any Next route.

### 4.4 Middleware Edge-Safety

- `happy-colors-nextjs-project/src/middleware.js` imports `shared/authConstants.js`, `@/i18n/config`, and `@/i18n/routing`.
- `shared/authConstants.js` is edge-safe and crypto-free.
- `@/i18n/routing` is pure URL/header/path logic in the inspected file.
- `@/i18n/config` is pure config plus reads of public Next env flags through `process.env.NEXT_PUBLIC_ENGLISH_LOCALE_ENABLED` and `process.env.NEXT_PUBLIC_LOCALE_ROUTES_ENABLED`.
- Phase 1 must decide whether these i18n env reads are acceptable in middleware or should be injected/isolated for stricter edge-safety documentation.

### 4.5 Manager request utilities

- `requestUtils.js` is imported by `productsManager.js`, `blogArticlesManager.js`, `categoriesManager.js`, and `homeBannersManager.js`.
- The helper currently standardizes query-string building and public server fetch options.
- Authenticated/cookie-forwarding fetches remain visibly `cache: 'no-store'` in the scanned managers.
- Phase 1 should decide whether public cache tags remain explicit enough at call sites or whether helper use hides too much behavior.

### 4.6 Compatibility wrappers

Wrapper chains found:

- Product limits: `shared/config/productLimits.js` -> `server/config/productLimits.js` and `happy-colors-nextjs-project/src/config/productLimits.js`.
- Ownership checks: `shared/productOwnership.js` -> `server/utils/isOwner.js` and `happy-colors-nextjs-project/src/utils/isOwner.js`.
- Auth roles/JWT: `shared/authCore.js` -> `server/utils/userRoles.js`, `server/middlewares/auth.js`, and `happy-colors-nextjs-project/src/app/api/_lib/auth.js`.
- Upload tokens: `shared/cartoonOrderUploadTokenCore.js` -> server and Next `_lib` wrappers.
- Cartoon upload guards: `shared/cartoonUploadGuardsCore.js` -> server and Next `_lib` wrappers.
- GCS helpers: `shared/gcsCore.js` -> server GCS helper, Next GCS helper, and backend services.

No wrapper should be deleted before caller migration and focused tests.

### 4.7 Direct Test Gaps For Shared Modules

Plan Batch B requires explicit unit tests for every retained or moved root `shared/` module regardless of coverage reports.

| Module | Current direct-test status | Required before retain/move completion |
| --- | --- | --- |
| `shared/authConstants.js` | No direct test found; low-branch constant. | Import-safety/config test or covered owner-approved exception. |
| `shared/authCore.js` | No direct shared test found. | Direct tests for role normalization/serialization and JWT verification, or split tests after move. |
| `shared/cartoonOrderUploadTokenCore.js` | Contract tests exist through wrappers; no direct shared test found. | Direct tests for sign/verify mismatch, purpose/session/object/content/size/expiration branches if retained. |
| `shared/cartoonUploadGuardsCore.js` | Wrapper tests exist; no direct shared test found. | Direct tests after env-loader injection/split. |
| `shared/config/productLimits.js` | Config wrapper tests may exist; no direct shared test found. | Direct constant/import test or owner-approved wrapper-level proof. |
| `shared/gcsCore.js` | GCS wrapper tests exist; no direct shared test found. | Direct tests for URL/object-name validation branches after split. |
| `shared/productOwnership.js` | Server wrapper tests exist; no direct shared test found. | Direct tests for owner id normalization and manage checks if retained. |

### 4.8 Deferred Repo-Wide Scan Areas

The following layers were identified but not fully classified in Phase 0. They are explicitly deferred into Phase 1 or later behavior-family batches:

- Frontend hooks: `src/hooks/useForm.js`, `src/hooks/useImageSlideshow.js`. Defer because no current dirty changes touch them, but UI/client-state cleanup must scan them before hook consolidation.
- Frontend non-auth contexts: `CartContext.jsx`, `ProductContext.jsx`. Defer until context/provider ownership batch.
- CSS modules and global CSS: 34 CSS files under `src/app/**` and `src/components/**`. Defer until UI/style reuse batch; do not delete by basename or visual similarity.
- Server controllers: all files under `server/controllers/**`. Defer until backend services/controllers/routes ownership batch.
- Server models/schemas: all files under `server/models/**`. Defer until backend model/schema ownership batch.
- Server middlewares outside auth: `trustedOrigin.js`, `rateLimit.js`, `paymentValidations.js`. Defer until middleware/validator cleanup batch.
- Frontend content modules: `src/content/publicPages/**`. Defer until content/style reuse batch; current blog content file remains a blog repair guard.
- Test factories/mocks/setup beyond touched files: defer until test utility batch; repeated mocks should not be generalized without scenario clarity.

### 4.9 Pre-existing duplicate candidates outside current diff

These are scan findings only, not deletion targets:

- `CONTACT_MESSAGE_MAX_LENGTH` and `CARTOON_CONTACT_MESSAGE_MAX_LENGTH` exist in both `server/controllers/contactsController.js` and `happy-colors-nextjs-project/src/utils/formValidations.js`. Phase 1 should classify whether this is intentional runtime-local validation or a pure shared limit candidate.
- GCS object-name/path validation exists in `shared/gcsCore.js`, `server/helpers/gcsImageHelper.js`, and Next upload/delete routes. Phase 1 should decide whether to split pure object-name predicates from Node storage helpers.
- Integration test setup mocks contain a local implementation of cartoon photo object-name validation. Phase 1 should decide whether tests should import a pure predicate or keep local mocks for isolation.
- Many `page.js`, `page.jsx`, `layout.js`, and `route.js` duplicate basenames are framework convention files. They are not deletion candidates by basename alone.
- Test setup/mocking patterns are repeated across frontend API/component suites. Consolidate only if a helper improves clarity without hiding scenario intent.

## 5. Initial Exception Log Draft

Exception IDs are provisional until owner approval. EX-001 documents an accepted canonical Next-owned revalidation surface, and EX-002, EX-004, and EX-005 document retained allowed root-shared surfaces; their Phase 0 classification is `Keep`, not `Exception`.

```text
Exception ID: EX-001
Owner: happy-colors-nextjs-project/src/app/api/revalidate/**/route.js
Canonical owner: Next runtime route entrypoints
Rationale: These endpoints call Next-only revalidatePath/revalidateTag APIs.
Scope: Product, blog, home banner, and cartoon hero banner cache invalidation endpoints.
Callers: Express domain services call backend revalidation helpers that POST to these endpoints.
Runtime constraints: Next App Router route.js files are convention-owned; public /bg and /en routes unchanged.
Review references: Cleanup design and implementation plan reviews already recorded in local docs.
Tests: Frontend revalidation API tests, localized revalidation paths, apiRouteOwnership, unifiedRouting.
Removal or revalidation condition: Revisit if Next exposes a different supported invalidation boundary or if route ownership changes.
Owner approval: Pending.

Exception ID: EX-002
Owner: shared/authConstants.js
Canonical owner: Cross-runtime pure constants
Rationale: Middleware and server/Next auth need the same cookie name without importing Node-only crypto.
Scope: AUTH_COOKIE_NAME only.
Callers: Next middleware, authSessionHint, authCore.
Runtime constraints: Edge-safe; must remain crypto-free and env-free.
Review references: Pending Phase 1 owner approval.
Tests: authSessionHint, middleware/auth tests where touched.
Removal or revalidation condition: Revisit if auth cookie ownership moves into a stricter shared constants package.
Owner approval: Pending.

Exception ID: EX-003
Owner: shared/cartoonOrderUploadTokenCore.js
Canonical owner: Cross-runtime Node-only token primitive
Rationale: Express and Next Node routes need identical HMAC token semantics.
Scope: Cartoon upload session, confirmation, and photo-read token encode/sign/verify behavior.
Callers: server/helper wrapper and Next API _lib wrapper.
Runtime constraints: Node-only; must not be imported by middleware, Edge runtime, client components, or browser bundles.
Review references: Pending Phase 1 owner approval.
Tests: upload token contract tests and server/Next wrapper tests.
Removal or revalidation condition: Revisit if one runtime stops needing token generation/verification.
Owner approval: Pending.

Exception ID: EX-004
Owner: shared/config/productLimits.js
Canonical owner: Cross-runtime pure constants
Rationale: Frontend validation/UI and backend validation must share product/upload limits.
Scope: Product video/image and cartoon order photo limits and MIME type constants.
Callers: server config wrapper, frontend config wrapper, GCS helper.
Runtime constraints: Edge-safe constants only.
Review references: Pending Phase 1 owner approval.
Tests: config/unit tests and upload validation tests.
Removal or revalidation condition: Revisit if constants move into a stricter shared package.
Owner approval: Pending.

Exception ID: EX-005
Owner: shared/productOwnership.js
Canonical owner: Cross-runtime pure predicates
Rationale: Server and frontend need consistent owner-id comparison while preserving runtime wrappers.
Scope: Product owner id normalization and owner/manage checks.
Callers: server isOwner wrapper, frontend isOwner wrapper.
Runtime constraints: Edge-safe, pure, no DB/user-service policy.
Review references: Pending Phase 1 owner approval.
Tests: server isOwner tests and frontend product access tests.
Removal or revalidation condition: Revisit if frontend no longer performs local ownership display checks.
Owner approval: Pending.
```

Pending Phase 1 exception or move decisions:

| Surface | Current Phase 0 classification | Required Phase 1 decision |
| --- | --- | --- |
| `shared/authCore.js` | Move | Split role predicates from Node JWT/env helpers or record a narrow Node-only exception. |
| `shared/cartoonOrderUploadTokenCore.js` | Defer | Record Node-only token primitive exception only if wrappers own secret loading and direct tests exist. |
| `shared/cartoonUploadGuardsCore.js` | Move | Remove direct shared env/secret reads by injecting runtime loaders or move code into runtime owners. |
| `shared/gcsCore.js` | Move | Split pure GCS URL/object-name predicates from Node path/crypto/env helpers. |
| `happy-colors-nextjs-project/src/app/api/_lib/auth.js` | Defer | Decide whether Next API auth adapter is a stable runtime boundary. |
| `happy-colors-nextjs-project/src/app/api/_lib/cartoonOrderUploadToken.js` | Defer | Decide whether Next token wrapper is a stable runtime boundary after core ownership decision. |
| `happy-colors-nextjs-project/src/app/api/_lib/cartoonUploadGuards.js` | Defer | Decide whether Next guard wrapper is a stable runtime boundary after core split/move. |
| `happy-colors-nextjs-project/src/app/api/_lib/gcs.js` | Defer | Decide whether Next GCS wrapper owns env/storage setup and which pure helpers it may import. |
| `server/config/productLimits.js` and `happy-colors-nextjs-project/src/config/productLimits.js` | Defer | Decide whether runtime config wrappers are stable import boundaries or caller migration targets. |
| `server/utils/isOwner.js` and `happy-colors-nextjs-project/src/utils/isOwner.js` | Defer | Decide whether wrappers preserve useful runtime/domain import paths. |
| `server/utils/userRoles.js` | Defer | Decide whether server role utility remains a stable boundary after `authCore.js` split. |
| `server/helpers/cartoonOrderUploadToken.js` and `server/helpers/cartoonUploadGuards.js` | Defer | Decide whether Express helper wrappers protect runtime env/cookie/request boundaries. |
| `server/helpers/revalidateBlog.js`, `server/helpers/revalidateProducts.js`, `server/helpers/revalidateSurfaces.js` | Defer | Decide retained domain/generic helper shape and direct-test coverage. |
| Non-revalidation Next API routes listed in Section 4.3 | Defer | Record runtime-only rationale, explicit exception, or move/migration plan per route. |

## 6. Phase 0 Blockers Before Implementation

1. Owner gave permission to continue on 2026-08-07, but Phase 1 owner decisions still need explicit approval before code implementation.
2. Durable record strategy must be selected: force-add docs to git, owner-approved external record, or another explicit durable location.
3. Reversible baseline must be owner-approved before any refactor/deletion batch: checkpoint commit, checkpoint branch, or external snapshot.
4. Phase 1 must approve wrapper/shared decisions before code changes.
5. Opus Phase 0 review raised findings F1-F8. This revision incorporates them; follow-up Opus review is required before Phase 0 is considered closed.

## 7. Recommended Phase 1 Order

1. Resolve durable record and reversible baseline.
2. Decide root `shared/` classifications, especially mixed modules: `authCore.js`, `gcsCore.js`, and `cartoonUploadGuardsCore.js`.
3. Decide wrapper policy for product limits, ownership checks, token helpers, guard helpers, and GCS helpers.
4. Decide whether `revalidateSurfaces.js` gets direct tests or is covered by domain helper tests.
5. Decide whether `requestUtils.js` keeps cache choices explicit enough.
6. Preserve blog repair and auth/session hint tests as regression guards while cleanup proceeds.

## 8. Opus Review History

### Claude Opus Phase 0 Review - 2026-08-07

Model ID: `claude-opus-4-8`

Reviewed target: `AGENTS.md`, cleanup design document, cleanup implementation plan, and this Phase 0 inventory.

Review artifact: Claude CLI output in the current Codex conversation transcript.

Owner approval reference: owner asked to continue and to use only Opus after each phase on 2026-08-07.

Outcome: Opus raised actionable findings:

- inventory all non-revalidation Next API route files;
- correct the middleware import/edge-safety claim;
- add `revalidate/_lib/localizedPaths.js`;
- reclassify direct-env-reading shared modules as move/split candidates;
- flag direct unit-test gaps for retained/moved root `shared/` modules;
- explicitly defer unscanned layers required by the Phase 0 scan plan;
- add pending exception markers for non-canonical wrappers and mixed shared modules;
- replace dual classifications with a single classification per row.

These findings were incorporated into this revision and require follow-up Opus review to close.

### Claude Opus Phase 0 Follow-Up Review - 2026-08-07

Model ID: `claude-opus-4-8`

Reviewed target: `AGENTS.md`, cleanup design document, cleanup implementation plan, and the revised Phase 0 inventory after F1-F8 fixes.

Review artifact: Claude CLI output in the current Codex conversation transcript.

Owner approval reference: owner asked to continue and to use only Opus after each phase on 2026-08-07.

Outcome: Opus verified that F1-F8 were resolved and accurate. It reported one true blocker already self-flagged in this report: durable-record and reversible-baseline decisions remain open before implementation batches. It also raised follow-up refinements:

- reconcile allowed pure root `shared/` modules so they are not both `Exception` and `Keep`;
- note that `/api/offices/speedy` lacks a matching explicit route ownership assertion while `/api/offices/econt` has one;
- note that route ownership tests default unknown `/api/*` paths to Next, so Phase 1 must record runtime-only rationale per Next route and not rely on test presence alone.

These refinements were incorporated into this revision and require final Opus closure review.

### Claude Opus Phase 0 Closure Review - 2026-08-07

Model ID: `claude-opus-4-8`

Reviewed target: final revised Phase 0 inventory after R2-R4 fixes.

Review artifact: Claude CLI output in the current Codex conversation transcript.

Owner approval reference: owner asked to continue and to use only Opus after each phase on 2026-08-07.

Outcome: Opus verified that R2-R4 were correctly addressed, the route ownership inventory is complete, direct-test gaps are catalogued, and durable-record/reversible-baseline blockers are correctly held open. It reported no blocking gaps. It raised one low-severity consistency issue: accepted canonical Next revalidation routes should not be classified as `Exception` while accepted pure shared modules are classified `Keep`.

That consistency issue was addressed by classifying revalidation route entrypoints and `localizedPaths.js` as `Keep`, while retaining EX-001 as a rationale/governance record for accepted Next-owned revalidation surfaces.
