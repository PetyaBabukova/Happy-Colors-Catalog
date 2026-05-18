# Happy Colors - Cookie Consent Design Document

**Date:** 2026-05-18
**Status:** Revised after Opus review
**Scope:** Cookie/privacy notice UX, consent storage, future analytics and marketing script gating, footer access, and policy content structure.
**Non-goal:** This document is not legal advice. Final legal copy should be reviewed by the site owner or a qualified privacy/legal advisor if needed.

---

## Goal

Add a cookie consent experience that is honest for the current catalog site and ready for future analytics and marketing integrations.

The current site does not appear to load analytics, advertising pixels, or third-party marketing trackers. It does use strictly necessary/auth-related cookies for admin flows and local/session storage for client-side state. The consent system must therefore:

- avoid pretending there are optional cookies when none are active yet;
- support analytics and marketing categories before those scripts are added;
- prevent future optional scripts from loading before the visitor has consented;
- give visitors a durable way to change their choice later.

---

## User Decisions

- Use `Хепи Колорс` as the primary Bulgarian spelling of the brand.
- Keep the first popup text universal, so it does not need to change every time a specific cookie/tool is added or removed.
- The site is currently a catalog, not a fully functioning customer shop.
- Login is currently for the owner/admin, not for public customer accounts.
- Marketing and analytics integrations are planned later.
- The UI should include settings because optional analytics/marketing categories are planned.
- The "decline" wording should not imply that strictly necessary cookies can be disabled.
- Consent should be stored in a first-party cookie so server-rendered pages can avoid rendering optional scripts before consent.
- V1 will not add server-side consent audit logging. This keeps the implementation simple and avoids collecting extra personal data. Before activating marketing pixels or other higher-risk tracking, revisit whether a server-side consent evidence log is required.

---

## Compliance-Oriented UX Principles

For EU/GDPR/ePrivacy-style consent, analytics and marketing cookies should be opt-in:

- Necessary cookies/storage: always enabled.
- Analytics: disabled by default.
- Marketing: disabled by default.
- Consent must be recorded before analytics or marketing scripts run.
- "Accept all" and "Only necessary" should be equally available.
- Settings must be available before consent and after consent.
- Users must be able to change or withdraw optional consent later.
- Withdrawal must be as easy as giving consent. The persistent footer link must reopen the same settings panel and expose the "Only necessary" action.
- Respect browser privacy signals where available. If `navigator.globalPrivacyControl === true`, treat optional categories as off even when a previous consent cookie says they were accepted. The visitor can explicitly re-enable optional categories from settings, but GPC must be treated as a withdrawal/opt-out signal until that explicit new choice is made.
- Do not treat `Do Not Track` as a complete consent signal because browser support and semantics are inconsistent, but do not use it to justify loading optional scripts.

---

## Current Storage/Cookie Inventory

Known current usage from local code inspection:

- `token` auth cookie: used for authenticated owner/admin actions.
- `localStorage`: currently used by cart/order/shipping-related code paths, although the public site is operating as a catalog. These paths should not be promoted in public cookie copy while catalog mode is active.
- `sessionStorage`: currently used to avoid repeated payment-success processing in payment-related flows.
- No current Google Analytics, Meta Pixel, TikTok Pixel, Hotjar, Clarity, or similar tracking scripts were found.

Because some storage code belongs to disabled or future commerce flows, public copy should not describe the site as an active shop or emphasize cart/order behavior.

Classification for V1:

- Auth cookie: necessary/security.
- Consent cookie: necessary, because it stores the visitor's privacy choice.
- Catalog-mode localStorage/sessionStorage from inactive commerce flows: functional app state. Do not mention it prominently in the first-layer popup. If customer-facing cart/checkout is re-enabled, update the policy details and reassess whether any of that storage is strictly necessary or should be optional.
- Future analytics tools: analytics, opt-in only.
- Future advertising pixels/remarketing tools: marketing, opt-in only.
- Third-party embeds, maps, videos, external widgets, or hosted fonts must be reviewed before adding them. If they send visitor data to third parties, they must be categorized and gated or documented under an appropriate lawful basis.
- The site is not directed at children under 16. If the target audience changes, revisit age-related consent requirements before adding analytics or marketing tools.

---

## Proposed Visitor Experience

### First Visit Banner/Popup

Show a compact, non-blocking consent banner on first visit, or when the stored consent version is outdated. Avoid a consent wall. Visitors must have an obvious "Only necessary" path and must not be trapped inside a modal before they can browse the site.

Recommended first-layer Bulgarian copy:

```txt
Използваме бисквитки и подобни технологии, за да осигурим коректната работа на сайта и, когато ни дадете съгласие, да анализираме посещенията и да подобряваме съдържанието и рекламните си послания.

Можете да приемете всички, да продължите само с необходимите или да управлявате избора си от настройките. Повече информация има в Политиката за бисквитки.
```

Buttons:

```txt
Приемам всички
Само необходими
Настройки
```

Rationale:

- "Само необходими" is clearer than "Отказвам всички", because necessary cookies/storage cannot realistically be disabled.
- The text is future-ready for analytics/marketing without claiming that specific providers are already active.

### Settings Panel

The settings panel should expose category-level toggles:

```txt
Необходими
```

Always enabled and disabled in the UI.

Suggested description:

```txt
Тези технологии са нужни за коректната и сигурна работа на сайта. Те не могат да бъдат изключени от настройките.
```

```txt
Аналитични
```

Default off.

Suggested description:

```txt
Помагат ни да разбираме как се използва сайтът, за да подобряваме съдържанието и потребителското изживяване.
```

```txt
Маркетингови
```

Default off.

Suggested description:

```txt
Позволяват ни да измерваме и подобряваме рекламните си послания и кампании, когато използваме такива инструменти.
```

Settings actions:

```txt
Запази избора
Приемам всички
Само необходими
```

The settings panel must also link to the cookie policy details and must identify the site/controller at a high level:

```txt
Happy Colors обработва данни чрез бисквитки и подобни технологии според избора ви и описаните по-долу категории.
```

### Footer Access

Add a permanent footer link:

```txt
Бисквитки и настройки за поверителност
```

Clicking it reopens the settings panel, even after consent has already been saved.

The footer can also include a short non-blocking note:

```txt
Използваме бисквитки и подобни технологии за коректна работа на сайта и, при съгласие, за аналитични и маркетингови цели.
```

---

## Consent Data Model

Store consent in a small first-party cookie. This is required so server-rendered pages can know whether optional scripts are allowed before sending HTML to the browser.

Recommended key:

```txt
happy_colors_cookie_consent
```

Recommended shape:

```js
{
  version: 1,
  necessary: true,
  analytics: false,
  marketing: false,
  updatedAt: '2026-05-18T00:00:00.000Z'
}
```

Rules:

- `necessary` is always `true`.
- Missing consent means no optional consent.
- Version mismatch means show the banner again.
- Corrupt JSON means ignore the stored value and show the banner again.
- The consent storage itself is strictly necessary for respecting the visitor's choice.
- Read logic must normalize `necessary` back to `true`, even if a visitor manually tampers with the cookie.
- The cookie should enforce retention with `Max-Age`.
- Read logic should also check `updatedAt` as a defense-in-depth fallback in case the cookie is copied, restored, or malformed by a browser/tool.
- Version bumps should be used for meaningful consent changes, such as a new category, a new vendor, or a material change in purpose. Copy-only changes should not automatically invalidate all consent unless the legal meaning changes.
- `COOKIE_CONSENT_VERSION` in `cookieConsent.js` is the single source of truth for version bumps. Every bump must include a short changelog comment explaining why existing consent must be refreshed.

Recommended retention:

- 6 to 12 months.
- Use 6 months for V1 unless a legal review recommends a longer retention period.
- Set `Max-Age` to 180 days.
- `updatedAt` changes only when the visitor explicitly saves a choice: "Accept all", "Only necessary", or "Save settings". Opening/closing settings must not silently extend consent.

Cookie attributes:

```txt
Path=/
SameSite=Lax
Secure=true in production HTTPS
Secure=false only for local HTTP development
HttpOnly=false
Domain omitted
Max-Age=15552000
```

Rationale:

- `HttpOnly=false` is required because client-side consent logic must read the cookie.
- `Domain` should be omitted so the cookie is scoped to the current host and not wider than necessary.
- `SameSite=Lax` is the minimum default; `Strict` can be considered if it does not break normal navigation.

---

## Frontend Architecture

Proposed files:

```txt
happy-colors-nextjs-project/src/components/privacy/CookieConsentProvider.jsx
happy-colors-nextjs-project/src/components/privacy/CookieConsentBanner.jsx
happy-colors-nextjs-project/src/components/privacy/CookieSettingsModal.jsx
happy-colors-nextjs-project/src/components/privacy/CookieConsent.module.css
happy-colors-nextjs-project/src/config/cookieConsent.js
```

### `cookieConsent.js`

Centralize category definitions, labels, descriptions, consent version, and helper defaults.

Example:

```js
export const COOKIE_CONSENT_VERSION = 1;

export const COOKIE_CATEGORIES = {
  necessary: { required: true },
  analytics: { required: false },
  marketing: { required: false },
};
```

This keeps the UI copy stable while allowing future implementation details to change.

### Provider Responsibilities

The provider should:

- read stored consent from the first-party cookie;
- expose current consent state through context or a small hook;
- show the banner when consent is missing or outdated;
- open settings from the footer link;
- save "accept all";
- save "only necessary";
- save custom settings;
- emit a browser event when consent changes.
- keep multiple tabs in sync, for example with `BroadcastChannel` plus a `storage` event fallback.

Suggested event:

```txt
happy-colors:cookie-consent-changed
```

This event lets future analytics/marketing loaders react without tight coupling.

---

## Script Gating

Optional scripts must only load after consent:

- Analytics scripts load only when `analytics === true`.
- Marketing scripts load only when `marketing === true`.
- No optional third-party scripts should be present in the initial HTML before consent.
- Optional scripts should be injected client-side after hydration, not rendered into shared server HTML. This avoids leaking consent-specific HTML through CDN/page caches.

Future integration example:

```jsx
{consent.analytics && <GoogleAnalytics />}
{consent.marketing && <MetaPixel />}
```

If scripts need to be disabled after consent withdrawal:

- stop future event dispatches;
- remove or disable app-level loaders where possible;
- clear or stop application-owned queues such as `dataLayer` dispatches where possible;
- document that already-set third-party cookies may need browser-side deletion or provider APIs if applicable.

SSR rule:

- Optional `<Script>` tags must never be rendered unconditionally from `layout.js` or other server-rendered entry points.
- V1 and the first analytics/marketing integrations should prefer client-only loaders that read consent after hydration.
- If a future integration must use server-side script rendering based on the consent cookie, the response/cache strategy must be designed first. At minimum, avoid shared URL-only CDN caching for consent-varying HTML, or use an explicit private/vary strategy that cannot serve accepted-consent HTML to visitors without consent.
- If a strict Content Security Policy is added later, analytics/marketing loaders must use the app's nonce/hash strategy.
- Add a code review checklist item for future PRs: no unguarded analytics or marketing scripts in `layout.js`, page files, or third-party widgets.

---

## Policy Content

Add a policy surface that can be opened from the modal and footer.

Preferred V1 implementation:

- A modal section titled `Политика за бисквитки`.
- Later, if the text grows, move it to `/cookies` or `/privacy/cookies`.

Policy should include:

- What cookies and similar technologies are.
- Controller identity at a practical level:
  - site name: Happy Colors;
  - contact email: `happy.colors.bg@gmail.com`;
  - business/legal entity details if/when the owner wants them published.
- Which categories the site may use:
  - necessary;
  - analytics;
  - marketing.
- That necessary technologies support core and secure site operation.
- That the current site may use functional local/session storage in disabled or future commerce-related flows, while the public catalog does not require visitors to create accounts or complete checkout.
- That analytics and marketing are optional and require consent.
- How users can change their choice.
- Contact email for privacy questions.
- Third-party provider details after specific tools are integrated.

Avoid listing hardcoded provider-specific claims in the first-layer popup. Provider details can be added to the policy when Google Analytics, Meta Pixel, or other tools are actually integrated.

The policy details should be rendered as an inline expandable section inside the settings modal, not as a nested modal. This keeps focus management simple and avoids stacked dialog behavior.

---

## Accessibility and UI Requirements

- The modal must use `role="dialog"` and `aria-modal="true"`.
- Focus should move into the modal when it opens.
- Escape closes the settings modal and returns focus to the trigger.
- The first consent prompt should be a non-blocking banner, not a keyboard-trapping consent wall.
- Buttons must be keyboard accessible.
- The banner must not hide essential navigation or content on small screens.
- The UI must be readable on mobile.
- The three primary choices should have comparable visual prominence.
- Avoid dark patterns:
  - no pre-enabled optional toggles;
  - no hidden decline option;
  - no misleading "accept" wording.

---

## Testing Plan

Add unit/component tests for:

- First visit shows the banner.
- Existing valid consent hides the banner.
- Version mismatch shows the banner.
- "Приемам всички" stores analytics and marketing as `true`.
- "Само необходими" stores analytics and marketing as `false`.
- Settings can save custom choices.
- Footer link reopens settings after consent is stored.
- Corrupt storage is handled safely.
- Optional script loader components render only after matching consent.
- Stored `necessary: false` is normalized to `true`.
- Expired consent is treated as missing consent.
- GPC present defaults optional categories to off.
- GPC present plus stored "accept all" treats analytics and marketing as off until a new explicit settings choice is saved.
- Consent changes sync across tabs.
- Initial SSR/HTML output contains no optional analytics or marketing script tags before consent.
- E2E network inspection shows zero analytics/marketing requests before consent and after "Only necessary".
- Withdrawal from accepted optional categories stops future optional event dispatches.
- Withdrawal from tab A stops future optional event dispatches in tab B after cross-tab sync.
- The footer path to "Only necessary" requires no more interaction steps than the first-visit "Accept all" path.
- The consent cookie is written with the documented `Path`, `SameSite`, `Secure`, `Domain`, `HttpOnly`, and `Max-Age` behavior.
- The inline policy details section is keyboard reachable, screen-reader labeled, and does not create a nested dialog.

Manual QA:

- Fresh browser profile.
- Returning visitor with saved consent.
- Consent withdrawal/change.
- Mobile viewport.
- Keyboard navigation.
- Screen reader labels for modal and toggles.
- Staging network log with denied consent.
- Staging network log with analytics consent accepted.
- Staging network log with marketing consent accepted.

---

## Rollout Plan

Phase 1:

- Add consent storage and UI.
- Add footer link.
- Add policy text.
- Do not load any analytics or marketing scripts yet.
- Add tests proving no optional scripts are present before consent.

Phase 2:

- Add analytics provider only behind `analytics` consent.
- Verify no analytics requests fire before consent.
- Verify analytics requests do not fire after consent is withdrawn.
- Update policy with provider details.
- Resolve whether server-side consent evidence logging is needed before the provider goes live.

Phase 3:

- Add marketing pixels only behind `marketing` consent.
- Verify no marketing requests fire before consent.
- Verify marketing requests do not fire after consent is withdrawn.
- Update policy with provider details.
- Resolve whether server-side consent evidence logging is needed before the provider goes live.

---

## Open Questions

- Which analytics provider is planned first?
- Which marketing platform is planned first?
- Should the policy live in a modal only, or should it also have a dedicated route such as `/cookies`?
- Should server-side consent evidence logging be added before the first analytics/marketing provider goes live?
