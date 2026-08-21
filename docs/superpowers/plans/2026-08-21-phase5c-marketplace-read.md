# Phase 5C — Marketplace Read Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the student marketplace list/detail mock reads with authenticated, school/network-scoped Supabase reads using server-side filtering, sorting and pagination.

**Architecture:** Marketplace reads use narrow public SECURITY DEFINER RPCs that validate the current student against email confirmation, approved account status and verified school membership before returning curated marketplace fields. RLS remains the database backstop: anonymous post/media reads are removed and authenticated public-post reads use the same effective visibility rule. Existing owner/admin/profile mocks remain until their scheduled phases.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Node >=20.19, Supabase JS 2.112.x, Supabase CLI 2.113.x, PostgreSQL 17, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-21-edu-share-plus-core-platform-v2-design.md`

## Global Constraints

- Core remains Free-tier-first.
- Marketplace is not readable by anonymous users or accounts that lack verified email, approved account status or verified current-school membership.
- Teacher authority and student visibility are separate concepts; cross-school visibility never grants cross-school moderation authority.
- School policy is `marketplace_scope = school | network`.
- Post policy is `visibility_scope = inherit | school | network`; a post may narrow but never widen its school's policy.
- Marketplace feed shows only `moderation_status='approved'`, `lifecycle_status='active'`, `is_hidden=false` posts.
- Owner/staff read policies remain available for their own workflows; Phase 5C changes only marketplace/public read behavior.
- Filtering, sorting, count and pagination are server-side. Page size remains 12.
- Rank/AI recommendation fields and controls are hidden/neutral until Phase 6.
- No Phase 5C code writes posts, favorites, comments, reports, contact events or Storage objects.
- No service-role key or secret may enter `src/`.
- SECURITY DEFINER functions use `set search_path = ''` and validate `auth.uid()` and role/school scope internally.
- All schema changes replay from a clean local Supabase database before hosted dev migration.

---

## File map

### Add
- `supabase/migrations/<generated>_marketplace_read_scope.sql`
- `tests/marketplaceRead.e2e.mjs`
- `src/features/marketplace/marketplaceReadService.ts`
- `src/features/marketplace/marketplaceReadModel.ts`
- `tests/marketplaceReadModel.test.ts`

### Modify
- `src/features/marketplace/types.ts`
- `src/features/marketplace/components/MarketplaceCards.tsx`
- `src/pages/MarketplacePage.tsx`
- `src/pages/DetailPage.tsx`
- `.github/workflows/ci.yml`
- `package.json`
- `docs/00_CURRENT_PROJECT_STATUS.md`
- `docs/ROADMAP.md`

---

### Task 1: Marketplace eligibility, scope and RLS foundation

**Produces:**
- `schools.marketplace_scope`: `school | network`, default `school`.
- `posts.visibility_scope`: `inherit | school | network`, default `inherit`.
- `private.is_marketplace_eligible()`.
- `private.can_read_marketplace_post(uuid,text)` where args are post school and visibility scope.

- [ ] Write RED SQL assertions in `tests/marketplaceRead.e2e.mjs` proving an anonymous identity and an approved-but-needs_revalidation student cannot read marketplace content.
- [ ] Add the two scope columns and check constraints.
- [ ] Implement `private.is_marketplace_eligible()` to require `auth.uid()`, confirmed `auth.users.email_confirmed_at`, active Student role, `profiles.account_status='approved'`, `school_membership_status='verified'`, non-null verification method/time.
- [ ] Implement effective visibility: school scope always remains school; network school + `inherit|network` is network; explicit post `school` is always school.
- [ ] Drop `posts_read_public_anon` and `post_media_read_anon`.
- [ ] Replace authenticated marketplace post/media policies with membership-aware visibility policies while retaining owner and staff policies.
- [ ] Add/adjust visible-feed indexes only where they match the actual 5C query path.
- [ ] Run clean local migration replay and existing Phase 5A/5B E2E.
- [ ] Commit as `security: enforce verified marketplace visibility`.

### Task 2: Trusted server-side marketplace list/detail RPCs

**Interfaces:**

```sql
public.list_marketplace_posts(
  p_keyword text default null,
  p_trade_type text default null,
  p_category_id uuid default null,
  p_class_id uuid default null,
  p_sort text default 'new',
  p_page integer default 1,
  p_page_size integer default 12
) returns jsonb

public.get_marketplace_post(p_post_id uuid) returns jsonb
```

`list_marketplace_posts` result:

```ts
type MarketplaceReadResponse = {
  items: MarketplaceReadItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: { totalOpen:number; free:number; sale:number; hasImage:number };
  classes: Array<{ id:string; label:string }>;
  categories: Array<{ id:string; code:string; name:string }>;
};
```

- [ ] RED E2E: seed two schools, two eligible students and posts spanning school/network visibility; RPC does not yet exist.
- [ ] Implement `list_marketplace_posts` with a strict page-size cap of 50 and page >= 1.
- [ ] Validate `p_sort` against `new|priceAsc|priceDesc|image`; validate trade type if provided.
- [ ] Apply keyword/category/class/trade filters in SQL before pagination.
- [ ] Order in SQL; no browser re-sorting of the complete dataset.
- [ ] Return owner display name/class respecting `profiles.show_name/show_class`; expose reputation cache only as display metadata, not a ranking signal.
- [ ] Compute `hasImage` from `post_media` and `favoriteCount` from favorites without exposing private rows.
- [ ] Return stats/facets only over posts visible to the current eligible student.
- [ ] Implement `get_marketplace_post` with the identical eligibility/visibility rule and up to four similar visible posts.
- [ ] Grant EXECUTE only to `authenticated`; revoke from PUBLIC/anon.
- [ ] E2E school/network matrix, hidden/pending/completed denial, filters, sort, pagination, count and detail visibility all PASS.
- [ ] Commit as `feat: add trusted marketplace read RPCs`.

### Task 3: Frontend marketplace read model/service

**Produces:**

```ts
export type MarketplaceQuery = {
  keyword:string;
  tradeType:'' | TradeType;
  categoryId:string;
  classId:string;
  sort:MarketSort;
  page:number;
  pageSize:number;
};

export async function listMarketplacePosts(query:MarketplaceQuery):Promise<MarketplaceReadResponse>;
export async function getMarketplacePost(postId:string):Promise<MarketplaceDetailResponse>;
```

- [ ] RED unit tests for RPC payload mapping, empty result normalization, date conversion, nullable price, owner privacy and invalid response rejection.
- [ ] Add `marketplaceReadModel.ts` as pure parsing/mapping code so tests do not require the browser client.
- [ ] Add `marketplaceReadService.ts`; it is the only Phase-5C marketplace file importing `getSupabaseClient()`.
- [ ] Map server rows to `MarketPost` without fabricated rank/AI scores.
- [ ] Keep favorite writes out of this service.
- [ ] Unit suite and production build PASS.
- [ ] Commit as `feat: add marketplace Supabase read service`.

### Task 4: Replace MarketplacePage mock read with async server query

- [ ] RED render/model test proves page state derives total pages/count from server response rather than `array.slice()`.
- [ ] Remove `marketplace.listPosts()` from `MarketplacePage`.
- [ ] Query on initial load and when filters/page change; debounce keyword changes by ~250 ms and ignore stale responses.
- [ ] Populate category/class selects from server facets using IDs as values and labels as display text.
- [ ] Show loading, retryable error and empty states.
- [ ] Use server `stats`, `totalCount`, `totalPages`, and returned page items directly.
- [ ] Hide reputation-ranking and AI-recommendation switches/strip until Phase 6; do not fabricate ranking data.
- [ ] Keep current saved-post local/mock interaction isolated until Phase 5G.
- [ ] Production build and unit tests PASS.
- [ ] Commit as `refactor: load marketplace feed from Supabase`.

### Task 5: Replace DetailPage primary/similar post reads

- [ ] RED model/render test: requested visible post comes from `getMarketplacePost`, not from the mock list.
- [ ] Replace primary post and similar-post lookup with the trusted detail RPC.
- [ ] Keep comments, contact reveal, reports and favorite mutation explicitly local/mock until their scheduled phases; label no backend data as real if it is still local.
- [ ] Do not expose a public Storage URL; image display remains unavailable until Phase 5F.
- [ ] Add loading/not-found/error handling.
- [ ] Build and tests PASS.
- [ ] Commit as `refactor: load marketplace detail from Supabase`.

### Task 6: Full Phase 5C release gate

Required matrix:

```text
anon marketplace read denied
unconfirmed student denied
pending student denied
approved + needs_revalidation denied
approved + verified student allowed
school-scoped post visible only same school
network school + inherit/network post visible cross-school
post school scope narrows network school
post network cannot widen school-scoped school
pending/rejected/hidden/completed posts absent
server keyword/trade/category/class filters correct
server new/priceAsc/priceDesc/image sort correct
server pagination/count correct
detail uses same visibility rule
post_media anon read denied
Phase 5A Auth E2E still pass
Phase 5B trust/roster E2E still pass
unit tests pass
production build pass
```

- [ ] Wire `tests/marketplaceRead.e2e.mjs` into the local Supabase CI job.
- [ ] Scan `src/` for service-role/secret patterns.
- [ ] Apply hosted development migration only after final clean-local matrix is green.
- [ ] Verify hosted policies/functions/grants and run Security Advisor.
- [ ] Record intentional authenticated SECURITY DEFINER warnings.
- [ ] Update current-status/roadmap docs and set next checkpoint to Phase 5D only after the final PR-head CI succeeds.
- [ ] Open PR to `main`; merge remains a separate release action.
- [ ] Commit as `docs: mark Phase 5C marketplace read pass` only when all gates are green.

## Self-review

- **Spec coverage:** authenticated/verified marketplace eligibility, school/network effective visibility, server-side pagination/filter/sort, detail visibility, owner privacy, no public media and no Phase-6 ranking are covered.
- **Scope boundary:** post writes, profile backend, Storage, interactions/contact, notifications/reports and moderation writes remain in 5D–5I.
- **Type consistency:** UI query values use category/class IDs; returned cards retain display labels. `MarketSort` remains `new|priceAsc|priceDesc|image`. Page size remains 12.
- **Placeholder scan:** no implementation step depends on undefined authorization behavior; migration filename is generated when applied.