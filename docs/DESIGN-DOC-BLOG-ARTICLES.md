# Happy Colors - Blog Articles Design Document

**Date:** 2026-05-14
**Status:** Revised after Claude/Sonnet review; Opus review was unavailable because the CLI requested 1M-context extra usage
**Scope:** Add a public Blog section with article detail pages, newest-first article sidebar, authenticated create/edit/archive workflow, rich text editing, automatic thumbnail generation, SEO metadata, and sitemap integration.
**Decision:** Public read access, authenticated write access, URL by Mongo article id, draft/published status, soft delete through archive.

---

## Goal

Build a new "Blog" area without changing the behavior of existing pages and flows.

The feature must allow visitors to read all published articles, while logged-in users can create, edit, publish, archive, and restore articles. The first implementation should also leave a clean path for a future newsletter feature where articles can be sent by email.

---

## User Requirements

- Add "Blog" to the main navigation.
- Public users can access and read all published blog articles.
- Only logged-in users can create, edit, publish/unpublish, archive, restore, and delete article assets.
- Article URLs use the article id, not a title slug, for example `/blog/661...`.
- Support draft and published states.
- Use soft delete/archive instead of permanent article deletion in the main UI.
- Each article page has:
  - hero banner image related to the article topic;
  - required alt text for the hero image;
  - H1 title;
  - small, pale date near the top-right under/near the title;
  - rich article body;
  - edit and archive controls for logged-in users only, rendered as simple icon buttons;
  - right-side list of older articles with thumbnail, title, excerpt ending in ellipsis, and a simple "Прочети повече" link with three arrows.
- Aside article list is newest-first.
- If the aside list is taller than the current article body area, only the aside list scrolls vertically.
- Create/edit form has:
  - article title;
  - rich text body;
  - hero image upload;
  - hero image alt text;
  - SEO title;
  - SEO description;
  - generated thumbnail from the hero image;
  - save and cancel buttons.
- Rich text editor supports standard formatting:
  - bold, italic, underline;
  - headings or font sizes;
  - text color;
  - left, center, right alignment;
  - ordered and unordered lists;
  - links.
- Published articles must appear in the sitemap.

---

## Current Context

### Existing frontend

- Next.js App Router lives in `happy-colors-nextjs-project/src/app`.
- There is already a placeholder blog page at `happy-colors-nextjs-project/src/app/blog/page.js`.
- Header navigation lives in `happy-colors-nextjs-project/src/components/header/header.jsx`.
- The Blog nav item exists but is currently commented out.
- Auth state is available through `src/context/AuthContext.jsx`.
- Existing create/edit flows use client components and frontend managers, for example products and homepage banners.
- Existing sitemap generator is `happy-colors-nextjs-project/src/app/sitemap.js`.
- Existing cache revalidation routes exist for products and homepage banners.
- Existing upload flow uses authenticated Next API routes and GCS.
- FAQ is currently a static page, not a CMS/editing pattern.

### Existing backend

- Express API lives under `server/`.
- Routes are mounted from `server/routes.js`.
- Auth guard is `requireAuth` from `server/middlewares/auth.js`.
- CRUD patterns exist for products and homepage banners:
  - model;
  - service;
  - controller;
  - route mount;
  - unit/integration tests.
- Authenticated users are currently treated as trusted site operators for content management flows.

### Existing upload/storage

- `happy-colors-nextjs-project/src/app/api/uploads/proxy/route.js` validates and uploads files to GCS.
- `uploadSignedFile()` in `src/managers/uploadManager.js` supports selected upload kinds with a single uploaded-object response shape.
- Blog image upload needs a separate helper because it returns a hero/thumbnail pair.
- Server-side image validation already checks MIME, size, and magic bytes.
- Existing homepage banner upload returns `publicUrl`, `objectName`, and `deleteToken` so failed creates can clean up uploaded files.

---

## Proposed Solution

Add a separate Blog module with its own data model, API, frontend manager, pages, form, rich text editor component, and image upload path.

The module is additive:

- existing product, category, homepage banner, checkout, contacts, FAQ, and sitemap behavior stays intact;
- the current `/blog/page.js` placeholder is replaced with the real blog entry/detail experience;
- existing upload flows are extended by new blog-specific upload kinds without changing current product/banner behavior.

---

## URL Strategy

Use Mongo article ids in public URLs:

```txt
/blog
/blog/[articleId]
```

Reasons:

- ids are unique;
- duplicate article titles do not create routing conflicts;
- title changes do not break URLs;
- sitemap entries are stable.

No public slug is required in V1.

Optional future enhancement:

```txt
/blog/[articleId]/[readable-title]
```

The id remains the canonical lookup key if readable URLs become desirable later.

---

## Data Model

New file:

```txt
server/models/BlogArticle.js
```

Proposed schema:

```js
const blogArticleSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    contentHtml: {
      type: String,
      required: true,
    },
    contentJson: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    contentText: {
      type: String,
      default: '',
      trim: true,
    },
    excerpt: {
      type: String,
      default: '',
      trim: true,
      maxlength: 240,
    },
    heroImageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailImageUrl: {
      type: String,
      required: true,
      trim: true,
    },
    heroImageAlt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    seoTitle: {
      type: String,
      default: '',
      trim: true,
      maxlength: 70,
    },
    seoDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: 170,
    },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
      index: true,
    },
    publishedAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
      index: true,
    },
    newsletterReady: {
      type: Boolean,
      default: false,
    },
    newsletterSentAt: {
      type: Date,
      default: null,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);
```

### Field rules

- `title`, `contentHtml`, `heroImageUrl`, `thumbnailImageUrl`, and `heroImageAlt` are required before publish.
- V1 drafts are complete unpublished articles, not partial autosaves. This is a deliberate UX limitation: saving a draft still requires title, body, hero image, generated thumbnail, and alt text. Partial drafts/autosave can be added later by relaxing schema requirements and adding status-aware validation.
- `contentHtml` is sanitized on the server before save.
- `contentJson` stores the editor document when available. It is optional in V1 but should be saved by the TipTap editor from the beginning to avoid a painful migration when newsletter/email rendering needs a richer canonical source than article HTML.
- `contentText` is generated from sanitized content and supports excerpt/search/newsletter use cases.
- `excerpt` is server-generated from `contentText` in V1; it is not accepted from create/edit request bodies.
- `seoTitle` defaults to `title` at render time when empty.
- `seoDescription` defaults to `excerpt` at render time when empty.
- `seoTitle` and `seoDescription` are optional form fields with max-length validation, not required fields.
- `publishedAt` is set when an article first changes from draft to published.
- `publishedAt` is preserved when editing an already published article.
- `archivedAt` marks soft deletion and hides the article from public lists/sitemap.
- Archive does not change `status`; `archivedAt` is the visibility override. Restore clears `archivedAt` and preserves the previous status, so a restored published article becomes public again and a restored draft remains private.
- `newsletterReady` and `newsletterSentAt` are reserved future fields. They do not affect V1 behavior and are not writable through the V1 article form/API whitelist.

### Indexes

```js
blogArticleSchema.index({ status: 1, archivedAt: 1, publishedAt: -1, createdAt: -1 });
blogArticleSchema.index({ archivedAt: 1, updatedAt: -1 });
```

---

## Permission Model

Public users:

- can load `/blog`;
- can load `/blog/[articleId]` only for `status='published'` and `archivedAt=null`;
- can see published articles in the aside list.

Logged-in users:

- can create articles;
- can edit articles;
- can switch status between draft and published;
- can archive and restore articles;
- can see edit/archive controls on article pages;
- can access an optional management list that includes drafts and archived articles.

V1 follows the existing site convention that any authenticated user is a trusted content operator. If public registration is enabled later, blog mutation routes must change to an explicit admin/owner role check before release.

Implementation note: add a short TODO comment near the blog controller `requireAuth` mutation routes documenting this V1 assumption, so the trust model is not silently inherited if registration becomes public later.

---

## Backend API

New controller:

```txt
server/controllers/blogArticlesController.js
```

New service:

```txt
server/services/blogArticlesService.js
```

Route mount:

```js
router.use('/blog-articles', blogArticlesController);
```

### Routes

```txt
GET    /blog-articles
GET    /blog-articles/admin
GET    /blog-articles/admin/:articleId
GET    /blog-articles/:articleId
POST   /blog-articles
PUT    /blog-articles/:articleId
PATCH  /blog-articles/:articleId/status
PATCH  /blog-articles/:articleId/archive
PATCH  /blog-articles/:articleId/restore
```

### Access

- `GET /blog-articles` is public and returns only published, non-archived articles newest-first.
- `GET /blog-articles/admin` uses `requireAuth` and returns draft, published, and archived records newest-updated-first.
- `GET /blog-articles/admin/:articleId` uses `requireAuth` and can return draft, published, or archived records for edit/management screens.
- `GET /blog-articles/:articleId` is public for published, non-archived articles.
- `POST`, `PUT`, status changes, archive, and restore use `requireAuth`.
- Mutation routes should use a rate limiter similar to homepage banners.

Route ordering is mandatory in the Express controller:

```js
router.get('/admin', requireAuth, ...);
router.get('/admin/:articleId', requireAuth, ...);
router.get('/:articleId', ...);
```

`/admin` routes must be registered before `/:articleId`, otherwise Express treats `"admin"` as an article id.

### Service rules

- Validate `articleId` with `mongoose.Types.ObjectId.isValid`.
- Whitelist accepted create fields:
  - `title`;
  - `contentHtml`;
  - `heroImageUrl`;
  - `thumbnailImageUrl`;
  - `heroImageAlt`;
  - `seoTitle`;
  - `seoDescription`;
  - `status`;
  - `contentJson`.
- Whitelist accepted edit fields:
  - `title`;
  - `contentHtml`;
  - `heroImageUrl`;
  - `thumbnailImageUrl`;
  - `heroImageAlt`;
  - `seoTitle`;
  - `seoDescription`;
  - `contentJson`.
- `PUT /blog-articles/:articleId` does not accept `status`; use `PATCH /blog-articles/:articleId/status` for publish/draft transitions so status changes stay explicit and testable.
- Implementation decision for V1: if `status` is present in a `PUT /blog-articles/:articleId` body, the service returns 400 instead of silently ignoring it. Other server-owned fields remain ignored/whitelisted out.
- Never accept `owner`, `createdAt`, `updatedAt`, `publishedAt`, `archivedAt`, `newsletterReady`, `newsletterSentAt`, or any future send-tracking fields from the request body.
- Sanitize `contentHtml` before saving.
- Validate `contentJson` before saving:
  - maximum serialized size: 100 KB;
  - root node must be a supported editor document;
  - strip or reject unknown node/mark types;
  - never render newsletter/email output directly from `contentJson` without its own sanitizer/transformer.
- Generate `contentText` and `excerpt` server-side from sanitized content.
- Validate image URLs as safe GCS URLs from the configured bucket:
  - exact protocol `https:`;
  - exact hostname `storage.googleapis.com`;
  - no URL username/password/user-info;
  - first path segment must equal the configured bucket name;
  - decoded path must not contain `.` / `..` traversal segments;
  - query strings and signed URL parameters are not accepted for stored article image URLs;
  - unsafe schemes such as `javascript:`, `data:`, and `file:` are rejected.
- On image replacement, delete the old hero and old thumbnail only after database save succeeds and only if no other blog article references them.
- `PATCH /status` sets `publishedAt` only on the first draft-to-published transition. Later published-to-draft-to-published cycles preserve the original `publishedAt`; `updatedAt` reflects the latest edit/status change.
- Because V1 drafts are complete articles, `PATCH /status` does not need to revalidate required article fields beyond normal record existence and auth checks. It exists to keep status changes explicit.
- Archive sets `archivedAt`.
- Restore clears `archivedAt` and preserves the existing `status`.
- Editing an archived article is allowed from the admin route, but save does not restore it. The form must show an archived-state warning and a separate restore action.
- Archived articles remain unavailable to public users and absent from sitemap.

---

## Rich Text Editor

Use a proper React rich text editor rather than hand-rolled `contentEditable`.

Preferred V1 choice:

```txt
TipTap
```

Required extensions:

- StarterKit or equivalent core formatting;
- Link;
- TextStyle;
- Color;
- Underline;
- TextAlign;
- Heading or font-size extension.

Why:

- it fits React component usage;
- it provides structured commands for toolbar buttons;
- it can output HTML for rendering;
- it can be extended later for newsletter/email-specific blocks if needed.

### Sanitization

The editor is not a security boundary.

Backend must sanitize submitted HTML with an allowlist that supports only the intended article markup:

- headings;
- paragraphs;
- strong/em/underline;
- ordered/unordered lists;
- links with safe protocols;
- inline spans for color/font-size only from allowed attributes/styles;
- alignment styles/classes;
- blockquote if enabled;
- line breaks.

The backend must remove:

- scripts;
- event handlers;
- iframes;
- arbitrary embeds;
- `javascript:` URLs;
- unsafe style properties.

Allowed inline styles should be explicit and narrow when configuring `sanitize-html`:

- `color`: hex colors and safe `rgb(...)` values only;
- `font-size`: a small allowlist such as `14px`, `16px`, `18px`, `20px`, `24px`, `28px`, `32px`;
- `text-align`: `left`, `center`, `right`;
- no `position`, `display`, `background`, `background-image`, `url(...)`, `filter`, `transform`, or layout-affecting arbitrary CSS.

Suggested backend package:

```txt
sanitize-html
```

`contentHtml` remains the only public article render field, while `contentJson` stores TipTap/ProseMirror JSON as a migration-friendly canonical editor source. Public article pages must never render raw `contentJson`. Newsletter rendering can later transform `contentJson` into email-safe HTML without reverse-engineering from article HTML.

TipTap should be loaded only on create/edit pages, preferably through dynamic import or an equivalent client-only split. Public article detail pages should not ship the editor bundle.

---

## Automatic Thumbnail Generation

Do not add a manual thumbnail field in V1.

Preferred V1:

- user uploads one hero image;
- a blog-specific authenticated Next API upload route validates the image;
- the route uploads the original hero image to GCS;
- the route generates a thumbnail from the same file;
- the route uploads the thumbnail to GCS;
- response returns both URLs and cleanup metadata.

Suggested implementation:

```txt
happy-colors-nextjs-project/src/app/api/blog/images/route.js
```

or an isolated extension to:

```txt
happy-colors-nextjs-project/src/app/api/uploads/proxy/route.js
```

Preferred response shape:

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

The route must explicitly use the Node runtime because thumbnail generation depends on native image processing:

```js
export const runtime = 'nodejs';
```

Suggested dependency:

```txt
sharp
```

Thumbnail target:

- width around 360px;
- WebP output;
- preserve aspect ratio;
- no upscaling;
- quality around 75-82.

Hero upload:

- keep original file type and resolution for now;
- rely on existing max image size validation;
- optional future enhancement can generate responsive hero variants.

Failure handling:

- if hero upload succeeds but thumbnail generation/upload fails, clean up the hero before returning an error;
- if create article fails after upload succeeds, frontend calls existing delete-upload flow for both objects;
- if edit replaces images and API save fails, frontend cleans up the newly uploaded pair;
- backend cleans old image pair after successful edit.

Frontend helper:

```txt
happy-colors-nextjs-project/src/managers/uploadManager.js
```

Add a dedicated helper instead of reusing `uploadSignedFile()`:

```js
export async function uploadBlogArticleImage(file) {
  // POST /api/blog/images and return the hero/thumbnail pair.
}
```

Reason:

- `uploadSignedFile()` returns one `{ publicUrl, objectName, deleteToken }` triplet;
- blog upload returns two objects, so sharing the same helper would create a response-shape mismatch;
- existing product/banner upload behavior stays unchanged.

Fallback:

- If `sharp` cannot be installed in the deployment environment, the implementation must add a manual thumbnail upload field before release. The schema still requires `thumbnailImageUrl`, so production cannot ship with neither automatic generation nor manual thumbnail upload.

---

## Frontend Pages

### Public blog index

```txt
happy-colors-nextjs-project/src/app/blog/page.js
```

Behavior:

- fetch published articles newest-first;
- render an index/list view rather than the full newest article, to avoid duplicate full article content between `/blog` and `/blog/[articleId]`;
- feature the newest article as a prominent list item/card that links to its detail page;
- render remaining articles newest-first;
- if no articles exist, show a simple empty public state without admin controls for guests;
- logged-in users see a simple create link/button.

### Public article detail

```txt
happy-colors-nextjs-project/src/app/blog/[articleId]/page.js
```

Behavior:

- fetch the selected article by id;
- fetch published article list for aside;
- render hero image with `alt={heroImageAlt}`;
- render H1 title;
- render small date near the title;
- render sanitized `contentHtml`;
- render aside list newest-first;
- exclude current article from aside or keep it visually inactive. Preferred V1: exclude current article.
- show edit/archive icon buttons only for logged-in users.

### Create page

```txt
happy-colors-nextjs-project/src/app/blog/create/page.js
happy-colors-nextjs-project/src/app/blog/create/CreateBlogArticleClient.jsx
```

Behavior:

- protected by client auth guard and backend API auth;
- render `BlogArticleForm`;
- upload hero image and generated thumbnail before submit;
- save as draft or published depending on selected status;
- draft save still requires all V1 required fields; drafts are unpublished complete articles, not partial autosaves;
- after successful save, invalidate blog caches and navigate to `/blog/[articleId]` if published or an admin preview/list if draft.

### Edit page

```txt
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/page.js
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/EditBlogArticleClient.jsx
```

Behavior:

- protected by auth;
- fetch article through admin route so drafts are editable;
- render `BlogArticleForm` with initial values;
- if the article is archived, show a clear archived-state warning; saving changes keeps it archived, and restore is a separate action;
- replacing hero image generates a new thumbnail pair;
- old images are cleaned by backend after successful save;
- newly uploaded images are cleaned by frontend if save fails.

### Optional management list

Recommended for V1 because drafts and archived articles otherwise become hard to find:

```txt
happy-colors-nextjs-project/src/app/blog/manage/page.js
```

Behavior:

- protected by auth;
- list draft, published, and archived articles;
- provide edit/restore links.

This page can be minimal but should exist if draft/archive are included.

---

## Frontend Components

New reusable form:

```txt
happy-colors-nextjs-project/src/components/blog/BlogArticleForm.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleForm.module.css
```

New editor:

```txt
happy-colors-nextjs-project/src/components/blog/RichTextEditor.jsx
happy-colors-nextjs-project/src/components/blog/RichTextEditor.module.css
```

New article UI pieces:

```txt
happy-colors-nextjs-project/src/components/blog/BlogArticleAside.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleActions.jsx
```

New manager:

```txt
happy-colors-nextjs-project/src/managers/blogArticlesManager.js
```

### Navigation

Uncomment/add public nav item:

```jsx
<li><Link href="/blog">Блог</Link></li>
```

Add authenticated nav item:

```jsx
<li><Link href="/blog/create">Създай блог статия</Link></li>
```

Recommended if `blog/manage` is implemented:

```jsx
<li><Link href="/blog/manage">Блог статии</Link></li>
```

---

## Layout and UX

### Desktop

- main content and aside use a two-column layout;
- main article column gets the larger width;
- aside is right-aligned and visually secondary;
- aside list receives a max height based on the article content area when possible.

Practical CSS approach:

```css
.articleLayout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  align-items: start;
  gap: 32px;
}

.asideList {
  max-height: var(--article-body-height, 70vh);
  overflow-y: auto;
}

@media (max-width: 768px) {
  .articleLayout {
    grid-template-columns: 1fr;
  }

  .asideList {
    max-height: none;
    overflow-y: visible;
  }
}
```

The exact body-height matching may need a small client component with `ResizeObserver`. If that adds too much complexity, V1 can use `max-height: 70vh`, which still ensures only the aside scrolls when it grows long.

### Mobile

- aside moves below the article;
- aside becomes a normal vertical list;
- no forced nested scroll on small screens unless the list becomes unreasonably long.

### Article card in aside

Each aside item contains:

- thumbnail image;
- title;
- generated excerpt;
- "Прочети повече >>>" link with no filled background.

### Admin controls

- edit: icon-only pencil button/link with accessible label;
- archive: icon-only X button with accessible label and confirmation;
- use local SVG assets or small inline SVG icons for pencil/X; do not add a broad icon package only for these controls.
- V1 archive confirmation can use native `window.confirm`, matching the current simple admin-control style. A custom modal can be a later design-system task.

---

## SEO and Metadata

Article detail pages generate metadata:

- title: `seoTitle || title`;
- description: `seoDescription || excerpt`;
- Open Graph image: `heroImageUrl` or `thumbnailImageUrl`;
- canonical URL: `${PROD_SITE_URL}/blog/${articleId}`.

Blog index metadata:

- title: "Блог";
- description: site-level blog description.

Structured data:

- optional V1: `BlogPosting` JSON-LD using title, description, image, datePublished, dateModified, and URL.
- If implemented, only published, non-archived articles get JSON-LD.

---

## Sitemap

Update:

```txt
happy-colors-nextjs-project/src/app/sitemap.js
```

Add:

- `/blog` static entry;
- published, non-archived article entries from `GET /blog-articles`;
- URL shape `${PROD_SITE_URL}/blog/${article._id}`;
- `lastModified` from `new Date(article.updatedAt || article.publishedAt || article.createdAt || now)`;
- `changeFrequency: 'monthly'` or `'weekly'`;
- `priority: 0.6`.

Because Next sitemap currently fetches products through the Express API, the blog sitemap should follow the same pattern. If the blog fetch fails, log and return the rest of the sitemap unchanged.

Add cache invalidation:

```txt
happy-colors-nextjs-project/src/app/api/revalidate/blog/route.js
```

This route must use Next.js API auth helper `requireApiAuth` from `happy-colors-nextjs-project/src/app/api/_lib/auth.js`.

After create/edit/status/archive/restore:

- revalidate `blog-articles` tag;
- revalidate `/blog`;
- revalidate the concrete article path with ``revalidatePath(`/blog/${articleId}`)``;
- revalidate `/sitemap.xml`, matching the existing product revalidation pattern;
- the revalidation route must accept `articleId` in the POST body so it can invalidate the correct article page.

Public blog fetches must opt into the same cache tag, for example:

```js
fetch(`${baseURL}/blog-articles`, {
  next: {
    revalidate: 60,
    tags: ['blog-articles'],
  },
});
```

Without the tag on the fetch, `revalidateTag('blog-articles')` has no effect.

---

## Newsletter Readiness

V1 does not send newsletters.

Small fields included now:

- `newsletterReady`;
- `newsletterSentAt`;
- `contentJson`;
- `contentText`;
- `excerpt`.

Why:

- newsletter UI can later filter articles that are ready to send;
- `newsletterSentAt` prevents accidental double-send;
- `contentText` and `excerpt` help build email previews and plain-text fallbacks;
- sanitized `contentHtml` can be reused as the starting point for email HTML, but email rendering should still get its own transformation later.
- `contentJson` keeps the original editor structure available for email-specific transformations.

Out of V1:

- subscriber model;
- unsubscribe links;
- email templates;
- send queue;
- delivery analytics;
- per-article send history beyond `newsletterSentAt`.

---

## Security Considerations

### Rich text XSS

Risk: formatted article body can contain malicious HTML.

Mitigation:

- sanitize on server before save;
- render only sanitized HTML;
- restrict links to safe protocols;
- add tests for script/event-handler stripping.

### Draft leakage

Risk: draft articles become public through id URL or sitemap.

Mitigation:

- public queries always filter `status='published'` and `archivedAt=null`;
- sitemap uses only public list endpoint;
- admin fetch path is authenticated.

### Mass assignment

Risk: request body changes protected fields.

Mitigation:

- service whitelists allowed fields;
- ignores client-provided owner, archivedAt, publishedAt, timestamps, newsletterReady, newsletterSentAt, and future send-tracking fields.

### Upload abuse

Risk: blog image upload becomes generic file hosting.

Mitigation:

- use Next.js API auth helper `requireApiAuth` from `happy-colors-nextjs-project/src/app/api/_lib/auth.js` for the blog image upload route;
- reuse MIME/size/magic-byte validation;
- allow only image formats already accepted by the site;
- store under blog-specific folders;
- return cleanup tokens.

Backend article CRUD uses the Express auth middleware `requireAuth` from `server/middlewares/auth.js`. The two helpers validate the same auth cookie in different runtime layers and should not be swapped.

### CSRF and origins

Risk: blog mutations use cookie authentication, so cross-site requests should not be made easier than the existing API surface.

Mitigation:

- do not add permissive CORS headers to blog mutation, upload, or revalidation routes;
- keep mutation requests as JSON/fetch flows, not plain HTML form-compatible endpoints;
- if the project adds a shared Origin/Referer guard, blog mutation, upload, and revalidation routes should use it;
- document this as matching the current cookie-auth API posture, not as a new solved CSRF layer.

### Orphaned assets

Risk: failed create/edit leaves GCS files.

Mitigation:

- frontend cleanup after failed create/edit;
- backend cleanup old images after successful replacement/archive if needed;
- keep archive from deleting images by default so restore works.
- if upload succeeds but article save fails and cleanup also fails because of network/storage problems, V1 accepts the temporary orphaned asset risk; this should be logged and can be handled later by a storage lifecycle rule or cleanup job.
- if edit image replacement succeeds in Mongo but one of the old GCS deletes fails, V1 also accepts the temporary partial-orphan risk and logs the failure.

### Archive image cleanup

Decision:

- archive does not delete hero/thumbnail images;
- restore keeps article visuals intact;
- a separate permanent purge job/tool may be added later if storage cleanup becomes necessary.

---

## Error Handling

- Public `/blog` should not crash if API fetch fails; show a short empty/error state.
- Article detail for missing/unpublished/archived public article returns Next `notFound()`.
- Admin edit page shows an error if article fetch fails.
- Upload errors are shown near the image field.
- Rich text validation errors are shown near the editor.
- Failed cache revalidation logs but does not make a successful save look failed.

---

## Affected Files

### Backend new files

```txt
server/models/BlogArticle.js
server/services/blogArticlesService.js
server/controllers/blogArticlesController.js
```

### Backend changed files

```txt
server/routes.js
```

### Frontend new files

```txt
happy-colors-nextjs-project/src/managers/blogArticlesManager.js
happy-colors-nextjs-project/src/components/blog/BlogArticleForm.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleForm.module.css
happy-colors-nextjs-project/src/components/blog/RichTextEditor.jsx
happy-colors-nextjs-project/src/components/blog/RichTextEditor.module.css
happy-colors-nextjs-project/src/components/blog/BlogArticleAside.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleActions.jsx
happy-colors-nextjs-project/src/app/blog/[articleId]/page.js
happy-colors-nextjs-project/src/app/blog/create/page.js
happy-colors-nextjs-project/src/app/blog/create/CreateBlogArticleClient.jsx
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/page.js
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/EditBlogArticleClient.jsx
happy-colors-nextjs-project/src/app/blog/manage/page.js
happy-colors-nextjs-project/src/app/api/blog/images/route.js
happy-colors-nextjs-project/src/app/api/revalidate/blog/route.js
```

### Frontend changed files

```txt
happy-colors-nextjs-project/src/app/blog/page.js
happy-colors-nextjs-project/src/app/sitemap.js
happy-colors-nextjs-project/src/components/header/header.jsx
happy-colors-nextjs-project/src/managers/uploadManager.js
```

### Dependency changes

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

`sharp` is a new explicit dependency for the blog image route.

Backend package:

```txt
sanitize-html
```

---

## Implementation Phases

### Phase 1: Backend model and API

- Add `BlogArticle` model.
- Add service with list public, list admin, get public, get admin, create, edit, publish/draft, archive, restore.
- Add controller routes.
- Register `/admin` and `/admin/:articleId` before `/:articleId`.
- Mount `/blog-articles`.
- Add mutation rate limiter.
- Add server-side sanitization and text/excerpt generation.
- Add GCS URL validation.
- Add backend unit/integration tests.

### Phase 2: Blog image upload

- Add blog image upload route or isolated proxy kind.
- Set `export const runtime = 'nodejs'`.
- Add automatic thumbnail generation with `sharp`.
- Return cleanup metadata for both hero and thumbnail.
- Add `uploadBlogArticleImage(file)` upload manager helper.
- Add tests for auth, validation, thumbnail response shape, and cleanup failure behavior.

### Phase 3: Frontend manager, form, and editor

- Add `blogArticlesManager.js`.
- Add rich text editor component and toolbar, loaded only on create/edit pages.
- Add `BlogArticleForm`.
- Add create/edit pages.
- Add admin management list.
- Add cache revalidation route.

### Phase 4: Public blog pages

- Replace placeholder `/blog`.
- Add `/blog/[articleId]`.
- Add hero, body, date, aside list, and logged-in controls.
- Add responsive layout and aside-only scrolling behavior.
- Add navigation links.

### Phase 5: SEO and sitemap

- Add article metadata.
- Add optional BlogPosting JSON-LD.
- Add `/blog` and article entries to sitemap.
- Verify archived/draft articles are excluded.

### Phase 6: Verification

- Run relevant backend tests.
- Run relevant frontend tests.
- Run build.
- Manual QA desktop/mobile for public and authenticated flows.
- Run external diff review before implementation merge.

---

## Test Plan

### Backend

- Public list returns only published, non-archived articles newest-first.
- Public detail rejects draft articles.
- Public detail rejects archived articles.
- Admin list rejects guests.
- Admin single-article fetch rejects guests.
- Admin list includes draft, published, and archived articles.
- Create rejects unauthenticated requests.
- Create sanitizes malicious HTML.
- Sanitization strips `<script>` tags.
- Sanitization strips event handler attributes such as `onerror`.
- Sanitization rejects or strips `href="javascript:"` links.
- Sanitization strips `<iframe>` embeds.
- Create generates `contentText` and `excerpt`.
- Create with no explicit excerpt stores a generated excerpt derived from `contentText`.
- Create sets `publishedAt` when status is published.
- Edit preserves `publishedAt` for already published articles.
- Switching draft to published sets `publishedAt` if empty.
- Switching published to draft and back to published preserves the original `publishedAt`.
- Archive sets `archivedAt` and hides article from public list.
- Restore clears `archivedAt`.
- Restore preserves the existing `status`.
- Editing an archived article keeps it archived until the restore endpoint is called.
- Archive rejects unauthenticated requests.
- Restore rejects unauthenticated requests.
- Service ignores protected fields from request body.
- Create sets `owner` from `req.user`.
- Edit never overwrites `owner` from request body.
- `PUT /blog-articles/:articleId` returns 400 when `status` is present; status changes go through `PATCH /status`.
- `contentJson` rejects oversized payloads and unknown node/mark types.
- Image URL validation rejects non-GCS or unsafe URLs.
- Image URL validation requires exact `storage.googleapis.com` hostname and configured bucket as the first path segment.
- Replacing image URLs does not delete old images before successful database save.
- Replacing image URLs skips old-image deletion when another article still references the same hero or thumbnail URL.
- Admin list returns articles sorted by `updatedAt` descending.

### Frontend/API

- Blog image upload rejects guests.
- Blog image upload rejects non-images.
- Blog image upload returns hero and thumbnail URLs.
- Blog image upload produces a thumbnail in the expected format and dimensions: WebP, around 360px wide, no upscaling.
- Failed article create cleans up both uploaded objects.
- `BlogArticleForm` requires title, body, hero image, alt text, and status; optional SEO title/description fields enforce max-length constraints when filled.
- Rich text editor toolbar applies headings/font size, color, alignment, lists, and links.
- Blog form stores both rendered HTML input and editor JSON where available.
- Public users do not see edit/archive controls.
- Public article page renders sanitized `contentHtml` and never renders raw `contentJson`.
- Logged-in users see edit/archive controls.
- Aside list is newest-first and uses thumbnail/excerpt/read-more link.
- Current article is excluded from aside.
- Blog mutations call cache revalidation.
- Sitemap includes published articles.
- Sitemap excludes draft and archived articles.
- Revalidation route receives `articleId` and invalidates `/blog/${articleId}`, `/blog`, `/sitemap.xml`, and the `blog-articles` tag.
- Revalidation route rejects unauthenticated requests.
- Revalidation route rejects missing or malformed `articleId` with 400 instead of revalidating an undefined path.
- Frontend form has no raw URL input for article images; it uses the authenticated blog image upload helper and submits only returned GCS URLs.
- Sitemap generation still returns static/product entries if the blog article fetch fails.

### Manual QA

- `/blog` with no articles.
- `/blog` with one article.
- `/blog` with many articles where aside is taller than article body.
- `/blog/[articleId]` desktop layout.
- `/blog/[articleId]` mobile layout.
- On mobile, the article layout collapses to one column and the aside appears below the article.
- Long Bulgarian titles do not overflow.
- Hero image renders with correct alt text.
- Rich text colors, links, headings/font sizes, lists, and alignment render after save.
- Archive confirmation prevents accidental archive.
- Draft article is editable but not publicly visible.
- Draft save still requires a complete article in V1; confirm this UX is acceptable before implementation.
- Restoring an archived published article makes it public again; restoring an archived draft keeps it private.
- Existing pages still work:
  - homepage;
  - products;
  - product detail;
  - homepage banners;
  - categories;
  - cart;
  - contacts;
  - FAQ.

---

## Risks and Mitigations

### Risk: Rich text introduces XSS

Mitigation:

- server-side sanitization;
- tests with malicious HTML;
- no arbitrary embeds in V1.

### Risk: Thumbnail generation complicates upload

Mitigation:

- isolate blog image upload path;
- keep manual thumbnail fallback possible by preserving `thumbnailImageUrl` in schema;
- do not release without either automatic thumbnail generation or a manual thumbnail upload field.

### Risk: Drafts leak through sitemap or public article route

Mitigation:

- public endpoint filters status/archive;
- sitemap consumes public endpoint;
- tests cover draft/archive exclusion.

### Risk: Authenticated user is too broad as admin

Mitigation:

- document current V1 assumption;
- keep owner audit field;
- prepare service boundary for future explicit admin role checks.

### Risk: Newsletter fields become misleading

Mitigation:

- include only passive readiness fields;
- do not add send behavior in V1;
- future newsletter design owns send tracking and compliance.

---

## Acceptance Criteria

- Main navigation includes public "Блог".
- Public users can read published blog articles.
- Public users cannot access create/edit/manage routes through the API.
- Logged-in users can create, edit, publish/unpublish, archive, and restore articles.
- Article URLs use article id.
- Draft articles are not visible to guests.
- Archived articles are not visible to guests.
- Article detail page has hero image with alt text, H1 title, date, rich body, and right-side article list.
- Aside list uses thumbnails, title, excerpt with ellipsis, and simple "Прочети повече >>>" link.
- Aside list scrolls independently when it becomes taller than the article body area.
- Rich text editor supports standard formatting, colors, links, and alignment.
- Hero upload automatically generates thumbnail image.
- If automatic thumbnail generation is unavailable, a manual thumbnail field exists before release.
- Published articles appear in sitemap.
- Draft and archived articles do not appear in sitemap.
- Existing functionality and pages keep their current behavior.
- Relevant tests and build pass before release.

---

## Open Questions for Opus Review

1. Should archive keep images forever for restore simplicity, or should we add a separate permanent purge admin action in V1?
2. Is `max-height: 70vh` acceptable for aside scrolling in V1, or should we require exact article-body height matching with `ResizeObserver`?
3. Should all logged-in users remain trusted blog operators in V1, matching current content admin flows, or should blog be the first module to require an explicit admin role?
