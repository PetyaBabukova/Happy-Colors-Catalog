# Happy Colors - Codebase Cleanup And Reuse Optimization Design Document

**Date:** 2026-08-06
**Status:** Revised after Claude Opus 4.8 and independent Codex reviews
**Scope:** Project-wide removal of unnecessary files, duplicated functionality, duplicated components, duplicated hooks/contexts, duplicated managers/services/controllers, duplicated helpers/utilities/configuration, duplicated styles/content/test utilities, route ownership drift, and code surfaces added during the public performance optimization work.
**Deployment model:** Unchanged. The root `node server.js` unified deploy remains the runtime model.
**URL architecture:** Unchanged. Public localized routes remain `/bg/...` and `/en/...`.

---

## 1. Goal

Pause the public performance optimization implementation and run a project-wide cleanup/refactor task focused on code quality, reuse, and ownership boundaries.

The desired outcome is a smaller, clearer codebase where existing modules own their established responsibilities, duplicated behavior is consolidated, and unnecessary new files are deleted only after their callers are safely migrated.

This is not a route-only cleanup. Route files are only one category. The cleanup applies to every layer of the project: UI components, pages, layouts, hooks, contexts, managers, services, controllers, routers, helpers, utilities, schemas, styles, content modules, configuration, tests, mocks, and factories.

This task must:

- follow `AGENTS.md` Architecture and reuse rules as a hard gate;
- reuse existing components, pages, layouts, hooks, contexts, managers, services, controllers, routers, helpers, utilities, schemas, styles, test factories, mocks, and configuration before adding or keeping new surfaces;
- remove unnecessary files and compatibility wrappers when they no longer provide a real ownership or migration benefit;
- avoid parallel implementations of the same behavior;
- keep the unified deploy model unchanged;
- keep `/bg/...` and `/en/...` route architecture unchanged;
- avoid reading, logging, or exposing environment secret values;
- preserve current public behavior, including restored blog page design and localized blog article rendering;
- preserve cache/security rules already required by the paused performance task where those changes remain in the working tree;
- maintain the repository's configured test and coverage gates;
- add or keep targeted regression tests for behavior affected by cleanup.

---

## 2. Non-Goals

- Do not continue broad performance optimization implementation as part of this task.
- Do not add product detail caching.
- Do not change public URL architecture.
- Do not rewrite Express business routes into Next.js API routes.
- Do not move established Express route ownership into Next.js unless the behavior requires the Next.js runtime.
- Do not delete files only because they are new; delete them only when no current or planned caller needs them.
- Do not collapse the repo into one giant shared folder without preserving runtime constraints.
- Do not perform visual redesign while doing code cleanup.
- Do not revert unrelated dirty worktree changes without explicit owner approval.
- Do not read `.env`, `.env.local`, `.env.*`, credential files, or secret-bearing files.

---

## 3. Hard Rules From `AGENTS.md`

These are acceptance criteria, not suggestions.

1. Reuse existing code first.
2. Do not create or keep a new file, module, component, hook, helper, service, controller, route, API endpoint, style block, test utility, or abstraction when an existing one can be extended safely.
3. Keep ownership in the established module for that behavior.
4. Business API ownership stays in Express modular routes unless a capability must run in the Next.js runtime, such as `revalidatePath` or `revalidateTag`.
5. If a new code surface is technically necessary, document why the existing owner cannot own the behavior.
6. Keep any technically necessary new surface as small and local as possible.
7. Add an abstraction only when it removes real duplication, reduces meaningful complexity, or matches an established local pattern.
8. Avoid parallel implementations of the same behavior.
9. Before adding or keeping code, search for existing behavior and reuse or extend it.

---

## 4. Current Situation

The working tree contains a mix of:

- paused MVP performance/caching changes;
- emergency blog page design/content fixes;
- anonymous auth UX changes;
- revalidation changes;
- project-wide reuse refactor attempts;
- new shared modules and helper wrappers.

The repo-wide cleanup also includes pre-existing duplication outside the current working diff. Current changes are the first inventory input, not the full scope.

The key risk is that cleanup and performance optimization are now mixed in one diff. The next task should separate intent before implementation:

| Change family | Current state | Cleanup risk |
| --- | --- | --- |
| Public performance MVP | Partially implemented in working tree | Can hide reuse violations if treated as performance-only |
| Blog design/content repair | Working after prior fixes | Must not regress while refactoring |
| Revalidation route helper | Shared helper introduced under Next route namespace | Useful only if it removes duplication without changing route ownership |
| Root `shared/` modules | Introduced to bridge Express and Next code | Needs ownership review per module |
| Thin compatibility wrappers | Preserve old imports while shared code is introduced | Temporary unless they are the established public module boundary |
| Tests | Expanded to cover cache/i18n/security/UX | Must be kept or simplified without lowering meaningful regression protection |

---

## 5. Ownership Principles

### 5.0 Canonical project architecture

The cleanup must align the project to the owner's established architecture. This is the default ownership model unless a documented runtime constraint requires a narrow exception.

Frontend ownership:

- UI and interaction belong in components, pages, layouts, hooks, contexts, providers, and styles.
- Frontend data access belongs in managers as thin request adapters.
- Managers must not own backend business rules; they call the API and normalize request/response concerns only where the frontend already owns that behavior.

Backend ownership:

- Business API behavior belongs in the Express backend.
- Express routes must stay modular and delegate to controllers.
- Controllers coordinate request/response handling and call services.
- Services own backend business logic, persistence rules, publication rules, translation behavior, and domain workflows.
- Models and schemas own persistence shape, indexes, schema-level validation, and database representation.

Shared/common behavior ownership:

- Reused cross-cutting behavior belongs in the existing handlers, utilities, validators, helpers, or middlewares appropriate to its layer.
- This means per-runtime shared behavior inside the established frontend or backend layers. It does not automatically justify a root `shared/` module; root `shared/` remains limited by the cross-runtime pure-code rules in Section 5.3.
- Models and schemas own persistence invariants. Validators own request, route, and input contracts. Root `shared/` may hold only reusable pure predicates called by those owners; it must not become the owner of validation policy.
- Middlewares own request pipeline and access-control pipeline behavior.
- Utilities own pure transformations and calculations.
- Handlers/helpers may package same-layer glue only when they reduce real duplication. They must not become shadow owners for business rules, request lifecycle, UI state, or data access that belongs to components, managers, controllers, services, validators, or middlewares.

Cleanup rule:

- Nothing extra: do not keep a file, abstraction, helper, component, manager, service, controller, route, style, mock, or utility that does not have a clear role in this architecture.
- Nothing missing: do not remove an ownership boundary that the architecture needs for clarity, reuse, runtime safety, or testability.
- No parallel ownership: the same behavior must not be implemented in more than one layer.
- Any exception must state why the canonical owner cannot safely own the behavior.

### 5.1 Express remains business API owner

Express owns business routes, controllers, services, models, and public/admin business behavior.

Examples:

- products;
- categories;
- blog articles;
- translations;
- users;
- contacts;
- orders/payments/delivery where applicable.

Next.js API routes must not duplicate these business routes.

### 5.2 Next.js owns runtime-only Next capabilities

Next.js may own API routes only when the behavior needs the Next runtime or is already an established Next-only integration.

Accepted criteria:

- the endpoint must call a Next-only runtime API such as `revalidatePath` or `revalidateTag`;
- the endpoint must handle a browser-to-Next integration that cannot be safely owned by the Express business API without duplicating request/runtime behavior;
- the endpoint must be explicitly listed as Next-owned in route ownership tests and still pass the Phase 0 ownership review.

Phase 0 must treat `server/__tests__/unit/apiRouteOwnership.test.js` and `server/__tests__/unit/unifiedRouting.test.js` as the source of truth for API ownership. Conditional ownership language is not enough.

Any Next API route that lacks a concrete runtime requirement is a Phase 0 ownership-review candidate, not an accepted owner.

Accepted Next-owned routes must have a durable runtime-only rationale. Presence in ownership tests proves routing behavior, but it does not by itself justify ownership. The rationale must explain why the canonical Express owner cannot safely own the behavior, and it must be recorded in the Phase 0 inventory or the authoritative governance log.

### 5.3 Root shared code is allowed only for cross-runtime pure logic

Root `shared/` can exist only for pure code required by both Express and Next, where duplicating behavior would be worse. A module is not eligible for root `shared/` merely because it is useful in more than one file inside the same runtime; same-runtime reuse belongs in that runtime's established handlers, utilities, validators, helpers, or middlewares.

Allowed edge-safe shared candidates:

- constants used by both runtimes;
- pure validation logic;
- pure ownership checks;
- pure URL/object-name parsing;
- role/status normalization that does not import DB, Express, Next runtime APIs, Node-only modules, or secret loaders.

Allowed Node-only shared candidates:

- crypto/token primitives that receive runtime-specific secret loaders;
- helpers that use Node built-ins such as `crypto`, `Buffer`, `path`, or filesystem-safe path parsing.

Node-only shared modules must never be imported by Next middleware, Edge runtime code, client components, or browser bundles. Middleware-imported shared code must be edge-safe and crypto-free.

Root shared module classification must be explicit:

- edge-safe shared module: importable by middleware and server/runtime code only if it avoids Node-only APIs and browser-unsafe dependencies;
- Node-only shared module: importable only by Node runtimes and never by middleware, Edge runtime code, client components, or browser bundles;
- deletion candidate: not imported by both runtimes or not a pure cross-runtime behavior.

Disallowed shared candidates:

- modules that import Next runtime APIs;
- modules that import Express request/response objects directly;
- modules that connect to MongoDB;
- modules that load or inspect secret files;
- business services that already have one established owner.

### 5.4 Wrappers are temporary unless they are ownership boundaries

A wrapper is acceptable when it preserves a stable import path and delegates to a shared implementation. A wrapper becomes unnecessary when:

- no external or established local code benefits from the old import path;
- all callers can import from the real owner without increasing coupling;
- it does not hide runtime assumptions;
- removing it does not create noisy unrelated churn.

### 5.5 Exception log

Any accepted exception to the canonical architecture must be recorded before implementation relies on it.

Each exception record must include:

- owner: the file/module/layer allowed to keep the exception;
- rationale: why the canonical owner cannot safely own the behavior;
- scope: the exact behavior and callers covered by the exception;
- review status: Opus/Codex review references required by Section 9;
- removal or revalidation condition: when the exception should be removed, revisited, or converted back to the canonical owner.

Exceptions include retained wrappers, root `shared/` modules, Next-owned routes that do not obviously require a Next runtime API, and any helper/handler that coordinates behavior near a manager/controller/service boundary.

---

## 6. Inventory Of Cleanup Targets

This inventory is based on the current working tree and known project layers. It must be expanded by the Phase 0 repo-wide duplicate and ownership scan before implementation.

Cleanup target categories are not limited to files created during the performance task. Every layer below must be audited for unnecessary files, duplicated functionality, and missed reuse opportunities.

### 6.1 Next revalidation route duplication

Current files:

- `happy-colors-nextjs-project/src/app/api/revalidate/products/route.js`
- `happy-colors-nextjs-project/src/app/api/revalidate/blog/route.js`
- `happy-colors-nextjs-project/src/app/api/revalidate/home-banners/route.js`
- `happy-colors-nextjs-project/src/app/api/revalidate/cartoon-hero-banners/route.js`
- `happy-colors-nextjs-project/src/app/api/revalidate/_lib/localizedPaths.js`
- `happy-colors-nextjs-project/src/app/api/revalidate/_lib/revalidateRoute.js`

Decision:

- Keep the route entrypoint files because Next App Router requires `route.js` at each endpoint.
- Keep them thin.
- Keep shared request/auth/rate-limit/body parsing in `_lib/revalidateRoute.js` only if every route still has explicit local ownership of its revalidation surface.
- Do not move Express business invalidation ownership into these routes.

Cleanup actions:

1. Confirm no extra `route.js` file was created where an existing route could have been extended.
2. Confirm each route's unique code is only payload validation and surface-specific `revalidatePath`/`revalidateTag`.
3. Delete any route-local helper that duplicates `_lib/revalidateRoute.js`.
4. Keep tests focused on route contracts, not copied implementation.
5. Keep localized path generation tested through `localizedRevalidationPaths.test.js`, including both `/bg` and `/en` path revalidation.

### 6.2 Server revalidation helper duplication

Current files:

- `server/helpers/revalidateProducts.js`
- `server/helpers/revalidateBlog.js`
- `server/helpers/revalidateSurfaces.js`

Decision:

- `revalidateProducts.js` and `revalidateBlog.js` may remain as domain-owned helpers if services import domain names.
- `revalidateSurfaces.js` may remain only if it removes duplicated fetch/error handling without obscuring product/blog ownership.

Cleanup actions:

1. Verify all product services import `revalidateProducts.js`, not the generic helper directly.
2. Verify blog/translation services import `revalidateBlog.js`, not the generic helper directly.
3. If only one domain uses the generic helper after cleanup, inline it and delete `revalidateSurfaces.js`.
4. If both domains use it, keep it as an internal helper with tests at the domain helper level.

### 6.3 Root shared module review

Current folder:

- `shared/authConstants.js`
- `shared/authCore.js`
- `shared/cartoonOrderUploadTokenCore.js`
- `shared/cartoonUploadGuardsCore.js`
- `shared/config/productLimits.js`
- `shared/gcsCore.js`
- `shared/productOwnership.js`

Decision:

- Keep only modules that are truly cross-runtime and pure.
- Prefer an existing owner when behavior is used by one side only.

Cleanup actions:

1. For each `shared/` file, list all imports.
2. If imports exist from both `server/` and `happy-colors-nextjs-project/`, keep only if the module is pure and runtime-safe.
3. If imports exist from one side only, move the code back into that side's established module and delete the shared file.
4. Split mixed modules if necessary. For example, a crypto-free constant can be safer than importing an auth module with Node crypto into middleware.
5. Add tests for shared pure logic only when the behavior has meaningful branches; otherwise test through owning wrappers.

### 6.4 Compatibility wrapper review

Current wrapper candidates:

- `server/config/productLimits.js`
- `happy-colors-nextjs-project/src/config/productLimits.js`
- `server/utils/userRoles.js`
- `server/utils/isOwner.js`
- `happy-colors-nextjs-project/src/utils/isOwner.js`
- `server/helpers/cartoonOrderUploadToken.js`
- `happy-colors-nextjs-project/src/app/api/_lib/cartoonOrderUploadToken.js`
- `server/helpers/cartoonUploadGuards.js`
- `happy-colors-nextjs-project/src/app/api/_lib/cartoonUploadGuards.js`

Decision:

- Keep wrappers only where the file path is an established domain API.
- Delete wrappers only after callers are migrated and tests prove behavior is unchanged.

Cleanup actions:

1. Identify wrappers with one or two local callers.
2. Prefer direct imports from the owning module when it reduces indirection without crossing runtime boundaries.
3. Preserve wrappers that protect runtime-specific env loading, request adapters, cookie serialization, or DB access.
4. Do not leave wrapper chains.

### 6.5 Frontend manager duplication

Current files:

- `happy-colors-nextjs-project/src/managers/requestUtils.js`
- `happy-colors-nextjs-project/src/managers/productsManager.js`
- `happy-colors-nextjs-project/src/managers/blogArticlesManager.js`
- `happy-colors-nextjs-project/src/managers/categoriesManager.js`
- `happy-colors-nextjs-project/src/managers/homeBannersManager.js`

Decision:

- Keep a manager helper only if it standardizes repeated URL/query/cache behavior and does not hide endpoint-specific cache/security decisions.

Cleanup actions:

1. Confirm each manager still declares its own endpoint and cache tags explicitly.
2. Avoid a generic "API client" that hides public vs authenticated fetch behavior.
3. Keep `cache: 'no-store'` explicit for any cookie-forwarding or authenticated request.
4. Delete helper functions that are used by only one manager after cleanup.

### 6.6 Auth/session hint cleanup

Current files:

- `happy-colors-nextjs-project/src/context/authSessionHint.js`
- `happy-colors-nextjs-project/src/context/AuthContext.jsx`
- `happy-colors-nextjs-project/src/context/AuthWrapper.jsx`
- `happy-colors-nextjs-project/src/app/layout.js`
- `happy-colors-nextjs-project/src/middleware.js`
- `shared/authConstants.js`

Decision:

- Keep anonymous `/users/me` gating because it addresses a real UX issue and has tests.
- Keep the session hint logic as small as possible.
- Do not import Node crypto or DB code into middleware.

Cleanup actions:

1. Confirm `authSessionHint.js` only exposes non-sensitive boolean hint logic.
2. Confirm middleware imports only crypto-free constants.
3. Confirm anonymous public visits do not request `/users/me` without the hint.
4. Delete any duplicate cookie-name constants outside the chosen constant owner.

### 6.7 Blog page repair guard

Current files:

- `happy-colors-nextjs-project/src/app/blog/page.jsx`
- `happy-colors-nextjs-project/src/app/(localized)/[locale]/blog/page.js`
- `happy-colors-nextjs-project/src/components/blog/BlogArticleDetails.jsx`
- `happy-colors-nextjs-project/src/content/publicPages/blog.js`
- blog component tests

Decision:

- Treat restored blog page design and full article rendering as regression-protected behavior.
- Do not alter page structure as part of cleanup unless removing duplicated code preserves the exact UI.

Cleanup actions:

1. Keep tests that assert hero image and full current article rendering.
2. Ensure localized `/bg/blog` and `/en/blog` both delegate to the same page implementation or an intentionally shared component boundary.
3. Remove any duplicate blog list/detail composition that is not needed for localized routing.

### 6.8 UI components, pages, layouts, and styles

Current areas:

- `happy-colors-nextjs-project/src/components/**`
- `happy-colors-nextjs-project/src/app/**/page.js`
- `happy-colors-nextjs-project/src/app/**/page.jsx`
- `happy-colors-nextjs-project/src/app/**/layout.js`
- component-level CSS modules and shared style files
- public page content modules under `happy-colors-nextjs-project/src/content/**`

Decision:

- Reuse existing visual components, page composition components, layout boundaries, content modules, and style patterns before creating or keeping new UI files.
- Do not keep duplicate page/component implementations for BG/EN or legacy/non-localized routes unless the route architecture requires a thin entrypoint.
- Do not create parallel CSS modules for the same visual behavior when an existing module or component style can be extended safely.

Cleanup actions:

1. Identify components that render the same UI, state, or workflow with different filenames.
2. Identify page files that duplicate composition instead of delegating to a shared page/component boundary.
3. Identify styles that duplicate layout, card, grid, hero, form, or button behavior.
4. Consolidate duplicate content copy into the existing content ownership module.
5. Preserve visual behavior with component tests, screenshots, or manual QA when cleanup touches public UI.
6. Delete UI/style/content files only after all routes/components have migrated to the shared owner.

### 6.9 Hooks, contexts, providers, and client state

Current areas:

- `happy-colors-nextjs-project/src/hooks/**`
- `happy-colors-nextjs-project/src/context/**`
- provider wiring in `happy-colors-nextjs-project/src/app/ClientLayout.jsx`
- provider wiring in layouts and wrappers

Decision:

- Reuse existing hooks and contexts for shared state, auth/session state, product/category state, cart state, and public shell behavior.
- Do not create a new hook/context/provider when an existing one can be extended safely.
- Keep provider scope as narrow as practical without duplicating state ownership.

Cleanup actions:

1. Inventory all hooks and contexts and map their consumers.
2. Identify duplicate loading/error/session/product/category/cart state logic.
3. Merge duplicated client-state behavior under the established context or hook owner.
4. Delete provider wrappers only after confirming no layout route or test depends on them.
5. Keep anonymous-auth UX tests when auth/session state is touched.

### 6.10 Express services, controllers, routers, models, and schemas

Current areas:

- `server/controllers/**`
- `server/services/**`
- `server/routes/**`
- `server/models/**`
- `server/middlewares/**`
- `server/utils/**`
- `server/helpers/**`

Decision:

- Business behavior stays in the existing Express owner unless a Next runtime API is technically required.
- Reuse existing service/controller/router helpers instead of adding parallel business logic in frontend managers, Next API routes, or shared modules.
- Do not duplicate publication, ownership, translation, validation, or revalidation behavior across services.

Cleanup actions:

1. Map each business domain to its controller/service/router/model owner.
2. Identify duplicate service functions, validation branches, authorization checks, and helper logic.
3. Consolidate repeated behavior under the domain service or existing helper.
4. Keep controllers thin and avoid moving business rules into route handlers.
5. Run integration tests for any changed domain.

### 6.11 Frontend managers and API client behavior

Current areas:

- `happy-colors-nextjs-project/src/managers/**`
- `happy-colors-nextjs-project/src/config.js`
- upload and analytics manager modules

Decision:

- Managers should remain thin request adapters.
- Reuse URL construction, query normalization, and fetch option helpers only when doing so does not hide cache/auth/security decisions.
- Do not duplicate backend business rules in managers.

Cleanup actions:

1. Identify repeated fetch boilerplate and repeated endpoint URL assembly.
2. Keep endpoint-specific public/authenticated/no-store/cache tags explicit.
3. Delete manager helpers that are used by only one caller or obscure behavior.
4. Add tests for any changed public/authenticated cache boundary.

### 6.12 Test utilities, mocks, factories, and fixtures

Current areas:

- `server/__tests__/**`
- `happy-colors-nextjs-project/__tests__/**`
- shared test setup files, factories, mocks, and component render helpers

Decision:

- Reuse test factories, mocks, setup helpers, and render wrappers.
- Do not copy/paste setup per test file when an existing helper can be safely extended.
- Do not delete regression tests merely to reduce file count.

Cleanup actions:

1. Inventory repeated mock setup, request builders, render helpers, sample users/products/categories/blog articles, and revalidation test helpers.
2. Consolidate repeated fixtures into existing test utility owners.
3. Keep tests readable; avoid generic test helpers that hide important scenario data.
4. Preserve coverage for cache, i18n, security, UX, ownership, and route-boundary behavior.

### 6.13 Configuration, constants, and content modules

Current areas:

- `server/config/**`
- `happy-colors-nextjs-project/src/config/**`
- root config files;
- public content modules under `happy-colors-nextjs-project/src/content/**`

Decision:

- Use one owner for each constant or configuration concept.
- Cross-runtime config constants may live in shared pure modules only when both runtimes need the same value.
- Environment variable names may be referenced for presence/ownership, but secret values must never be read or printed.

Cleanup actions:

1. Identify duplicate constants across server/frontend/shared.
2. Keep environment-specific runtime config in the runtime owner.
3. Keep public content copy in content modules, not duplicated inside components/pages.
4. Delete duplicate constants only after all imports are migrated and tests/build pass.

---

## 7. Deletion Policy

No file should be deleted until it passes this checklist:

1. It has no imports, alias references, dynamic `import()`/`require()` references, package export references, config references, script references, test discovery dependencies, or route/runtime ownership requirement.
2. Its behavior is covered elsewhere or intentionally removed.
3. The replacement path is already in place.
4. Focused tests pass.
5. The deletion does not revert unrelated user changes.
6. The deletion is listed in the cleanup report with reason.

For Next App Router:

- `route.js`, `page.js`, and `layout.js` files may be required by convention even when they are thin.
- These files are not "unnecessary" solely because they are small.
- The correct cleanup is to move duplicated internals into existing owners or shared helpers, while keeping required entrypoints.

---

## 8. Proposed Phased Plan

### Phase 0 - Freeze, classify, and scan ownership

Goal: stop mixing performance work with cleanup work and establish a repo-wide cleanup inventory.

Tasks:

1. Produce a file inventory of modified and untracked files.
2. Mark each file as one of:
   - keep as behavior change;
   - keep as shared owner;
   - temporary wrapper;
   - candidate for deletion;
   - unrelated dirty change to avoid touching.
3. Confirm which changes belong to the paused performance task and which belong to cleanup.
4. Do not delete or refactor behavior until classification is approved.
5. Run cross-project import searches for every candidate deletion or move, covering:
   - `server/**`;
   - `happy-colors-nextjs-project/**`;
   - dynamic `import()` and `require()` usage;
   - Next filesystem-convention entrypoints such as `route.js`, `page.js`, and `layout.js`.
6. Record a reversible baseline before code cleanup starts. The preferred baseline is a checkpoint commit or separate branch that captures the current approved state without unrelated user changes.
7. Run a repo-wide duplicate and ownership scan, not only a current-diff scan. At minimum, inspect:
   - route ownership and route convention files;
   - components, pages, layouts, styles, and content modules;
   - hooks, contexts, providers, and client state;
   - Express controllers, services, routers, models, schemas, middlewares, helpers, and utils;
   - managers and API request helpers;
   - auth/session/role helpers;
   - upload/GCS/token helpers;
   - product ownership and publication helpers;
   - config constants duplicated across frontend/backend;
   - test factories, mocks, and setup helpers.

Acceptance criteria:

- every untracked file has an owner decision;
- every new helper has a reuse justification or deletion plan;
- performance and cleanup changes are clearly separated in the report.
- pre-existing duplication candidates outside the current diff are listed, deferred with reason, or included in cleanup scope;
- the owner confirms that the accepted design document and review artifacts are preserved in git or in an owner-approved external record before implementation begins;
- API route ownership tests pass before any route or proxy ownership changes are attempted.

### Phase 1 - Complete duplicated behavior inventory

Goal: ensure duplicated behavior families have explicit owners before files are removed.

Tasks:

1. Classify each duplicated behavior family as:
   - keep existing owner;
   - consolidate under existing owner;
   - keep pure shared module;
   - split edge-safe and Node-only shared code;
   - delete as unnecessary.
2. Assign canonical owners for:
   - auth role/status normalization;
   - product ownership checks;
   - product/cartoon upload limits;
   - GCS public URL and object-name validation;
   - upload token encode/sign/verify patterns;
   - manager URL/query construction;
   - revalidation request boilerplate;
   - UI component/page/layout composition;
   - hooks/contexts/providers/client state;
   - Express service/controller/router ownership;
   - styles/content/config ownership;
   - test factories, mocks, and setup helpers.
3. Identify which wrappers are stable boundaries and which are deletion candidates.
4. Identify any Next API route that lacks a Next-runtime requirement and mark it for route ownership review.

Acceptance criteria:

- one planned owner exists for each audited behavior;
- every wrapper has a keep/delete decision;
- every shared module is classified as edge-safe, Node-only, temporary, or deletion candidate;
- no deletion begins before the relevant behavior family has an owner decision.

### Phase 2 - Consolidate one behavior at a time

Goal: establish a single canonical owner before deleting or moving files.

Tasks:

1. Pick one duplicated behavior.
2. Confirm its current callers and runtime boundaries.
3. Choose the canonical owner.
4. Migrate callers to that owner.
5. Keep runtime-specific adapters only where they protect env loading, request/response objects, cookies, DB access, or Next runtime APIs.
6. Run focused tests for that behavior.

Acceptance criteria:

- the behavior has one canonical owner;
- all callers are migrated or explicitly documented as temporary;
- focused tests pass before deletion is considered;
- cross-runtime import searches show no missed callers.

### Phase 3 - Delete unnecessary files and wrapper chains

Goal: reduce file count and indirection after canonical ownership is proven.

Tasks:

1. Delete wrappers that are not stable ownership boundaries.
2. Inline generic helpers that are used by only one domain.
3. Move single-runtime shared code back into its established runtime owner.
4. Keep only required Next App Router entrypoints.
5. Keep route files thin and local.
6. Remove wrapper chains.

Acceptance criteria:

- no wrapper chain remains;
- no shared module is imported by only one side unless documented as temporary;
- no duplicate constants remain for the same domain value;
- full server and frontend gates pass before deletion is finalized.

### Phase 4 - Reassess paused performance changes

Goal: resume performance work only after cleanup is stable.

Tasks:

1. Re-run the MVP performance plan against the cleaned codebase.
2. Remove or rewrite any performance diff that violates the reuse rules.
3. Reconfirm product detail caching remains deferred.
4. Reconfirm no cookie-forwarding fetch is cached.
5. Reconfirm `/bg/...` and `/en/...` architecture is unchanged.

Acceptance criteria:

- MVP performance changes are smaller after cleanup;
- no duplicated route/helper/module surfaces are introduced;
- targeted cache/i18n/security/UX tests pass;
- build and coverage pass.

---

## 9. Review Requirements

Before implementation starts:

1. Claude must review this design document using the exact Opus model required by the current `AGENTS.md` before implementation starts.
2. A separate non-interactive Codex review must review the same document independently.
3. Valid findings must be incorporated before code cleanup begins.

Design change governance:

- Every change to this cleanup task's design document, and any future implementation-plan document for this cleanup task, must be reviewed by Claude using the exact Opus model required by the current `AGENTS.md` before the owner accepts it.
- This applies to scope, phase order, ownership rules, deletion policy, test gates, acceptance criteria, and review process changes.
- Valid blocking findings from Claude must be resolved before the design change is considered accepted.
- If a blocking finding is dismissed as invalid for this repo, the Review History entry must include the rationale.
- Minor wording edits that do not change meaning intentionally still require review; they may be batched, but the batch still requires Claude review using the exact Opus model required by the current `AGENTS.md` and blocking-finding resolution before owner acceptance.
- A design change is not owner-accepted until review is complete, valid blocking findings are resolved or waived with written rationale, the durable review record defined below exists, and the approving owner is recorded.
- Each accepted design change must add a dated entry to the authoritative governance log for this cleanup task. Until the owner chooses a different durable log, this document's Review History section is the local working log.
- Each Review History entry must summarize what changed, the exact model ID used, the reviewed target or diff identifier, the review artifact location, the review outcome, any dismissed-finding rationale, and the owner approval reference.
- Appending, correcting, or first-recording the Review History entry for an already-reviewed change is a review-record update and does not itself require a new review cycle when it only records the completed review accurately.
- Applying reviewer findings from the current review cycle is part of that same cycle. It requires the follow-up review needed to close the findings, but it does not create a separate design-change cycle for the same reviewer.
- The review target must be passed explicitly to Claude, no secret values may be included in the review prompt or input, and Claude review must follow the current mechanics in `AGENTS.md`.
- Because `docs/` is gitignored locally, the local Review History is not sufficient as a durable audit trail for merge/deploy decisions. Before the owner accepts a design change or implementation relies on this design, the owner must either track the accepted document/review history in git or preserve the accepted document plus review artifacts in an owner-approved external record.
- Independent Codex review is required for the initial design review and optional for incremental design changes unless the owner explicitly requests it or the change materially alters scope, phase order, deletion policy, ownership rules, test gates, acceptance criteria, or the review process itself.

Before high-risk cleanup diffs merge:

1. Inspect the diff locally.
2. Run Claude with the exact Opus model required by the current `AGENTS.md`, at least a 300 second shell timeout, and the actual diff passed explicitly.
3. Optionally run a second Codex review for large or security-sensitive cleanup.
4. Apply only findings that are valid for this repo.

---

## 10. Testing And Verification

For documentation-only changes:

- no build is required unless code changes are made;
- reviewer feedback must be incorporated.

For code cleanup phases:

Run focused tests for touched areas first, then full gates.

The root CI command is the real coverage threshold gate because package-level `test:coverage` scripts generate reports but only `test:ci` sets `CI_COVERAGE=true`.

```powershell
npm test
npm run test:coverage
npm run test:ci
npm run build
```

Focused test areas:

- revalidation API route tests;
- localized revalidation path tests;
- `server/__tests__/unit/apiRouteOwnership.test.js`;
- `server/__tests__/unit/unifiedRouting.test.js`;
- server revalidation helper tests;
- auth/session hint tests;
- product/category/blog service tests;
- manager tests;
- blog page/component tests;
- component/page/layout tests for any touched UI surface;
- hook/context/provider tests for any touched client state;
- integration tests for any touched Express controller/service/router behavior;
- upload/token/GCS helper tests if shared modules are touched.

Coverage expectations:

- preserve the repository's configured thresholds;
- do not remove meaningful regression tests only to reduce file count;
- line/function coverage must remain above 80%;
- branch coverage must not drop below the configured 75% threshold;
- coverage gates do not replace explicit unit tests for `shared/` or server helper code that may live outside a runner's default include patterns.

Additional cleanup-specific tests:

- if `revalidateSurfaces.js` remains, add direct tests for fetch/error handling or prove domain-wrapper tests cover every meaningful branch;
- add or keep a regression test proving cookie-forwarding/authenticated fetches remain `no-store`;
- keep blog component/page tests that assert hero image and full current article rendering, because App Router page files may be coverage-excluded;
- run both server and frontend suites after any cross-runtime shared-code move.

Post-change smoke checks:

- at least one Express-owned business route still resolves through the unified server routing model;
- at least one Next-owned revalidation or proxy route still resolves through the unified server routing model;
- representative localized public pages under `/bg/...` and `/en/...` still render;
- blog hero image and full current article rendering are manually or test verified after any blog page/component cleanup.

---

## 11. Acceptance Criteria

This cleanup task is complete only when all of the following are true:

- every modified and untracked file from the current worktree is classified;
- repo-wide duplicate and ownership scan has been completed or explicitly scoped into deferred cleanup items;
- unnecessary files are deleted with documented reasons;
- no parallel implementation remains for the audited behavior;
- duplicated components, hooks, contexts, services, controllers, helpers, utilities, styles, content modules, config, mocks, and factories are consolidated or explicitly deferred with reason;
- remaining new files have a specific ownership justification;
- Next App Router convention files remain only where required by routing;
- Express business ownership is preserved;
- Next-only runtime capabilities remain in Next;
- shared code is pure, cross-runtime, and actually reused;
- shared code imported by middleware or edge/runtime-sensitive code is edge-safe and does not import Node-only APIs;
- wrappers are either deleted or documented as stable boundaries;
- blog design and full article rendering remain intact;
- no public route architecture changes are made;
- no cookie-forwarding fetch is cached;
- product detail caching remains deferred unless separately approved;
- no secrets are read, logged, or exposed;
- the accepted design document and review artifacts are preserved in git or in an owner-approved external record before implementation relies on them;
- focused tests pass;
- full tests, `test:ci`, coverage reporting, and build pass before code cleanup is considered finished;
- Claude Opus and independent Codex reviews have no unresolved blocking findings.

---

## 12. Open Questions For Owner Approval

1. Should compatibility wrappers be removed aggressively after callers are migrated, or kept when they preserve clear domain import paths?
2. Should root `shared/` be allowed as a permanent cross-runtime pure-code area, or should shared code live under a named package/folder with stricter ownership rules?
3. Should the paused performance diff be split into separate commits before cleanup implementation starts?

---

## 13. Initial Recommendation

Proceed with Phase 0 only until the file classification is approved.

After approval, implement cleanup in small reviewable batches:

1. classify and baseline the current worktree;
2. consolidate one behavior and migrate callers;
3. delete only the wrappers/files proven unnecessary for that behavior;
4. repeat for shared pure modules, revalidation helper shape, frontend manager helper shape, and blog/auth regression guards;
5. only then resume the public performance MVP.

This order prevents another large mixed-purpose diff and makes each deletion or retained abstraction explainable.

---

## 14. Review History

### Claude Opus 4.8 - 2026-08-06

Model ID: `claude-opus-4-8`

Reviewed target: initial cleanup design draft in `docs/DESIGN-DOC-CODEBASE-CLEANUP-AND-REUSE-OPTIMIZATION.md`.

Review artifact: current Claude CLI output in this Codex conversation transcript.

Owner approval reference: pending owner approval.

Outcome: Claude raised blocking corrections:

- include server tests and route ownership tests in verification;
- use `npm run test:ci` for enforced coverage thresholds;
- do not rely on coverage for `shared/` or App Router page behavior;
- reorder phases so ownership consolidation happens before wrapper deletion;
- require cross-project import searches before moving shared code;
- harden deletion criteria for convention-based files and dynamic routing;
- require a reversible baseline before deletion phases;
- inventory `revalidate/_lib/localizedPaths.js`;
- add explicit tests for no-store authenticated/cookie-forwarding fetch boundaries.

These findings were incorporated into this revision.

### Independent Codex - 2026-08-06

Model ID: `gpt-5.4`

Reviewed target: revised cleanup design draft in `docs/DESIGN-DOC-CODEBASE-CLEANUP-AND-REUSE-OPTIMIZATION.md`.

Review artifact: current Codex CLI output in this Codex conversation transcript.

Owner approval reference: pending owner approval.

Outcome: Codex raised additional corrections:

- do not accept Next API ownership merely because a route already exists there;
- complete full duplicated-behavior inventory before deleting wrappers or shared files;
- make the scope truly repo-wide, not only current-worktree cleanup;
- expand deletion checks beyond imports to aliases, configs, scripts, package exports, and convention references;
- require smoke/integration checks for Express-owned routes, Next-owned routes, and localized public pages;
- distinguish edge-safe shared modules from Node-only shared modules.

These findings were incorporated into this revision.

### Claude Opus 4.8 Governance Review - 2026-08-06

Model ID: `claude-opus-4-8`

Reviewed target: design-change governance diff for Section 9 in `docs/DESIGN-DOC-CODEBASE-CLEANUP-AND-REUSE-OPTIMIZATION.md`.

Review artifact: current Claude CLI output in this Codex conversation transcript.

Owner approval reference: pending owner approval.

Outcome: Claude raised enforceability corrections:

- require blocking findings to be resolved, not only reviewed;
- require every accepted design change to add a Review History entry;
- define owner acceptance as the gate;
- clarify that independent Codex review is optional for small incremental design changes but required for material design changes;
- point Claude review mechanics back to `AGENTS.md`;
- broaden the rule to future implementation-plan documents for this cleanup task.

These findings were incorporated into this revision.

### Claude Opus 4.8 Governance Follow-Up - 2026-08-06

Model ID: `claude-opus-4-8`

Reviewed target: revised design-change governance diff for Section 9 and Section 14.

Review artifact: current Claude CLI output in this Codex conversation transcript.

Owner approval reference: pending owner approval.

Outcome: Claude raised additional enforceability corrections:

- account for `docs/` being gitignored by requiring a durable owner-approved audit record before implementation relies on the design;
- avoid infinite review recursion by carving out the Review History entry for an already-reviewed change;
- require Codex review for material review-process and test-gate changes;
- require written rationale when blocking findings are dismissed as invalid;
- allow an owner- or `AGENTS.md`-designated Opus successor model and record the exact model ID used;
- clarify that meaning-preserving wording edits intentionally still require review.

These findings were incorporated into this revision.

### Independent Codex Governance Review - 2026-08-06

Model ID: `gpt-5.4`

Reviewed target: `docs/DESIGN-DOC-CODEBASE-CLEANUP-AND-REUSE-OPTIMIZATION.md` Section 9 and Section 14 in the current local worktree.

Review artifact: current Codex conversation transcript / CLI output from `codex exec --full-auto -m gpt-5.4`.

Owner approval reference: pending owner approval.

Outcome: Codex raised blocking governance corrections:

- make `AGENTS.md` the executable source of truth for Claude model selection;
- backfill the missing Codex governance review entry;
- require Review History entries to include model ID, reviewed target, artifact location, outcome, dismissed-finding rationale, and owner approval reference;
- define one authoritative governance log for all governed cleanup docs;
- make owner acceptance a single checklist that includes review completion, blocking-finding resolution or rationale, durable audit record, and recorded owner approval.

These findings were incorporated into this revision.

### Claude Opus 4.8 Final Governance Review - 2026-08-06

Model ID: `claude-opus-4-8`

Reviewed target: governance diff after incorporating independent Codex findings, focused on Section 9 and Section 14.

Review artifact: current Claude CLI output in this Codex conversation transcript.

Owner approval reference: pending owner approval.

Outcome: Claude raised final blocking corrections:

- record the post-Codex Claude review in Review History;
- remove the remaining hardcoded "Claude Opus 4.8" wording from the governance rule;
- backfill Review History entries with the mandatory fields;
- clarify that applying reviewer findings is part of the current review cycle and does not create a separate same-reviewer cycle;
- point the durable review record in the acceptance checklist to the git-tracked or owner-approved external record requirement.

These findings were incorporated into this revision.

### Claude Opus 4.8 Blocking-Only Governance Review - 2026-08-06

Model ID: `claude-opus-4-8`

Reviewed target: final governance diff after all prior Opus and Codex findings were incorporated, focused on Section 9 and Section 14.

Review artifact: current Claude CLI output in this Codex conversation transcript.

Owner approval reference: pending owner approval.

Outcome: Claude reported that no blockers remain for Opus consultation requirements, Codex triggers, recursion handling, durable audit record gating, owner acceptance, `AGENTS.md` model mechanics, or Review History completeness.

### Claude Opus 4.8 Canonical Architecture Review - 2026-08-06

Model ID: `claude-opus-4-8`

Reviewed target: Section 5.0 canonical project architecture addition and related ownership rules.

Review artifact: current Claude CLI output in this Codex conversation transcript.

Owner approval reference: pending owner approval.

Outcome: Claude found the architecture rule clear and raised material corrections:

- include models and schemas in backend ownership;
- distinguish per-runtime shared handlers/helpers from root `shared/` cross-runtime pure code;
- record the design change in Review History;
- run independent Codex review because this materially changes ownership rules.

These findings were incorporated into this revision.

### Independent Codex Canonical Architecture Review - 2026-08-06

Model ID: `gpt-5.4`

Reviewed target: Section 5.0 canonical project architecture, Sections 5.1-5.4 ownership rules, and Section 9 governance consistency.

Review artifact: current Codex conversation transcript / CLI output from `codex exec --full-auto -m gpt-5.4`.

Owner approval reference: pending owner approval.

Outcome: Codex raised material ownership corrections:

- split validation ownership between models/schemas, validators, and reusable shared predicates;
- prevent handlers/helpers from becoming shadow owners beside managers, controllers, or services;
- tighten root `shared/` to pure cross-runtime code and classify edge-safe vs Node-only shared modules;
- require durable runtime-only rationale for Next-owned route exceptions;
- add an exception log format for retained wrappers, root `shared/` modules, Next-owned route exceptions, and helper/handler boundary exceptions.

These findings were incorporated into this revision.
