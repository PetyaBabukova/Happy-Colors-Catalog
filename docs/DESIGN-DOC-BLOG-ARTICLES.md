# Happy Colors - Blog Articles Design Document

**Date:** 2026-05-15
**Status:** Updated to match the current local implementation and user decisions
**Scope:** Public blog reading, authenticated create/edit/archive workflow, manual hero and thumbnail uploads, TipTap rich text editor, SEO metadata, cache revalidation, and sitemap integration.
**Decision:** Blog articles are published immediately. Draft/publish workflows and the `/blog/manage` page are out of scope for V1.

---

## Goal

Add a Blog area to Happy Colors without changing existing product, checkout, category, homepage banner, contact, FAQ, or auth behavior.

Visitors can read public blog articles. Logged-in trusted operators can create, edit, and archive articles. The implementation keeps article content structured enough for a future newsletter feature, but newsletter sending is not part of V1.

---

## Current User Decisions

- Public users can read non-archived blog articles.
- Logged-in users can create, edit, and archive articles.
- Draft mode is removed.
- A separate "Publish article" action is removed.
- New articles are published immediately on successful create.
- Article URLs use Mongo ids, for example `/blog/661...`.
- The public `/blog` page opens the latest article by default.
- The selected article layout is:
  - full-width hero image at the top;
  - title below the hero;
  - date under the title;
  - article body in the main column;
  - right-side aside list of other articles.
- The title is visually constrained so long titles do not overrun the layout.
- The logged-in article view has edit and delete/archive controls near the top.
- The logged-in header link is "Create blog article" and points directly to `/blog/create`.
- The old "Blog articles" management/list page is not needed in V1.
- Hero image upload is manual.
- Thumbnail image upload is also manual.
- Do not resample the hero image.
- Do not generate the thumbnail automatically in V1.
- Do not use `sharp` for blog images in V1.
- Rich text editing uses TipTap/ProseMirror, loaded only on create/edit pages.

---

## User Requirements

- Add a public Blog section.
- Public blog article pages must not expose admin-only fields.
- Logged-in users can create/edit/archive articles through the UI.
- Archive is the delete action in the UI; it is a soft delete using `archivedAt`.
- Archived articles are hidden from public blog routes and sitemap.
- Create/edit form fields:
  - title;
  - hero image upload;
  - thumbnail image upload;
  - hero image alt text;
  - rich text body;
  - SEO title;
  - SEO description.
- Frontend validation and backend validation are both required.
- Rich text editor supports:
  - H2, H3, H4 headings;
  - bold;
  - italic;
  - underline;
  - links;
  - left, center, and right alignment;
  - lists where supported by the editor configuration.
- Users must be able to style selected text inside the article, not only whole paragraphs.
- Public pages render sanitized article HTML.
- `contentJson` stores TipTap/ProseMirror JSON for future transformations.
- `contentJson` is never rendered directly on public pages.
- Non-archived articles appear in sitemap.

---

## Existing Context

### Frontend

- Next.js App Router lives in `happy-colors-nextjs-project/src/app`.
- Header navigation lives in `happy-colors-nextjs-project/src/components/header/header.jsx`.
- Auth state is available through `src/context/AuthContext.jsx`.
- Existing create/edit patterns use client components and frontend managers.
- Existing sitemap generator is `happy-colors-nextjs-project/src/app/sitemap.js`.
- Existing cache revalidation routes exist for products and homepage banners.
- Upload flows use authenticated Next API routes and GCS.

### Backend

- Express API lives under `server/`.
- Routes are mounted from `server/routes.js`.
- Auth guard is `requireAuth` from `server/middlewares/auth.js`.
- Backend CRUD patterns exist for products and homepage banners.
- Mongo models use Mongoose.

### Trust Model

V1 treats every authenticated user as a trusted content operator, consistent with the current admin-like content flows.

If public registration is enabled or if untrusted customer accounts are allowed to log in, blog create/edit/archive routes must be protected by an explicit admin/owner role check before production release.

---

## Data Model

Model file:

```txt
server/models/BlogArticle.js
```

Core fields:

```js
{
  title: String,
  contentHtml: String,
  contentJson: Mixed,
  contentText: String,
  excerpt: String,
  heroImageUrl: String,
  thumbnailImageUrl: String,
  heroImageAlt: String,
  seoTitle: String,
  seoDescription: String,
  status: 'published',
  publishedAt: Date,
  archivedAt: Date | null,
  newsletterReady: Boolean,
  newsletterSentAt: Date | null,
  owner: ObjectId
}
```

V1 keeps a `status` field for compatibility and explicit public filtering, but the only valid article status is `published`.

Important behavior:

- `title`, `contentHtml`, `heroImageUrl`, `thumbnailImageUrl`, and `heroImageAlt` are required.
- `status` defaults to `published`.
- `publishedAt` is set when an article is created.
- Editing preserves `publishedAt`.
- Archive sets `archivedAt`.
- Restore clears `archivedAt`.
- Restore does not change `status`.
- Clients cannot set `owner`, `excerpt`, `contentText`, `publishedAt`, `archivedAt`, newsletter fields, or timestamps.
- `excerpt` is generated server-side from sanitized text.
- `contentText` is extracted server-side from sanitized HTML.

Indexes:

```js
blogArticleSchema.index({ status: 1, archivedAt: 1, publishedAt: -1, createdAt: -1 });
blogArticleSchema.index({ archivedAt: 1, updatedAt: -1 });
```

---

## Backend API

Mounted under:

```txt
/blog-articles
```

Routes:

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

There is no status patch route in V1.

Route behavior:

- `GET /blog-articles` is public and returns non-archived articles newest-first.
- `GET /blog-articles/:articleId` is public and returns a non-archived article.
- Because draft mode was removed after early preview testing, public reads intentionally do not filter by `status`; this keeps legacy preview articles created with the old `draft` status visible to visitors.
- `GET /blog-articles/admin` requires auth and returns the full blog queue, including archived articles.
- `GET /blog-articles/admin/:articleId` requires auth and can return archived articles for editing/restoring.
- `POST /blog-articles` requires auth, creates a published article, and sets `publishedAt`.
- `PUT /blog-articles/:articleId` requires auth and edits article content/metadata/images.
- `PUT /blog-articles/:articleId` rejects `status` with 400.
- `PATCH /blog-articles/:articleId/archive` requires auth and soft-deletes the article.
- `PATCH /blog-articles/:articleId/restore` requires auth and clears `archivedAt`.

Mutation routes share the blog mutation rate limiter.

---

## Backend Validation

Backend service validation is the security boundary.

Validate:

- Mongo article id shape.
- Required text fields.
- Text length limits:
  - title: 160;
  - hero image alt: 180;
  - SEO title: 70;
  - SEO description: 170.
- Sanitized article HTML is non-empty.
- Allowed HTML tags and attributes only.
- Links allow `https:` and `mailto:` only.
- `target="_blank"` links receive safe `rel` values.
- TipTap JSON is serializable, size-limited, and restricted to supported nodes/marks/attrs.
- Hero image URL points to the configured GCS bucket under `blog/articles/hero/`.
- Thumbnail image URL points to the configured GCS bucket under `blog/articles/thumbnails/`.
- Image URLs must be HTTPS `storage.googleapis.com` URLs with no credentials, query string, hash, or path traversal.

Server-owned fields are ignored or rejected according to the service whitelist.

---

## Image Upload Design

Upload route:

```txt
happy-colors-nextjs-project/src/app/api/blog/images/route.js
```

Upload helper:

```txt
happy-colors-nextjs-project/src/managers/uploadManager.js
```

V1 behavior:

- The form uploads hero and thumbnail separately.
- The upload request includes `kind: "hero"` or `kind: "thumbnail"`.
- Hero images are stored under `blog/articles/hero/`.
- Thumbnail images are stored under `blog/articles/thumbnails/`.
- The route validates auth, file presence, file type, file size, and upload kind.
- The route returns a single uploaded object response:
  - `kind`;
  - `imageUrl`;
  - `objectName`;
  - `deleteToken`.
- The frontend stores the returned URL in form state.
- If save fails after upload, newly uploaded images are cleaned up with their delete tokens.
- On edit image replacement, old images are deleted only after the DB save succeeds and only if no other article references them.

Explicitly out of scope:

- automatic thumbnail generation;
- hero image resampling;
- `sharp`;
- returning a hero/thumbnail pair from one upload call.

---

## Rich Text Editor

Editor file:

```txt
happy-colors-nextjs-project/src/components/blog/RichTextEditor.jsx
```

The editor uses TipTap/ProseMirror and is imported client-side only from the blog form.

Expected editor capabilities:

- H2/H3/H4 heading controls;
- bold, italic, underline;
- links;
- left, center, right alignment;
- list controls where enabled;
- styling selected text inside the body.

The editor emits:

- `contentHtml`;
- `contentJson`;
- `contentText`.

The public article pages must not import TipTap directly.

---

## Frontend Pages And Components

Public pages:

```txt
happy-colors-nextjs-project/src/app/blog/page.js
happy-colors-nextjs-project/src/app/blog/[articleId]/page.js
```

Authenticated pages:

```txt
happy-colors-nextjs-project/src/app/blog/create/page.js
happy-colors-nextjs-project/src/app/blog/[articleId]/edit/page.js
```

Components:

```txt
happy-colors-nextjs-project/src/components/blog/BlogArticleDetails.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleForm.jsx
happy-colors-nextjs-project/src/components/blog/BlogArticleActions.jsx
happy-colors-nextjs-project/src/components/blog/RichTextEditor.jsx
```

V1 does not include:

```txt
happy-colors-nextjs-project/src/app/blog/manage/page.js
```

Public `/blog` behavior:

- fetch public articles newest-first;
- if no article exists, render an empty state;
- otherwise render the latest article opened;
- pass the article list to the aside component.

Public `/blog/[articleId]` behavior:

- fetch selected public article;
- fetch public article list for the aside;
- render `notFound()` for invalid, missing, or archived articles.

Logged-in article actions:

- edit link;
- delete/archive button;
- no publish button.

---

## Navigation

Header behavior:

- Public navigation includes Blog.
- Logged-in user navigation includes "Create blog article" linking to `/blog/create`.
- There is no logged-in "Blog articles" management link in V1.

---

## SEO And Sitemap

Each article can provide:

- `seoTitle`;
- `seoDescription`;
- `heroImageAlt`;
- hero/thumbnail image URLs.

Metadata behavior:

- title uses `seoTitle` when provided, otherwise article title;
- description uses `seoDescription` when provided, otherwise excerpt;
- Open Graph image can use hero or thumbnail URL;
- public detail pages should not expose admin-only fields.

Sitemap behavior:

- include `/blog`;
- include public, non-archived article URLs;
- exclude archived articles;
- use `updatedAt || publishedAt || createdAt` for `lastModified`.

Cache revalidation:

```txt
happy-colors-nextjs-project/src/app/api/revalidate/blog/route.js
```

After create/edit/archive/restore, invalidate:

- `/blog`;
- `/blog/[articleId]` when an id is available;
- `/sitemap.xml`;
- `blog-articles` tag.

---

## Security

Primary risks and mitigations:

- XSS in article body: sanitize HTML on the backend and validate TipTap JSON shape.
- Unsafe links: allow only safe schemes and safe blank-target rel values.
- Mass assignment: whitelist create/edit fields.
- Unauthorized mutations: require auth and rate-limit mutation routes.
- Storage URL abuse: validate GCS bucket, path prefix, protocol, and object path.
- Accidental public archive leakage: public queries filter `status='published'` and `archivedAt=null`.

Remaining production decision:

- Add explicit admin/owner authorization if public registration or non-operator accounts can authenticate.

---

## Testing Expectations

Backend:

- model/service tests for create, edit, archive, restore;
- content sanitization tests;
- contentJson validation tests;
- image URL validation tests;
- integration tests for public/admin routes and auth;
- mutation rate-limit tests;
- image replacement cleanup tests.

Frontend:

- upload route tests for auth, validation, upload kind, response shape, and rate limiting;
- manager tests for request shapes and cache invalidation;
- form tests for required fields, image upload, cleanup on failed save, and payload whitelist;
- editor tests for TipTap controls and change emission;
- public component tests for hero/title/date/body/aside rendering.

Manual QA:

- create article;
- edit article;
- archive/delete article;
- upload hero and thumbnail manually;
- verify hero image is not resampled by the app;
- verify rich text selected-text formatting;
- verify desktop and mobile public layout;
- verify logged-in edit/delete controls;
- verify archived article disappears from public blog and sitemap.

---

## Out Of Scope For V1

- Drafts.
- Publish/unpublish button.
- `/blog/manage` page.
- Automatic thumbnail generation.
- `sharp`.
- Hero image resampling.
- Slug URLs.
- Newsletter sending.
- Role-based admin permissions, unless public registration is enabled before release.

---

## Release Readiness

Before production release:

- all relevant frontend tests pass;
- all relevant backend blog tests pass;
- Next build passes;
- manual browser QA passes;
- docs and implementation plan match the shipped behavior;
- external review findings are triaged;
- auth trust model is confirmed safe for the deployed user model.
