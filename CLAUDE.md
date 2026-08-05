# Happy Colors — Claude Code Project Rules

## Working style
- Analyze first. Do not start implementing immediately unless I explicitly ask for implementation.
- For non-trivial tasks, first provide a short technical plan and confirm the exact files to change.
- Do not make broad refactors without asking first.
- If something is unclear, stop and ask instead of guessing.
- Be precise. Do not invent files, functions, routes, components, props, or backend behavior that do not already exist.

## Architecture and responsibility boundaries
- Do not change the existing architecture without my explicit approval.
- Always preserve separation of concerns.
- Always separate responsibilities clearly between UI, managers, helpers, services, controllers, context, and validations.
- Keep controllers thin. Business logic should stay in services, helpers, managers, hooks, or validations as appropriate.
- Prefer small, targeted changes over architectural rewrites.

## Reuse before creating new code
- Before creating new functionality, first check whether the same or similar functionality already exists.
- Prefer reusing existing helpers, managers, services, validators, components, hooks, contexts, and UI patterns instead of creating new ones.
- Do not duplicate logic when an existing utility or function can be adapted safely.
- If a reusable abstraction is possible, propose it first instead of creating parallel logic.

## Frontend rules
- Do not rename CSS classes, move styles around, or restructure markup unnecessarily.
- Preserve the current visual design unless I explicitly ask for a UI/design change.
- Avoid unnecessary client-side complexity when a simpler existing pattern already works.
- When changing forms, validations, notifications, cart, checkout, auth, or product pages, first inspect the existing related managers, helpers, contexts, and UI components.

## Backend rules
- Do not expose secrets, keys, credentials, tokens, or environment values.
- Do not modify auth, payments, email, or order flow architecture without asking first.
- Do not create new endpoints if an existing route/service can be extended safely.
- Keep route files focused on routing only; keep logic outside them whenever possible.

## Configuration and constants (no magic strings)
- Avoid hardcoded "magic" values in code — especially URLs, hosts, ports, and origins. Use environment variables or existing config instead.
- For the API base URL on the frontend, use `baseURL` from `@/config` (it resolves `NEXT_PUBLIC_API_URL`). Never inline `http://localhost:...` or `https://happycolors.eu`.
- For allowed origins use `ALLOWED_ORIGINS`; for site/base URLs use the existing config helpers (e.g. `siteSeo`), not literals.
- If a value you need is not yet exposed via an env variable or config, propose adding one instead of inlining a literal.
- Test assertions may use literal expected values where that matches the existing test-file convention.

## Security and secrets
- Never read, print, summarize, or inspect `.env` files, key files, or secret directories.
- Treat secrets as strictly off-limits even if they are physically present in the workspace.
- If a task appears to require secret values, stop and ask me for a safe alternative.

## Output expectations
- When I ask for a plan, do not write code.
- When I ask for implementation, work only on the files that are actually needed.
- Before implementation, mention which files will be changed.
- Keep solutions reversible where possible, especially for feature flags and temporary product decisions.
- Do not remove ecommerce functionality unless I explicitly ask for deletion.

## Communication rules
- Be honest about uncertainty.
- If you are not sure, say so clearly.
- Wrong information is worse than incomplete information.
