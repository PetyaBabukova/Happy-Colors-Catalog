# Happy Colors - Newsletter Subscription Implementation Plan

**Date:** 2026-05-18
**Status:** Approved by Opus review; ready for implementation
**Related design document:** `docs/DESIGN-DOC-NEWSLETTER-SUBSCRIPTION.md`
**Goal:** Implement the approved V1 newsletter subscription flow in small reviewable phases: secure public subscribe, frontend footer form, two-step unsubscribe, focused tests, and regression checks for existing contact/order/payment/auth flows.

---

## Fixed V1 Decisions

- Use single opt-in.
- A valid subscription immediately creates or restores an `active` subscriber.
- Do not send a confirmation email.
- Send a welcome email after a new subscription or reactivation. This email confirms the subscription and includes an unsubscribe link, but it is not an opt-in confirmation step.
- Do not implement campaign/newsletter sending UI in V1.
- Do not add Mailchimp, Brevo, MailerLite, Resend, BullMQ, or another newsletter platform/library in V1.
- Use existing dependencies: Mongoose, `validator`, existing rate limiter, and existing frontend manager/test patterns.
- Do not import or reuse `contactsServices.js`.
- Do not change contact, order, payment, auth, checkout, or catalog-mode behavior.
- Keep newsletter route outside `catalogModeGuard`.
- Put the V1 public form in the footer only.
- Extract the current inline footer from `ClientLayout.jsx` into a small Footer component before adding the newsletter form.
- Manage the consent checkbox locally in the newsletter component. Do not change the shared `useForm` hook.
- Use a frontend unsubscribe confirmation page. Opening an email link must not unsubscribe the user.
- Use backend `POST /newsletter/unsubscribe` for the unsubscribe mutation.
- Use signed unsubscribe tokens with `subscriberId`, `unsubscribeTokenVersion`, and `iat`.
- Do not store raw unsubscribe tokens in MongoDB.
- Do not add source tracking in V1.

---

## Phase Summary

1. Baseline and repo guardrails.
2. Backend model, token helper, service, controller, and route.
3. Backend integration and unit tests.
4. Frontend manager, footer extraction, subscribe form, and unsubscribe page.
5. Frontend component tests.
6. Regression checks, external diff review, and release readiness.

Each phase should leave the existing app behavior intact. If a phase reveals an unrelated existing bug, document it separately unless it directly blocks newsletter implementation.

---

## Phase 0 - Baseline And Guardrails

### Goal

Confirm the current worktree, test commands, and relevant implementation patterns before editing feature code.

### Files To Read

```txt
docs/DESIGN-DOC-NEWSLETTER-SUBSCRIPTION.md
server/routes.js
server/middlewares/rateLimit.js
server/models/User.js
server/services/userService.js
server/controllers/contactsController.js
server/__tests__/integration/contacts.test.js
server/__tests__/integration/setup.js
happy-colors-nextjs-project/src/app/ClientLayout.jsx
happy-colors-nextjs-project/src/managers/contactsManager.js
happy-colors-nextjs-project/src/utils/errorHandler.js
happy-colors-nextjs-project/__tests__/components/contacts/ContactForm.test.jsx
```

### Commands

```powershell
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" status --short
npm run test:server
npm run test:frontend
```

### Acceptance

- Dirty/untracked files are known before implementation starts.
- The approved design document exists and is the source of truth.
- No unrelated file is edited.
- The implementation does not rely on the contact form service.

---

## Phase 1 - Backend Newsletter Module

### Goal

Add an isolated backend newsletter module for subscribe and unsubscribe.

### New Files

```txt
server/models/NewsletterSubscriber.js
server/services/newsletterService.js
server/controllers/newsletterController.js
```

### Changed Files

```txt
server/routes.js
.env.test.example
server/__tests__/integration/setup.js
```

Do not commit real secrets. Use a deterministic non-production test value such as `test-newsletter-unsubscribe-secret` in examples and test setup only.

`server/__tests__/integration/setup.js` must set `process.env.NEWSLETTER_UNSUBSCRIBE_SECRET` in `beforeAll` and delete it in `afterAll`, matching the existing cleanup pattern for `JWT_SECRET`, `CLIENT_URL`, and `GCS_BUCKET_NAME`.

### Data Model

Create `NewsletterSubscriber` with:

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

Use timestamps.

Add indexes:

- unique index on `email`;
- non-unique index on `status`.

### Token Implementation

Use Node `crypto`, not a new dependency.

Recommended format:

```txt
base64url(JSON.stringify({ sub, ver, iat })).base64url(hmacSha256(payload, secret))
```

Rules:

- `sub` is the subscriber Mongo id string.
- `ver` is `unsubscribeTokenVersion`.
- `iat` is a Unix timestamp in seconds.
- Use `NEWSLETTER_UNSUBSCRIBE_SECRET`.
- The token helper throws a clear configuration error if `NEWSLETTER_UNSUBSCRIBE_SECRET` is missing.
- Compare signatures with `crypto.timingSafeEqual`.
- Do not log the token.
- Do not put email addresses in the token payload.
- Do not enforce expiry in V1.
- Use URL-safe base64url encoding, for example `Buffer.from(value).toString('base64url')`, not plain base64.

Implementation can keep token helper functions private inside `newsletterService.js`, or export them only if direct unit tests need them.

### Service Behavior

Implement:

```js
subscribeToNewsletter({ email, consent, website })
unsubscribeFromNewsletter({ token })
verifyUnsubscribeToken(token)
createUnsubscribeToken(subscriber)
```

Subscribe rules:

- Reject non-object payloads.
- Reject unknown fields or ignore them consistently. Prefer reject.
- Reject non-string `email`.
- Normalize email with `trim().toLowerCase()`.
- Reject empty or >254-char email.
- Validate with `validator.isEmail`.
- Require `consent === true`.
- If `website` is present and non-empty, do not create a subscriber. Return a generic success response or throw a controlled honeypot error. Prefer generic success to avoid bot feedback.
- If email is active, return generic success without changing `unsubscribeTokenVersion`.
- If email is active but `welcomeEmailSentAt` is null, retry the welcome email.
- If email is unsubscribed, reactivate:
  - `status: "active"`;
  - `consentGivenAt: new Date()`;
  - `unsubscribedAt: null`;
  - increment `unsubscribeTokenVersion`.
  - clear `welcomeEmailSentAt` until the welcome email is sent.
- On duplicate key races, re-read by email and apply the same duplicate behavior.

Welcome email rules:

- Use existing `sendEmail`.
- Send only after new subscription, reactivation, or retry when `welcomeEmailSentAt` is null.
- Include a frontend unsubscribe URL generated from `CLIENT_URL` and `createUnsubscribeToken`.
- Do not send welcome email for honeypot submissions.
- Do not send welcome email for already active subscribers with non-null `welcomeEmailSentAt`.
- Set `welcomeEmailSentAt` only after successful delivery.
- If delivery fails after storing the subscriber, return a controlled server error and keep `welcomeEmailSentAt: null` so a later submit can retry.

Unsubscribe rules:

- Verify the signed token.
- Find subscriber by `sub`.
- Require token `ver` to match current `unsubscribeTokenVersion`.
- If subscriber is already unsubscribed, return generic success.
- If token is invalid, unknown, or stale, return a generic success-style response or controlled 400 without revealing subscriber details. Prefer generic success for UX and privacy.
- Mark active subscriber as:
  - `status: "unsubscribed"`;
  - `unsubscribedAt: new Date()`.

### Controller And Routes

Add:

```txt
POST /newsletter/subscribe
POST /newsletter/unsubscribe
```

Controller rules:

- Accept JSON only.
- Return Bulgarian user-facing `message` strings consistent with existing API style.
- Do not echo submitted email in responses.
- Log unexpected errors without request bodies or tokens.
- Return generic 500 for unexpected errors.

Route mounting in `server/routes.js`:

```js
// Newsletter applies endpoint-specific rate limiters in its controller.
router.use('/newsletter', newsletterController);
```

Do not wrap newsletter routes with `catalogModeGuard`.

Apply endpoint-specific limiters inside `newsletterController.js`:

- subscribe: 5 attempts per 10 minutes per IP;
- unsubscribe POST: 10 attempts per minute per IP.

### Backend Acceptance Criteria

- Valid subscribe creates an active subscriber.
- Valid subscribe sends a welcome email with an unsubscribe link.
- Duplicate active subscribe returns success and creates no duplicate.
- Duplicate active subscribe does not send another welcome email when `welcomeEmailSentAt` is already set.
- Duplicate active subscribe retries welcome email when `welcomeEmailSentAt` is null.
- Unsubscribed email can subscribe again and increments `unsubscribeTokenVersion`.
- Reactivated email receives a new welcome email with a fresh unsubscribe link.
- Invalid email is rejected.
- Missing consent is rejected.
- Honeypot-filled request creates no subscriber.
- Subscribe rate limit is separate from contacts rate limit.
- Unsubscribe POST is rate-limited.
- Valid unsubscribe token marks subscriber as unsubscribed.
- Opening the frontend unsubscribe link alone cannot mutate backend state.
- Invalid/stale unsubscribe token does not reveal whether the email/subscriber exists.
- Newsletter route remains available in catalog mode.
- No contact/order/payment/auth files are changed unless required for tests, and any such change is explicitly justified.

---

## Phase 2 - Backend Tests

### New Or Changed Test Files

```txt
server/__tests__/integration/newsletter.test.js
server/__tests__/unit/services/newsletterService.test.js
server/__tests__/integration/setup.js
```

If test helpers need a factory:

```txt
server/__tests__/integration/factories.js
```

### Integration Tests

Cover:

- `POST /newsletter/subscribe` with valid email and consent returns 200 and creates `active`.
- Valid subscribe sends a welcome email containing `/newsletter/unsubscribe?token=`.
- Email is normalized to lowercase and trimmed.
- Invalid email returns 400 and creates nothing.
- Missing consent returns 400 and creates nothing.
- Honeypot creates nothing and returns generic success.
- Unknown fields are handled according to the chosen contract.
- Duplicate active subscribe returns 200 and leaves one record.
- Duplicate active subscribe with existing `welcomeEmailSentAt` does not resend the welcome email.
- Duplicate active subscribe with null `welcomeEmailSentAt` retries the welcome email.
- Unsubscribed email re-subscribes with a later `consentGivenAt`, null `unsubscribedAt`, and incremented `unsubscribeTokenVersion`.
- Welcome email delivery failure leaves the subscriber active with null `welcomeEmailSentAt`, allowing a later retry.
- Subscribe route has its own rate limit.
- Contact route rate limit is unaffected by newsletter attempts.
- `POST /newsletter/unsubscribe` with valid token marks status `unsubscribed`.
- Reusing the same unsubscribe token is idempotent.
- Stale token after reactivation does not unsubscribe the restored subscriber.
- Invalid token returns generic response and does not mutate any subscriber.
- Newsletter route is not blocked by catalog mode.

### Unit Tests

Cover:

- token generation includes `sub`, `ver`, and `iat`;
- token verification rejects tampered payloads;
- token verification rejects tampered signatures;
- token verification uses the current secret;
- missing `NEWSLETTER_UNSUBSCRIBE_SECRET` throws a clear configuration error;
- subscribe service does not use HTML regex filtering and relies on strict typed fields plus `validator.isEmail`.

### Backend Test Commands

```powershell
Push-Location "server"
npx vitest run newsletter
npx vitest run --project integration newsletter
npx vitest run --project unit newsletter
Pop-Location
npm run test:server
```

Use the full `npm run test:server` script as the final backend verification even when filtered Vitest runs pass.

### Backend Test Acceptance

- New newsletter tests pass.
- Existing contacts integration tests pass.
- Existing `sendEmail` helper tests pass.
- Existing order/payment tests are unchanged unless a shared dependency was touched.

---

## Phase 3 - Frontend Manager And UI

### Goal

Add the public footer subscribe form and unsubscribe confirmation page without changing existing forms or shared hooks.

### New Files

```txt
happy-colors-nextjs-project/src/managers/newsletterManager.js
happy-colors-nextjs-project/src/components/newsletter/NewsletterSubscribeForm.jsx
happy-colors-nextjs-project/src/components/newsletter/NewsletterSubscribeForm.module.css
happy-colors-nextjs-project/src/components/layout/Footer.jsx
happy-colors-nextjs-project/src/components/layout/Footer.module.css
happy-colors-nextjs-project/src/app/newsletter/unsubscribe/page.js
happy-colors-nextjs-project/src/app/newsletter/unsubscribe/NewsletterUnsubscribeClient.jsx
happy-colors-nextjs-project/src/app/newsletter/unsubscribe/newsletterUnsubscribe.module.css
```

If the repo already has a preferred layout component location by implementation time, follow that pattern.

### Changed Files

```txt
happy-colors-nextjs-project/src/app/ClientLayout.jsx
```

Possibly changed if sitemap/robots policy requires it:

```txt
happy-colors-nextjs-project/src/app/robots.js
```

No sitemap change is expected because `sitemap.js` uses an explicit route list and does not include `/newsletter/unsubscribe`. Optionally add `Disallow: /newsletter/unsubscribe` in `robots.js`; this is not required for V1 correctness.

### Manager Behavior

Add:

```js
subscribeToNewsletter({ email, consent, website })
unsubscribeFromNewsletter(token)
```

Rules:

- Use `baseURL` from existing config.
- Use `readResponseJsonSafely`.
- Throw `Error(responseData?.message || fallbackMessage)` on non-OK.
- Do not special-case 429 beyond showing backend message.

### Footer Extraction

Move the current footer markup out of `ClientLayout.jsx` into `Footer.jsx`.

Rules:

- Keep existing copyright and `CookieFooterLink`.
- Keep the external webcreativeteam link.
- Import `CookieConsent.module.css` directly in `Footer.jsx` and keep using `privacyStyles.footerLeftBlock`. Do not copy that class into `Footer.module.css`.
- Use `Footer.module.css` only for new footer/newsletter layout styles.
- Add `NewsletterSubscribeForm` inside Footer.
- Do not change provider ordering in `ClientLayout.jsx`.

### Subscribe Form Behavior

Fields:

- `email`;
- `consent` checkbox;
- hidden `website` honeypot.

State:

- local `email`;
- local `consent`;
- local `website`;
- local `status`/`message`;
- local `isSubmitting`.

Rules:

- Do not use or modify `useForm`.
- Client-side validate email is present.
- Client-side validate consent is checked.
- Use `type="email"` for browser affordance, but rely on backend validation for authority.
- Disable submit while submitting.
- On success, clear email, consent, and website.
- On error, keep email and consent.
- Show backend-provided message for 400/429/500.
- Do not render any submitted value as HTML.

### Unsubscribe Page Behavior

Route:

```txt
/newsletter/unsubscribe?token=...
```

Behavior:

- `page.js` remains a server component, reads `searchParams.token`, and passes the token as a prop to `NewsletterUnsubscribeClient`.
- Because the project uses Next.js 15+, implement `page.js` as an async server component and `await searchParams` before reading `.token`.
- If token is missing, show a generic invalid-link state.
- Do not call the backend on page load.
- Show a confirmation button.
- On button click, call `unsubscribeFromNewsletter(token)`.
- Show success message from backend.
- Do not show token in visible UI.
- Do not log token.

### Frontend Acceptance Criteria

- Footer appears on existing pages with existing content preserved.
- Newsletter form is visible in the footer.
- Submitting valid data calls `/newsletter/subscribe`.
- Missing email is blocked client-side.
- Missing consent is blocked client-side.
- Honeypot field exists but is not visible to normal users.
- Backend errors display as user-facing messages.
- Unsubscribe page does not mutate on load.
- Unsubscribe mutation happens only after explicit button click.
- Existing contact form UI and tests remain unchanged.

---

## Phase 4 - Frontend Tests

### New Or Changed Test Files

```txt
happy-colors-nextjs-project/__tests__/unit/managers/newsletterManager.test.js
happy-colors-nextjs-project/__tests__/components/newsletter/NewsletterSubscribeForm.test.jsx
happy-colors-nextjs-project/__tests__/components/newsletter/NewsletterUnsubscribeClient.test.jsx
happy-colors-nextjs-project/__tests__/components/layout/Footer.test.jsx
```

If the project groups layout tests elsewhere, follow the existing convention.

### Test Cases

Manager:

- subscribe posts to `/newsletter/subscribe`;
- unsubscribe posts to `/newsletter/unsubscribe`;
- non-OK responses throw backend message;
- malformed JSON responses use fallback message.

Subscribe form:

- requires email;
- requires consent;
- sends `{ email, consent: true, website: '' }`;
- disables button while submitting;
- clears fields after success;
- preserves email on error;
- renders generic 429/backend error message;
- honeypot field is hidden from normal layout.

Footer:

- renders existing copyright/cookie/external link content;
- renders newsletter form.

Unsubscribe client:

- missing token shows invalid link state;
- valid token does not call backend on initial render;
- clicking confirm calls unsubscribe manager once;
- success and error states render correctly.

### Frontend Test Commands

```powershell
Push-Location "happy-colors-nextjs-project"
npx vitest run newsletter
npx vitest run --project unit newsletter
npx vitest run --project components newsletter
Pop-Location
npm run test:frontend
```

Use the full `npm run test:frontend` script as the final frontend verification even when filtered Vitest runs pass.

Use the exact supported Vitest filter syntax if needed.

---

## Phase 5 - Regression And External Review

### Local Diff Inspection

```powershell
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" diff --stat
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" diff
```

### Required Regression Commands

Run at minimum:

```powershell
npm run test:server
npm run test:frontend
npm run build
```

If time permits or if shared behavior changed:

```powershell
npm test
npm run test:coverage
```

### External Review

Use Claude/Opus or the default Claude CLI review on the implementation diff:

```powershell
git -c safe.directory="E:/web_projects/Happy-Colors/Happy-Colors-Repo" diff | claude --model opus -p "Review this newsletter subscription implementation diff for bugs, regressions, security issues, and missing tests. Focus on subscribe/unsubscribe security, token handling, rate limits, frontend UX, and whether existing contact/order/payment/auth flows are accidentally changed. Give concise, actionable findings with file paths and line references where possible."
```

Apply valid findings and repeat review until no blocking findings remain.

### Regression Acceptance Criteria

- Newsletter tests pass.
- Existing contacts tests pass.
- Existing frontend contact form tests pass.
- Existing `sendEmail` helper tests pass.
- Build passes.
- External review has no blocking findings.
- Any remaining non-blocking findings are documented with rationale.

---

## Phase 6 - Release Notes And Manual QA

### Manual QA Checklist

- Subscribe from footer with a valid email.
- Subscribe with mixed-case email and verify normalized DB value.
- Subscribe same email twice and verify no duplicate.
- Subscribe with invalid email and verify user-facing error.
- Try submitting without consent and verify user-facing error.
- Verify honeypot-filled request does not create a subscriber.
- Generate an unsubscribe URL in a controlled test and open it.
- Confirm that merely opening unsubscribe page does not change DB status.
- Click confirm and verify DB status becomes `unsubscribed`.
- Re-subscribe the same email and verify status becomes `active` and old token is stale.
- Confirm `/contacts` still submits normally.
- Confirm checkout/order/payment smoke paths are unaffected if testable in the environment.

### Release Notes

Mention:

- Added footer newsletter subscription form.
- Added secure single opt-in backend subscription storage.
- Added two-step unsubscribe flow.
- Added rate limiting and honeypot protection.
- No newsletter campaign sending is included yet.
- A welcome email is sent for new and reactivated subscribers.

---

## Risks And Mitigations

### Single Opt-In Email Bombing

Risk: Someone can subscribe another person's email.

Mitigation:

- consent checkbox;
- honeypot;
- rate limiting;
- unsubscribe link in every future email;
- future double opt-in remains possible.

### Email Scanner Unsubscribe

Risk: Email security scanners open links.

Mitigation:

- email link opens frontend confirmation page only;
- backend mutation requires explicit POST from button click.

### Token Leakage

Risk: Leaked unsubscribe URL can unsubscribe someone.

Mitigation:

- token cannot reveal email;
- token cannot access data;
- re-subscribe increments version and invalidates old links;
- no token logging.

### Existing Flow Regression

Risk: Shared layout, rate limits, or helper changes affect current app flows.

Mitigation:

- separate newsletter route and limiter;
- no `useForm` changes;
- no contact service changes;
- Footer extraction tests;
- contacts/sendEmail/order/payment regression tests.

---

## Implementation Checklist

- [ ] Confirm baseline status.
- [ ] Add `NewsletterSubscriber` model.
- [ ] Add newsletter token helpers.
- [ ] Add newsletter service.
- [ ] Add newsletter controller.
- [ ] Mount newsletter routes with separate limiters.
- [ ] Add env/test secret guidance.
- [ ] Add backend tests.
- [ ] Add frontend newsletter manager.
- [ ] Extract Footer component.
- [ ] Add footer subscribe form.
- [ ] Add frontend unsubscribe page.
- [ ] Add frontend tests.
- [ ] Run server tests.
- [ ] Run frontend tests.
- [ ] Run build.
- [ ] Run Opus implementation diff review.
- [ ] Address valid review findings.
- [ ] Complete manual QA checklist.

---

## Out Of Scope For This Implementation

- Campaign editor.
- Campaign sending UI.
- Subscriber admin panel.
- Bulk sending queue.
- HTML email support in `sendEmail`.
- External newsletter provider integration.
- Blog `newsletterReady` / `newsletterSentAt` wiring.
- Multiple form placements and source tracking.

---

## Approval Criteria

The implementation plan is approved when:

- it matches `docs/DESIGN-DOC-NEWSLETTER-SUBSCRIPTION.md`;
- it has no blocking security gaps;
- it has no contradictions around single opt-in or unsubscribe behavior;
- it keeps existing contact/order/payment/auth behavior isolated;
- Opus review returns no blocking findings.
