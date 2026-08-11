# Checkpoint 2C — Feature Modularization

## Goal

Modularize the largest Phase 1 pages without changing the frozen EDU SHARE+ UI/UX, legacy URL model, or local behavior.

No backend, Supabase, authentication, storage, migration, or research data is introduced in this checkpoint.

## Refactor scope

### Marketplace

Presentation logic moved into the marketplace feature:

- `src/features/marketplace/components/MarketplaceCards.tsx`
- `src/features/marketplace/components/MarketplacePagination.tsx`
- `src/features/marketplace/viewUtils.ts`

`MarketplacePage.tsx` remains the page/controller for filters, sorting, pagination state, smart-mode state and saved-state coordination.

### My Posts

Owner-dashboard presentation moved into:

- `src/features/my-posts/components/MyPostsSummary.tsx`
- `src/features/my-posts/components/MyPostsFilters.tsx`
- `src/features/my-posts/components/OwnerPostCard.tsx`
- `src/features/my-posts/viewUtils.ts`

`MyPostsPage.tsx` remains responsible for page orchestration and local owner actions.

### Profile

Repeated profile presentation moved into:

- `src/features/profile/components/ProfileSections.tsx`

The page still owns privacy/image/password form state because repository/service boundaries are deliberately deferred to Checkpoint 2D.

### Admin

Admin visual/dashboard pieces moved into:

- `src/features/admin/components/AdminVisuals.tsx`
- `src/features/admin/components/AdminShellSections.tsx`

The page still owns moderation state/actions and local-store orchestration.

## Page-size change

Approximate page LOC before → after:

| Page | 2B | 2C |
|---|---:|---:|
| Marketplace | 300 | 172 |
| My Posts | 324 | 120 |
| Profile | 266 | 160 |
| Admin | 444 | ~303 |

This is a structural refactor only. The extracted markup retains the frozen Phase 1 CSS classes and visible labels.

## Fidelity guard

Static class-literal comparison against Checkpoint 2B:

- Marketplace: 65/65 original class literals retained
- My Posts: 30/30 retained
- Profile: 37/37 retained
- Admin: 101/101 retained

No legacy route was renamed or removed.

## Deliberately not done in 2C

- no repository interfaces yet;
- no mock adapter boundary yet;
- no Supabase client;
- no database/API calls;
- no CSS redesign/cleanup;
- no migration;
- no new Product Verification / Dispute UI.

Those data-access boundaries belong to Checkpoint 2D.

## Required local acceptance

Run:

```bash
npm install
npm run dev
```

Smoke-test the four refactored surfaces:

1. Marketplace — search/filter/sort/smart mode/save/pagination/detail.
2. My Posts — tabs/search/sort/hide/show/complete/withdraw/duplicate/detail/edit.
3. Profile — privacy, saved post navigation, avatar preview/save, notifications, password validation.
4. Admin — filters, row moderation, rejection reason, switches, modal, approve-all, charts/system actions.

Then:

```bash
npm run build
```

Acceptance requires no visible regression against the frozen Phase 1 baseline.
