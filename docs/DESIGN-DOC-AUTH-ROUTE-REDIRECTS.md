# Happy Colors - Auth-Only Route Redirect Design Document

**Date:** 2026-05-18
**Status:** Revised after Opus review
**Scope:** Frontend UX guard for routes that are intended only for the logged-in owner/admin.
**Non-goal:** This document does not introduce public user roles, customer accounts, or a new authorization model.

---

## Goal

When a visitor opens a route that is available only to the logged-in owner/admin, the UI should:

- show the existing red notification that the page is not accessible without login;
- redirect the visitor to the login form after a short delay;
- preserve the originally requested internal route so successful login can return the owner/admin there;
- keep all public catalog and blog reading pages visible to everyone.

This is a UX improvement and consistency pass. Backend authentication and authorization remain the real security boundary for create, edit, and delete actions.

---

## Current Situation

The project currently uses a client-side auth context:

- `src/context/AuthContext.jsx` fetches the current user from `${baseUrl}/users/me` with `credentials: 'include'`.
- `useAuth()` exposes `user`, `loading`, `setUser`, and `refreshUser`.
- `src/app/ClientLayout.jsx` wraps the app in `AuthWrapper`.
- Several admin pages check `useAuth()` locally.

The existing behavior is inconsistent:

- Some admin routes redirect to `/users/login` immediately.
- Some admin routes only show `MessageBox` and stay on the same page.
- Some public pages use `useAuth()` only to show admin buttons, and must stay public.
- The login form currently redirects to `/products` after success, without considering the route the user originally tried to open.

---

## Design Principles

- Public reading pages must stay public.
- Create, edit, delete, and admin management pages must require login.
- The user should see a clear notification before being moved to login.
- The redirect should not create loops.
- The redirect target must be sanitized so login cannot become an open redirect.
- The solution should be reusable instead of duplicating auth checks in every admin component.
- The frontend guard must not replace backend checks. API calls that mutate data must continue to require authenticated requests.

---

## Route Classification

### Public Routes

These routes should remain visible without login:

- `/`
- `/aboutus`
- `/blog`
- `/blog/[articleId]`
- `/products`
- `/products/[productId]`
- `/contacts`
- `/faq`
- `/partners`
- `/search`
- `/users/login`
- `/users/logout`
- `/users/register` in development only. In production the route already returns `notFound()`, so this task should not make it publicly usable.

`/cart` and `/checkout` are catalog-mode routes at the moment and should not be changed by this task unless a separate catalog/checkout decision is made.

Checkout subroutes should also stay outside this owner/admin redirect task:

- `/checkout/shipping` currently redirects back to `/checkout`;
- `/checkout/payment-success` and `/checkout/payment-cancel` are payment-flow routes and should be handled only by checkout/catalog-mode logic.

`/users/logout` can remain reachable without an extra owner/admin guard. It should not redirect guests to login. If it is touched during implementation, verify that a missing/expired session does not leave the visitor stuck on the logout page; a `401` from logout should still clear local auth state and route to a safe public page.

### Owner/Admin-Only Routes

These routes should show the red notification and then redirect to login when opened by a guest:

- `/users`
- `/blog/create`
- `/blog/[articleId]/edit`
- `/products/create`
- `/products/[productId]/edit`
- `/products/[productId]/delete`
- `/categories`
- `/categories/create`
- `/categories/[categoryId]/edit`
- `/categories/delete`
- `/home-banners/create`
- `/home-banners/[bannerId]/edit`
- `/homepage-featured`

`/categories` is intentionally classified as owner/admin-only because the current route renders `CategoriesClientPage`, an internal category management screen with edit/delete controls, not a public category browsing page.

Public detail pages that merely contain owner/admin controls, such as product details or blog article details, must not be wrapped with this guard. They should continue to render for guests and hide edit/delete controls when there is no authenticated user.

---

## Proposed Architecture

### Add a Reusable Client Guard

Create a client component:

`src/components/auth/RequireAuth.jsx`

Suggested API:

```jsx
<RequireAuth message="Трябва да сте логнати, за да създадете блог статия.">
  <CreateBlogArticleForm />
</RequireAuth>
```

Responsibilities:

- read `user` and `loading` from `useAuth()`;
- show a loading state while auth is being checked;
- treat `loading === true` or `user === undefined` as the initial auth-checking state;
- render `children` only when `user` is truthy;
- render `MessageBox type="error"` when there is no user;
- after a short delay, redirect to login with a sanitized `redirect` query parameter;
- clear the redirect timer on unmount;
- cancel the pending redirect if `user` becomes truthy before the timer fires, for example after a cross-tab login and auth refresh.

Recommended default message:

`Тази страница е достъпна само след вход. Пренасочваме Ви към формата за вход.`

Recommended default delay:

`1200ms`

This keeps the red notification visible long enough to be understood, but does not leave the visitor stuck.

The implementation should pin this as the V1 delay unless we deliberately change it during implementation. On slow connections, the visitor may first see the auth loading state while `/users/me` resolves, then the red notification for `1200ms`.

### Preserve Requested Route

For a guest opening:

`/blog/create`

redirect to:

`/users/login?redirect=%2Fblog%2Fcreate`

For a guest opening:

`/products/123/edit?tab=images`

redirect to:

`/users/login?redirect=%2Fproducts%2F123%2Fedit%3Ftab%3Dimages`

The guard can build this from `usePathname()` and `useSearchParams()`.

Because `useSearchParams()` can require a `<Suspense>` boundary in statically rendered App Router routes, V1 should prefer building the current URL inside a client effect from:

```js
window.location.pathname + window.location.search + window.location.hash
```

If the implementation uses `useSearchParams()` instead, the affected route must be wrapped in an explicit `<Suspense>` boundary and verified with `npm run build`.

### Sanitize Redirect Targets

The login route must never navigate to external URLs from the `redirect` parameter.

Allowed redirect values:

- start with `/`;
- do not start with `//`;
- do not normalize to another origin;
- do not use backslash-prefixed or protocol-relative variants such as `\\evil.com`, `/\evil.com`, or `//evil.com`;
- do not accept control characters or leading/trailing whitespace as a bypass;
- do not accept case-insensitive dangerous schemes such as `javascript:` or `data:`;
- are not `/users/login` itself.

If the redirect value is missing or invalid, use a safe fallback, preferably `/products` or `/`.

This sanitizer should be a small shared helper so both `RequireAuth` and `LoginClientPage` use the same rules.

Suggested helper:

`src/utils/authRedirect.js`

Suggested functions:

- `getSafeRedirectPath(value, fallback = '/products')`
- `buildLoginRedirectUrl(currentPathWithQuery)`

Recommended sanitizer approach:

```js
export function getSafeRedirectPath(value, fallback = '/products', origin) {
  if (typeof value !== 'string') return fallback;

  const baseOrigin =
    origin ||
    (typeof window !== 'undefined' ? window.location.origin : null);

  if (!baseOrigin) return fallback;

  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return fallback;
  if (trimmed.includes('\\')) return fallback;

  try {
    const parsed = new URL(trimmed, baseOrigin);
    if (parsed.origin !== baseOrigin) return fallback;

    const normalizedPath = parsed.pathname
      .replace(/\/+$/, '')
      .toLowerCase();

    if (
      normalizedPath === '/users/login' ||
      normalizedPath.startsWith('/users/login/')
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
```

The sanitizer should normally be called from client-only effects or event handlers. If it is ever imported by code that can run during server render, pass an explicit `origin` in tests/server code or let it return the fallback when `window` is unavailable.

The implementation should account for `URLSearchParams.get('redirect')` decoding once before the sanitizer receives the value. Encoded protocol-relative or backslash values such as `%2F%2Fevil.com` and `%5C%5Cevil.com` must still be rejected after decoding.

### Update Login Success Behavior

Update `src/app/users/login/LoginClientPage.jsx` so successful login redirects to the sanitized `redirect` query parameter when present.

Current behavior:

```jsx
router.push('/products');
```

Proposed behavior:

```jsx
if (user) {
  router.replace(getSafeRedirectPath(redirectParam, '/products'));
}
```

Use `replace` after login so the browser back button does not immediately return to the login form.

The redirect should be gated on `user` becoming truthy, not only on the current `success` flag. `onLoginSubmit` sets auth state separately from the success message, and navigating before `AuthContext.user` updates can send the owner/admin back to the protected route while the guard still sees a guest state. That creates a flash of the red message or a redirect loop.

If an already logged-in owner opens `/users/login?redirect=/blog/create`, the login page should send them to the sanitized redirect target only after `loading === false && user` is truthy. If the redirect target is missing or invalid, fall back to `/products`.

### Apply Guard at Page/Client Boundary

Use the guard at the top of admin-only route components or page-level client components. Keep form components focused on form behavior.

Example:

```jsx
export default function CreateBlogArticleClient() {
  return (
    <RequireAuth message="Трябва да сте логнати, за да създадете блог статия.">
      <BlogArticleForm mode="create" />
    </RequireAuth>
  );
}
```

For pages that currently fetch protected/admin data inside `useEffect`, the guard should prevent those fetches from running before authentication is known. If that is not practical in a specific file, keep the existing `loading` check and only fetch after `user` exists.

### File-Level Application Checklist

Apply the guard to these route-level files or their matching client page components:

- `src/app/users/page.js`
- `src/app/blog/create/CreateBlogArticleClient.jsx`
- `src/app/blog/[articleId]/edit/EditBlogArticleClient.jsx`
- `src/app/products/create/CreateProductClient.jsx`
- `src/app/products/[productId]/edit/EditProductClient.jsx`
- `src/app/products/[productId]/delete/DeleteProductClient.jsx`
- `src/app/categories/CategoriesClientPage.jsx`
- `src/app/categories/create/page.js` or a new client wrapper around `CreateCategory`
- `src/app/categories/[categoryId]/edit/EditCategoryClient.jsx`
- `src/app/categories/delete/page.js`
- `src/app/home-banners/create/CreateHomeBannerClient.jsx`
- `src/app/home-banners/[bannerId]/edit/EditHomeBannerClient.jsx`
- `src/app/homepage-featured/HomepageFeaturedClient.jsx`

Do not wrap:

- `src/app/blog/page.js`
- `src/app/blog/[articleId]/page.js`
- `src/app/products/page.js`
- `src/app/products/[productId]/page.js`
- public pages that only conditionally show admin controls.

If an admin route is currently a server component, add or reuse a small client wrapper that renders `RequireAuth` and then the existing form/client component. A client guard cannot block server-side data fetching that happens before hydration, so admin data fetches for guarded routes should happen inside client components after auth resolves, or they should remain protected by backend auth if server-side fetching is later introduced.

During implementation, audit every file in the checklist for server-side admin data fetching before wrapping it. In particular, `src/app/categories/create/page.js` and `src/app/categories/delete/page.js` are server component route shells today; they should either remain thin shells around guarded client components or be converted to a guarded client wrapper if needed. They must not fetch or expose admin-only data before the guard runs.

---

## Backend/API Boundary

This task should not weaken backend security.

The following must remain true:

- create, edit, and delete API requests use `credentials: 'include'` where required;
- backend routes keep their existing auth checks;
- a guest cannot mutate products, categories, homepage banners, or blog articles by bypassing the UI;
- frontend redirect behavior is treated only as UX, not as authorization.

As part of implementation review, verify that each create/edit/delete route used by the pages above is still protected on the backend. If any admin mutation endpoint is discovered to lack backend auth, that should be fixed as a separate security bug before relying on the UI.

---

## UX Details

### Guest Opens Admin Route

1. Route loads.
2. Auth context checks `/users/me`.
3. If unauthenticated, the page shows the red `MessageBox`.
4. After the short delay, the page redirects to `/users/login?redirect=...`.
5. After successful login, the owner/admin returns to the original admin route.

### Logged-In Owner Opens Admin Route

1. Route loads.
2. Auth context confirms user.
3. Page content renders normally.
4. No redirect happens.

### Guest Opens Public Blog/Product Detail

1. Route loads normally.
2. Public content is visible.
3. Edit/delete/admin controls stay hidden.
4. No redirect happens.

---

## Tests

Add focused tests for the shared behavior instead of duplicating full page tests everywhere.

### Unit Tests

For `src/utils/authRedirect.js`:

- accepts `/blog/create`;
- accepts `/products/123/edit?tab=images`;
- rejects `https://example.com`;
- rejects `//example.com`;
- rejects `/\evil.com`;
- rejects `\\evil.com`;
- rejects raw `%5C%5Cevil.com` when it is read through the login page query flow and decoded before sanitization;
- rejects values with leading whitespace such as `  //evil.com`;
- rejects encoded protocol-relative values such as `%2F%2Fevil.com` after decoding;
- rejects `javascript:alert(1)`;
- rejects mixed-case schemes such as `JavaScript:alert(1)`;
- rejects `/users/login`;
- rejects `/users/login/`;
- rejects `/Users/Login`;
- rejects `/users/login?redirect=/users/login`;
- falls back when value is missing.

### Component Tests

For `RequireAuth`:

- renders loading state while `loading` is true;
- renders children when `user` exists;
- renders `MessageBox` when `user` is null;
- schedules redirect to login with the current path;
- preserves query string in the redirect parameter;
- clears timeout on unmount;
- cancels a pending redirect if `user` becomes truthy before the timer fires.

For `LoginClientPage`:

- redirects to sanitized `redirect` parameter after successful login;
- falls back to `/products` or `/` when redirect is missing;
- rejects external redirect values.
- redirects an already logged-in owner away from `/users/login?redirect=...` to the sanitized target.
- waits for `loading === false && user` before redirecting an already logged-in owner.
- covers an end-to-end encoded backslash case such as `/users/login?redirect=%5C%5Cevil.com`.

### Regression Checks

Manually verify:

- guest can open `/blog` and `/blog/[articleId]`;
- guest can open `/products` and `/products/[productId]`;
- guest opening `/blog/create` sees red notification and lands on login;
- logged-in owner can open create/edit/delete pages without being redirected;
- successful login from an admin route returns to that route.
- already logged-in owner opening `/users/login?redirect=/blog/create` is sent to `/blog/create`.

Run before finishing implementation:

```bash
npm test
npm run build
```

---

## Risks and Mitigations

### Auth Loading Flicker

Risk: The page may briefly show content before `useAuth()` finishes.

Mitigation: The guard must render only a loading state while `loading` is true or `user` is still `undefined`, and admin page fetches should wait for authenticated state.

### Inconsistent Route Coverage

Risk: One admin route may be missed.

Mitigation: Use the route inventory in this document as the implementation checklist, then search for `useAuth()` and admin pages again during review.

### Open Redirect

Risk: A malicious link to `/users/login?redirect=https://bad.example` could redirect the user after login.

Mitigation: Sanitize redirect values and only allow internal paths.

The sanitizer must reject backslashes, protocol-relative URLs, encoded protocol-relative URLs, control characters, whitespace bypasses, and mixed-case dangerous schemes.

### Login Redirect Race

Risk: The login form may navigate after `success` is set but before `AuthContext.user` is populated, causing the protected target route to see a guest state and redirect back to login.

Mitigation: Redirect after login only when `user` is truthy, and handle already-authenticated visits to the login page with the same sanitized redirect helper.

### Backend Assumption

Risk: Frontend redirect gives a false sense of security if a backend mutation endpoint lacks auth.

Mitigation: Treat this task as UX only and keep or verify backend auth on all mutation endpoints.

### Public Pages Accidentally Locked

Risk: Wrapping too high in the route tree could hide blog/product content from guests.

Mitigation: Apply the guard only to the admin-only routes listed above. Do not wrap public listing or detail pages.

---

## Acceptance Criteria

- Guests are redirected to `/users/login` after seeing a red notification on every owner/admin-only route.
- The login URL includes a safe `redirect` parameter for the originally requested internal route.
- Successful login returns the owner/admin to the originally requested admin route.
- Already logged-in owner/admin visitors are not left on the login page when a safe redirect target is present.
- Public blog and product pages remain visible to everyone.
- Existing admin actions still work for the logged-in owner.
- No external URL, protocol-relative URL, backslash variant, encoded protocol-relative value, or dangerous scheme can be used as a post-login redirect.
- Tests cover redirect sanitization and the reusable guard behavior.
- `npm run build` passes.

---

## Implementation Notes for Later

This document intentionally avoids Next.js middleware for V1. The current auth state is already centralized in the client `AuthContext`, and adding middleware would require duplicating token validation and cookie parsing at the framework edge/server layer. A middleware-based approach can be revisited later if the project needs server-side route protection before client hydration.

For now, a reusable client guard gives the requested behavior with the smallest blast radius and preserves the current public catalog/blog behavior.
