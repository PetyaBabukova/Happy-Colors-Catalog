# Happy Colors - Codebase Cleanup And Reuse Optimization Implementation Plan

**Date:** 2026-08-06
**Status:** Reviewed by independent Codex and Claude Opus; pending owner approval and durable review record
**Related design document:** `docs/DESIGN-DOC-CODEBASE-CLEANUP-AND-REUSE-OPTIMIZATION.md`
**Design status:** Revised after Claude Opus and independent Codex reviews; owner approval and durable review record still required before implementation relies on it.
**Scope:** Project-wide cleanup of unnecessary files, duplicated functionality, duplicated components/hooks/contexts/managers/services/controllers/helpers/utilities/styles/config/tests, and ownership drift.

---

## 1. Execution Principle

This plan turns the cleanup design into a safe implementation sequence.

The cleanup is not a route-only task and not a performance task. It is a project-wide architecture cleanup aligned to the owner's canonical structure:

- frontend UI and interaction live in components, pages, layouts, hooks, contexts, providers, and styles;
- frontend data access lives in managers as thin request adapters;
- backend API behavior lives in modular Express routes, controllers, services, models, and schemas;
- shared/common behavior lives in the correct same-layer handlers, utilities, validators, helpers, or middlewares;
- root `shared/` is allowed only for pure cross-runtime code that is actually needed by both Express and Next;
- nothing extra remains;
- nothing necessary is removed;
- no behavior has parallel owners.

The implementation order is:

1. inventory;
2. owner decision;
3. caller migration;
4. focused tests;
5. deletion;
6. full verification.

No code deletion is allowed before the target has passed the deletion checklist in the design document.

Paused public performance work stays deferred while this cleanup runs. Reassessing whether to resume or reshape that performance work belongs to the design document's later performance-resumption phase and is outside this implementation plan's cleanup batches.

---

## 2. Hard Rules

- Do not continue the public performance optimization task during this cleanup.
- Do not change `/bg/...` or `/en/...` route architecture.
- Do not add product detail caching.
- Do not cache any fetch that forwards cookies.
- Do not read or print `.env`, `.env.local`, `.env.*`, credential files, or secret values.
- Do not revert unrelated dirty worktree changes.
- Do not delete Next App Router `route.js`, `page.js`, or `layout.js` files only because they are thin; filesystem convention can make them live without imports.
- Do not remove regression tests only to reduce file count.
- Do not create a new abstraction during cleanup unless an existing owner cannot safely own the behavior and the exception is recorded.
- Every design or implementation-plan change for this cleanup task requires Claude review using the exact Opus model required by `AGENTS.md`.
- Material changes to scope, ownership, deletion policy, test gates, acceptance criteria, or review process also require independent Codex review.
- Before code cleanup starts, the owner must preserve the accepted design/plan and review artifacts in git or in an owner-approved external record because `docs/` is gitignored.

---

## 3. Deliverables

### 3.1 Planning deliverables

- Accepted design document.
- Accepted implementation plan.
- Phase 0 inventory report with every changed/untracked file classified.
- Repo-wide duplicate/ownership scan report.
- Exception log for accepted deviations from canonical architecture.

### 3.2 Code deliverables

Code changes must be delivered in small batches. Each batch should have:

- one behavior family;
- one canonical owner decision;
- caller migration;
- deletion of proven-unnecessary files only after migration;
- focused tests;
- review notes when high-risk.

### 3.3 Verification deliverables

- Focused test results for each batch.
- `npm test`
- `npm run test:coverage`
- `npm run test:ci`
- `npm run build`
- Frontend lint when frontend code is touched and the current project lint command is usable; otherwise record the known lint-command blocker.
- Manual/smoke notes for touched public UI or route-boundary behavior.

---

## 4. Classification System

Every audited file or behavior gets one classification.

| Classification | Meaning | Allowed next step |
| --- | --- | --- |
| Keep | Correct owner, no duplicate, still needed | Leave it alone |
| Merge | Duplicate behavior should move into an existing owner | Migrate callers, then delete duplicate |
| Move | Behavior is useful but lives in the wrong layer | Move to canonical owner, then update callers |
| Delete | No runtime/test/config/convention owner remains | Delete after full checklist |
| Defer | Real issue but too risky or outside this cleanup batch | Record reason and revalidation condition |
| Exception | Non-canonical location is technically required | Record in exception log and test it |
| Unrelated | Dirty change not part of cleanup | Do not touch |

Inventory records must include:

| Field | Required content |
| --- | --- |
| Path or behavior | File path, function, component, route, style, test helper, or behavior |
| Layer | Frontend UI, frontend manager, backend route, backend controller, backend service, model/schema, utility, middleware, validator, shared, test, config |
| Current owner | Current module or layer |
| Canonical owner | The owner under the architecture |
| Classification | Keep / Merge / Move / Delete / Defer / Exception / Unrelated |
| Rationale | Why this action is safe and consistent |
| Callers | Static imports, dynamic references, route conventions, config/script/test references |
| Tests | Focused tests required before and after action |
| Review need | None / Opus / Opus + Codex |
| Exception link | Required when classification is Exception |

---

## 5. Phase 0 - Freeze, Baseline, And Inventory

### Goal

Create a trustworthy map before changing code.

### Tasks

1. Record current worktree state.
2. Identify files changed by the paused performance task versus cleanup-specific files.
3. Produce a complete list of untracked files.
4. Classify unrelated dirty changes as `Unrelated` and leave them untouched.
5. Record a reversible baseline before any refactor or deletion starts.
   - Preferred: owner-approved checkpoint commit or branch.
   - Alternative: owner-approved external snapshot of the exact worktree classification plus review artifacts.
   - Do not use destructive git commands to create this baseline.
6. Confirm `docs/` durable-record decision with the owner before implementation relies on the docs.
7. Run repo-wide duplicate/ownership scans.
8. Run route ownership verification before any route/proxy ownership edit.
9. Create the first exception-log draft.

### Suggested commands

```powershell
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" status --short
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" diff --name-status
rg --files "server" "happy-colors-nextjs-project" "shared"
rg -n "from ['\"]|require\\(|import\\(" "server" "happy-colors-nextjs-project" "shared"
npm run test:server -- --run __tests__/unit/apiRouteOwnership.test.js __tests__/unit/unifiedRouting.test.js
```

Use additional focused `rg` searches for components, hooks, contexts, managers, services, controllers, helpers, validators, middlewares, styles, config constants, tests, mocks, and factories.

### Phase 0 scan areas

- `happy-colors-nextjs-project/src/components/**`
- `happy-colors-nextjs-project/src/app/**`
- `happy-colors-nextjs-project/src/hooks/**`
- `happy-colors-nextjs-project/src/context/**`
- `happy-colors-nextjs-project/src/managers/**`
- `happy-colors-nextjs-project/src/utils/**`
- `happy-colors-nextjs-project/src/config/**`
- `happy-colors-nextjs-project/src/content/**`
- component/page CSS modules
- `server/routes/**`
- `server/controllers/**`
- `server/services/**`
- `server/models/**`
- `server/middlewares/**`
- `server/helpers/**`
- `server/utils/**`
- `server/config/**`
- `shared/**`
- `server/__tests__/**`
- `happy-colors-nextjs-project/__tests__/**`
- root config and scripts

### Acceptance

- Every modified and untracked file is classified.
- Pre-existing duplicate candidates outside the current diff are listed or explicitly deferred.
- No deletion or move has happened yet.
- A reversible baseline exists before any refactor or deletion batch starts.
- Exception-log draft exists for retained non-canonical surfaces.
- Owner has chosen durable record strategy for the accepted docs and review artifacts.
- `server/__tests__/unit/apiRouteOwnership.test.js` and `server/__tests__/unit/unifiedRouting.test.js` pass before route/proxy cleanup begins.

---

## 6. Phase 1 - Ownership Decisions

### Goal

Convert inventory into concrete owner decisions before editing code.

### Tasks

1. Group findings by behavior family.
2. For each family, choose the canonical owner.
3. Mark all duplicate files/functions/components as `Merge`, `Move`, `Delete`, `Defer`, or `Exception`.
4. Define migration order.
5. Define focused tests for each group.
6. Request owner approval for the Phase 1 report before implementation starts.

### Required behavior families

| Family | Canonical owner question |
| --- | --- |
| UI components/pages/layouts/styles/content | Which component or page composition owns the UI? |
| Hooks/contexts/providers/client state | Which existing hook/context owns the state? |
| Frontend managers/API adapters | Which manager owns each endpoint call? |
| Express routes/controllers/services/models/schemas | Which backend layer owns each business rule? |
| Validators/middlewares/utils/helpers | Which cross-cutting layer owns each repeated behavior? |
| Root `shared/` | Is this pure cross-runtime code used by both runtimes? |
| Tests/mocks/factories | Which test utility owns repeated setup/data? |
| Config/constants | Which runtime or pure shared module owns the constant? |

### Acceptance

- No behavior family has multiple planned owners.
- Every retained wrapper has a reason.
- Every root `shared/` module has an edge-safe / Node-only / delete classification.
- Every Next-owned API route exception has a runtime-only rationale.
- Owner has approved the implementation order.

---

## 7. Phase 2 - Batch Refactors

### Goal

Refactor one behavior family at a time, with tests around each change.

### Batch process

For each batch:

1. Re-read the owner files and callers.
2. Confirm no newer user changes conflict.
3. Move or merge behavior into the canonical owner.
4. Keep adapters only where runtime boundaries require them.
5. Update imports.
6. Run focused tests.
7. Delete now-unused files only after all references are gone.
8. Run focused tests again.
9. Record deleted files and rationale.
10. Run Opus review for high-risk or ownership-sensitive diffs.

Batch names below identify discovery areas, not permission to split one behavior across layers. If a behavior family spans root `shared/`, runtime wrappers, config/constants, helpers, and tests, consolidate that full family in one batch operation. Later batch references to the same family must be marked already resolved, deferred with a reason, or recorded as an exception.

Known cross-area families that must not be split by directory:

- product limits: root shared config, server config wrapper, frontend config wrapper, and frontend/server constants;
- cartoon upload token and guard behavior: root shared core, Express helper boundary, Next `_lib` boundary, and tests;
- GCS upload behavior: root shared core, runtime-specific storage/config callers, and tests;
- ownership checks: root shared ownership core, `isOwner` wrappers, role utilities, service/controller callers, and tests.

### Batch order

#### Batch A - Current worktree cleanup and safety split

Purpose: separate paused performance changes, emergency blog fixes, and cleanup work.

Known candidates:

- files under root `shared/`;
- thin wrappers in `server/config`, `server/utils`, `server/helpers`;
- thin wrappers in `happy-colors-nextjs-project/src/config`, `src/utils`, `src/app/api/_lib`;
- new test files added for cleanup/performance behavior.

Acceptance:

- current working tree is separated into behavior groups;
- no performance change is expanded;
- no user/unrelated change is reverted.

#### Batch B - Root `shared/` module audit

Known candidates:

- `shared/authConstants.js`
- `shared/authCore.js`
- `shared/cartoonOrderUploadTokenCore.js`
- `shared/cartoonUploadGuardsCore.js`
- `shared/config/productLimits.js`
- `shared/gcsCore.js`
- `shared/productOwnership.js`

Actions:

- keep only pure cross-runtime modules;
- split edge-safe from Node-only where needed;
- move same-runtime code back to its runtime owner;
- delete shared modules that are not used by both runtimes;
- when a shared module belongs to a cross-area family, finish that family's wrapper/config/caller/test cleanup in the same batch operation.

Focused tests:

- auth/API tests;
- middleware/session hint tests;
- upload/token/GCS tests;
- product ownership tests;
- explicit unit tests for every retained or moved root `shared/` module, even if coverage thresholds still pass;
- build when middleware imports change.

#### Batch C - Wrapper and import-boundary cleanup

Known candidates:

- `server/config/productLimits.js`
- `happy-colors-nextjs-project/src/config/productLimits.js`
- `server/utils/userRoles.js`
- `server/utils/isOwner.js`
- `happy-colors-nextjs-project/src/utils/isOwner.js`
- `server/helpers/cartoonOrderUploadToken.js`
- `happy-colors-nextjs-project/src/app/api/_lib/cartoonOrderUploadToken.js`
- `server/helpers/cartoonUploadGuards.js`
- `happy-colors-nextjs-project/src/app/api/_lib/cartoonUploadGuards.js`

Actions:

- delete wrapper chains;
- keep wrappers that are stable architecture boundaries;
- record retained wrappers in exception log.

Focused tests:

- server unit tests for touched helpers/utils;
- frontend API route tests for touched `_lib`;
- build for alias/import validation.

#### Batch D - Revalidation ownership cleanup

Known candidates:

- `server/helpers/revalidateProducts.js`
- `server/helpers/revalidateBlog.js`
- `server/helpers/revalidateSurfaces.js`
- `happy-colors-nextjs-project/src/app/api/revalidate/_lib/revalidateRoute.js`
- revalidation route files under `src/app/api/revalidate/**/route.js`

Actions:

- keep Next route files only as required entrypoints;
- keep `revalidatePath`/`revalidateTag` in Next runtime;
- keep domain revalidation ownership in the service/controller path that owns the mutation;
- limit backend revalidation helpers to same-layer glue such as request construction, error handling, or safe no-throw wrappers;
- remove generic helpers if only one owner remains;
- preserve localized path helper tests.

Focused tests:

- frontend revalidation API tests;
- `localizedRevalidationPaths.test.js`;
- server revalidation helper tests;
- explicit unit tests for retained server helper behavior, even if coverage thresholds still pass;
- if `server/helpers/revalidateSurfaces.js` remains, add direct tests for fetch/error handling or prove domain-wrapper tests cover every meaningful branch;
- `server/__tests__/unit/apiRouteOwnership.test.js`;
- `server/__tests__/unit/unifiedRouting.test.js`.

#### Batch E - Frontend manager and request utility cleanup

Known candidates:

- `happy-colors-nextjs-project/src/managers/requestUtils.js`
- repeated URL/query/fetch options across managers;
- public/authenticated/no-store cache boundaries.

Actions:

- keep managers as thin request adapters;
- keep public/authenticated cache choices explicit;
- delete helper functions that hide important behavior or have one real caller.

Focused tests:

- manager tests;
- cache/no-store regression tests;
- product/blog/category/home banner manager tests.

#### Batch F - UI, page, layout, content, and style reuse

Known areas:

- duplicated page composition under localized and non-localized app routes;
- blog page composition after emergency fixes;
- repeated hero/list/detail/card/form layout patterns;
- duplicate content copy outside content modules.

Actions:

- consolidate duplicate UI into existing components;
- keep route `page.js` files thin when required by route architecture;
- keep content in content modules;
- remove duplicate styles only after visual parity is verified.

Focused tests:

- blog component/page tests;
- component tests for touched UI;
- localized route smoke/manual QA;
- visual/manual check for public pages changed by cleanup.

#### Batch G - Hooks, contexts, providers, and client-state cleanup

Known areas:

- `AuthContext`, `AuthWrapper`, `ProductContext`, `ClientLayout`;
- repeated loading/error/session/category state;
- provider scope in public shell.

Actions:

- reuse existing contexts/hooks;
- remove provider wrappers only when no longer needed;
- keep anonymous auth UX behavior intact.

Focused tests:

- auth/session hint tests;
- context/component tests;
- header tests.

#### Batch H - Backend services/controllers/routes/models/validators cleanup

Known areas:

- products;
- categories;
- blog articles;
- translations;
- upload/GCS URL validation;
- ownership/role/publication checks.

Actions:

- keep controllers thin;
- consolidate business rules into services;
- keep request validation in validators/middlewares;
- keep persistence invariants in models/schemas;
- delete duplicate helper logic only after service tests pass.

Focused tests:

- server integration tests for touched domains;
- server unit tests for validators/middlewares/utils/helpers;
- route ownership tests.

#### Batch I - Tests, mocks, fixtures, and factories cleanup

Known areas:

- repeated request builders;
- repeated auth/user/product/category/blog fixtures;
- repeated revalidation request helpers;
- repeated component render wrappers.

Actions:

- consolidate repeated setup into existing test utilities;
- avoid over-generic helpers that hide scenario intent;
- preserve regression tests for cache, i18n, security, UX, route ownership, and blog rendering.

Focused tests:

- affected test suites;
- `npm test` after broad test utility changes.

#### Batch J - Config/constants/content cleanup

Known areas:

- frontend/server product limits;
- auth cookie name constants;
- public content modules;
- SEO and route constants;
- feature flags.

Actions:

- keep runtime config in runtime owner;
- keep pure cross-runtime constants in root shared only when both runtimes need them;
- do not read or print secret values;
- delete duplicate constants after caller migration;
- if a config/constant belongs to an earlier cross-area family such as product limits or auth cookie names, resolve it in that family's batch instead of reopening ownership here.

Focused tests:

- config/unit tests;
- build;
- smoke checks for public pages using content/config.

---

## 8. Exception Log Format

Every exception must be recorded in the Phase 0 inventory or a dedicated owner-approved external record.

```text
Exception ID:
Owner:
Canonical owner:
Rationale:
Scope:
Callers:
Runtime constraints:
Review references:
Tests:
Removal or revalidation condition:
Owner approval:
```

Examples of exception candidates:

- a root `shared/` Node-only token module used by both Express and Next Node routes;
- a Next API route that must call `revalidateTag`;
- a wrapper that protects Next env loading or Express cookie serialization;
- a helper that packages same-layer orchestration but does not own business behavior.

---

## 9. Review Gates

### Plan review

This implementation plan must be reviewed by:

1. Claude using the exact Opus model required by `AGENTS.md`;
2. an independent non-interactive Codex instance.

Valid findings must be incorporated before owner acceptance.

Claude review must follow `AGENTS.md` mechanics:

- pass the reviewed document or diff explicitly to Claude;
- use the exact Opus model required by the current `AGENTS.md`;
- use at least a 300 second shell timeout;
- run outside the Codex sandbox when required by `AGENTS.md`;
- do not include secret values in prompts or review input.

Codex review must also receive the exact reviewed file or focused prompt, not a vague request to "review the plan."

### Batch review

Run Opus review for:

- root `shared/` changes;
- auth/session/middleware changes;
- route ownership changes;
- cache/no-store boundary changes;
- deletion batches touching more than one layer;
- any exception retained against canonical architecture.

Run Codex review for:

- material ownership changes;
- review/test gate changes;
- large cross-runtime cleanup;
- anything the owner explicitly requests.

---

## 10. Verification Gates

### Focused gates

Run focused tests for the touched layer before and after deletion:

- frontend manager tests;
- component/page/layout tests;
- hook/context/provider tests;
- frontend API route tests;
- backend unit tests for helpers/utils/validators/middlewares;
- backend integration tests for touched domains;
- route ownership tests;
- localized revalidation path tests.

Coverage gates do not replace explicit unit tests for root `shared/` modules or server helper code that may live outside a runner's default include patterns.

### Full gates

Before cleanup is considered complete:

```powershell
npm test
npm run test:coverage
npm run test:ci
npm run build
```

The `test:ci` gate must enforce `CI_COVERAGE=true`. Current minimum coverage expectations are line/function coverage at least 80% and branch coverage at least 75%.

Frontend lint should be run when frontend code changes if the current lint command is usable. If it is blocked by the project's current Next/ESLint script state, record the blocker instead of silently skipping it.

### Smoke/manual gates

Manual or browser smoke verification is required when cleanup touches public UI, route boundaries, auth shell behavior, or localized pages.

Minimum smoke set:

- `/bg/...` representative public page;
- `/en/...` representative public page;
- one Express-owned API route through unified routing;
- one Next-owned API route through unified routing;
- blog page hero image and full current article rendering if blog files are touched;
- anonymous public visit without unintended `/users/me` call if auth shell files are touched.

---

## 11. Phase Completion Checklist

A cleanup batch is complete only when:

- canonical owner is documented;
- callers are migrated;
- unnecessary files are deleted or deferred with reason;
- exception log is updated for retained non-canonical surfaces;
- no route architecture changed;
- no secret values were read or printed;
- focused tests pass;
- required Opus/Codex reviews are resolved;
- deleted files and rationale are listed in the batch report.

The full cleanup task is complete only when:

- Phase 0 and Phase 1 reports are owner-approved;
- all planned batches are complete or explicitly deferred;
- no audited behavior has parallel owners;
- every retained exception has a rationale and removal/revalidation condition;
- full verification gates pass;
- owner accepts the final cleanup report.

---

## 12. Initial Known Candidate Buckets

These are not automatic deletion targets. They are starting points for Phase 0.

| Bucket | Examples | Initial expectation |
| --- | --- | --- |
| Root shared modules | `shared/authCore.js`, `shared/gcsCore.js`, `shared/productOwnership.js` | Keep only if pure cross-runtime and classified |
| Wrappers | `server/utils/isOwner.js`, `src/utils/isOwner.js`, `server/config/productLimits.js` | Delete only if not stable boundaries |
| Revalidation helpers | `revalidateSurfaces.js`, revalidation route helper | Keep only if ownership stays clear |
| Frontend manager helpers | `src/managers/requestUtils.js` | Keep only if cache/auth decisions stay explicit |
| Blog page repair files | blog page/component/content tests | Preserve behavior; consolidate only with visual parity |
| Auth/session hint files | `authSessionHint.js`, `AuthWrapper`, `AuthContext` | Preserve anonymous UX; avoid Node imports in middleware |
| Test helpers | repeated request/render/mock setup | Consolidate without hiding scenario intent |
| Styles/content/config | duplicate CSS/content/constants | Merge into established owners |

---

## 13. Owner Decision Points

Before implementation starts, the owner should confirm:

1. Durable record strategy for the accepted design and implementation plan.
2. Whether compatibility wrappers should be aggressively removed or kept when they are clean domain boundaries.
3. Whether root `shared/` is acceptable as a permanent pure cross-runtime area, with edge-safe and Node-only classification.
4. Whether the paused performance diff should be split into separate commits before cleanup starts.
5. Whether the first code batch should focus on current worktree cleanup or broader pre-existing duplication.

---

## 14. Review History

### Independent Codex Review - 2026-08-06

Model ID: `gpt-5.4`

Reviewed target: this implementation plan draft.

Review artifact: current Codex conversation transcript / CLI output from `codex exec --full-auto -m gpt-5.4`.

Owner approval reference: pending owner approval.

Outcome: Codex raised blocking/material corrections:

- add an explicit reversible-baseline gate before any refactor or deletion batch;
- move route ownership tests into Phase 0 before route/proxy cleanup begins;
- keep domain revalidation ownership in services/controllers, with helpers limited to same-layer glue;
- add enforceable review mechanics from `AGENTS.md`, including explicit review target, Opus model, timeout, sandbox/escalation behavior, and no secrets.

These findings were incorporated into this revision.

### Claude Opus Review - 2026-08-06 Usage-Limit Attempt

Model ID: `claude-opus-4-8`

Reviewed target: this implementation plan draft.

Review artifact: pending. Claude CLI returned usage limit: `You've hit your limit · resets 8:10pm (Europe/Sofia)`.

Owner approval reference: pending owner approval.

Outcome: superseded by the successful 2026-08-07 Opus review below.

### Claude Opus Review - 2026-08-07

Model ID: `claude-opus-4-8`

Reviewed target: `AGENTS.md`, the cleanup design document, and this implementation plan draft.

Review artifact: Claude CLI output from explicit document input:

```powershell
$target = @("===== AGENTS.md =====", (Get-Content "AGENTS.md" -Raw), "===== DESIGN DOC =====", (Get-Content "docs\DESIGN-DOC-CODEBASE-CLEANUP-AND-REUSE-OPTIMIZATION.md" -Raw), "===== IMPLEMENTATION PLAN =====", (Get-Content "docs\IMPLEMENTATION-PLAN-CODEBASE-CLEANUP-AND-REUSE-OPTIMIZATION.md" -Raw)) -join "`n"
$target | claude --model claude-opus-4-8 -p "Review this Happy Colors codebase cleanup implementation plan for consistency with AGENTS.md and the cleanup design document..."
```

Owner approval reference: pending owner approval.

Outcome: Opus raised material corrections:

- avoid layer-based batches that can split one behavior family across root `shared/`, wrappers, config/constants, helpers, and tests;
- add explicit unit-test gates for root `shared/` modules and server helper behavior regardless of coverage results;
- add the specific `revalidateSurfaces.js` keep-condition: direct fetch/error tests or proof that domain-wrapper tests cover every meaningful branch;
- restate the performance-resumption boundary and coverage thresholds.

These findings were incorporated into this revision.

### Claude Opus Follow-Up Review - 2026-08-07

Model ID: `claude-opus-4-8`

Reviewed target: `AGENTS.md`, the cleanup design document, and the revised implementation plan.

Review artifact: Claude CLI output from explicit document input using the same `--model claude-opus-4-8` review flow required by `AGENTS.md`.

Owner approval reference: pending owner approval.

Outcome: Opus verified that the prior material findings were resolved:

- behavior-family batching now overrides layer-based splitting;
- explicit unit-test gates exist for root `shared/` modules and server helper behavior;
- `revalidateSurfaces.js` has the required direct-test or full-domain-wrapper-coverage keep-condition;
- performance resumption is clearly deferred outside this cleanup implementation plan;
- coverage thresholds and `CI_COVERAGE=true` enforcement are recorded;
- review history accurately records the superseded usage-limit attempt and the successful Opus review.

Opus found no blockers. It noted only a cosmetic wording issue: the coverage threshold should say line/function coverage is at least 80%, not above 80%. That wording was corrected.

### Independent Codex Follow-Up Review - 2026-08-07

Model ID: `gpt-5.4`

Reviewed target: `AGENTS.md`, the cleanup design document, and the final implementation plan after Opus fixes.

Review artifact: CLI output from `codex exec --full-auto -m gpt-5.4` with explicit document input. The first sandbox attempt failed with auth/network errors, then the same review was rerun outside the sandbox and completed.

Owner approval reference: pending owner approval.

Outcome: Codex found no blocking findings. It confirmed the final plan is materially consistent with `AGENTS.md` and the design document for behavior-family cleanup, deletion safety, review gates, coverage/test gates, durable docs handling, no-secrets handling, and unchanged route architecture. Codex noted that the only remaining prerequisites are owner approval and the durable review record, both already captured by the plan.
