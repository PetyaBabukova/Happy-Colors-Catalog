# Happy Colors - Newsletter Sending and OG Images Implementation Plan

**Date:** 2026-05-19
**Status:** Draft for Opus review
**Related design document:** `docs/DESIGN-DOC-NEWSLETTER-SENDING-AND-OG.md`
**Goal:** Implement authenticated low-volume newsletter sending for active subscribers, with reusable email infrastructure, protected subscriber privacy, product/blog/custom prefill flows, focused tests, and OG image hardening.

---

## Fixed V1 Decisions

- Use `requireAuth` only for newsletter send/test/status/prefill endpoints.
- Do not add roles, `NEWSLETTER_ADMIN_EMAILS`, or `requireNewsletterAdmin` in this task.
- Production self-registration remains disabled; the product owner is the only expected user.
- Do not expose subscriber listing, search, export, or download endpoints in V1.
- Send/test/status/prefill responses must not include subscriber emails, subscriber records, or unsubscribe tokens.
- Partial broadcast failure details are sent only to `CONTACT_EMAIL` as a private owner report.
- Test email is optional and goes to `NEWSLETTER_TEST_RECIPIENTS`.
- Send-to-all requires a confirmation modal.
- The confirmation modal must show the current active subscriber count from `GET /newsletter/send/status`.
- Custom newsletter CTA is fixed to `/products`.
- Product/blog CTA and image are re-derived server-side from `sourceId`.
- Site-relative email image, CTA, and unsubscribe URLs use `NEWSLETTER_PUBLIC_SITE_URL` first, then `NEXT_PUBLIC_SITE_URL`, then the production Happy Colors default. Absolute Mongo/GCS image URLs are preserved.
- Newsletter test and broadcast POST routes enforce a trusted `Origin`/`Referer` guard in addition to auth, JSON validation, and rate limits.
- Real subscriber emails include per-recipient unsubscribe links and `List-Unsubscribe` headers.
- No segmentation, campaign history, tracking pixels, queues, or external newsletter platform in V1.

---

## Phase Summary

1. Baseline and guardrails.
2. Product/site OG image hardening.
3. Shared email helper and newsletter template.
4. Backend newsletter sending service and controller for custom/status/test/broadcast.
5. Frontend manager and authenticated custom send page.
6. Product send button and prefill flow.
7. Blog send button and prefill flow.
8. Final regression, external review, and release readiness.

Each phase should be small enough to review independently. Do not change auth, registration, payments, orders, checkout, or contact form behavior except for backward-compatible `sendEmail` helper changes.

---

## Phase 0 - Baseline And Guardrails

### Goal

Confirm the current state and read the implementation patterns before editing feature code.

### Files To Read

```txt
docs/DESIGN-DOC-NEWSLETTER-SENDING-AND-OG.md
server/helpers/sendEmail.js
server/controllers/newsletterController.js
server/services/newsletterService.js
server/models/NewsletterSubscriber.js
server/middlewares/auth.js
server/middlewares/rateLimit.js
server/routes.js
server/services/blogArticlesService.js
server/services/productsServices.js
happy-colors-nextjs-project/src/components/blog/RichTextEditor.jsx
happy-colors-nextjs-project/src/managers/newsletterManager.js
happy-colors-nextjs-project/src/utils/productSeo.js
happy-colors-nextjs-project/src/utils/blogSeo.js
```

### Commands

```powershell
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" status --short
npm run test:server
npm run test:frontend
```

### Acceptance

- Dirty/untracked files are known before implementation starts.
- The design document is the source of truth.
- Existing tests are either green or any pre-existing failures are documented.
- No unrelated files are edited.

---

## Phase 1 - Product And Site OG Image Hardening

### Goal

Ensure product metadata and newsletter email previews have a stable raster fallback image.

### Files

```txt
happy-colors-nextjs-project/public/og/happy-colors-og.png
happy-colors-nextjs-project/src/config/siteSeo.js
happy-colors-nextjs-project/src/utils/productSeo.js
happy-colors-nextjs-project/__tests__/unit/utils/productSeo.test.js
happy-colors-nextjs-project/__tests__/unit/config/siteSeo.test.js
```

### Implementation Notes

- Add or identify a public PNG/JPG site OG fallback asset.
- Add an exported frontend constant for the fallback path, for example `SITE_OG_IMAGE_PATH = "/og/happy-colors-og.png"`.
- Add a backend constant with the same path in the newsletter send/template layer; do not import frontend modules from the server.
- Backend email URLs should be built from the public site URL, not local `CLIENT_URL`, so production emails never contain `localhost` links. Preserve already-absolute image URLs from source records.
- Product metadata should prefer the primary product image and fallback to the site OG asset.
- Newsletter email builders currently use `/logo_64pxH.svg` as the configured default newsletter image when source images are absent; this can be swapped for a raster asset later without accepting client-provided image URLs.

### Acceptance

- Public fallback asset exists and can be referenced as `/og/happy-colors-og.png`.
- Product metadata includes an OG/Twitter image when product media is missing.
- Tests cover absolute URL behavior and fallback behavior.

---

## Phase 2 - Shared Email HTML Support

### Goal

Extend email infrastructure without breaking the existing contact form or welcome newsletter email.

### Files

```txt
server/helpers/sendEmail.js
server/__tests__/unit/helpers/sendEmail.test.js
server/services/newsletterEmailTemplate.js
server/__tests__/unit/services/newsletterEmailTemplate.test.js
.env.test.example
```

### Implementation Notes

- Extend `sendEmail({ to, subject, text, html, headers })`.
- Preserve text-only callers.
- Preserve `DISABLE_EMAIL_DELIVERY === "true"` behavior.
- Pass optional `headers` through to nodemailer.
- Use a Happy Colors display sender for newsletter/contact infrastructure, for example `"Happy Colors <${CONTACT_EMAIL}>"`, while preserving the configured Gmail account for SMTP auth.
- Ensure UTF-8 Cyrillic survives text and HTML payloads.
- Mask or omit recipients in normal failure logs.
- Build a newsletter template helper that returns `{ subject, html, text, headers }`.
- Real subscriber emails include:
  - sanitized content HTML;
  - hosted image URL;
  - CTA link;
  - visible unsubscribe link;
  - plain text fallback;
  - `<meta charset="UTF-8">`;
- `List-Unsubscribe` and `List-Unsubscribe-Post` headers, with the header URL pointing to `/api/newsletter/unsubscribe/one-click?token=...` and the visible footer URL pointing to `/newsletter/unsubscribe?token=...`.
- Test emails omit real unsubscribe headers and use a clearly labeled test footer.
- Add `NEWSLETTER_TEST_RECIPIENTS` to `.env.test.example` here so later endpoint tests have the expected configuration documented.

### Acceptance

- Existing contact and welcome email tests still pass.
- Text-only email calls produce the same nodemailer options as before, except for safe log masking if implemented globally.
- HTML emails pass `html`.
- Header-aware emails pass `headers`.
- Failure retry logs never include full recipient email addresses.
- Template tests cover escaping, CTA, image fallback, unsubscribe URL, list-unsubscribe headers, and test-email behavior.
- Template tests include Bulgarian Cyrillic subject/content and verify the output preserves the same characters.

---

## Phase 3 - Backend Newsletter Sending Core

### Goal

Add authenticated backend endpoints for status, custom test send, and custom broadcast send, while keeping subscriber data private.

### New Files

```txt
server/services/newsletterSendService.js
server/controllers/newsletterSendController.js
server/__tests__/integration/newsletterSend.test.js
server/__tests__/unit/services/newsletterSendService.test.js
```

### Changed Files

```txt
server/routes.js
server/__tests__/integration/setup.js
```

### Routes

Mount a dedicated send controller before the existing `router.use('/newsletter', newsletterController)` route in `server/routes.js`:

```js
router.use('/newsletter/send', newsletterSendController);
```

Routes:

```http
GET /newsletter/send/status
POST /newsletter/send/test
POST /newsletter/send
```

All routes require `requireAuth`.
The two `POST` routes must use the existing JSON content-type guard pattern.

### Request Shape

Custom send/test:

```json
{
  "subject": "Summer promotion",
  "contentHtml": "<p>...</p>",
  "contentJson": {},
  "contentText": "...",
  "sourceType": "custom"
}
```

Product/blog request handling is added in Phases 5 and 6. The core validator should already reserve the schema:

```json
{
  "subject": "Product title",
  "contentHtml": "<p>...</p>",
  "contentJson": {},
  "contentText": "...",
  "sourceType": "product",
  "sourceId": "product-id"
}
```

Do not accept client-provided `imageUrl`, `ctaUrl`, recipient lists, unsubscribe tokens, or subscriber ids in send/test payloads.

### Service Responsibilities

- Validate strict payload field allowlists.
- Validate required trimmed subject and max length around 120-160 characters.
- Reuse or extract the existing blog TipTap `contentJson` validation where possible, including size/depth/type limits.
- Sanitize newsletter HTML with rules appropriate for email; strip inline styles unless explicitly safe.
- Derive `contentText` server-side when needed.
- Build absolute image, CTA, and unsubscribe URLs from the backend using `NEWSLETTER_PUBLIC_SITE_URL` / `NEXT_PUBLIC_SITE_URL` / the production default; do not rely on frontend URL helpers or local `CLIENT_URL`.
- For custom sends, derive CTA `/products` and the configured default newsletter image, currently `/logo_64pxH.svg`.
- `GET /status` returns `{ activeSubscribers }` only.
- Test send validates `NEWSLETTER_TEST_RECIPIENTS` and returns `422` if missing/invalid.
- Test send sends to configured test recipients only and returns `{ message, recipients }`, where `recipients` is a number count, not an email array.
- Test and broadcast send reject untrusted browser origins before sending any email.
- Broadcast send queries active subscribers at broadcast start.
- Broadcast send sends only to `status: "active"` subscribers.
- Broadcast send generates a unique visible unsubscribe URL and one-click `List-Unsubscribe` API URL per subscriber.
- Broadcast send imports and reuses the existing `createUnsubscribeToken` helper from `newsletterService.js`, so `NEWSLETTER_UNSUBSCRIBE_SECRET` is required for real sends.
- Add a simple per-process concurrent broadcast guard. If a broadcast is already running, return `409` with a clear message instead of sending duplicate emails.
- Broadcast response returns counts only: `{ message, sent, failed, activeSubscribers }`.
- `activeSubscribers` is the count queried at broadcast start.
- Partial failures collect `{ email, reason }` for the private owner report only.
- If failures occur, email `CONTACT_EMAIL` the private failure report.
- If owner failure report email fails, log the report-send failure with subscriber emails masked or omitted.
- Do not log full HTML payloads, subscriber emails, or unsubscribe tokens in normal logs.

### Acceptance

- Unauthenticated status/test/send requests are rejected before subscriber queries or email sends.
- Authenticated status returns active subscriber count only.
- Authenticated test send works with valid `NEWSLETTER_TEST_RECIPIENTS`.
- Invalid/missing `NEWSLETTER_TEST_RECIPIENTS` returns `422`.
- Subject exceeding the configured max length is rejected.
- Unsafe or oversized `contentJson` is rejected using the reused/extracted blog validation rules.
- Authenticated broadcast sends to active subscribers only.
- Unsubscribed subscribers are skipped.
- Each real subscriber email gets an individual unsubscribe URL and list-unsubscribe header.
- A second simultaneous broadcast receives `409` and sends no duplicate emails.
- Partial failures produce a private owner report email.
- API responses never expose subscriber emails, subscriber records, or unsubscribe tokens.
- Authenticated send mutations from untrusted origins receive `403` and do not send email.
- In production, newsletter send mutations require a trusted `Origin` or `Referer`.
- Trusted-origin tests cover allowed site origin, rejected foreign origin, and production missing-origin behavior.
- No V1 subscriber listing/search/export/download endpoint is added.
- Representative future-looking subscriber-list paths such as `/newsletter/subscribers`, `/newsletter/send/subscribers`, and `/newsletter/export` return `401` or `404` and do not query subscribers.
- Rate limits are isolated from public subscribe/contact limits:
  - test send: 10/hour per authenticated user/IP;
  - broadcast: 3/hour per authenticated user/IP.
- Authenticated newsletter send limits are keyed by the logged-in user, so changing `X-Forwarded-For` does not bypass the cap.
- Integration tests cover both test-send and broadcast rate-limit rejection and prove they do not consume public subscribe/contact quotas.

---

## Phase 4 - Frontend Manager And Custom Send Page

### Goal

Add the authenticated `/newsletter/send` UI for custom newsletters.

### Files

```txt
happy-colors-nextjs-project/src/managers/newsletterSendManager.js
happy-colors-nextjs-project/src/app/newsletter/send/page.js
happy-colors-nextjs-project/src/app/newsletter/send/NewsletterSendClient.jsx
happy-colors-nextjs-project/src/app/newsletter/send/newsletterSend.module.css
happy-colors-nextjs-project/__tests__/unit/managers/newsletterSendManager.test.js
happy-colors-nextjs-project/__tests__/components/newsletter/NewsletterSendClient.test.jsx
```

### Implementation Notes

- Reuse the existing auth guard/redirect pattern used by management pages.
- Reuse `RichTextEditor` in place from `src/components/blog/RichTextEditor.jsx`; do not move it in this task.
- Initialize custom newsletters with:
  - empty subject;
  - empty editor content;
  - default newsletter image summary;
  - CTA `/products`;
  - label `Виж повече`.
- Manager methods:
  - `getNewsletterSendStatus`;
  - `sendNewsletterTest`;
  - `sendNewsletterToSubscribers`.
- Product/blog prefill manager methods are added in Phases 5 and 6.
- Do not add any frontend method that lists subscribers.
- Before opening the send-to-all confirmation modal, fetch `/newsletter/send/status`.
- Confirmation modal shows the active subscriber count.
- Test send is optional.
- Send-to-all is blocked until the confirmation modal is confirmed.
- Partial failures show a warning and explain that the owner report was emailed.

### Acceptance

- Unauthenticated users are redirected/guarded.
- Editor updates subject/content state.
- Test send button calls the test endpoint.
- Send-to-all opens confirmation modal with active subscriber count.
- Canceling confirmation does not send.
- Confirming sends.
- Zero subscribers show an informational state.
- UI never renders subscriber emails or subscriber lists.

---

## Phase 5 - Product Newsletter Flow

### Goal

Allow authenticated users to start a prefilled newsletter from a product detail page without sending immediately.

### Files

```txt
happy-colors-nextjs-project/src/app/products/[productId]/ProductDetails.jsx
happy-colors-nextjs-project/src/managers/newsletterSendManager.js
happy-colors-nextjs-project/__tests__/components/products/ProductDetails.test.jsx
happy-colors-nextjs-project/__tests__/components/newsletter/NewsletterSendClient.test.jsx
server/__tests__/integration/newsletterSend.test.js
```

### Implementation Notes

- Add `GET /newsletter/send/prefill/product/:productId`.
- Add `getProductNewsletterPrefill` to `newsletterSendManager.js`.
- Show `Изпрати до абонати` only to authenticated users.
- The button navigates to `/newsletter/send?source=product&id=<productId>`.
- The send page fetches product prefill server-side through the authenticated API.
- Prefill uses:
  - product title;
  - full product description;
  - first normalized product image or configured default newsletter image fallback;
  - CTA `/products/<productId>`;
  - label `Виж повече`.
- The authenticated user can edit subject/content before test/broadcast.
- Final test/broadcast requests include `sourceType: "product"` and `sourceId`, not `imageUrl` or `ctaUrl`.

### Acceptance

- Product prefill integration tests land in this phase, not later.
- Unauthenticated product prefill requests return `401` before loading product records.
- Product button is hidden for unauthenticated users and visible for authenticated users.
- Product button does not send email directly.
- Product prefill loads expected subject/content/image/CTA summary.
- Product send/test ignores any client-provided CTA/image and re-derives from `sourceId`.
- Missing/deleted product source returns a clear `404`.

---

## Phase 6 - Blog Newsletter Flow

### Goal

Allow authenticated users to start a prefilled newsletter from a blog article without sending immediately.

### Changed Files

```txt
happy-colors-nextjs-project/src/components/blog/BlogArticleActions.jsx
happy-colors-nextjs-project/src/managers/newsletterSendManager.js
happy-colors-nextjs-project/__tests__/components/newsletter/NewsletterSendClient.test.jsx
server/__tests__/integration/newsletterSend.test.js
server/__tests__/unit/services/newsletterSendService.test.js
happy-colors-nextjs-project/src/utils/blogSeo.js
happy-colors-nextjs-project/__tests__/unit/utils/blogSeo.test.js
```

### New Files

```txt
happy-colors-nextjs-project/__tests__/components/blog/BlogArticleActions.test.jsx
```

### Implementation Notes

- Add `GET /newsletter/send/prefill/blog/:articleId`.
- Add `getBlogNewsletterPrefill` to `newsletterSendManager.js`.
- Extend the existing `BlogArticleActions.jsx` component.
- Show `Изпрати до абонати` only to authenticated users.
- The button navigates to `/newsletter/send?source=blog&id=<articleId>`.
- Blog prefill uses:
  - article title;
  - first non-empty paragraph from sanitized article HTML;
  - existing excerpt/contentText fallback only when no paragraph exists;
- thumbnail image or configured default newsletter image fallback;
- CTA `/blog/<articleId>`;
- label `Виж повече`.
- Keep blog OG fallback tests aligned with the design document.

### Acceptance

- Blog prefill integration tests land in this phase.
- Unauthenticated blog prefill requests return `401` before loading article records.
- Blog OG fallback is hardened in this phase, matching the design document sequencing.
- Blog button is hidden for unauthenticated users and visible for authenticated users.
- Blog button does not send email directly.
- Blog prefill returns a first-paragraph content body.
- Missing/deleted blog source returns a clear `404`.
- Blog send/test ignores any client-provided CTA/image and re-derives from `sourceId`.

---

## Phase 7 - Security And Privacy Code Search

### Goal

Do a final targeted code search for accidental subscriber exposure after the automated tests from earlier phases are in place.

### Checks

- There is no route for:
  - `GET /newsletter/subscribers`;
  - `GET /newsletter/send/subscribers`;
  - `GET /newsletter/export`;
  - any subscriber search/download/list route.
- Send/test/status/prefill responses never include:
  - subscriber emails;
  - subscriber records;
  - unsubscribe tokens;
  - per-recipient failure arrays.
- Frontend code does not fetch, cache, render, or store subscriber lists.
- Browser-visible failure UX does not include failed recipient emails.
- Owner failure report email is the only place failed recipient emails are intentionally listed.
- Normal logs mask or omit subscriber emails and unsubscribe tokens.

### Acceptance

- Automated integration/component tests from Phases 3 and 4 cover the main privacy assertions.
- Integration tests include representative negative paths: `/newsletter/subscribers`, `/newsletter/send/subscribers`, and `/newsletter/export`.
- Manual code search confirms no accidental subscriber-list manager/API/UI was added.
- Any suspicious route or frontend manager method is removed or documented as out of scope before release.

---

## Phase 8 - Regression And Release Readiness

### Commands

Run focused tests as each phase lands. Before final handoff run:

```powershell
npm run test:server
npm run test:frontend
npm run build
```

If time permits:

```powershell
npm run test:coverage
```

### External Review

Use the repository Claude review workflow on the final working diff. This command is PowerShell-specific because the repository is used on Windows and the encoding lines keep Bulgarian Cyrillic intact when piping to Claude:

```powershell
$OutputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" diff | claude -p --model claude-opus-4-6 "Review this git diff for bugs, regressions, security issues, privacy leaks, and missing tests. Focus on newsletter sending, subscriber privacy, auth, and email deliverability. Give concise actionable findings with file paths and line references where possible."
```

### Release Checklist

- `NEWSLETTER_TEST_RECIPIENTS` is configured in production if the owner wants to use the optional test-send feature.
- `CONTACT_EMAIL` and `CONTACT_EMAIL_PASS` are configured in production.
- `NEWSLETTER_UNSUBSCRIBE_SECRET` remains configured.
- Site OG fallback asset exists in production build.
- Registration remains disabled in production.
- `NEWSLETTER_PUBLIC_SITE_URL` is configured as `https://happycolors.eu` in production.
- No subscriber list endpoint exists.
- Test email is verified manually before first real broadcast if the owner chooses to do so.
- Send-to-all confirmation displays the correct active subscriber count.

---

## Out Of Scope For This Implementation

- User roles.
- Public registration changes.
- Subscriber segmentation/interests.
- Campaign history dashboard.
- Subscriber management/listing/export UI.
- Queue/batch processing.
- External email/newsletter provider migration.
- Open/click tracking.
- Attachments or custom newsletter image upload.
