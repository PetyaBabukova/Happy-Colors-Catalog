# Happy Colors - Newsletter Sending and OG Images Design Document

**Date:** 2026-05-19
**Status:** Revised after Opus 4.6 review and product-owner clarifications
**Scope:** Authenticated newsletter sending, product/blog "Send to subscribers" flow, reusable email template, owner failure reports, and Open Graph image behavior for product and blog links.
**Builds on:** `docs/DESIGN-DOC-NEWSLETTER-SUBSCRIPTION.md`

---

## Goal

Add a controlled way for Happy Colors to send news to existing newsletter subscribers.

The existing newsletter subscription work stores active subscribers, sends a welcome email, and supports unsubscribe links. This design covers the next layer: creating and sending newsletter messages from trusted authenticated surfaces.

The implementation should stay small enough for the current stage of the business, where there are no or very few subscribers, while keeping the architecture ready for later segmentation and batching.

---

## Decisions Confirmed With Product Owner

- Add an authenticated newsletter page for custom messages.
- The custom newsletter page should reuse the blog rich text editor if technically safe.
- Test email is recommended but not required before sending to all subscribers.
- Test recipients are configured through environment, with the initial recipients:
  - `p.babukova@gmail.com`
  - `s.babukov@gmail.com`
- Every send-to-all action must show a confirmation modal.
- Custom newsletter image uses a raster site OG image in V1.
- Custom newsletter CTA link points to `/products`.
- CTA text is always `Виж повече`.
- Product newsletter content uses the full product description.
- Blog newsletter content uses the first paragraph of the article.
- Custom newsletter content uses the full editor content.
- Product and blog buttons should not send immediately. They open a prefilled newsletter form/preview that can be edited.
- Send buttons should be visible only to authenticated users.
- Backend newsletter sending uses `requireAuth` in V1. No roles or newsletter-admin allowlist are needed while production self-registration is disabled and the site owner is the only expected user.
- All active subscribers receive the same V1 campaigns. No interest segmentation in this phase.
- Later, subscribers may choose interests through checkboxes and campaigns can be targeted by segment.
- No campaign history/dashboard in V1.
- After a broadcast, if any subscriber email fails, the site owner receives an operational failure report at `CONTACT_EMAIL` (`happy.colors.bg@gmail.com` in production) with failed recipient emails and failure reasons.
- No queue/batch system in V1 unless subscriber count grows enough to require it.
- First implementation phase should focus on product OG images, then the newsletter sending flow.

---

## Non-Goals

- No external newsletter platform in this phase.
- No automatic send on product or blog publish.
- No required test email gate before send-to-all.
- No subscriber segmentation UI yet.
- No campaign history dashboard yet.
- No open/click tracking pixels.
- No per-recipient analytics.
- No attachments in newsletter emails.
- No rich image upload for custom newsletters in V1.
- No public unsubscribe changes beyond continuing to include a per-recipient unsubscribe link.

---

## Existing Context

### Newsletter Subscription

Existing modules:

```txt
server/models/NewsletterSubscriber.js
server/services/newsletterService.js
server/controllers/newsletterController.js
happy-colors-nextjs-project/src/managers/newsletterManager.js
```

Important existing behavior:

- Subscribers have `status: "active"` or `status: "unsubscribed"`.
- Unsubscribe URLs use signed tokens generated per subscriber.
- Active duplicate subscriptions return `status: "already_subscribed"`.
- Welcome email sending already uses `server/helpers/sendEmail.js`.

The sending feature should reuse the subscriber model and token helper concepts, but it should not mix campaign sending concerns into the public subscribe endpoint.

### Email Infrastructure

Current shared helper:

```txt
server/helpers/sendEmail.js
```

Current helper behavior:

- Uses `CONTACT_EMAIL` and `CONTACT_EMAIL_PASS`.
- Sends from the same Gmail account used by the contact form.
- Currently supports `text`.

Newsletter sending needs HTML emails. The helper should be extended in a backward-compatible way:

```js
sendEmail({ to, subject, text, html, headers })
```

Existing callers that only pass `text` must continue working unchanged.

The visible sender should remain Happy Colors through the same sender infrastructure used by the contact form.

### Rich Text Editor

Blog articles already use:

```txt
happy-colors-nextjs-project/src/components/blog/RichTextEditor.jsx
server/services/blogArticlesService.js
```

The editor is TipTap-based. The blog service already sanitizes HTML through `sanitize-html` and validates `contentJson` with an allowlist. This is a strong fit for reuse.

Recommended approach:

- Reuse `RichTextEditor` for custom newsletters.
- If the component is too blog-named or blog-coupled, move it to a shared editor path such as `src/components/rich-text/RichTextEditor.jsx`.
- Reuse or extract the existing sanitization/validation logic so newsletter HTML accepts the same safe subset as blog content.

### Auth Model

The current project treats authenticated users as trusted management users for product/category/blog management. There is no explicit admin role in `User`, and production registration is intentionally disabled.

Newsletter broadcast sending is more sensitive than normal content editing because one click can email every active subscriber. For V1, the accepted product decision is to use the same trust model as the existing management surfaces:

- V1 endpoints require `requireAuth` only.
- Do not add `NEWSLETTER_ADMIN_EMAILS`, `requireNewsletterAdmin`, or roles in this task.
- The backend remains the source of truth; frontend hiding is convenience only.
- Registration remains disabled in production, so another public visitor cannot create an account and reach the send flow.

Backend authentication is mandatory for:

- test send;
- send to all subscribers;
- product prefill;
- blog prefill.

If the product owner later adds more users or opens registration, role-based authorization should be handled as a separate task before those users can access newsletter sending.

### Current OG Metadata

Product and blog pages already call metadata helpers:

```txt
happy-colors-nextjs-project/src/utils/productSeo.js
happy-colors-nextjs-project/src/utils/blogSeo.js
```

Product metadata already builds Open Graph and Twitter image metadata from normalized product images and video posters. Blog metadata already uses `heroImageUrl` or `thumbnailImageUrl`.

Phase 1 should audit and harden this behavior rather than assume OG support starts from zero.

---

## User Experience

### Authenticated Custom Newsletter Page

Proposed route:

```txt
/newsletter/send
```

Alternative if we want clearer authenticated management grouping later:

```txt
/admin/newsletter/send
```

V1 can use `/newsletter/send` because existing management pages are not grouped under `/admin`.

The page is available only to authenticated users and redirects unauthenticated users to login.

Fields:

- Subject.
- Rich text content using the reused blog editor.
- Read-only/default image preview: raster site OG image.
- Link preview: `/products`.
- CTA text preview: `Виж повече`.
- Optional test send button.
- Send to all subscribers button.

States:

- idle;
- validating;
- sending test;
- test sent;
- sending to subscribers;
- sent;
- validation error;
- backend error;
- zero active subscribers.

Important interaction rule:

- Test email is optional.
- Send-to-all must open a confirmation modal before the request is sent.
- The confirmation modal must show the current active subscriber count from `/newsletter/send/status`.

Confirmation copy can be:

```txt
Сигурни ли сте, че искате да изпратите този имейл до 37 активни абонати?
```

### Product "Изпрати до абонати"

On product detail pages, authenticated users should see a new action:

```txt
Изпрати до абонати
```

The button should not send immediately.

It should open the newsletter sending form in a prefilled product mode, for example:

```txt
/newsletter/send?source=product&id=<productId>
```

Prefilled values:

- subject: product title;
- content: full product description;
- image: first normalized product image, resolved server-side;
- link: `/products/<productId>`;
- CTA text: `Виж повече`.

The authenticated user can review/edit subject and content before sending.

### Blog "Изпрати до абонати"

Blog support follows the same pattern after product support.

Authenticated users see:

```txt
Изпрати до абонати
```

The button opens:

```txt
/newsletter/send?source=blog&id=<articleId>
```

Prefilled values:

- subject: article title;
- content: first paragraph of the article;
- image: thumbnail image, resolved server-side;
- link: `/blog/<articleId>`;
- CTA text: `Виж повече`.

The first paragraph should be derived safely from existing article data:

- Sanitize `contentHtml`.
- Extract the first non-empty paragraph from the sanitized HTML.
- If no paragraph exists, fall back to the existing excerpt or trimmed `contentText`.
- Add tests for multi-paragraph articles.
- Do not trust raw unsanitized HTML.

### Email Recipient Experience

Every newsletter email contains:

- Happy Colors branding;
- main image;
- subject/title;
- message body;
- CTA button with text `Виж повече`;
- unsubscribe link;
- plain text fallback.

The image is embedded as a hosted image URL, not as an attachment.

---

## Email Template Design

Create a newsletter template builder on the backend.

Proposed module:

```txt
server/services/newsletterEmailTemplate.js
```

Input:

```js
{
  title,
  contentHtml,
  contentText,
  imageUrl,
  ctaUrl,
  ctaLabel: 'Виж повече',
  unsubscribeUrl,
}
```

Output:

```js
{
  subject,
  html,
  text,
  headers,
}
```

HTML template requirements:

- Use table-friendly, email-safe HTML.
- Include `<meta charset="UTF-8">` so Bulgarian Cyrillic renders correctly in email clients.
- Inline critical styles or keep styles simple enough for major email clients.
- Do not depend on external CSS.
- Use absolute URLs for images and links.
- Include `alt` text for the image.
- Include a visible unsubscribe link in the footer.
- For real subscriber emails, include `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers with the per-subscriber unsubscribe URL.
- Omit `List-Unsubscribe` headers for test emails because they do not have a real subscriber unsubscribe URL.
- Escape all interpolated plain strings.
- Only insert rich HTML after sanitization.

Plain text fallback requirements:

- Preserve UTF-8 Cyrillic text.
- Include title.
- Include readable content text.
- Include CTA URL.
- Include unsubscribe URL.

Image rules:

- custom: configured raster site OG image;
- product: first product image, fallback to configured raster site OG image;
- blog: thumbnail image, fallback to configured raster site OG image.
- The API should not accept arbitrary external image URLs from the client in V1.
- Product/blog images should be derived server-side from `sourceId`.
- Custom image should be the configured site OG asset.

`imageUrl` is an internal template value after backend validation/derivation. It should not be trusted as a free client-provided field.

---

## API Design

Add authenticated routes under the existing newsletter controller or a dedicated newsletter send controller.

Recommended route shape:

```http
POST /newsletter/send/test
POST /newsletter/send
GET /newsletter/send/prefill/product/:productId
GET /newsletter/send/prefill/blog/:articleId
GET /newsletter/send/status
```

All routes require authentication.
The two `POST` routes must use the existing JSON content-type guard pattern from `server/controllers/newsletterController.js`.

### Test Send

```http
POST /newsletter/send/test
Content-Type: application/json
```

Request:

Custom newsletter:

```json
{
  "subject": "Summer promotion",
  "contentHtml": "<p>...</p>",
  "contentJson": {},
  "contentText": "...",
  "sourceType": "custom"
}
```

Product/blog newsletter:

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

Behavior:

- require auth;
- validate and sanitize payload;
- apply the same server-side CTA and image derivation rules as broadcast sends;
- send to configured test recipients from `NEWSLETTER_TEST_RECIPIENTS`;
- include unsubscribe placeholder text or a non-functional test unsubscribe note;
- if `NEWSLETTER_TEST_RECIPIENTS` is missing, empty, or contains no valid email addresses, return a clear `422` configuration error and do not send.

Response:

```json
{
  "message": "Test email sent.",
  "recipients": 2
}
```

Recommendation:

For test emails, use a clearly labeled test footer instead of a real subscriber unsubscribe token:

```txt
Това е тестов имейл. Реалните имейли до абонати съдържат индивидуален линк за отписване.
```

This avoids generating unsubscribe tokens for non-subscribers.

### Send To Subscribers

```http
POST /newsletter/send
Content-Type: application/json
```

Same request shape as test send.

Behavior:

- require auth;
- validate and sanitize payload;
- for product/blog sends, load the source record and return `404` if it does not exist;
- query subscribers with `status: "active"`;
- if there are zero active subscribers, return a clear success-style or informational response without sending;
- send one email per active subscriber;
- generate an individual unsubscribe URL for each subscriber;
- collect per-recipient failure details without writing full subscriber emails to application logs;
- after the broadcast, if any sends failed, email `CONTACT_EMAIL` an operational report listing failed recipient emails and failure reasons;
- return summary counts.

Response:

```json
{
  "message": "Newsletter send finished.",
  "sent": 12,
  "failed": 0,
  "activeSubscribers": 12
}
```

`activeSubscribers` is the active subscriber count queried at broadcast start.

Low-volume V1 can send synchronously, but the implementation should be structured so a queue can be added later.

### Prefill Product

```http
GET /newsletter/send/prefill/product/:productId
```

Behavior:

- require auth;
- load product;
- derive the trusted product image server-side;
- return prefilled newsletter fields.

Response:

```json
{
  "sourceType": "product",
  "sourceId": "product-id",
  "subject": "Product title",
  "contentHtml": "<p>Full product description</p>",
  "contentText": "Full product description",
  "imageUrl": "https://...",
  "ctaUrl": "/products/product-id",
  "ctaLabel": "Виж повече"
}
```

The prefill response may include `imageUrl` for preview purposes. The final send endpoint should re-resolve the trusted image server-side from `sourceType` and `sourceId`, rather than trusting the preview value.

### Prefill Blog

```http
GET /newsletter/send/prefill/blog/:articleId
```

Behavior:

- require auth;
- load article;
- derive the trusted thumbnail image server-side;
- return the first paragraph and thumbnail.

Response:

```json
{
  "sourceType": "blog",
  "sourceId": "article-id",
  "subject": "Article title",
  "contentHtml": "<p>First paragraph</p>",
  "contentText": "First paragraph",
  "imageUrl": "https://...",
  "ctaUrl": "/blog/article-id",
  "ctaLabel": "Виж повече"
}
```

### Newsletter Send Status

```http
GET /newsletter/send/status
```

Behavior:

- require auth;
- return aggregate send readiness data only;
- include `activeSubscribers` count so the confirmation modal can show the exact number of recipients before sending;
- do not return subscriber emails, subscriber records, or unsubscribe tokens.

Response:

```json
{
  "activeSubscribers": 37
}
```

---

## Validation and Security

### Public vs Authenticated Input

This feature accepts authenticated rich text, which is safer than public input but still must be validated and sanitized.

Reasons:

- protects subscribers if an authenticated session is compromised;
- protects against accidental malformed HTML;
- keeps email rendering predictable;
- keeps future rendering of sent content safe if history is added later.

### Payload Validation

Backend must validate:

- JSON content type;
- strict allowlist of fields;
- subject required, trimmed, max length around 120-160 chars;
- `contentHtml` required after sanitization;
- `contentJson` optional but validated if present;
- `contentText` required or derived server-side;
- client-provided `imageUrl` is not accepted in V1 send payloads;
- product/blog image URLs are derived server-side from source data;
- custom image URL is the configured raster site OG asset;
- client-provided `ctaUrl` is not accepted in V1 send payloads;
- `ctaLabel` fixed to `Виж повече` in V1;
- `sourceType` in `custom`, `product`, `blog`;
- `sourceId` required for product/blog test and broadcast sends;
- `NEWSLETTER_TEST_RECIPIENTS` must parse to one or more valid email addresses before test sending is enabled;
- for `sourceType: "product"` and `sourceType: "blog"`, `ctaUrl` is re-derived server-side from `sourceId`;
- for `sourceType: "custom"`, `ctaUrl` is fixed to `/products`.

Use existing or extracted blog sanitization rules:

- allow paragraphs, headings, lists, bold, italic, underline, and safe links;
- allow only `https:` and `mailto:` links;
- add `rel="noopener noreferrer"` and `target="_blank"` for external links;
- strip script/event attributes/styles not explicitly allowed.

### Authorization

- All send and prefill endpoints require `requireAuth`.
- Do not add roles, `NEWSLETTER_ADMIN_EMAILS`, or `requireNewsletterAdmin` in V1.
- Product/blog prefill authorization is mandatory because prefill exposes management-only editing flows.
- Frontend hiding is convenience only; backend auth is mandatory.
- Unauthenticated requests receive `401` and do not query subscribers, build emails, or send mail.
- Authenticated requests never provide their own recipient list. Recipients are always loaded server-side from active subscribers or from `NEWSLETTER_TEST_RECIPIENTS`.

### Subscriber List Privacy

The subscriber list contains personal data. V1 must not expose it through the frontend or through any API response.

Rules:

- do not add a subscriber listing, search, export, or download endpoint in this task;
- do not return subscriber emails, unsubscribe tokens, or full subscriber records from send/test/prefill endpoints;
- send-to-all responses return counts only: `sent`, `failed`, and `activeSubscribers`;
- partial failure details are sent only in the private owner report email to `CONTACT_EMAIL`;
- frontend screens must not fetch, render, cache, or store the subscriber list;
- frontend copy may show aggregate counts only, never the list of addresses;
- if a subscriber management screen is needed later, build it as a separate task with explicit auth, pagination, masking by default, audit-friendly actions, and its own tests.

### Abuse and Deliverability

Add lightweight protection appropriate for a one-owner V1 feature.

Suggested limit:

- test send: 10 per hour per authenticated user/IP;
- send to all: 3 per hour per authenticated user/IP.

Synchronous V1 should stay simple:

- send only to active subscribers;
- show the current active subscriber count in the send-to-all confirmation modal;
- if sending becomes slow or Gmail limits are reached, handle batching, queues, or provider changes as a separate task.

Do not log full HTML payloads, subscriber emails, or unsubscribe tokens in normal application logs.

Subscriber email addresses may appear in the private owner failure report email because the owner explicitly needs them to remove fake or invalid subscribers. That report must be sent only to `CONTACT_EMAIL` and must not be exposed in public API responses.

If the owner failure report email itself fails, log the report-send failure with subscriber emails masked or omitted. Do not retry indefinitely inside the broadcast request.

Current `sendEmail` logs `mailOptions.to` on failure. Before newsletter broadcast sending is implemented, update the helper to mask or omit recipients in failure logs.

### Request Forgery and Session Safety

The send endpoints are high-impact authenticated mutations. V1 must rely on the existing session and CORS model and avoid introducing public mutation surfaces:

- use `POST` for test and broadcast sends;
- require `Content-Type: application/json` for send endpoints;
- rely on the existing CORS allowlist with credentials so arbitrary sites cannot call the API from a browser;
- keep auth cookies `httpOnly` and `secure` in production;
- do not add GET endpoints that send emails;
- do not add GET endpoints that list subscribers in V1;
- keep the confirmation modal before the broadcast request is submitted;
- if more users are added, registration is opened, or cross-origin auth changes, revisit roles and CSRF protection as a separate security task.

### Unsubscribe

Every real subscriber email must include an individual unsubscribe link.

Do not reuse a single generic unsubscribe URL.

Do not put email addresses in unsubscribe URLs.

---

## Data Model

No campaign history in V1.

That means no new `NewsletterCampaign` collection is required yet.

The backend can send directly from the submitted, validated payload. This keeps V1 small.

Future campaign history can add:

```txt
NewsletterCampaign
NewsletterCampaignDelivery
```

without changing the existing subscriber model.

Optional future fields on `NewsletterSubscriber` for segmentation:

```js
interests: {
  type: [String],
  default: [],
}
```

Do not add this in the current phase unless the segmentation UI is implemented too.

---

## Open Graph Image Design

### Goal

When a product or blog link is shared in social apps, the preview should show the correct title, description, and image.

### Phase 1: Products

Audit and harden existing product metadata:

- confirm `generateMetadata` returns `openGraph.images`;
- confirm image URLs are absolute through `metadataBase` or explicit URL conversion;
- confirm the first product image is used as the primary preview image;
- fallback to the configured raster site OG image if no product image is present;
- confirm `twitter.card` is `summary_large_image`;
- avoid using video poster ahead of the primary product image unless that is intentional.

Potential adjustment:

- Product helper currently has no explicit site-logo fallback when `previewImages` is empty. Add one as defensive behavior.
- Add or generate a stable raster site OG asset before relying on logo fallback in product/blog metadata or newsletter emails.

### Phase 2: Blogs

Audit and harden blog metadata:

- use thumbnail image for newsletter emails;
- for social OG preview, choose hero image or thumbnail based on current site UX. Current helper prefers hero image.
- fallback to the configured raster site OG image if blog image is missing;
- confirm `openGraph.type` is `article`;
- confirm `twitter.card` is `summary_large_image`.

### Site OG Image

Add or identify a stable raster site OG image/logo asset.

Requirements:

- public URL;
- absolute URL in email HTML;
- suitable preview dimensions where possible;
- PNG/JPG for email and social compatibility, even if the site logo is SVG.

The implementation should not rely on the current SVG logo as the final OG/email fallback. Add a PNG/JPG asset such as:

```txt
happy-colors-nextjs-project/public/og/happy-colors-og.png
```

---

## Frontend Architecture

Proposed additions:

```txt
happy-colors-nextjs-project/src/app/newsletter/send/page.js
happy-colors-nextjs-project/src/app/newsletter/send/NewsletterSendClient.jsx
happy-colors-nextjs-project/src/app/newsletter/send/newsletterSend.module.css
happy-colors-nextjs-project/src/managers/newsletterSendManager.js
```

If the editor is moved:

```txt
happy-colors-nextjs-project/src/components/rich-text/RichTextEditor.jsx
happy-colors-nextjs-project/src/components/rich-text/RichTextEditor.module.css
```

Product page addition:

```txt
happy-colors-nextjs-project/src/app/products/[productId]/ProductDetails.jsx
```

Blog page addition:

```txt
happy-colors-nextjs-project/src/components/blog/BlogArticleActions.jsx
```

Authenticated form behavior:

- if `source=product&id=...`, fetch product prefill;
- if `source=blog&id=...`, fetch blog prefill;
- otherwise initialize custom newsletter defaults;
- allow editing subject/content before send;
- show a read-only summary of image, CTA URL, and CTA label;
- fetch `/newsletter/send/status` before opening the send-to-all confirmation modal;
- show the active subscriber count in the confirmation modal, for example: `Сигурни ли сте, че искате да изпратите този имейл до 37 активни абонати?`;
- provide buttons for test send and send to all.

---

## Backend Architecture

Proposed additions:

```txt
server/services/newsletterSendService.js
server/services/newsletterEmailTemplate.js
server/controllers/newsletterSendController.js
server/__tests__/integration/newsletterSend.test.js
server/__tests__/unit/services/newsletterEmailTemplate.test.js
```

Possible route mount:

```js
router.use('/newsletter/send', newsletterSendController);
```

Service responsibilities:

- validate and sanitize authenticated newsletter payloads;
- build custom/product/blog prefill data;
- enforce `requireAuth` at the controller boundary;
- derive trusted image URLs server-side;
- render HTML/text email template;
- query active subscribers;
- generate per-subscriber unsubscribe links;
- call `sendEmail` with `{ to, subject, html, text }` for subscriber broadcasts;
- collect per-recipient failures;
- send a private failure report email to `CONTACT_EMAIL` when failures occur;
- return send summary.

Keep public subscription logic in `newsletterService.js` and authenticated sending logic in `newsletterSendService.js`.

---

## Implementation Phases

### Phase 1 - Product OG Image Audit and Hardening

- Add or generate a stable raster site OG fallback image.
- Verify current product metadata output.
- Add site-logo fallback for product OG/Twitter images.
- Add or update tests for product SEO metadata.
- Confirm absolute image URLs are generated correctly.

### Phase 2 - Shared Email HTML Support

- Extend `sendEmail` to accept optional `html` and `headers`.
- Add regression tests proving existing text-only email callers still work.
- Add newsletter email template builder.
- Add template unit tests for escaping, CTA, image, unsubscribe URL, and `List-Unsubscribe` headers.

### Phase 3 - Authenticated Newsletter Sending Backend

- Add test send endpoint.
- Add send-to-subscribers endpoint.
- Add `NEWSLETTER_TEST_RECIPIENTS` environment support.
- Add active subscriber query and per-recipient unsubscribe links.
- Add lightweight broadcast rate limiting.
- Add authenticated send status endpoint that returns active subscriber count only.
- Add owner failure report email for failed subscriber sends.
- Add subscriber email log masking for normal application logs.
- Add integration tests.

### Phase 4 - Authenticated Custom Newsletter UI

- Add authenticated `/newsletter/send` page.
- Reuse or move the TipTap rich text editor.
- Add preview, test send, and confirmation modal.
- Add frontend tests.

### Phase 5 - Product Send Button

- Add authenticated product action.
- Add product prefill endpoint/use.
- Route the user to the prefilled newsletter form.
- Add tests for visibility and prefill behavior.

### Phase 6 - Blog OG and Blog Send Button

- Harden blog OG image fallback.
- Add blog prefill endpoint/use.
- Add blog send action.
- Use the first paragraph as email content, with excerpt/text fallback only when no paragraph exists.
- Add tests.

---

## Testing Plan

### Backend Unit Tests

- `sendEmail` passes optional `html` to nodemailer and preserves text-only behavior.
- `sendEmail` passes optional `headers` to nodemailer and preserves existing callers.
- `sendEmail` preserves UTF-8 Cyrillic in text and HTML payloads.
- `sendEmail` masks or omits recipients in normal failure logs.
- Email template escapes plain strings.
- Email template includes image, CTA, content, and unsubscribe URL.
- Email template includes `<meta charset="UTF-8">`.
- Real subscriber email template output includes `List-Unsubscribe` headers; test email output omits them.
- Authenticated newsletter validation rejects unknown fields and unsafe URLs.
- Authenticated newsletter validation rejects client-provided arbitrary image URLs.
- Product/blog send validation ignores client-provided CTA/image data and re-derives CTA URL and image URL from `sourceId`.
- Product/blog send validation returns `404` when `sourceId` does not exist.
- Sanitization removes unsafe HTML.
- Newsletter sanitization strips inline styles unless explicitly needed for safe email rendering.
- Product/blog prefill builders return expected content and trusted image URLs.
- Blog prefill extracts the first non-empty paragraph from sanitized multi-paragraph HTML.
- failure report builder includes failed recipient emails and reasons for the private owner email.
- failure report builder does not include unsubscribe tokens or full HTML payloads.

### Backend Integration Tests

- unauthenticated test send is rejected;
- unauthenticated send-to-all is rejected;
- unauthenticated prefill is rejected;
- unauthenticated status/count request is rejected;
- authenticated test send is allowed;
- authenticated send-to-all is allowed;
- authenticated prefill is allowed;
- authenticated status/count request returns active subscriber count only;
- missing or invalid `NEWSLETTER_TEST_RECIPIENTS` returns `422` and sends no test emails;
- test send sends to the two configured recipients;
- send-to-all sends only to active subscribers;
- unsubscribed subscribers are skipped;
- each active subscriber gets a different unsubscribe token;
- zero active subscribers returns a clear response;
- send-to-all returns sent/failed/active subscriber counts;
- `activeSubscribers` in the send response is the count queried at broadcast start;
- test send returns recipient count only and no subscriber data;
- send/test/prefill responses do not expose subscriber emails, unsubscribe tokens, or subscriber records;
- there is no V1 endpoint that lists, searches, exports, or downloads subscribers;
- unauthenticated requests to any future-looking subscriber-list path return `401` or `404` and do not query subscribers;
- partial failures send an owner failure report to `CONTACT_EMAIL` with failed emails and reasons;
- if owner failure report email fails, the error is logged with subscriber emails masked;
- owner failure report is not sent when there are no failures;
- lightweight test and broadcast rate limiting is isolated from public subscribe/contact limits;
- newsletter broadcast email failures do not log full subscriber email addresses.

### Frontend Tests

- custom newsletter page redirects/guards unauthenticated users;
- editor updates content state;
- test send button calls the test endpoint;
- send-to-all opens confirmation modal;
- confirmation modal shows the current active subscriber count from the authenticated status endpoint;
- cancelling confirmation does not send;
- confirming sends;
- zero active subscribers shows an informational state;
- partial failures show a warning and explain that a failure report was emailed to the site owner;
- frontend does not fetch or render subscriber email lists in V1;
- frontend shows only aggregate subscriber counts returned by the backend;
- product button is visible only when authenticated;
- product button opens prefilled newsletter page;
- blog button is visible only when authenticated.

### SEO Tests

- product metadata includes Open Graph image;
- product metadata falls back to the configured raster site OG image;
- blog metadata includes expected image;
- blog metadata falls back to the configured raster site OG image.
- site fallback points to a public raster OG image.

### Regression Tests

- existing contact form email still works;
- existing welcome newsletter email still works;
- existing product details page behavior is unchanged for visitors;
- existing blog create/edit flow still works after editor reuse/move;
- production build passes.

---

## Risks and Mitigations

### Accidental Send To All

Risk: a logged-in user sends a newsletter by mistake.

Mitigation:

- no direct send from product/blog buttons;
- preview/edit page;
- confirmation modal before send-to-all;
- optional test email button.

### Rich Text XSS

Risk: HTML content could be unsafe in email or future authenticated previews.

Mitigation:

- reuse/extract existing blog sanitization and contentJson validation;
- escape plain strings;
- avoid `dangerouslySetInnerHTML` except with sanitized HTML.

### Gmail/SMTP Limits

Risk: Sending synchronously through Gmail may hit limits as subscribers grow.

Mitigation:

- V1 is low volume;
- show the active subscriber count in the confirmation modal so growth is visible before each broadcast;
- send a private owner report when individual recipients fail, so fake or invalid subscribers can be removed;
- structure service so queue/provider migration is isolated.

### Authenticated User Trust Boundary

Risk: Any authenticated user can send newsletters because V1 intentionally does not have roles.

Mitigation:

- production registration is disabled, and the product owner is the only expected user in V1;
- all send/prefill endpoints require `requireAuth`;
- frontend hiding is not trusted as authorization;
- add explicit roles as a separate task before adding more users or opening registration.

### Unauthorized Send Attempts

Risk: A visitor or attacker attempts to send email to subscribers through the newsletter API.

Mitigation:

- send endpoints are not public and return `401` before doing work when the auth cookie is missing or invalid;
- send endpoints require JSON requests and reject form posts;
- recipients are always selected server-side from active subscribers or `NEWSLETTER_TEST_RECIPIENTS`;
- clients cannot submit arbitrary recipient lists;
- product/blog CTA and image values are re-derived server-side from trusted source records;
- CORS remains restricted to configured site origins with credentials;
- no GET route sends email;
- if the authentication or deployment model changes, revisit CSRF protection and role-based authorization before enabling the new model.

### Subscriber List Exposure

Risk: A visitor or attacker attempts to extract subscriber emails through Postman, browser dev tools, or an accidentally exposed frontend/API route.

Mitigation:

- V1 does not implement subscriber listing, search, export, or download endpoints;
- broadcast endpoints return aggregate counts only and never include subscriber emails;
- failure details are sent only to the private `CONTACT_EMAIL` owner mailbox, not returned to the browser;
- frontend does not request or store subscriber lists;
- tests must assert that send/test/prefill responses never contain subscriber emails or unsubscribe tokens.

### OG Image Compatibility

Risk: Some apps may not render SVG logos or protected/non-absolute image URLs.

Mitigation:

- prefer absolute URLs;
- use product/blog raster images when available;
- add a raster site OG fallback asset before the feature relies on fallback previews.

---

## Recommendation

Proceed in phases:

1. Harden product OG images first.
2. Add email HTML support and a reusable newsletter email template.
3. Add authenticated low-volume sending endpoints, active subscriber count status, and owner failure reports.
4. Add the custom authenticated newsletter page.
5. Add product prefill/send action.
6. Add blog prefill/send action and blog OG fallback hardening.

This keeps the highest-visibility sharing issue separate from the higher-risk sending flow, while still moving toward the exact authenticated owner workflow requested.
