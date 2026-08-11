# Checkpoint 2D — Data Access Boundary

## Status

**Candidate for local acceptance.**

Checkpoint 2D changes frontend architecture only. It does **not** connect Supabase, PostgreSQL, Auth, Storage, external APIs, or production data. The Phase 1 UI/UX/legacy URL baseline remains frozen.

## Objective

Remove provider/data-source knowledge from pages and shared UI before database work begins.

Before 2D, several screens imported controlled Phase-1 data directly:

```text
Page / StudentHeader
  -> mockPosts.ts
  -> localOwnerStore.ts
  -> localOwnerDetailStore.ts
  -> localProfileStore.ts
  -> localAdminStore.ts
```

After 2D:

```text
Page / shared UI
       |
       v
useDataAccess()
       |
       v
Repository contracts
       |
       v
Mock repository adapters
       |
       v
Controlled Phase-1 in-memory stores / mock samples
```

Only the application composition root (`src/main.tsx`) knows that the active implementation is currently `createMockRepositories()`.

## New architecture

```text
src/
├── app/
│   └── providers/
│       └── DataAccessProvider.tsx
├── data/
│   ├── contracts/
│   │   └── repositories.ts
│   └── mock/
│       ├── index.ts
│       └── mockAdapters.ts
└── features/
    └── my-posts/
        ├── detailTypes.ts
        └── effectiveness.ts
```

## Repository contracts

### MarketplaceRepository

Owns access to the public marketplace post collection used by the current local UI.

### OwnerPostsRepository

Owns the student's post list and mutations:

- list
- get by id
- insert
- replace
- update
- duplicate

### OwnerDetailRepository

Owns post-owner interaction detail state:

- favorites
- contact logs
- comments
- timeline
- timeline mutation

### ProfileRepository

Owns:

- profile bundle
- saved posts
- favorite state
- privacy settings
- profile images
- notifications
- local password-change simulation state

### AdminRepository

Owns:

- moderation post list
- post update
- approve-all operation
- reset controlled sample
- dashboard summary

## Composition root

`src/main.tsx` now creates the mock implementation once:

```text
createMockRepositories()
        |
        v
DataAccessProvider
        |
        v
Application
```

Pages do not import the mock implementation.

When a real backend is introduced, the application should replace the adapter at the composition boundary rather than rewriting UI components.

## UI files migrated to the boundary

- `MarketplacePage.tsx`
- `DetailPage.tsx`
- `AddPostPage.tsx`
- `MyPostsPage.tsx`
- `MyDetailPage.tsx`
- `EditPostPage.tsx`
- `ProfilePage.tsx`
- `AdminPage.tsx`
- `StudentHeader.tsx`

Static audit after the refactor found **zero direct mock/local-store imports in `src/pages` and `src/components`**.

## Pure feature logic separated from mock data

Owner-detail interfaces and the effectiveness calculation were previously located in a file named `mockMyPostDetail.ts`. Checkpoint 2D separates them into:

- `detailTypes.ts` — provider-neutral types
- `effectiveness.ts` — provider-neutral deterministic UI/domain calculation

The controlled sample records remain in the mock implementation.

## Why repositories are synchronous in Checkpoint 2D

The current adapters intentionally expose synchronous snapshot/action contracts because the approved Phase 1 local UI is synchronous. Changing every screen to remote asynchronous loading in the same checkpoint would alter timing, loading states and regression surface without any backend being present.

This is a deliberate transitional boundary, not a claim that PostgreSQL/Supabase requests will be synchronous. When the backend phase begins, asynchronous transport and request state will be added behind feature services/hooks while keeping provider-specific Supabase calls out of pages/components.

## Invariants

Checkpoint 2D must preserve:

- all existing `?page=...` URLs;
- route-level lazy loading from 2B;
- visual structure and CSS class names;
- controlled local reset-on-refresh behavior;
- cross-screen favorite state;
- cross-screen owner-post state;
- profile/header state consistency;
- local admin moderation state;
- zero research-data migration;
- zero backend/API calls.

## Acceptance tests

The most important tests are cross-boundary flows, because repository wiring now owns the data hand-off:

1. Marketplace -> save post -> Profile -> saved post exists.
2. Detail -> save/unsave -> Marketplace/Profile reflects the same local state after navigation.
3. Add Post -> My Posts -> newly created post is present and pending.
4. My Posts -> hide/complete/withdraw -> My Detail reflects the updated state.
5. My Detail -> mark contact handled -> leave/reopen -> handled state/timeline remains during the SPA session.
6. Edit rejected post -> resubmit -> My Posts shows `Chờ duyệt` and rejection reason is cleared.
7. Profile -> update avatar -> navigate to Marketplace/My Posts -> Student Header uses the same avatar.
8. Profile -> mark notifications read -> header unread badge becomes zero after render/navigation.
9. Admin -> approve/reject/toggle visibility/comments -> table/modal/dashboard continue to use the same local moderation store.
10. Build succeeds and all legacy routes still load.

## Explicit non-goals

Checkpoint 2D does not:

- create database tables;
- design RLS policies;
- install Supabase;
- add `.env`;
- introduce service-role keys;
- migrate accounts/posts/research data;
- change authentication;
- upload files to object storage;
- redesign UI;
- make Admin sample data identical to Student sample data.

Those boundaries are intentional.

## Exit condition for Phase 2

Phase 2 can be marked PASS when Checkpoint 2D passes local testing and build with:

```text
Pages/components -> direct mock/store imports = 0
Mock/provider implementation -> known only at composition/data layer
Legacy routes = preserved
Phase 1 UI/UX/flows = preserved
npm run build = PASS
```

After acceptance, the next phase is **Phase 3 — Database Design / ERD**, beginning with schema requirements and ERD documentation before any database is created.
