# Happy Colors - Blog Articles Implementation Plan

**Date:** 2026-05-15
**Status:** Updated after local implementation changes
**Related design document:** `docs/DESIGN-DOC-BLOG-ARTICLES.md`
**Goal:** Track the remaining work for the Blog Articles feature after the current local implementation: public reading, authenticated create/edit/archive, manual hero/thumbnail uploads, TipTap editor, validation, SEO, sitemap, tests, and QA.

---

## Current Fixed Decisions

- Public users can read non-archived blog articles.
- Authenticated trusted operators can create, edit, archive, and restore articles.
- Draft mode is removed.
- The publish/unpublish action is removed.
- New articles are created as `published` immediately.
- `publishedAt` is set on create and preserved on edit.
- Article public URLs use Mongo ids: `/blog/[articleId]`.
- No title slug in V1.
- Archive is soft delete through `archivedAt`.
- Restore clears `archivedAt` and preserves `status`.
- V1 keeps `status: "published"` for filtering/compatibility, but no draft state exists.
- Public pages render sanitized `contentHtml`, never raw `contentJson`.
- `contentJson` stores TipTap/ProseMirror JSON for future newsletter/editor transformations.
- Article images are uploaded through a blog-specific authenticated upload route.
- Hero image and thumbnail image are uploaded manually as two separate files.
- No automatic thumbnail generation.
- No `sharp` dependency for blog images.
- No app-side resampling of the hero image.
- `thumbnailImageUrl` is required in the article model.
- `seoTitle` and `seoDescription` are optional with max-length validation.
- `excerpt` is generated server-side from `contentText`.
- Non-archived articles appear in sitemap.
- Archived articles do not appear in sitemap.
- Blog revalidation route is authenticated and receives `articleId`.
- Public blog fetches use the `blog-articles` cache tag.
- TipTap is loaded only on create/edit pages.
- There is no `/blog/manage` page in V1.
- Header logged-in navigation points directly to `/blog/create`.
- V1 treats every authenticated user as a trusted content operator. If public registration becomes available, mutation routes need explicit admin/owner checks before production.

---

## Phase Summary

1. Backend model/service/controller/routes.
2. Manual blog image upload route and upload manager integration.
3. Frontend manager, revalidation, form, and TipTap editor.
4. Public blog pages, logged-in article actions, navigation, SEO, and sitemap.
5. Tests, manual QA, external review, and release readiness.

The first four phases are locally implemented. The remaining work is mainly documentation, manual QA, review, and any polish/fixes found during QA.

---

## Phase 1 - Backend Blog Module

### Files

```txt
server/models/BlogArticle.js
server/services/blogArticlesService.js
server/controllers/blogArticlesController.js
server/routes.js
server/__tests__/unit/services/blogArticlesService.test.js
server/__tests__/integration/blogArticles.test.js
server/__tests__/integration/factories.js
```

### Implemented Behavior

- Add `BlogArticle` model.
- Add public list/detail service methods.
- Add admin list/detail service methods for authenticated users.
- Add create service:
  - requires auth;
  - validates required fields;
  - sanitizes HTML;
  - validates TipTap JSON;
  - validates hero and thumbnail GCS URLs;
  - stamps `owner`;
  - generates `contentText`;
  - generates `excerpt`;
  - sets `status: "published"`;
  - sets `publishedAt`.
- Add edit service:
  - requires auth;
  - rejects `status`;
  - ignores/rejects server-owned fields through whitelisting;
  - preserves `publishedAt`;
  - regenerates `contentText` and `excerpt` when content changes;
  - deletes replaced images only after DB save and only if unreferenced.
- Add archive service:
  - requires auth;
  - sets `archivedAt`;
  - is idempotent.
- Add restore service:
  - requires auth;
  - clears `archivedAt`;
  - preserves `status`.
- Mount `/blog-articles` routes.
- Rate-limit mutation routes through the shared blog mutation bucket.

### Routes

```txt
GET   /blog-articles
GET   /blog-articles/:articleId
GET   /blog-articles/admin
GET   /blog-articles/admin/:articleId
POST  /blog-articles
PUT   /blog-articles/:articleId
PATCH /blog-articles/:articleId/archive
PATCH /blog-articles/:articleId/restore
```

No status patch route exists in V1.

### Backend Acceptance Criteria

- Public list returns non-archived articles newest-first.
- Public detail returns a non-archived article.
- Public reads do not filter by `status`, so legacy preview records created with the removed `draft` status are still visible after deployment.
- Public detail returns 404 for invalid, missing, or archived articles.
- Admin list/detail routes require auth.
- Create requires auth.
- Create stamps owner from auth, not request body.
- Create ignores client-provided `excerpt`, `contentText`, `owner`, timestamps, archive/newsletter fields.
- Create always returns `status: "published"` and a non-null `publishedAt`.
- Edit requires auth.
- Edit rejects client-supplied `status` with 400.
- Edit preserves `publishedAt`.
- Edit does not allow handcrafted `excerpt`, `contentText`, `owner`, `publishedAt`, `archivedAt`, `newsletterReady`, or `newsletterSentAt` to overwrite server-owned values.
- Archive requires auth and hides the article from public routes.
- Restore requires auth and makes the article public again if it is otherwise valid.
- Image replacement cleanup skips deletion when another article still references the same URL.
- Rate limiting applies to create, edit, archive, and restore.

---

## Phase 2 - Manual Blog Image Uploads

### Files

```txt
happy-colors-nextjs-project/src/app/api/blog/images/route.js
happy-colors-nextjs-project/src/managers/uploadManager.js
happy-colors-nextjs-project/__tests__/api/blog/images.test.js
happy-colors-nextjs-project/__tests__/unit/managers/uploadManager.test.js
happy-colors-nextjs-project/src/app/api/uploads/delete/route.js
```

### Implemented Behavior

- Add authenticated Next API upload route for blog images.
- Accept one file per request.
- Accept upload `kind`:
  - `hero`;
  - `thumbnail`.
- Store hero images under:

```txt
blog/articles/hero/
```

- Store thumbnail images under:

```txt
blog/articles/thumbnails/
```

- Return:

```js
{
  kind,
  imageUrl,
  objectName,
  deleteToken
}
```

- Add upload manager helper for blog article images.
- Validate unexpected response shapes.
- Reuse signed cleanup/delete behavior for failed form saves.

### Explicit Non-Goals

- Do not generate thumbnails automatically.
- Do not resample hero images.
- Do not add `sharp`.
- Do not return hero and thumbnail URLs from a single upload request.

### Upload Acceptance Criteria

- Guests cannot upload blog images.
- Invalid `kind` is rejected.
- Missing file is rejected.
- Non-image file is rejected.
- Oversized file is rejected.
- Hero upload stores object under the hero prefix.
- Thumbnail upload stores object under the thumbnail prefix.
- Response contains the single uploaded object's URL, object name, and delete token.
- Rate limiting applies to the upload route.
- Form cleanup can delete newly uploaded objects when save fails or the form unmounts before save.

---

## Phase 3 - Frontend Manager, Form, And TipTap Editor

### Files

```txt
happy-colors-nextjs-project/src/managers/blogArticlesManager.js
happy-colors-nextjs-project/src/app/api/revalidate/blog/route.js
happy-colors-nextjs-project/src/app/blog/create/page.js
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/page.js
happy-colors-nextjs-project/src/components/blog/BlogArticleForm.jsx
happy-colors-nextjs-project/src/components/blog/RichTextEditor.jsx
happy-colors-nextjs-project/src/components/blog/RichTextEditor.module.css
happy-colors-nextjs-project/__tests__/unit/managers/blogArticlesManager.test.js
happy-colors-nextjs-project/__tests__/components/blog/BlogArticleForm.test.jsx
happy-colors-nextjs-project/__tests__/components/blog/RichTextEditor.test.jsx
happy-colors-nextjs-project/__tests__/api/revalidate/blog.test.js
```

### Manager Tasks

- Add public fetch helpers:
  - `getBlogArticles()`;
  - `getBlogArticleById(articleId)`.
- Add admin fetch helpers:
  - `getAdminBlogArticles()`;
  - `getAdminBlogArticleById(articleId)`.
- Add mutation helpers:
  - `createBlogArticle(values)`;
  - `editBlogArticle(articleId, values)`;
  - `archiveBlogArticle(articleId)`;
  - `restoreBlogArticle(articleId)`.
- Do not add `updateBlogArticleStatus`.
- Whitelist create/edit payload fields.
- Do not send `status` from the frontend.
- Invalidate blog caches after create/edit/archive/restore.

### Revalidation Tasks

- Add authenticated `/api/revalidate/blog`.
- Validate request body and article id when present.
- Revalidate:
  - `/blog`;
  - `/blog/[articleId]`;
  - `/sitemap.xml`;
  - `blog-articles` cache tag.
- Rate-limit revalidation requests.

### Form Tasks

- Build create/edit form with:
  - title;
  - hero image upload;
  - thumbnail image upload;
  - hero image alt;
  - TipTap content editor;
  - SEO title;
  - SEO description;
  - save button.
- No status selector.
- No draft save.
- Upload hero and thumbnail separately.
- Store returned upload URLs in form state.
- Submit only:

```js
{
  title,
  contentHtml,
  contentJson,
  heroImageUrl,
  thumbnailImageUrl,
  heroImageAlt,
  seoTitle,
  seoDescription
}
```

- Do not submit `status`, `excerpt`, `contentText`, `owner`, `publishedAt`, `archivedAt`, `newsletterReady`, or `newsletterSentAt`.
- Frontend validation checks required fields and length limits.
- Backend remains authoritative.
- On failed save, cleanup newly uploaded hero/thumbnail images.
- On form unmount before save, cleanup pending uploaded images.

### Editor Tasks

- Use TipTap/ProseMirror.
- Load editor only on create/edit pages through `next/dynamic` or equivalent client-only split.
- Provide icon-based toolbar controls.
- Support:
  - H2/H3/H4;
  - bold;
  - italic;
  - underline;
  - links;
  - text alignment;
  - lists where enabled.
- Ensure toolbar controls apply to selected text where applicable.
- Emit `contentHtml`, `contentJson`, and `contentText`.
- Do not import TipTap from public article detail pages.

### Frontend Acceptance Criteria

- Form requires title, body, hero image, thumbnail image, and alt text.
- Form validates SEO title and SEO description length.
- Form validates non-image files before upload.
- Create/edit payload excludes server-owned fields and `status`.
- Upload cleanup runs on failed save.
- Upload cleanup runs on unmount before save.
- TipTap toolbar renders correctly and does not collapse under global button styles.
- TipTap can format selected text inside existing content.
- Public detail bundle does not directly import the editor.

---

## Phase 4 - Public Blog Pages, Article Actions, Navigation, SEO, Sitemap

### Files

```txt
happy-colors-nextjs-project/src/app/blog/page.js
happy-colors-nextjs-project/src/app/blog/[articleId]/page.js
happy-colors-nextjs-project/src/components/blog/BlogArticleDetails.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleActions.jsx
happy-colors-nextjs-project/src/components/blog/blogPublic.module.css
happy-colors-nextjs-project/src/components/header/header.jsx
happy-colors-nextjs-project/src/app/sitemap.js
happy-colors-nextjs-project/src/utils/blogSeo.js
happy-colors-nextjs-project/src/lib/getBlogArticle.js
happy-colors-nextjs-project/__tests__/components/blog/BlogPublicComponents.test.jsx
happy-colors-nextjs-project/__tests__/components/layout/Header.test.jsx
happy-colors-nextjs-project/__tests__/unit/app/sitemap.test.js
happy-colors-nextjs-project/__tests__/unit/utils/blogSeo.test.js
```

### Public Page Tasks

- `/blog` fetches public articles newest-first.
- `/blog` renders the latest article opened by default.
- `/blog/[articleId]` fetches selected public article.
- Public detail renders:
  - full-width hero image;
  - title under hero;
  - date under title;
  - sanitized article body;
  - aside list of articles on the right.
- Aside list:
  - newest-first;
  - uses thumbnail image;
  - shows title and optional excerpt/date;
  - marks the current article.
- If there are no articles, render an empty state.
- Public routes return not found for invalid, missing, or archived articles.

### Logged-In Article Actions

- If logged in, article page shows:
  - edit link;
  - delete/archive button.
- Do not show a publish button.
- Archive confirmation uses `window.confirm`.
- Archive redirects to `/blog` and refreshes public data.

### Navigation Tasks

- Public header includes Blog.
- Logged-in header includes "Create blog article".
- "Create blog article" links to `/blog/create`.
- Do not add a `/blog/manage` link.

### SEO And Sitemap Tasks

- Metadata title uses `seoTitle` when present, otherwise article title.
- Metadata description uses `seoDescription` when present, otherwise excerpt.
- Open Graph image uses hero or thumbnail.
- Sitemap includes `/blog`.
- Sitemap includes public, non-archived article URLs.
- Sitemap excludes archived articles.
- Sitemap uses `updatedAt || publishedAt || createdAt` for `lastModified`.

### Public Page Acceptance Criteria

- `/blog` opens the latest article.
- `/blog/[articleId]` renders selected article.
- Hero image uses the original uploaded hero image URL.
- Date appears under the title.
- Aside appears on desktop and adapts on smaller screens.
- Logged-in user sees edit/delete controls.
- Logged-out user does not see edit/delete controls.
- Publish button is absent.
- Header logged-in blog action points to create form.
- Sitemap includes non-archived blog article URLs and excludes archived articles.

---

## Phase 5 - Tests, QA, Review, Release Readiness

### Automated Checks

Run targeted checks after blog changes:

```powershell
cd server
npx vitest run "__tests__/unit/services/blogArticlesService.test.js" "__tests__/integration/blogArticles.test.js"
```

```powershell
cd happy-colors-nextjs-project
npm test -- --runInBand "__tests__/components/blog/RichTextEditor.test.jsx" "__tests__/components/blog/BlogArticleForm.test.jsx" "__tests__/unit/managers/blogArticlesManager.test.js" "__tests__/api/blog"
npm run build
```

Run broader suites before final release when the local Mongo memory server environment is stable:

```powershell
npm test
```

```powershell
npm run test:server
```

### Manual QA Checklist

Create flow:

- Log in.
- Open `/blog/create`.
- Upload hero image.
- Upload thumbnail image.
- Fill title, alt text, body, SEO title, SEO description.
- Use editor controls on selected text inside the body.
- Add a link.
- Save.
- Confirm redirect/public article rendering.

Edit flow:

- Open existing article as logged-in user.
- Click edit.
- Change title.
- Change part of the body text using TipTap controls.
- Replace hero image.
- Replace thumbnail image.
- Save.
- Confirm public article updates.
- Confirm old images are cleaned up if unreferenced.

Archive flow:

- Open article as logged-in user.
- Click delete/archive.
- Cancel once and confirm no mutation happens.
- Confirm once and verify article disappears from public blog.
- Verify direct public URL returns not found.
- Verify sitemap no longer includes the archived article.

Public layout:

- Check `/blog` desktop.
- Check `/blog/[articleId]` desktop.
- Check mobile and tablet widths.
- Confirm header stays above article content while scrolling.
- Confirm no "Back to blog" label appears above the date.
- Confirm aside list does not resemble product listing cards.
- Confirm hero image is not visibly resampled by the app.

Editor:

- H2/H3/H4.
- Bold selected text.
- Italic selected text.
- Underline selected text.
- Link selected text.
- Align paragraph left/center/right.
- Lists if enabled.

Auth:

- Logged-out user can read public blog.
- Logged-out user cannot create/edit/archive.
- Logged-in trusted operator can create/edit/archive.

### External Review

Use a diff-based Claude review before final release:

```powershell
git diff | claude -p "Review this git diff for bugs, regressions, security issues, and missing tests. Give concise, actionable findings with file paths and line references where possible."
```

Prioritize:

- security issues;
- auth/role gaps;
- XSS or unsafe HTML handling;
- upload cleanup bugs;
- cache/sitemap invalidation bugs;
- regressions to existing flows.

### Known Residual Risk

The current trusted-operator auth model is acceptable only if logged-in users are site operators. If customer/public registration is enabled, add explicit role authorization to blog mutation routes before release.

### Release Acceptance Criteria

- Design doc and implementation plan match actual behavior.
- Targeted blog frontend tests pass.
- Targeted blog backend tests pass.
- Next build passes.
- Manual QA checklist passes.
- External review findings are triaged.
- `bolg.html` or other accidental scratch files are not included in the final commit unless intentionally kept.

---

## Current Local Verification

Latest known checks after removing draft/publish flow:

- Blog server tests: 18 passed.
- Blog frontend targeted tests: 24 passed.
- Next build: passed.
- `git diff --check`: clean except normal Windows LF/CRLF warnings.

The full server suite may fail locally if multiple `mongodb-memory-server` instances hit a Windows spawn/MongoMemoryServer environment issue. When that happens, confirm targeted blog tests separately and rerun the full suite once the local test environment is stable.
