# Happy Colors - Newsletter Subscription Design Document

**Date:** 2026-05-18
**Status:** Approved by Opus review; no blocking issues remain
**Scope:** Public "Subscribe to news" form, backend subscription storage, unsubscribe flow, future email sending integration, security controls, and regression boundaries.
**Decision:** V1 uses single opt-in. A subscriber becomes active immediately after submitting a valid email and consent.

---

## Goal

Add a small newsletter subscription feature to Happy Colors without changing existing contact, order, payment, auth, checkout, catalog, blog, or homepage behavior.

Visitors can enter an email address, give explicit consent, and become active subscribers immediately. Every future newsletter email must include an unsubscribe link.

After a new subscription or reactivation, the system sends a welcome email confirming the subscription and including an unsubscribe link. This is not a confirmation step and does not change the single opt-in decision.

V1 intentionally avoids a full newsletter platform, campaign builder, queue system, or double opt-in flow because the project currently has no subscribers and should start with the smallest secure implementation.

---

## Current User Decisions

- Use a public "Абонирай се за новини" form.
- Use single opt-in:
  - no `pending` status;
  - no confirmation email;
  - no "confirm subscription" click;
  - the subscriber becomes `active` immediately after valid submit.
- Every newsletter email must include an unsubscribe link.
- New and reactivated subscribers receive a welcome email with an unsubscribe link.
- Reuse the existing email sending infrastructure used by the contact form where appropriate.
- Do not couple newsletter business logic to the contact form service.
- Security is a core requirement: the public form must not allow malicious input to break the site, inject HTML/script, or abuse email sending.
- Consider free libraries/tools, but avoid unnecessary platform complexity while there are no subscribers.
- Keep the new feature isolated so it does not break existing features.

---

## Non-Goals

- No double opt-in in V1.
- No Mailchimp, Brevo, MailerLite, Resend, or other external newsletter platform in V1.
- No newsletter campaign editor in V1.
- No bulk sending queue in V1.
- No newsletter campaign sending UI in V1 unless separately requested.
- No subscriber admin panel in V1 unless separately requested.
- No rich text input from the public subscription form.
- No change to the contact form endpoint or payload.
- No change to order, payment, auth, checkout, or catalog mode behavior.

---

## Existing Context

### Frontend

- Next.js App Router lives in `happy-colors-nextjs-project/src/app`.
- Existing frontend managers live in `happy-colors-nextjs-project/src/managers`.
- Contact form UI is implemented separately in `happy-colors-nextjs-project/src/components/contacts/ContactForm.jsx`.
- Existing form validation helpers live in `happy-colors-nextjs-project/src/utils/formValidations.js`.
- Existing API manager pattern can be followed with a new `newsletterManager.js`.
- `happy-colors-nextjs-project/src/hooks/useForm.js` reads `e.target.value` and does not currently handle checkbox `checked` state.
- The footer currently lives inline in `happy-colors-nextjs-project/src/app/ClientLayout.jsx`.

### Backend

- Express API routes are mounted from `server/routes.js`.
- Existing contact route is mounted at `/contacts` and rate-limited separately.
- Email sending is centralized in `server/helpers/sendEmail.js`.
- The contact service uses `sendEmail` from `server/services/contactsServices.js`.
- Orders and payments also use `sendEmail`, so this helper is already a shared email boundary.
- Rate limiting middleware exists in `server/middlewares/rateLimit.js`.
- Mongo models use Mongoose in `server/models`.
- `server/server.js` currently uses the default `express.json()` body limit. Express defaults to about 100KB, which is more than enough for this tiny payload.
- `server/models/BlogArticle.js` already has `newsletterReady` and `newsletterSentAt` fields. V1 subscription storage must not automatically wire into those fields.
- Catalog mode currently blocks orders, payments, and delivery, but newsletter subscription is informational and should remain available in catalog mode.

---

## Proposed User Experience

### Placement

V1 should use a quiet inline form rather than a popup. Good placements:

- homepage near the lower content area;
- site footer;
- blog page/sidebar later, if blog/news content becomes active.

The first version can start in one place only, preferably footer or homepage lower section.

### Form Fields

Visible fields:

- email input;
- required consent checkbox;
- submit button.

Hidden anti-bot field:

- `website` honeypot input, visually hidden and left blank by real users.

Example copy:

- Title: `Абонирай се за новини`
- Supporting text: `Получавай новини за нови продукти, идеи и обновления от Happy Colors.`
- Email placeholder: `you@example.com`
- Consent: `Съгласявам се да получавам новини и имейл известия от Happy Colors.`
- Button: `Абонирай се`
- Success: `Успешно се абонирахте. Благодарим!`
- Already active: return the same success-style message to avoid account enumeration.
- Error: `Не успяхме да запишем абонамента. Моля, опитайте отново.`

### Frontend States

- idle;
- submitting;
- success;
- validation error;
- backend error;
- rate-limited error.

The form should not clear the email until the request succeeds. On success, clear the input and uncheck consent.

---

## API Design

### Subscribe

```http
POST /newsletter/subscribe
Content-Type: application/json
```

Request body:

```json
{
  "email": "user@example.com",
  "consent": true,
  "website": ""
}
```

Rules:

- `email` is required.
- `consent` must be exactly `true`.
- `website` must be empty or missing.
- Unknown fields are ignored or rejected. Prefer reject for a stricter contract.

Success response:

```json
{
  "message": "Успешно се абонирахте."
}
```

Error examples:

- `400` invalid email or missing consent;
- `429` too many attempts;
- `500` unexpected server error.

### Unsubscribe

Public email unsubscribe links should point to the frontend, for example:

```txt
${CLIENT_URL}/newsletter/unsubscribe?token=...
```

Email clients and security scanners may prefetch links from email bodies. For that reason, opening the link must not perform the unsubscribe mutation directly.

Recommended two-step flow:

1. Frontend route `/newsletter/unsubscribe?token=...` renders a confirmation page with a button.
2. The confirmation button submits the token to the backend API.

Backend mutation endpoint:

```http
POST /newsletter/unsubscribe
Content-Type: application/json
```

```json
{
  "token": "raw-token-from-email-link"
}
```

The `POST` endpoint marks the subscriber as `unsubscribed` and returns JSON. The frontend page owns the final success or error UI.

Unsubscribe responses should be generic. If a token is unknown or already used, do not reveal subscriber details.

---

## Data Model

New model:

```txt
server/models/NewsletterSubscriber.js
```

Proposed schema:

```js
{
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
  },
  status: {
    type: String,
    enum: ['active', 'unsubscribed'],
    default: 'active',
    index: true,
  },
  consentGivenAt: {
    type: Date,
    required: true,
  },
  unsubscribedAt: {
    type: Date,
    default: null,
  },
  unsubscribeTokenVersion: {
    type: Number,
    default: 1,
  },
  welcomeEmailSentAt: {
    type: Date,
    default: null,
  },
}
```

Use Mongoose timestamps for `createdAt` and `updatedAt`.

### Duplicate Behavior

- If email exists with `status: "active"`, return success without changing `unsubscribeTokenVersion`.
- If email exists with `status: "unsubscribed"`, reactivate only when the user submits the form again with consent.
- On reactivation, set:
  - `status: "active"`;
  - new `consentGivenAt`;
  - `unsubscribedAt: null`;
  - increment `unsubscribeTokenVersion` to invalidate old unsubscribe links.
  - reset `welcomeEmailSentAt` until the new welcome email is delivered.

### Source Tracking

Do not add a `source` field in V1 if the form is placed in only one location. Add source tracking later when there are at least two meaningful placements, such as footer and blog.

---

## Backend Modules

Add isolated newsletter modules:

```txt
server/models/NewsletterSubscriber.js
server/services/newsletterService.js
server/controllers/newsletterController.js
```

Route mount:

```js
router.use('/newsletter', newsletterLimiter, newsletterController);
```

The newsletter service owns subscription and unsubscribe business logic.

Do not create a separate `newsletterEmailService.js` until newsletter sending is actually implemented. When sending is added, the sending service may import:

```js
import { sendEmail } from '../helpers/sendEmail.js';
```

Do not import or reuse `contactsServices.js`; that service is specific to contact form admin notifications.

---

## Email Sending Strategy

### V1

The subscription V1 sends a welcome email after a new subscription or reactivation. The email must say that the user subscribed to Happy Colors news, thank them, and include a link to the frontend unsubscribe confirmation page.

If a welcome email fails after the subscriber is stored, leave `welcomeEmailSentAt: null` so a later duplicate submit can retry the welcome email. Once the welcome email is sent, set `welcomeEmailSentAt`.

V1 does not send campaign/newsletter broadcast emails.

When newsletter sending is added, use the existing shared helper:

```txt
server/helpers/sendEmail.js
```

This keeps the implementation small and consistent with current contact/order/payment email behavior.

The first future newsletter sending implementation should be suitable for low volume. Gmail/nodemailer is acceptable for early usage and internal/manual sends.

`sendEmail` currently supports plain-text email through a `text` field. A plain-text unsubscribe URL is acceptable for the first low-volume newsletter send. If HTML newsletters or button-style unsubscribe links are required, extend `sendEmail` with an optional `html` field in a backward-compatible way and add regression tests for existing callers.

### Future Upgrade Path

If the subscriber list grows or deliverability matters more, replace the internals of the future newsletter sending service with:

- Brevo;
- Mailchimp;
- MailerLite;
- Resend;
- Postmark;
- queued batch sending through BullMQ or similar.

The public form and subscriber model should not need major changes for that migration.

---

## Security Design

The public form accepts only a small strict payload. This is the main defense.

### Input Validation

Backend validation must:

- require JSON requests;
- enforce a small body size limit through existing Express JSON config or route-level middleware;
- require `email` to be a string;
- trim and lowercase email;
- reject emails longer than 254 characters;
- validate email with the existing `validator` dependency rather than only a hand-written regex;
- require `consent === true`;
- require honeypot `website` to be empty when present;
- reject or ignore unknown fields.

### XSS and Injection Prevention

- The public form must not accept name, message, HTML, rich text, markdown, or arbitrary content.
- Never render public subscription input as HTML.
- If email is shown later in an admin UI, render it as text, not `dangerouslySetInnerHTML`.
- Do not interpolate user input into newsletter HTML without escaping.
- Newsletter content must come from trusted admin-controlled content only.
- If a future rich text newsletter editor is added, sanitize with an allowlist before sending or rendering.

### Token Handling

- Generate unsubscribe links as signed server tokens, not as raw email addresses.
- Recommended token payload: subscriber id plus `unsubscribeTokenVersion`.
- Sign the payload with a server secret such as `NEWSLETTER_UNSUBSCRIBE_SECRET`.
- Include `iat` in the signed payload even if V1 does not enforce expiry. This preserves the option to add max-age rules later without changing the token format.
- Do not store raw unsubscribe tokens in MongoDB.
- Do not log unsubscribe tokens.
- Do not put subscriber email addresses in unsubscribe URLs.
- Increment `unsubscribeTokenVersion` when an unsubscribed user subscribes again.
- Do not expire unsubscribe links by default; an old email should still let the user unsubscribe. A leaked token can unsubscribe the user, but cannot access account data or perform privileged actions.
- Add `NEWSLETTER_UNSUBSCRIBE_SECRET` to environment configuration and sample env documentation if present. The newsletter token helper should fail with an explicit configuration error if the secret is missing.

### Abuse Controls

- Add a dedicated newsletter rate limiter, separate from contacts/orders/payments.
- Suggested limit: 5 attempts per 10 minutes per IP for subscribe.
- Add a basic rate limit for unsubscribe `POST`, for example 10 attempts per minute per IP, even though signed tokens make brute force impractical.
- Add honeypot field.
- Return generic success for already-active emails to reduce account enumeration.
- Keep server logs useful but avoid logging raw tokens or full request bodies.
- Do not copy the current contact controller's forbidden HTML regex pattern with the `/g` flag. Global regex `.test()` is stateful in JavaScript and can produce inconsistent results across repeated calls.
- Do not add an HTML/script-tag regex check to the subscribe endpoint. There is no free-text field; validation should be type-based and email-based.

### Email Bombing Risk

Single opt-in means someone can submit another person's email. V1 accepts that tradeoff because:

- the user explicitly requested no confirmation step;
- every email will include an unsubscribe link;
- rate limiting and honeypot reduce automated abuse;
- future double opt-in remains possible if abuse or deliverability issues appear.

---

## Free Library and Tool Decision

Do not add a newsletter platform or queue library in V1.

Use existing dependencies and infrastructure:

- `nodemailer` through `sendEmail`;
- `validator` for email validation;
- existing rate limiter;
- Mongoose/MongoDB.

Use `validator.isEmail` for newsletter backend validation even though the existing contact controller and some frontend helpers use regex validation. Do not copy the contact controller email validation pattern.

Do not add `sanitize-html` or `DOMPurify` for the public subscribe form, because the form does not accept rich text or HTML. Add a sanitizer only if a future admin newsletter editor accepts rich text.

Do not add BullMQ or another queue until the list size or sending volume justifies it.

---

## Regression Boundaries

The new feature must not change:

- `server/helpers/sendEmail.js` behavior unless required and separately reviewed;
- `server/services/contactsServices.js`;
- `server/controllers/contactsController.js`;
- `/contacts` route contract;
- contact form frontend payload;
- order creation;
- payment session/webhook behavior;
- auth behavior;
- checkout behavior;
- catalog mode guard behavior.

The only shared dependency should be the existing `sendEmail` helper, used from a new newsletter-specific service.

Suggested route structure:

```txt
contacts -> contactsController -> contactsServices -> sendEmail
newsletter -> newsletterController -> newsletterService
future newsletter sending -> newsletter sending service -> sendEmail
orders/payments -> existing services -> sendEmail
```

Use a separate newsletter rate limiter so subscribe attempts cannot consume the contact form quota.

Do not put the newsletter route behind `catalogModeGuard`; users should be able to subscribe even when the shop is in catalog mode.

For the frontend, avoid changing the shared `useForm` hook just to support the consent checkbox. Manage the checkbox in the newsletter component state. If `useForm` is extended later, add regression tests for existing forms.

If placing the form in the footer, prefer extracting a small `<Footer />` component rather than growing `ClientLayout.jsx` with form state and submit logic.

---

## Testing Plan

### Backend Integration Tests

Add tests for:

- valid subscribe creates an active subscriber;
- duplicate active subscribe returns success and does not create a duplicate;
- unsubscribed email can subscribe again with new consent;
- invalid email is rejected;
- missing consent is rejected;
- honeypot submission is ignored or rejected without creating a subscriber;
- unsubscribe token marks subscriber as unsubscribed;
- unknown unsubscribe token returns generic response;
- rate limiting applies to subscribe and unsubscribe routes.

### Backend Unit Tests

Add tests for:

- email normalization;
- signed unsubscribe token generation and verification;
- future newsletter sending appends unsubscribe URL when sending is implemented.

### Frontend Tests

Add component tests for:

- required email validation;
- required consent validation;
- successful submit state;
- backend error state;
- honeypot field is present but not visible to normal users.
- 429 responses show the backend-provided generic error message consistently.

### Regression Tests

Run existing relevant tests:

- contacts integration tests;
- `sendEmail` helper tests;
- existing `sendEmail` callers still work if the helper signature is extended with optional `html`;
- order/payment email-adjacent tests if affected;
- frontend contact form tests;
- full build or relevant test command before merge.

---

## Rollout Plan

1. Add backend model, service, controller, and route with rate limiting.
2. Add backend tests.
3. Add frontend manager and newsletter form component.
4. Place the component in the chosen site area.
5. Add frontend tests.
6. Verify existing contact form tests still pass.
7. Run external diff review before implementation merge.

---

## Open Questions

- Final placement: footer, homepage lower section, or both?
- Should newsletter sending be exposed later through an authenticated admin action, a script, or an external provider once there are subscribers?

---

## Recommendation

Implement V1 as a small isolated module with strict input validation, single opt-in, signed unsubscribe tokens, and no dependency on the contact form service.

This matches the current business stage: no subscribers yet, no need for a full external newsletter platform, but enough security and architecture to avoid painting the project into a corner.
