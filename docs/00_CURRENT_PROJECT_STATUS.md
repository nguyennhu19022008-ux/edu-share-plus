# EDU SHARE+ — Current Project Status

## Current state

- Current implementation generation: React + Vite + TypeScript + Supabase.
- The Google Apps Script / Google Sheets generation is frozen as historical and research reference; operational legacy data is not migrated into V2.
- **Phase 5A — Foundation Stabilization: PASS.**
- **Phase 5B — Roster & Registration Trust Layer: PASS and integrated into `main`.**
- **Phase 5C — Marketplace Read: PASS** on `phase/5c-marketplace-read`; integration into `main` remains a separate release action.
- **Cost policy: Free-tier-first.** Core functionality must work on the Supabase Free Plan and other free/open-source tooling wherever practical. Paid-only platform features are optional hardening/scale upgrades, not Core release blockers unless the project owner explicitly changes this policy.

## Runtime architecture

Auth, roster-assisted registration, school membership verification, teacher roster administration, teacher account review, marketplace feed reads, and marketplace detail reads use real Supabase. Owner-post writes/reads, profile simulation, favorites, comments, contact reveal, reports, Storage media delivery, and post-moderation writes still materially depend on later phases or the runtime mock boundary. `src/main.tsx` still constructs `createMockRepositories()`; complete removal belongs to Phase 5J.

## Live Supabase development state

- PostgreSQL 17 project is operational and public application tables use RLS.
- Student authorization requires `account_status='approved'` plus verified school membership evidence.
- Phase 5B private roster and trusted teacher-review workflows remain active.
- Marketplace browsing requires confirmed email, active Student role, approved account and verified school membership.
- `schools.marketplace_scope` is `school|network`; `posts.visibility_scope` is `inherit|school|network`. A post may narrow but never widen its school's marketplace policy.
- Marketplace-visible posts must be approved, active and not hidden.
- `public.list_marketplace_posts(...)` provides server-side keyword/trade/category/class filtering, sorting, count, facets and pagination.
- `public.get_marketplace_post(uuid)` provides detail data and up to four visible same-category similar posts under the identical visibility rule.
- Anonymous marketplace/post-media RLS reads are removed. Hosted role-level verification under `anon` returns zero visible `posts` and zero visible `post_media` rows.
- Hosted Phase 5C migration history is aligned with repository filenames: `20260821082432_marketplace_read_scope` and `20260821082507_marketplace_read_rpcs`.
- Both marketplace RPCs are trusted `SECURITY DEFINER` functions with `set search_path=''`; PUBLIC/anon cannot execute them and `authenticated` may execute them only through their internal eligibility/visibility checks.
- Storage metadata tables exist, but application Storage buckets/private media delivery are deferred to Phase 5F.

## Phase 5C verification evidence

The Phase 5C release matrix covers:

- anonymous, unconfirmed, pending, and approved-but-needs-revalidation students denied marketplace access;
- approved + verified students allowed;
- school-only and network visibility, including post-level narrowing and prevention of widening a school-only tenant;
- pending/rejected/hidden/completed posts absent from the marketplace;
- server-side keyword/trade/category/class filters;
- server-side newest/price/image sorts, pagination and counts;
- detail RPC using the same eligibility/visibility rule as the feed;
- owner display privacy via `show_name` / `show_class`;
- anonymous post-media read denied;
- MarketplacePage no longer derives its feed from `marketplace.listPosts()` and uses async Supabase results directly;
- DetailPage no longer derives the requested/similar post from the mock list and uses `getMarketplacePost()` with loading/not-found/error/retry states;
- Phase 5C does not expose public Storage URLs; image delivery remains Phase 5F;
- favorites/comments/contact/reports are explicitly identified as local/deferred rather than presented as live backend behavior;
- source scanning rejects service-role/secret material under `src/`;
- clean local Supabase replay, Phase 5A Auth E2E, the complete Phase 5B matrix, Phase 5C marketplace E2E, unit tests and production build are CI gates.

Hosted development was migrated only after the clean-local Phase 5C matrix passed. Post-migration audit confirmed columns, policies, RPC grants and safe search paths.

## Security / performance advisor review

Post-Phase-5C Security Advisor findings are reviewed and classified as follows:

- `public.roles` and `public.user_roles`: RLS enabled without policies is intentional because browser table privileges are revoked.
- Trusted public RPCs, including `list_marketplace_posts` and `get_marketplace_post`, intentionally trigger the authenticated `SECURITY DEFINER` warning. They validate authenticated identity and the applicable role/membership/school visibility rules internally and use `set search_path=''`.
- Supabase Leaked Password Protection remains disabled and is accepted under the Free-tier-first policy because it is paid-plan hardening.
- Performance Advisor candidates (unused development indexes, unindexed foreign keys, multiple permissive read policies) remain query-driven follow-up work. No index is removed merely because a low-traffic development database reports it unused.

Advisor references:
- RLS enabled without policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Authenticated SECURITY DEFINER RPC: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Multiple permissive policies: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Approved Core V2 decisions

Core V2 is one multi-school EDU SHARE+ network. Teacher authority remains school-scoped. Student access requires a confirmed email, approved account, and verified school membership. Marketplace visibility may span the network where school policy permits, without granting cross-school moderation authority. Storage buckets will be private. Contact reveal is a trusted audited workflow. Phase 5 collects structured price inputs but does not yet implement a price estimator.

## Current checkpoint

**Phase 5C — Marketplace Read: PASS**

## Known gaps / next-phase work

- Profile/private profile reads and privacy updates still need the Phase 5D backend conversion.
- Owner post create/edit/list/detail remain scheduled for Phase 5E.
- No operational private Storage buckets/media-delivery flow exists yet; Phase 5F owns it.
- Favorites, comments/replies and audited contact reveal remain Phase 5G.
- Reports/notification workflows and teacher post moderation remain later phases.
- Development users created before Phase 5B may require roster reconciliation or explicit teacher verification before protected student access.
- Performance Advisor findings remain evidence for later query-plan-driven optimization, not automatic schema changes.

## Accepted Free-Plan limitations

- Supabase Leaked Password Protection is paid-only, so it is not required for the current Core release gate.
- Security on Free Plan instead relies on mandatory email confirmation, strong application password rules, safe session handling, RLS, narrow trusted RPC permissions, and school/teacher verification.
- Paid platform features may be adopted later only when they provide enough value to justify cost.

## Definition of Done

A checkpoint passes only after build/tests, relevant database/RLS verification, Security Advisor review, documentation update, and unauthorized-path checks pass. Warnings caused solely by unavailable paid-only features may be explicitly accepted when a documented free alternative/risk treatment exists.

## Next checkpoint

**Phase 5D — Profile Backend**
