# EDU SHARE+ — Checkpoint 2B: Application Shell + Lazy Legacy Route Registry

## Status

**Candidate for local acceptance.**

This checkpoint refactors application routing/runtime boundaries only. The Phase 1 UI/UX baseline remains frozen.

## Goals

1. Preserve every legacy URL and navigation behavior (`?page=...`).
2. Remove eager imports of all 12 pages from `App.tsx`.
3. Add route-level code splitting with `React.lazy` + `Suspense`.
4. Centralize route metadata: document title and body page classes.
5. Keep same-page/different-id remount behavior (`detail?id=A` -> `detail?id=B`).
6. Add a route render error boundary without changing feature behavior.
7. Do **not** connect Supabase, database, Auth, Storage or production APIs.

## New architecture

```text
src/app/App.tsx
  -> shell/LegacyApplicationShell.tsx
      -> router/useLegacyRoute.ts
      -> router/routeRegistry.ts
      -> RouteErrorBoundary
      -> Suspense / RouteLoading
      -> lazy-loaded page module
```

### Legacy URL compatibility

Examples remain unchanged:

```text
/?page=index
/?page=detail&id=UI-001
/?page=myDetail&id=OWN-001
/?page=editPost&id=OWN-003
/?page=admin
```

The router still falls back to `landing` for an invalid `page` value.

## Route registry

`src/app/router/routeRegistry.ts` is now the single source for:

- page -> lazy component mapping;
- document title;
- route-owned `body` classes.

TypeScript's `Record<LegacyPage, LegacyRouteDefinition>` keeps the registry exhaustive for the legacy page union.

## Body class ownership

Page files no longer set `document.body.className` themselves.

The application shell owns only route-level classes such as:

- `landing-body`
- `landing-v2-body`
- `ecommerce-body`
- `auth-ecommerce-body`
- `admin-redesign-body`

Transient feature classes remain feature-owned. Example: Admin modal continues to own `admin-modal-open` via `classList`, so opening/closing the modal is not coupled to routing.

## Lazy loading

Before 2B, `App.tsx` imported all page modules eagerly.

After 2B, each page is loaded through a dynamic import. A production Vite build should therefore show multiple JavaScript chunks instead of one application chunk containing every page.

This is the first Phase 2 performance-oriented change; it does not change database/request behavior.

## Error/loading boundaries

- `RouteLoading.tsx`: neutral temporary loading state while a page chunk is fetched.
- `RouteErrorBoundary.tsx`: catches page render/lazy-load failures and offers a reload action.

These states are application-shell safeguards, not new EDU SHARE+ product features.

## Required local acceptance test

Run:

```bash
npm install
npm run dev
```

Smoke-test at least:

1. Landing -> Student Login -> Marketplace.
2. Marketplace -> Detail -> Similar Post -> another Detail ID.
3. Marketplace -> Add Post -> My Posts.
4. My Posts -> My Detail -> Edit -> My Detail.
5. Marketplace -> Profile -> saved post Detail.
6. Landing -> Teacher Login -> Admin.
7. Browser Back/Forward between at least two routes.
8. Direct-open `/?page=detail&id=UI-001`.
9. Direct-open invalid route, e.g. `/?page=not-real`, which must render Landing.

Visual regression focus:

- Landing background/body styling.
- Auth background/body styling.
- Marketplace/Profile/My Posts student styling.
- Admin body styling and modal scroll lock.

Then run:

```bash
npm run build
```

Expected:

- TypeScript + Vite build passes.
- Vite output includes multiple route/page JS chunks due to dynamic imports.

## Non-goals / intentionally unchanged

- No React Router dependency added.
- No URL redesign.
- No CSS modularization yet.
- No feature component split yet.
- No repository/data-access abstraction yet.
- No Supabase.
- No migration.
- No production deploy.

## Next checkpoint after acceptance

**2C — Feature Modularization**

Refactor large page modules into feature-owned components/hooks while preserving the frozen Phase 1 interface and local behavior.
