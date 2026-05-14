# Happy Colors - Blog Articles Implementation Plan

**Date:** 2026-05-14
**Status:** Draft for Opus review
**Related design document:** `docs/DESIGN-DOC-BLOG-ARTICLES.md`
**Goal:** Translate the approved Blog Articles design into small, reviewable implementation phases that preserve existing site behavior while adding public blog reading, authenticated article management, rich text editing, automatic thumbnails, SEO metadata, and sitemap integration.

---

## Execution Principle

Implement the blog feature as an additive module.

Do not refactor existing product, category, homepage banner, checkout, FAQ, cart, contact, auth, or upload flows unless a change is explicitly required by the blog module. Shared helpers may be reused, but existing behavior must stay stable and covered by existing tests.

Recommended phase order:

1. Baseline and dependency check.
2. Backend model, service, controller, and route mount.
3. Blog image upload and thumbnail generation.
4. Frontend manager, revalidation, form, and editor.
5. Public blog pages, navigation, SEO, and sitemap.
6. Tests, manual QA, external review, and final release readiness.

The feature can be delivered in one branch, but each phase should leave the repo in a testable state.

---

## Fixed Decisions From Design

- Public users can read published, non-archived articles.
- Only authenticated users can create, edit, publish/unpublish, archive, and restore articles.
- V1 treats every authenticated user as a trusted content operator, matching current content admin flows.
- Article public URLs use Mongo ids: `/blog/[articleId]`.
- No title slug in V1.
- Drafts are complete unpublished articles, not partial autosaves.
- Archive is soft delete through `archivedAt`; archive does not remove images.
- Restore clears `archivedAt` and preserves `status`.
- `status` changes use `PATCH /blog-articles/:articleId/status`, not `PUT`.
- Implementation-plan clarification: `PUT /blog-articles/:articleId` rejects `status` with a 400 response so status transitions stay explicit. This tightens the design wording that `PUT` "does not accept" `status`.
- `publishedAt` is set only on the first draft-to-published transition.
- Later published-to-draft-to-published cycles preserve the original `publishedAt`.
- Public pages render sanitized `contentHtml`, never raw `contentJson`.
- `contentJson` is stored for future newsletter/editor transformations but must be size/shape validated.
- Article images are uploaded through a blog-specific authenticated upload route.
- The blog image route generates a WebP thumbnail automatically with `sharp`.
- If `sharp` cannot be installed, a manual thumbnail field must be implemented before release.
- `thumbnailImageUrl` is required in the article model.
- `seoTitle` and `seoDescription` are optional with max-length validation.
- `excerpt` is generated server-side from `contentText`; clients do not submit it.
- Published, non-archived articles appear in sitemap.
- Draft and archived articles do not appear in sitemap.
- Blog revalidation route is authenticated and receives `articleId`.
- Public blog fetches use the `blog-articles` cache tag.
- Sitemap fetches may keep the existing 3600s sitemap pattern; immediate sitemap refresh comes from `revalidatePath('/sitemap.xml')`.
- TipTap is loaded only on create/edit pages.
- TipTap must be imported with `next/dynamic` or an equivalent client-only split with SSR disabled.
- Admin edit/archive controls use local or inline SVG icons, not a broad icon package.
- Archive confirmation uses `window.confirm` in V1.
- Article image URLs must point to blog-specific GCS object prefixes, not arbitrary files in the same bucket.

---

## Phase 0 - Baseline, Dependencies, and Guardrails

### Goal

Confirm the current working state and avoid mixing unrelated changes into the blog implementation.

### Files to inspect

```txt
docs/DESIGN-DOC-BLOG-ARTICLES.md
happy-colors-nextjs-project/package.json
server/package.json
server/routes.js
server/middlewares/auth.js
server/controllers/homeBannersController.js
server/services/homeBannersService.js
server/helpers/gcsImageHelper.js
happy-colors-nextjs-project/src/app/sitemap.js
happy-colors-nextjs-project/src/components/header/header.jsx
happy-colors-nextjs-project/src/managers/uploadManager.js
happy-colors-nextjs-project/src/app/api/uploads/proxy/route.js
happy-colors-nextjs-project/src/app/api/uploads/delete/route.js
happy-colors-nextjs-project/src/app/api/_lib/auth.js
happy-colors-nextjs-project/src/app/api/_lib/uploadValidation.js
```

### Pre-flight checks

- Confirm `sharp` installs successfully on the Windows development machine and the deployment environment.
- Confirm `server/helpers/gcsImageHelper.js` exposes server-side GCS deletion helpers usable from Express services.
- Confirm `/api/revalidate/products/route.js` still uses `revalidatePath('/sitemap.xml')`; if not, keep blog sitemap revalidation but remove "matching product pattern" language during implementation notes.
- Confirm no public route imports the rich text editor directly.

### Commands

```powershell
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" status --short
Get-Content docs\DESIGN-DOC-BLOG-ARTICLES.md -Raw
Get-Content server\routes.js -Raw
Get-Content happy-colors-nextjs-project\src\managers\uploadManager.js -Raw
Get-Content happy-colors-nextjs-project\src\app\sitemap.js -Raw
```

### Dependency plan

Frontend package:

```txt
@tiptap/react
@tiptap/starter-kit
@tiptap/extension-link
@tiptap/extension-text-style
@tiptap/extension-color
@tiptap/extension-underline
@tiptap/extension-text-align
sharp
```

Backend package:

```txt
sanitize-html
```

### Manual thumbnail fallback, only if `sharp` fails pre-flight

If `sharp` cannot be used, implement this before release:

- add a second manual thumbnail upload field to `BlogArticleForm`;
- add a blog thumbnail upload helper or reuse the blog image route in a no-resize thumbnail mode;
- require both hero and thumbnail URLs before save;
- validate thumbnail GCS URL under `blog/articles/thumbnails/`;
- add form/API tests for manual thumbnail upload and rollback.

Install only when implementation starts, not during documentation-only planning.

### Acceptance

- Dirty/untracked files are known before implementation.
- Existing blog placeholder is identified.
- Existing upload, auth, revalidation, and sitemap patterns are understood.
- Dependency additions are confirmed and scoped.

---

## Phase 1 - Backend BlogArticle Model, Service, and API

### Goal

Add the Express-side article contract: schema, validation, sanitization, public/admin queries, authenticated mutations, soft archive, and route wiring.

### New files

```txt
server/models/BlogArticle.js
server/services/blogArticlesService.js
server/controllers/blogArticlesController.js
```

### Changed files

```txt
server/routes.js
server/package.json
server/package-lock.json
```

### Tests

```txt
server/__tests__/unit/services/blogArticlesService.test.js
server/__tests__/integration/blogArticles.test.js
```

### Model tasks

- Add `BlogArticle` schema:
  - `title`
  - `contentHtml`
  - `contentJson`
  - `contentText`
  - `excerpt`
  - `heroImageUrl`
  - `thumbnailImageUrl`
  - `heroImageAlt`
  - `seoTitle`
  - `seoDescription`
  - `status`
  - `publishedAt`
  - `archivedAt`
  - `newsletterReady`
  - `newsletterSentAt`
  - `owner`
  - timestamps
- Add indexes:
  - `{ status: 1, archivedAt: 1, publishedAt: -1, createdAt: -1 }`
  - `{ archivedAt: 1, updatedAt: -1 }`
- Keep `newsletterReady` and `newsletterSentAt` passive and non-writable in V1.

### Service tasks

- Add `createError(message, statusCode)` helper consistent with existing services.
- Validate article ids with `mongoose.Types.ObjectId.isValid`.
- Add public list:
  - returns only `status: 'published'`;
  - returns only `archivedAt: null`;
  - sorts newest-first by `publishedAt`, then `createdAt`.
- Add admin list:
  - requires user context;
  - returns draft, published, and archived articles;
  - sorts by `updatedAt` descending.
- Add public get:
  - returns published, non-archived article by id;
  - invalid/missing/unpublished/archived ids produce 404-style errors.
- Add admin get:
  - requires user context;
  - can return draft, published, or archived article by id.
- Add create:
  - requires user context;
  - whitelists create fields only;
  - sets `owner` from `userId`;
  - sanitizes `contentHtml`;
  - validates `contentJson`;
  - generates `contentText`;
  - generates `excerpt`;
  - validates hero and thumbnail GCS URLs;
  - if `status` is `published`, sets `publishedAt`.
- Add edit:
  - requires user context;
  - whitelists edit fields only;
  - rejects `status` with 400;
  - preserves `owner`;
  - sanitizes changed `contentHtml`;
  - validates changed `contentJson`;
  - regenerates `contentText` and `excerpt` when body changes;
  - validates image URLs;
  - after successful save, deletes old hero/thumbnail only if unreferenced.
- Add status patch:
  - requires user context;
  - accepts only `draft` or `published`;
  - sets `publishedAt` only if moving to published and `publishedAt` is empty;
  - preserves original `publishedAt` on later status cycles.
- Add archive:
  - requires user context;
  - sets `archivedAt` if not already archived;
  - does not delete images.
- Add restore:
  - requires user context;
  - clears `archivedAt`;
  - preserves `status`.
- Add GCS URL validation:
  - protocol exactly `https:`;
  - hostname exactly `storage.googleapis.com`;
  - no username/password/user-info;
  - first path segment equals configured bucket name;
  - hero object path starts with `blog/articles/hero/`;
  - thumbnail object path starts with `blog/articles/thumbnails/`;
  - decoded object path has no `.` or `..` traversal segments;
  - no query string or signed URL params;
  - reject unsafe schemes.
- Add content JSON validation:
  - validation runs only when `contentJson` is supplied;
  - empty or missing `contentJson` is allowed;
  - max serialized size 100 KB;
  - supported root document shape;
  - allow only known TipTap/ProseMirror node types:
    - `doc`;
    - `paragraph`;
    - `text`;
    - `heading`;
    - `bulletList`;
    - `orderedList`;
    - `listItem`;
    - `hardBreak`;
    - `blockquote`, only if enabled in the editor.
  - allow only known marks:
    - `bold`;
    - `italic`;
    - `underline`;
    - `link`;
    - `textStyle` with validated color/font-size attributes.
  - allow only expected attrs:
    - `level` for headings;
    - safe `href`, `target`, `rel` for links;
    - `textAlign` values `left`, `center`, `right`;
    - color/font-size values matching the sanitizer allowlist.
  - reject or strip unknown node/mark types and unexpected attrs.
- Add sanitization with `sanitize-html`:
  - allow only planned article tags;
  - allow safe links;
  - allow narrow style properties for color, font-size, and text-align;
  - strip script/event handlers/iframes/unsafe CSS.
- Add cross-reference checks before deleting old blog images:
  - other `BlogArticle.heroImageUrl`;
  - other `BlogArticle.thumbnailImageUrl`.
- Use the Express-side server helper `deleteImageFromGCS` from `server/helpers/gcsImageHelper.js` for old image cleanup. Do not use the frontend `/api/uploads/delete` token flow for old article images, because the article model stores URLs, not short-lived delete tokens.
- Log but do not fail the article update if old GCS cleanup fails after a successful DB save.

### Controller tasks

- Add controller routes:

```txt
GET    /
GET    /admin
GET    /admin/:articleId
GET    /:articleId
POST   /
PUT    /:articleId
PATCH  /:articleId/status
PATCH  /:articleId/archive
PATCH  /:articleId/restore
```

- Register routes in this order:

```js
router.get('/admin', requireAuth, ...);
router.get('/admin/:articleId', requireAuth, ...);
router.get('/:articleId', ...);
```

- Add shared mutation rate limiter:
  - same shared bucket for create, edit, status, archive, and restore;
  - suggested key prefix `blog-articles`;
  - window `10 * 60 * 1000`;
  - max `20`.
- Add a TODO comment near authenticated mutations:
  - V1 treats authenticated users as trusted operators;
  - change to admin role check if registration becomes public.
- Mount controller in `server/routes.js`:

```js
router.use('/blog-articles', blogArticlesController);
```

### Backend unit tests

`server/__tests__/unit/services/blogArticlesService.test.js`

Required coverage:

- Public list returns only published, non-archived articles newest-first.
- Public detail rejects invalid ObjectId with 404-style error.
- Public detail rejects draft articles.
- Public detail rejects archived articles.
- Admin list requires user context.
- Admin list includes draft, published, and archived articles.
- Admin list sorts by `updatedAt` descending.
- Admin get requires user context.
- Create rejects missing user context.
- Create sets `owner` from `userId`.
- Create ignores client-provided `owner`.
- Create sanitizes `<script>`.
- Create strips event handlers such as `onerror`.
- Create strips or rejects `href="javascript:"`.
- Create strips `<iframe>`.
- Create strips disallowed inline styles such as `background-image: url(...)`.
- Create strips disallowed inline styles such as `position: fixed`.
- Create preserves only allowed color/font-size/text-align style values.
- Create generates `contentText`.
- Create generates `excerpt` from `contentText`.
- Create validates `contentJson` size.
- Create allows missing `contentJson`.
- Create rejects unknown `contentJson` node/mark types.
- Create rejects unexpected `contentJson` attrs.
- Edit validates `contentJson` size.
- Edit rejects unknown `contentJson` node/mark types.
- Edit rejects unexpected `contentJson` attrs.
- Service rejects `title` longer than 160 characters.
- Service rejects `seoTitle` longer than 70 characters.
- Service rejects `seoDescription` longer than 170 characters.
- Service rejects `heroImageAlt` longer than 180 characters.
- Service enforces/generated `excerpt` max length of 240 characters.
- Create rejects unsafe/non-GCS hero URL.
- Create rejects unsafe/non-GCS thumbnail URL.
- Create rejects GCS URL with wrong bucket.
- Create rejects hero URL outside `blog/articles/hero/`.
- Create rejects thumbnail URL outside `blog/articles/thumbnails/`.
- Create rejects GCS URL with query params.
- Create sets `publishedAt` when initial status is published.
- Create leaves `publishedAt` null when initial status is draft.
- Edit preserves `owner`.
- Edit ignores/rejects client-supplied `excerpt`, `owner`, `publishedAt`, `archivedAt`, `newsletterReady`, and `newsletterSentAt`.
- Edit rejects client-supplied `status` with 400.
- Edit preserves `publishedAt`.
- Edit keeps archived article archived.
- Status patch draft to published sets `publishedAt` when empty.
- Status patch published to draft preserves `publishedAt`.
- Status patch draft to published again preserves original `publishedAt`.
- Archive sets `archivedAt`.
- Archive is idempotent for already archived articles and does not bump `archivedAt` on a second archive call.
- Restore clears `archivedAt`.
- Restore preserves `status`.
- Image replacement deletes old hero/thumbnail only after successful save.
- Image replacement skips delete if another article references old hero/thumbnail.
- Image replacement logs/continues when old cleanup fails.

### Backend integration tests

`server/__tests__/integration/blogArticles.test.js`

Required coverage:

- `GET /blog-articles` is public.
- `GET /blog-articles` excludes drafts.
- `GET /blog-articles` excludes archived articles.
- `GET /blog-articles/:id` returns a published article.
- `GET /blog-articles/:id` returns 404 for malformed ObjectId.
- `GET /blog-articles/:id` returns 404 for draft article.
- `GET /blog-articles/:id` returns 404 for archived article.
- `GET /blog-articles/admin` rejects guests.
- `GET /blog-articles/admin/:id` rejects guests.
- `GET /blog-articles/admin/:id` returns draft for authenticated user.
- `POST /blog-articles` rejects guests.
- `POST /blog-articles` creates article for authenticated user.
- `PUT /blog-articles/:id` rejects guests.
- `PUT /blog-articles/:id` edits article for authenticated user.
- `PUT /blog-articles/:id` returns 400 when `status` is present in the body.
- `PUT /blog-articles/:id` does not allow handcrafted `excerpt`, `owner`, `publishedAt`, `archivedAt`, `newsletterReady`, or `newsletterSentAt` to overwrite server-owned values.
- `PATCH /blog-articles/:id/status` rejects guests.
- `PATCH /blog-articles/:id/archive` rejects guests.
- `PATCH /blog-articles/:id/restore` rejects guests.
- `PATCH /status`, `/archive`, and `/restore` work for authenticated user.
- Repeated `PATCH /archive` on an already archived article is idempotent.
- `/blog-articles/admin` route is not captured by `/:articleId`; guest receives auth error, not article-not-found.
- Mutation rate limiter is configured for mutation routes if test infra can check it stably.

### Acceptance

- Express API exposes the blog contract.
- Public routes never leak drafts or archived articles.
- Admin routes are authenticated.
- Status/archive/restore behavior matches design.
- Sanitization and mass-assignment protections are covered.
- Backend tests for the phase pass.

---

## Phase 2 - Blog Image Upload and Thumbnail Generation

### Goal

Add an authenticated upload route that accepts one hero image, uploads it to GCS, generates a WebP thumbnail, uploads the thumbnail, and returns cleanup metadata for both objects.

### New files

```txt
happy-colors-nextjs-project/src/app/api/blog/images/route.js
```

### Changed files

```txt
happy-colors-nextjs-project/src/managers/uploadManager.js
happy-colors-nextjs-project/package.json
happy-colors-nextjs-project/package-lock.json
```

### Tests

```txt
happy-colors-nextjs-project/__tests__/api/blog/images.test.js
happy-colors-nextjs-project/__tests__/unit/managers/uploadManager.test.js
```

### API route tasks

- Add `export const runtime = 'nodejs'`.
- Use `requireApiAuth(request)` from `src/app/api/_lib/auth.js`.
- Add upload route rate limiting because thumbnail generation is CPU/memory-heavy:
  - shared prefix `blog-article-images` or reuse `blog-articles`;
  - suggested window `10 * 60 * 1000`;
  - suggested max `20` per authenticated user/IP.
- Include this route in any future shared Origin/Referer guard because it is cookie-authenticated and CPU-heavy.
- Load GCS helpers from existing API lib.
- Reuse existing image validation:
  - allowed MIME;
  - max size;
  - magic-byte sniffing;
  - MIME/extension consistency.
- Store hero images under a blog-specific folder, for example:

```txt
blog/articles/hero
```

- Generate thumbnail with `sharp`:
  - WebP;
  - width around 360px;
  - preserve aspect ratio;
  - no upscaling;
  - quality 75-82.
- Store thumbnails under a blog-specific folder, for example:

```txt
blog/articles/thumbnails
```

- Response shape:

```js
{
  heroImageUrl,
  heroObjectName,
  heroDeleteToken,
  thumbnailImageUrl,
  thumbnailObjectName,
  thumbnailDeleteToken
}
```

- If hero upload succeeds but thumbnail generation/upload fails:
  - attempt hero cleanup;
  - return error;
  - log cleanup failure if cleanup also fails.
- Do not add permissive CORS headers.

### Upload manager tasks

- Add `uploadBlogArticleImage(file)` to `src/managers/uploadManager.js`.
- The helper posts to `/api/blog/images`.
- The helper validates response has both hero and thumbnail URL/object/token sets.
- Keep `uploadSignedFile()` behavior unchanged.
- Reuse `deleteSignedUploadedFile(objectName, deleteToken)` for rollback cleanup.

### API tests

`happy-colors-nextjs-project/__tests__/api/blog/images.test.js`

Required coverage:

- Rejects unauthenticated request.
- Applies rate limiting to repeated authenticated upload requests.
- Rejects missing file.
- Rejects non-image file.
- Rejects spoofed image content.
- Rejects oversized image.
- Returns hero and thumbnail URLs.
- Returns hero and thumbnail object names.
- Returns hero and thumbnail delete tokens.
- Thumbnail object is WebP.
- Thumbnail is around 360px wide.
- Thumbnail is not upscaled for smaller source image.
- Cleans hero when thumbnail generation/upload fails, if failure can be mocked.

### Manager tests

`happy-colors-nextjs-project/__tests__/unit/managers/uploadManager.test.js`

Required coverage:

- `uploadBlogArticleImage` posts to `/api/blog/images`.
- `uploadBlogArticleImage` returns the expected pair response.
- `uploadBlogArticleImage` throws a meaningful error on non-ok response.
- `uploadBlogArticleImage` throws `Неочакван отговор от blog image upload route-а.` or an equivalent explicit unexpected-response error when any hero/thumbnail response field is missing.
- Existing `uploadSignedFile()` tests keep passing.
- Existing `deleteSignedUploadedFile()` tests keep passing.

### Acceptance

- Logged-in users can upload a blog hero image and receive hero/thumbnail URLs.
- Guests cannot use the route.
- Existing product/banner upload helpers remain compatible.
- Upload tests pass.

---

## Phase 3 - Frontend Manager, Revalidation, Form, and Rich Text Editor

### Goal

Add client/server frontend plumbing for blog article CRUD, editor UI, image upload rollback, status/archive/restore actions, and cache revalidation.

### New files

```txt
happy-colors-nextjs-project/src/managers/blogArticlesManager.js
happy-colors-nextjs-project/src/components/blog/BlogArticleForm.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleForm.module.css
happy-colors-nextjs-project/src/components/blog/RichTextEditor.jsx
happy-colors-nextjs-project/src/components/blog/RichTextEditor.module.css
happy-colors-nextjs-project/src/app/blog/create/page.js
happy-colors-nextjs-project/src/app/blog/create/CreateBlogArticleClient.jsx
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/page.js
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/EditBlogArticleClient.jsx
happy-colors-nextjs-project/src/app/blog/manage/page.js
happy-colors-nextjs-project/src/app/api/revalidate/blog/route.js
```

### Changed files

```txt
happy-colors-nextjs-project/src/managers/uploadManager.js
happy-colors-nextjs-project/package.json
happy-colors-nextjs-project/package-lock.json
```

### Tests

```txt
happy-colors-nextjs-project/__tests__/unit/managers/blogArticlesManager.test.js
happy-colors-nextjs-project/__tests__/components/blog/BlogArticleForm.test.jsx
happy-colors-nextjs-project/__tests__/components/blog/RichTextEditor.test.jsx
happy-colors-nextjs-project/__tests__/components/blog/BlogManagePage.test.jsx
happy-colors-nextjs-project/__tests__/api/revalidate/blog.test.js
```

### Manager tasks

- Add `getBlogArticles()`:
  - fetches public list from `${baseURL}/blog-articles`;
  - uses cache tag `blog-articles` where server-side fetch is used.
- Add `getBlogArticleById(articleId)`:
  - public fetch for published article detail.
  - use the `blog-articles` cache tag when called from the server article detail page;
  - detail freshness primarily relies on `revalidatePath('/blog/${articleId}')`, with the tag as a broad V1 fallback.
- Add `getAdminBlogArticles()`:
  - authenticated fetch to `/blog-articles/admin`;
  - `cache: 'no-store'`.
- Add `getAdminBlogArticleById(articleId)`:
  - authenticated fetch to `/blog-articles/admin/:articleId`;
  - `cache: 'no-store'`.
- Add `createBlogArticle(values)`.
- Add `editBlogArticle(articleId, values)`.
- Add `updateBlogArticleStatus(articleId, status)`.
- Add `archiveBlogArticle(articleId)`.
- Add `restoreBlogArticle(articleId)`.
- Add `invalidateBlogCaches(articleId)`:
  - posts to `/api/revalidate/blog`;
  - includes `{ articleId }`;
  - logs but does not fail a successful mutation if revalidation fails.
- Use one `blog-articles` cache tag for list and detail fetches in V1. This means any mutation can invalidate more cached article data than strictly necessary; the simplicity is acceptable for the expected article volume.

### Revalidation route tasks

- Add `POST /api/revalidate/blog`.
- Use `requireApiAuth(request)`.
- Reject unauthenticated requests.
- Parse body safely.
- Require `articleId` to match Mongo ObjectId regex `^[a-fA-F0-9]{24}$` before interpolating it into `revalidatePath`.
- Return 400 for missing/malformed `articleId`.
- Call:
  - `revalidateTag('blog-articles')`;
  - `revalidatePath('/blog')`;
  - `revalidatePath(`/blog/${articleId}`)`;
  - `revalidatePath('/sitemap.xml')`.

### Rich text editor tasks

- Build editor as client component.
- Use TipTap extensions:
  - StarterKit;
  - Link;
  - TextStyle;
  - Color;
  - Underline;
  - TextAlign;
  - heading/font-size support.
- Provide toolbar controls for:
  - bold;
  - italic;
  - underline;
  - headings or font sizes;
  - color;
  - align left/center/right;
  - ordered list;
  - unordered list;
  - link add/edit/remove.
- Output both:
  - `contentHtml`;
  - `contentJson`.
- Load editor only on create/edit pages. Do not import it from public detail page.
- Use `next/dynamic` or an equivalent client-only split with SSR disabled for the editor import:

```js
const RichTextEditor = dynamic(() => import('@/components/blog/RichTextEditor'), {
  ssr: false,
});
```

- Do not add explanatory instructional text inside the app UI beyond normal field labels/errors.

### Form tasks

- Build `BlogArticleForm`.
- Support create and edit modes.
- Fields:
  - title;
  - rich text body;
  - hero image upload;
  - hero image alt;
  - optional SEO title;
  - optional SEO description;
  - status selector;
  - save;
  - cancel.
- Required before save:
  - title;
  - body;
  - hero image/thumbnail pair;
  - alt text;
  - status.
- Optional SEO fields enforce max lengths:
  - `seoTitle` max 70;
  - `seoDescription` max 170.
- Draft save uses the same required fields as published save.
- Use `uploadBlogArticleImage(file)` for image upload.
- Store returned hero/thumbnail URLs in form state.
- Keep returned object names and delete tokens for rollback.
- On create failure after upload:
  - attempt cleanup of hero;
  - attempt cleanup of thumbnail;
  - log cleanup failure;
  - show save error.
- On edit failure after replacement upload:
  - cleanup newly uploaded hero/thumbnail pair.
- On edit success:
  - backend cleans old images if unreferenced.
- If editing archived article:
  - show archived-state warning;
  - save keeps article archived;
  - restore action is separate.
- Cancel navigates back without submitting.

### Page tasks

- Create page:
  - auth-gated client flow;
  - renders form;
  - on success redirects:
    - Phase 3 standalone behavior: redirect both draft and published saves to `/blog/manage`, because public detail is introduced in Phase 4;
    - after Phase 4 lands, published saves may redirect to `/blog/[articleId]`, while drafts continue to redirect to `/blog/manage`.
- Edit page:
  - auth-gated client flow;
  - fetches admin article;
  - renders form;
  - on success redirects to public article if published and not archived, otherwise `/blog/manage`.
- Manage page:
  - auth-gated client flow;
  - lists draft, published, archived;
  - newest-updated-first;
  - links to edit;
  - offers restore for archived articles.

### Manager tests

Required coverage:

- Public list uses `/blog-articles`.
- Public detail uses `/blog-articles/:id`.
- Admin list uses `/blog-articles/admin` with credentials.
- Admin detail uses `/blog-articles/admin/:id` with credentials.
- Create sends allowed payload shape.
- Edit does not send `status`.
- Status patch sends `PATCH /status`.
- Archive sends `PATCH /archive`.
- Restore sends `PATCH /restore`.
- Successful mutations call revalidation with `articleId`.
- `invalidateBlogCaches` failure is logged and does not make the already-successful mutation fail.
- Archive calls revalidation with `articleId`.
- Restore calls revalidation with `articleId`.
- Non-ok responses throw meaningful errors.

### Revalidation tests

Required coverage:

- Rejects unauthenticated request.
- Rejects missing `articleId`.
- Rejects malformed `articleId`.
- Rejects path traversal-like `articleId` values such as `../foo` or `evil/path`.
- Calls `revalidateTag('blog-articles')`.
- Calls `revalidatePath('/blog')`.
- Calls `revalidatePath('/blog/:articleId')` using concrete id.
- Calls `revalidatePath('/sitemap.xml')`.

### Component tests

`BlogArticleForm.test.jsx`

Required coverage:

- Renders create form.
- Renders edit initial values.
- Requires title.
- Requires body.
- Requires hero image pair.
- Requires alt text.
- Requires status.
- Allows empty SEO fields.
- Enforces SEO max lengths when filled.
- Calls `uploadBlogArticleImage`.
- Submits hero and thumbnail URLs from upload response.
- Submits `contentHtml` and `contentJson`.
- Does not submit `excerpt`, `owner`, `publishedAt`, `archivedAt`, `newsletterReady`, or `newsletterSentAt`.
- Rejects `heroImageAlt` longer than 180 characters.
- Failed create after upload calls cleanup for both uploaded objects.
- Failed edit after replacement upload calls cleanup for both new uploaded objects.
- Archived edit mode shows archived-state warning.
- Cancel action navigates away.

`RichTextEditor.test.jsx`

Required coverage:

- Bold button changes output.
- Underline button changes output.
- Heading/font-size control changes output.
- Color control changes output.
- Align left/center/right controls change output.
- Ordered and unordered list controls change output.
- Link control creates safe link markup.
- Emits HTML and JSON changes to parent.

`BlogManagePage.test.jsx`

Required coverage:

- Guests are redirected or blocked by auth flow.
- Authenticated user sees draft/published/archived articles.
- Edit links point to `/blog/:id/edit`.
- Restore action calls manager for archived article.

### Acceptance

- Authenticated user can create/edit/manage articles through frontend.
- Editor supports required formatting.
- Upload rollback is covered.
- Revalidation route is authenticated and covered.
- TipTap is not bundled into public detail page through direct import.
- Public detail page does not load TipTap/editor chunks; verify by build output inspection or Playwright network assertion if practical.

---

## Phase 4 - Public Blog Pages, Navigation, SEO, and Sitemap

### Goal

Replace the placeholder `/blog` page with public blog index/detail experiences, add navigation links, article aside, SEO metadata, JSON-LD if feasible, and sitemap entries.

### New files

```txt
happy-colors-nextjs-project/src/app/blog/[articleId]/page.js
happy-colors-nextjs-project/src/app/blog/blog.module.css
happy-colors-nextjs-project/src/components/blog/BlogArticleAside.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleActions.jsx
```

### Changed files

```txt
happy-colors-nextjs-project/src/app/blog/page.js
happy-colors-nextjs-project/src/app/sitemap.js
happy-colors-nextjs-project/src/components/header/header.jsx
```

### Tests

```txt
happy-colors-nextjs-project/__tests__/components/blog/BlogIndexPage.test.jsx
happy-colors-nextjs-project/__tests__/components/blog/BlogArticlePage.test.jsx
happy-colors-nextjs-project/__tests__/components/blog/BlogArticleAside.test.jsx
happy-colors-nextjs-project/__tests__/components/blog/BlogArticleActions.test.jsx
happy-colors-nextjs-project/__tests__/components/layout/Header.test.jsx
happy-colors-nextjs-project/__tests__/unit/app/sitemap.test.js
```

### Blog index tasks

- Replace placeholder `/blog/page.js`.
- Fetch published articles newest-first.
- Use `next: { revalidate: 60, tags: ['blog-articles'] }` on server fetch.
- Render index/list view, not full newest article.
- Feature newest article as prominent list item/card.
- Render remaining articles newest-first.
- If empty:
  - show simple public empty state;
  - logged-in users can see create link if auth state is available client-side.
- Add metadata:
  - title "Блог";
  - description for blog section.

### Article detail tasks

- Add `/blog/[articleId]/page.js`.
- Validate/fetch article by id through public endpoint.
- Use `notFound()` for:
  - malformed ids;
  - missing article;
  - draft article;
  - archived article.
- Fetch published article list for aside.
- Render:
  - hero image;
  - `alt={heroImageAlt}`;
  - H1 title;
  - small pale date near top-right under/near H1;
  - sanitized `contentHtml`;
  - aside list newest-first;
  - edit/archive controls only for logged-in user.
- Never render raw `contentJson`.
- Render edit/archive controls through a client child component that reads `AuthContext`; the server article page should not attempt to infer auth state directly.
- Exclude current article from aside.
- Archive action uses `window.confirm`.
- Archive action calls manager, revalidates, and navigates to `/blog` or refreshes appropriately.

### BlogArticleActions tasks

- Props:
  - `articleId`;
  - optional `isArchived`;
  - optional callbacks for successful archive/restore if used outside detail page.
- Reads `AuthContext`.
- Renders nothing while auth is loading or when no user exists.
- Renders local/inline SVG edit link to `/blog/${articleId}/edit` for logged-in users.
- Renders local/inline SVG archive button for logged-in users when the article is not archived.
- Uses `window.confirm` before archive.
- Calls `archiveBlogArticle(articleId)`.
- Navigates or refreshes after successful archive.
- Does not mount TipTap or form code.

### Aside tasks

- Each item renders:
  - thumbnail image;
  - title;
  - excerpt with ellipsis;
  - simple `Прочети повече >>>` link with no filled background.
- Desktop:
  - two-column layout;
  - aside on right;
  - aside list gets `max-height: var(--article-body-height, 70vh)`;
  - `overflow-y: auto`.
- Mobile:
  - one-column layout;
  - aside below article;
  - no nested scroll by default.
- V1 uses the `70vh` aside max-height fallback. Do not add `ResizeObserver` unless later QA shows the fallback is insufficient.

### Navigation tasks

- Uncomment the existing commented public Blog nav item in `mainNavList`:

```jsx
<li><Link href="/blog">Блог</Link></li>
```

- Add authenticated nav items to the separate `userNav` list, next to existing content-admin links:

```jsx
<li><Link href="/blog/create">Създай блог статия</Link></li>
<li><Link href="/blog/manage">Блог статии</Link></li>
```

- Preserve existing nav behavior and mobile menu behavior.

### SEO tasks

- Detail metadata:
  - `title: seoTitle || title`;
  - `description: seoDescription || excerpt`;
  - Open Graph image from hero or thumbnail;
  - canonical `/blog/${articleId}`.
- Optional V1 JSON-LD:
  - `BlogPosting`;
  - only for published, non-archived article;
  - include title, description, image, datePublished, dateModified, URL.
- If JSON-LD is implemented, add a render test. If it is skipped in V1, keep it out of acceptance criteria.

### Sitemap tasks

- Update `src/app/sitemap.js`.
- Add static `/blog` entry.
- Fetch public `/blog-articles` using the existing sitemap style, with the sitemap module's `revalidate = 3600`.
- Add only published, non-archived articles.
- Entry shape:
  - `url: ${PROD_SITE_URL}/blog/${article._id}`;
  - `lastModified: new Date(article.updatedAt || article.publishedAt || article.createdAt || now)`;
  - `changeFrequency: 'weekly'` or `'monthly'`;
  - `priority: 0.6`.
- If blog fetch fails:
  - log;
  - return rest of sitemap unchanged.
- Do not add a 60s cache tag fetch inside the sitemap just for blog articles; sitemap freshness is handled by `/sitemap.xml` path revalidation and the module-level revalidate window.

### Page/component tests

Required coverage:

- `/blog` renders article index.
- `/blog` does not render full article body as duplicate content.
- `/blog` empty state renders.
- `/blog` newest article is prominent and links to detail.
- Article detail renders hero image with alt text.
- Article detail renders H1 and date.
- Article detail renders sanitized body.
- Article detail never renders raw `contentJson`.
- Article detail metadata falls back to article `title` when `seoTitle` is empty.
- Article detail metadata falls back to generated `excerpt` when `seoDescription` is empty.
- Public user does not see edit/archive controls.
- Logged-in user sees edit/archive controls after auth loading.
- Archive cancellation does not call manager.
- Archive confirmation calls manager.
- Archiving an already-archived article is idempotent.
- Aside list is newest-first.
- Aside excludes current article.
- Aside item renders thumbnail, title, excerpt, and read-more link.
- Mobile layout puts aside below article.
- Header shows public Blog nav.
- Header shows authenticated create/manage blog links only for logged-in user.

### Sitemap tests

Required coverage:

- Sitemap includes `/blog`.
- Sitemap includes published blog article.
- Sitemap excludes draft blog article.
- Sitemap excludes archived blog article.
- Sitemap wraps `lastModified` in `new Date(...)`.
- Sitemap returns static/product entries if blog fetch fails.

### Acceptance

- Public blog index works.
- Public article detail works.
- Guests cannot see controls.
- Logged-in users can access controls.
- Responsive article layout works.
- Sitemap includes only public articles.
- Existing nav links still work.

---

## Phase 5 - End-to-End and Manual QA

### Goal

Verify realistic public and authenticated blog journeys in browser and confirm existing site areas still behave normally.

### E2E files

```txt
e2e/tests/blog.spec.js
e2e/tests/helpers/shop.js
```

### E2E data strategy

Seed or create:

- trusted operator user;
- at least 3 published blog articles;
- at least 1 draft blog article;
- at least 1 archived blog article;
- small valid test image.

If GCS is not available in e2e:

- mock/stub upload route; or
- mark upload-dependent e2e as manual-only and keep API/unit coverage for upload route.

### E2E scenarios

#### Public blog index

- Open `/blog`.
- See Blog page.
- See newest article prominent.
- See published article list.
- Do not see draft article.
- Do not see archived article.
- Click article link and reach `/blog/:id`.

#### Public article detail

- Open `/blog/:publishedId`.
- See hero image.
- See H1.
- See date.
- See body.
- See aside list.
- Aside excludes current article.
- Do not see edit/archive controls.

#### Authenticated article controls

- Login as trusted operator.
- Open `/blog/:publishedId`.
- See edit/archive controls.
- Click edit and reach `/blog/:id/edit`.
- Cancel archive and confirm article remains visible.
- Confirm archive and article disappears from public detail/list.
- Restore from manage page and article becomes public again if status is published.

#### Create article

- Login.
- Open `/blog/create`.
- Fill title, body, alt, optional SEO.
- Upload hero image.
- Save as draft.
- Redirect to manage.
- Draft appears in manage and not in public blog.
- Edit draft or use status control to publish.
- Published article appears in public blog and sitemap after revalidation window/path.

#### Edit article

- Login.
- Open edit page.
- Change title/body/SEO.
- Replace image if storage route is available.
- Save.
- Public article reflects changes.
- Old image cleanup is covered by service tests; staging bucket manual QA may verify real deletion.

#### Responsive layout

- Desktop:
  - article/aside are two columns;
  - aside can scroll independently when long;
  - no control overlap.
- Mobile:
  - article is single column;
  - aside appears below content;
  - text does not overflow.

### Existing functionality regression smoke

Run or manually verify:

- homepage loads;
- products page loads;
- product detail page loads;
- cart page loads;
- categories page loads;
- contacts page loads;
- FAQ page loads;
- authenticated nav still works;
- homepage banner create/edit links still work if tested.

### Manual storage QA

If staging bucket is available:

1. Create article with hero image A.
2. Confirm hero A and thumbnail A exist.
3. Edit article and upload hero image B.
4. Confirm hero B and thumbnail B exist.
5. Confirm old hero A and thumbnail A are deleted if unreferenced.
6. Repeat with two articles sharing old image URLs and confirm cleanup skips shared assets.
7. Archive article and confirm images are not deleted.
8. Restore article and confirm images still render.

### Acceptance

- Public E2E passes.
- Authenticated E2E passes where auth/storage setup allows.
- Upload-dependent gaps are documented if not automatable.
- Existing core site pages still work.

---

## Phase 6 - Final Verification and External Review

### Goal

Close the feature with tests, build, diff review, and a clear release checklist.

### Commands

Root:

```powershell
npm test
npm run build
```

Backend only:

```powershell
Set-Location server
npm test
```

Frontend targeted:

```powershell
Set-Location happy-colors-nextjs-project
npm run test:api
npm run test:unit
npm run test:components
npm run build
```

E2E:

```powershell
npx playwright test --config=e2e/playwright.config.js --grep "blog"
```

If broad regression confidence is needed:

```powershell
npm run test:coverage
npm run test:e2e:smoke
```

### External review

Use explicit standard Opus unless 1M context is intentionally enabled:

```powershell
git diff | claude --model claude-opus-4-7 -p "Review this git diff for bugs, regressions, security issues, and missing tests. Give concise, actionable findings with file paths and line references where possible."
```

If Opus is unavailable, use Sonnet and label it:

```powershell
git diff | claude --model claude-sonnet-4-6 -p "Review this git diff for bugs, regressions, security issues, and missing tests. Give concise, actionable findings with file paths and line references where possible."
```

Weigh findings on merit; do not accept style-only suggestions unless they reveal a real maintainability or regression risk.

### Final acceptance checklist

- `/blog` is linked in public nav.
- `/blog` lists only published, non-archived articles.
- `/blog/[articleId]` renders published article with hero alt text, title, date, body, and aside.
- Aside list is newest-first and scrolls independently on desktop when long.
- Mobile layout stacks article and aside.
- Guests cannot create/edit/archive/restore through API.
- Logged-in users can create articles.
- Logged-in users can edit articles.
- Logged-in users can publish/unpublish articles.
- Logged-in users can archive articles.
- Logged-in users can restore articles.
- Draft articles are hidden publicly.
- Archived articles are hidden publicly.
- Public detail returns not found for invalid/missing/draft/archived article.
- Rich text output is sanitized server-side.
- Article pages never render raw `contentJson`.
- Hero upload generates thumbnail automatically.
- Manual thumbnail fallback exists if automatic generation cannot ship.
- Upload route rejects guests and invalid files.
- Express article routes use `requireAuth` from `server/middlewares/auth.js`; Next upload/revalidation routes use `requireApiAuth` from `src/app/api/_lib/auth.js`.
- Revalidation route rejects guests and malformed article ids.
- Sitemap includes `/blog`.
- Sitemap includes only published, non-archived articles.
- Existing homepage, products, cart, categories, contacts, and FAQ still work.
- Relevant tests pass or storage-dependent gaps are documented with manual QA evidence.
- Build passes.
- Opus review findings are addressed or explicitly rejected with rationale.

---

## File Responsibility Map

### Backend core

```txt
server/models/BlogArticle.js
server/services/blogArticlesService.js
server/controllers/blogArticlesController.js
server/routes.js
```

Responsibility:

- article persistence;
- public/admin query rules;
- sanitization;
- mass-assignment protection;
- archive/status behavior;
- old image cleanup rules.

### Upload and image processing

```txt
happy-colors-nextjs-project/src/app/api/blog/images/route.js
happy-colors-nextjs-project/src/managers/uploadManager.js
```

Responsibility:

- authenticated upload;
- validation;
- GCS write;
- thumbnail generation;
- cleanup metadata;
- frontend upload helper.

### Frontend management

```txt
happy-colors-nextjs-project/src/managers/blogArticlesManager.js
happy-colors-nextjs-project/src/components/blog/BlogArticleForm.jsx
happy-colors-nextjs-project/src/components/blog/RichTextEditor.jsx
happy-colors-nextjs-project/src/app/blog/create/page.js
happy-colors-nextjs-project/src/app/blog/create/CreateBlogArticleClient.jsx
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/page.js
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/EditBlogArticleClient.jsx
happy-colors-nextjs-project/src/app/blog/manage/page.js
```

Responsibility:

- authenticated create/edit/manage flow;
- rich text editing;
- upload rollback;
- status/archive/restore actions.

### Public rendering and SEO

```txt
happy-colors-nextjs-project/src/app/blog/page.js
happy-colors-nextjs-project/src/app/blog/[articleId]/page.js
happy-colors-nextjs-project/src/components/blog/BlogArticleAside.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleActions.jsx
happy-colors-nextjs-project/src/app/sitemap.js
happy-colors-nextjs-project/src/components/header/header.jsx
```

Responsibility:

- public index;
- public article detail;
- article aside;
- admin action visibility;
- navigation;
- metadata;
- sitemap.

---

## Rollout Strategy

Recommended PR split if the work is broken into reviewable chunks:

1. PR 1: Backend model/service/controller/tests.
2. PR 2: Blog image upload/thumbnail route/tests.
3. PR 3: Frontend manager/form/editor/revalidation/manage pages/tests.
4. PR 4: Public blog pages/navigation/SEO/sitemap/tests.
5. PR 5: E2E/manual QA/final hardening.

If implemented in one branch, keep the same internal checkpoints and run targeted tests after each phase.

Do not merge public navigation before the public `/blog` page and backend public list/detail behavior are ready. If backend/admin lands earlier, keep the public nav link disabled until Phase 4 is complete.
