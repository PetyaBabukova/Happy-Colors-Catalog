# Single-Service Deployment Refactor — Final Design Document

**Status:** Finalized for Phase 1 implementation  
**Branch:** `single-deploy-refactor`

---

## 1. Overview

### Problem
The project currently has a separate Next.js frontend and a separate Express backend. Deploying them as two Render services increases cost and adds cross-origin complexity.

### Goal
Refactor the current setup into a **single-service deployment** on Render, using:
- one Node.js process
- one port
- one Render Web Service
- one shared environment configuration

### Chosen Direction (**DECIDED**)
The chosen architecture for Phase 1 is:

- keep the existing Express backend
- keep the existing Next.js frontend
- create a **root-level custom server**
- mount the Express app under `/api`
- let Next.js handle everything else

This is a **deployment-oriented refactor**, not an application rewrite.

---

## 2. Goals (Phase 1)

Phase 1 must achieve all of the following:

- one unified Node.js process serves both frontend and backend
- one Render service can run the application
- public catalog functionality continues to work
- auth continues to work
- image upload continues to work
- sitemap and robots continue to work
- catalog-mode protections continue to block shopping/order/payment/delivery flows
- implementation remains conservative and reversible
- code duplication is avoided
- responsibility boundaries remain explicit and clean

---

## 3. Non-Goals (Phase 1)

Phase 1 will **not** do any of the following:

- rewrite Express endpoints into Next.js API routes
- remove Econt/Speedy proxy routes
- change cookie policy (`sameSite`)
- remove or refactor CORS middleware
- flatten all dependencies into one fully merged root dependency tree unless phase-1 validation forces that
- rename folders
- refactor shopping logic
- refactor unrelated UI/components/CSS
- perform broad cleanup unrelated to unified deployment
- change business logic unless strictly required for the deployment refactor

---

## 4. Architectural Principles

These principles are mandatory.

### 4.1 Separation of Concerns (**DECIDED**)
- **root `server.js`** = orchestration only
- **`server/server.js`** = Express app definition only
- **`happy-colors-nextjs-project/src/config.js`** = API base URL resolution only

### 4.2 No duplicated logic (**DECIDED**)
- middleware should be configured in one place only
- route ownership should be defined in one place only
- startup concerns should not be split across multiple files without clear benefit
- no helper/abstraction should be introduced unless it clearly improves reuse or responsibility boundaries

### 4.3 Conservative Phase-1 scope (**DECIDED**)
Phase 1 includes only changes that are **mandatory** for a working single-service deployment.

### 4.4 First make it work, then clean it up (**DECIDED**)
Optional cleanup and simplification are deferred unless strictly required for correctness.

### 4.5 Responsibility boundary rules (**DECIDED**)
1. Root `server.js` = orchestration only  
2. `server/server.js` = Express app definition only  
3. `config.js` = API base URL resolution only  
4. No duplication of middleware or routing logic across layers  
5. Root `server.js` must not become a mixed-responsibility “god file”

---

## 5. Current Architecture Summary

### Current structure
- `server/` → Express backend
- `happy-colors-nextjs-project/` → Next.js frontend

### Current model
- backend runs separately
- frontend runs separately
- frontend uses `src/config.js` to call the backend
- some API behavior already exists in Next.js API routes

### Current special cases
These Next.js API routes must remain intact in Phase 1:
- `/api/upload-image`
- `/api/offices/econt`
- `/api/offices/speedy`

### Important SSR finding (**DECIDED**)
Multiple server-side code paths currently fetch data from the API using `baseURL` from `config.js`. This is not limited to `sitemap.js`.

Verified server-side consumers include:
- `products/[productId]/page.js` → `generateMetadata`
- `products/[productId]/page.js` → SSR product rendering
- `products/page.js`
- `contacts/page.js`
- `sitemap.js`

This means the SSR API base URL is a **core rendering dependency** for the public site, not a minor SEO detail.

---

## 6. Proposed Architecture

### 6.1 Unified runtime model (**DECIDED**)
A root-level custom server will:
- load environment variables
- connect to MongoDB
- prepare Next.js
- import and mount the Express app under `/api`
- delegate all remaining requests to Next.js
- listen on a single port

### 6.2 Backend integration contract (**DECIDED**)
`server/server.js` will export a **fully configured Express app**.

That Express app will own:
- Express app creation
- middleware stack
- middleware ordering
- webhook raw-body middleware ordering
- cookie parser
- CORS middleware
- route mounting
- Express-specific settings such as:
  - `app.set('trust proxy', 1)`
  - `app.disable('x-powered-by')`

The root `server.js` will own:
- env loading
- MongoDB connection
- mounting Express under `/api`
- preparing Next.js
- mounting Next.js catch-all
- port binding / `listen()`

### 6.3 Routing ownership invariants (**DECIDED**)

#### Express owns only:
- `/api/users`
- `/api/products`
- `/api/categories`
- `/api/search`
- `/api/contacts`
- `/api/orders`
- `/api/payments`
- `/api/delivery`

#### Next.js owns:
- all page routes
- static assets
- SEO routes (`/sitemap.xml`, `/robots.txt`)
- `/api/upload-image`
- `/api/offices/*`

#### Invariant
Unmatched `/api/*` requests must fall through to Next.js, not terminate early in Express.

### 6.4 Health-check clarification (**DECIDED**)
The existing `app.get('/')` inside the exported Express app becomes `GET /api/` when mounted under `/api`.

This is:
- a specific route match
- not a catch-all
- not an interceptor of `/api/upload-image` or other `/api/*` sub-paths

It may remain in Phase 1 and be treated as deferred cleanup.

---

## 7. API Base URL Strategy

### 7.1 Final hierarchy (**DECIDED**)

#### Default behavior
- **browser/client-side** → `/api`
- **server-side / SSR** → `http://localhost:${process.env.PORT || 3000}/api`

#### Optional override
- `NEXT_PUBLIC_API_URL` may override both, but is **not part of the default path**
- it exists only as an optional override, not as a co-equal source of truth

### 7.2 Explicit rejection (**DECIDED**)
`NEXT_PUBLIC_BASE_URL` must **not** participate in the new API resolution logic.

### 7.3 Why server-side absolute URL is required (**DECIDED**)
The server-side base URL is required by:
- `sitemap.js`
- `products/page.js`
- `products/[productId]/page.js`
- `contacts/page.js`
- any other server component or metadata function importing `config.js`

These server-side `fetch()` calls require an absolute URL.

### 7.4 Architectural rule (**DECIDED**)
The default Phase-1 behavior must require **zero configuration** to understand:
- browser → relative `/api`
- server → local loopback absolute URL

---

## 8. Root Dependency Strategy

### 8.1 Preferred strategy (**ASSUMED**)
Use a **minimal root package.json** plus the existing sub-project package.json files.

Preferred root dependencies:
- `next`
- `react`
- `react-dom`
- `dotenv`
- `mongoose`

Sub-project dependency trees remain intact in Phase 1.

### 8.2 Why this remains ASSUMED
This strategy is preferred, but not considered validated until the first implementation checkpoint passes.

### 8.3 Validation checkpoint
The dependency strategy becomes **VALIDATED** only when all of the following succeed:

1. install succeeds at root and in sub-projects
2. root can resolve `next`
3. unified server boots successfully
4. Next + Express integration runs successfully enough to start local testing

If this fails, fallback strategy can be discussed then.

---

## 9. MongoDB Connection Ownership

### 9.1 Decision (**DECIDED**)
MongoDB connection logic will live directly in the root `server.js`.

### 9.2 Rationale
- it is startup/orchestration logic
- it is not reused elsewhere
- extracting it into a helper adds abstraction without reuse
- the root server should remain the single place where application startup is orchestrated

### 9.3 Constraint
Root `server.js` may contain MongoDB startup logic, but must not absorb unrelated business/application logic.

---

## 10. Local Workflow / Operational Contract

### 10.1 Official supported workflow (**DECIDED**)
The official Phase-1 local workflow is the unified one.

Canonical commands:
- `npm run install:all`
- `npm run build`
- `npm run start`
- `npm run dev`

### 10.2 Development mode (**DECIDED**)
`npm run dev` is part of Phase 1 and should start the unified app in development mode.

### 10.3 Two-process legacy mode (**DECIDED**)
Old separate frontend/backend local mode may remain technically possible, but it is:
- not the official workflow
- not maintained as part of Phase 1
- not part of the design guarantee

### 10.4 Windows handling (**DECIDED**)
Preferred Phase-1 approach:
- if `NODE_ENV` is unset locally, root server defaults to development
- Render sets production explicitly

No extra cross-platform tooling is required in Phase 1 unless implementation proves otherwise.

---

## 11. Mandatory Phase-1 Changes

### M1. Create root `server.js` (**DECIDED**)
Responsibilities:
- load env
- validate required startup env
- connect MongoDB
- import Express app from `server/server.js`
- mount Express app under `/api`
- prepare Next.js
- mount Next.js catch-all
- start listening

### M2. Refactor `server/server.js` (**DECIDED**)
It must export a fully configured Express app and stop owning:
- env loading
- MongoDB connection
- `listen()`

It should continue owning:
- Express middleware
- Express middleware ordering
- Express app settings
- route mounting

### M3. Update `happy-colors-nextjs-project/src/config.js` (**DECIDED**)
It must implement the strict API hierarchy defined above.

### M4. Create root `package.json` (**ASSUMED**)
It must support:
- install
- build
- start
- dev

### M5. Preserve current responsibility boundaries (**DECIDED**)
No duplication of middleware/routing/startup logic across layers.

---

## 12. Deferred / Optional Cleanup

### O1. Remove Econt/Speedy proxy routes
Deferred because they are not required to achieve unified deployment.

### O2. Change cookie policy to `sameSite: 'Lax'`
Deferred because current behavior can remain unchanged for Phase 1.

### O3. Remove/refactor CORS middleware
Deferred because same-origin makes it less necessary, but it is not required to remove it in Phase 1.

### O4. Merge all dependencies into one flat root dependency tree
Deferred unless the preferred root dependency strategy fails.

### O5. Remove redundant env vars
Deferred.

### O6. Remove health-check Express route
Deferred unless it actively interferes.

---

## 13. Risks and Mitigations

### R1. SSR API resolution risk (**HIGHEST RISK**)
If SSR uses relative `/api`, server-side fetch will fail.

This would break not only the sitemap but also:
- product listing page
- product detail page SSR
- product metadata generation
- contact page product-prefill flow
- core public-facing rendering paths

**Mitigation:** strict `config.js` hierarchy.

### R2. Route collision / route swallowing
If unmatched `/api/*` does not fall through correctly, Next API routes may break.

**Mitigation:** preserve routing invariants and test them explicitly.

### R3. Stripe raw-body ordering
Webhook body parsing order must remain intact.

**Mitigation:** middleware ownership remains inside Express app definition.

### R4. Hidden store code still imports at startup
Catalog-only mode reduces runtime exposure, but imports still exist.

**Mitigation:** startup smoke test with minimal env plus catalog guard checks.

### R5. GCS credential path / `process.cwd()` changes
Unified process changes runtime assumptions.

**Mitigation:** require explicit `GOOGLE_APPLICATION_CREDENTIALS` env usage and verify image upload.

### R6. Root server bloat
There is a risk that root `server.js` becomes a mixed-responsibility file.

**Mitigation:** enforce orchestration-only rule and no duplication rule.

---

## 14. Testing Plan

### 14.1 Mandatory local validation before deploy
Must verify:
- unified app boots successfully
- home page works
- `/products` works
- product detail works
- login works
- logout works
- auth persists on refresh
- contact form works
- image upload works
- `/sitemap.xml` includes products
- `/robots.txt` works
- catalog guard blocks orders/payments/delivery
- `/api/upload-image` is still handled by Next
- `/api/offices/*` is still handled by Next

### 14.2 Additional mandatory checks
The following must remain in Phase-1 acceptance:
- inspect page source / HTML of product listing page for SSR output
- inspect page source / HTML of product detail page for SSR output
- verify canonical/title/description on public pages
- inspect cookies in browser after login/logout:
  - cookie exists after login
  - `httpOnly`
  - correct path
  - correct clearing on logout

---

## 15. Phase-1 Acceptance Criteria

Phase 1 is successful only if all of the following are true:

1. app boots from a single root command
2. `/products` works
3. product detail works
4. `/products` renders actual product data in the HTML source
5. `/products/:id` renders actual product data in the HTML source
6. login/logout/refresh works
7. image upload works
8. contact form works
9. `/sitemap.xml` includes product URLs
10. `/robots.txt` behaves correctly
11. public metadata/canonical output is not broken
12. cookies behave correctly after login/logout
13. catalog guard still blocks orders/payments/delivery
14. Next API routes (`/api/upload-image`, `/api/offices/*`) are still reachable
15. no deferred cleanup was silently bundled into Phase 1

---

## 16. Open Questions

### OPEN-A
Can the preferred root dependency strategy be validated as-is during implementation checkpoint 1?  
**Expected answer:** yes

If validated successfully, this item becomes **DECIDED**.

---

## 17. Final Recommendation

Proceed with:
- this architecture
- this Phase-1 scope
- this responsibility model
- this strict API hierarchy
- this conservative testing/acceptance gate

Any deviation from this must be explicitly justified as:
- mandatory for correctness
- not optional cleanup