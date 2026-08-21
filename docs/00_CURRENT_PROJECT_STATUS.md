# EDU SHARE+ — Current Project Status

## Current state

- Current implementation generation: React + Vite + TypeScript + Supabase.
- The Google Apps Script / Google Sheets generation is frozen as historical and research reference; operational legacy data is not migrated into V2.
- **Phase 5A — Foundation Stabilization: PASS and integrated into `main`.**
- **Phase 5B — Roster & Registration Trust Layer: PASS and integrated into `main`.**
- **Phase 5C — Marketplace Read: PASS and integrated into `main`.**
- **Phase 5D — Profile Backend: PASS and integrated into `main`.**
- **Phase 5E — Create/Edit/My Posts: PASS** on `phase/5e-create-edit-my-posts`; integration into `main` remains a separate release action.
- **Cost policy: Free-tier-first.** Core functionality must work on the Supabase Free Plan and other free/open-source tooling wherever practical. Paid-only platform features are optional hardening/scale upgrades, not Core release blockers unless the project owner explicitly changes this policy.

## Runtime architecture

Auth, roster-assisted registration, school membership verification, teacher roster administration, teacher account review, marketplace feed/detail reads, self profile/private-profile reads, profile privacy updates, profile password changes, and owner post create/edit/list/detail/lifecycle workflows now use real Supabase. Favorites, comments/replies, audited contact reveal, reports, Storage media delivery, notifications, and teacher post-moderation writes remain later-phase work. `src/main.tsx` still constructs `createMockRepositories()` for remaining legacy-backed surfaces; complete removal belongs to Phase 5J.

## Live Supabase development state

- PostgreSQL 17 project is operational and public application tables use RLS.
- Student authorization requires a confirmed email, Student role, `account_status='approved'`, and verified school membership evidence.
- Phase 5B private roster and trusted teacher-review workflows remain active.
- Marketplace browsing uses the Phase 5C school/network visibility model.
- Self profile/privacy uses the Phase 5D RLS + narrow trusted RPC model.
- Phase 5E hosted migration history is aligned with the repository filename: `20260821154133_owner_post_write_backend`.
- `posts` now stores `preferred_contact_method`, `original_purchase_price`, `original_price_is_estimate`, `purchase_date`, `condition_grade`, `brand`, and `model` for structured low-price-sale inputs.
- `public.create_my_post(...)`, `public.update_my_post(...)`, and `public.change_my_post_lifecycle(uuid,text)` are the browser-accessible owner-write boundary. They derive the actor from `auth.uid()` and reuse the verified Student trust context.
- Browser roles have no direct INSERT/UPDATE/DELETE privilege on `public.posts`.
- Every owner edit of an active post returns `moderation_status` to `pending`; staff-owned `is_hidden` and `comments_enabled` state is not overwritten by the student edit path.
- Owner completion is accepted only for an `active` + `approved` listing. Owner withdrawal is allowed for an active listing. Neither action is transaction proof.
- Owner list/detail pages read real `posts` and `post_status_history` rows under RLS with server pagination/filtering.
- Storage metadata tables exist, but operational private media delivery remains deferred to Phase 5F.

## Phase 5E verification evidence

The Phase 5E release matrix covers:

- anonymous, teacher, pending/unverified, and wrong-owner post-write attempts denied;
- verified Student post creation derives owner/school/class and initial moderation/lifecycle state server-side;
- school policy cannot be widened by a post visibility input;
- preferred contact method must correspond to contact data already held in `profile_private`; arbitrary contact PII is not stored in the post;
- low-price-sale posts require positive sale/original price, original-price estimate flag, and condition grade; non-sale posts reject estimator-only fields;
- direct authenticated INSERT/UPDATE/DELETE on `posts` denied;
- owner edit resets moderation to `pending`, clears `published_at`, preserves staff-only hidden/comment controls, and records state history;
- owner cannot edit another user's post or a finalized lifecycle row;
- `complete` requires an approved active listing; `withdraw` finalizes an active listing without hard delete;
- owner list/detail reads are owner-scoped under RLS, including pagination/search/filter and post status history;
- Add Post, Edit Post, My Posts, and My Detail use the real owner-post service rather than the owner mock store;
- My Posts/My Detail do not fabricate interaction metrics or image URLs;
- Phase 5F media and Phase 5G/5H interaction/report data are explicitly deferred in the UI;
- regression coverage prevents the UI from offering `complete` for pending/rejected active posts;
- unit tests, production build, Phase 5A Auth E2E, full Phase 5B trust/roster matrix, Phase 5C marketplace matrix, Phase 5D profile matrix, Phase 5E owner-write matrix, and Phase 5E owner-read matrix all pass on clean local Supabase.

CI run #345 on the post-review implementation head passed both `verify` and `local-auth-e2e`, including the full 5A–5E matrix. The hosted migration was then applied, audited, and its generated migration version was mirrored byte-for-byte into the repository.

## Security / performance advisor review

Post-Phase-5E hosted audit confirmed:

- all seven Phase 5E post columns and all six associated constraints exist;
- `posts` RLS remains enabled;
- `authenticated` and `anon` have no direct post-write table privileges;
- the three owner-write RPCs are `SECURITY DEFINER` with fixed `search_path`;
- anon cannot execute the owner-write RPCs; authenticated execution is intentional and internally guarded;
- the private payload validator is not executable by anon/authenticated.

Security Advisor findings are classified as follows:

- `public.roles` and `public.user_roles`: RLS enabled without policies is intentional because browser table privileges are revoked.
- Trusted public RPCs intentionally trigger the authenticated `SECURITY DEFINER` warning when they must be callable by signed-in users. The new Phase 5E owner RPC warnings are expected under this model and are covered by unauthorized-path tests plus fixed search paths and server-side identity checks.
- Supabase Leaked Password Protection remains disabled and is accepted under the Free-tier-first policy because it is paid-plan hardening.

Performance Advisor continues to report unindexed foreign-key candidates, development-time unused indexes, and multiple permissive SELECT policies. These remain query-plan-driven follow-up work; no index or policy is changed merely to silence development-time advisories.

Advisor references:
- RLS enabled without policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Authenticated SECURITY DEFINER RPC: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Multiple permissive policies: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
- Unindexed foreign keys: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

## Approved Core V2 decisions

Core V2 is one multi-school EDU SHARE+ network. Teacher authority remains school-scoped. Student access requires a confirmed email, approved account, and verified school membership. Marketplace visibility may span the network where school policy permits, without granting cross-school moderation authority. Storage buckets will be private. Contact reveal is a trusted audited workflow. Phase 5 collects structured price inputs but does not yet implement a price estimator.

## Current checkpoint

**Phase 5E — Create/Edit/My Posts: PASS**

## Known gaps / next-phase work

- No operational private Storage buckets/media-delivery flow exists yet; Phase 5F owns it.
- Favorites, comments/replies and audited contact reveal remain Phase 5G.
- Reports/notification workflows remain Phase 5H.
- Teacher post moderation writes remain Phase 5I.
- Runtime mock construction remains until Phase 5J removes the final core dependency.
- Development users created before Phase 5B may require roster reconciliation or explicit teacher verification before protected student access.
- Performance Advisor findings remain evidence for later query-plan-driven optimization, not automatic schema changes.

## Accepted Free-Plan limitations

- Supabase Leaked Password Protection is paid-only, so it is not required for the current Core release gate.
- Security on Free Plan instead relies on mandatory email confirmation, strong application password rules, safe session handling, RLS, narrow trusted RPC permissions, explicit current-password verification, and school/teacher verification.
- Paid platform features may be adopted later only when they provide enough value to justify cost.

## Definition of Done

A checkpoint passes only after build/tests, relevant database/RLS verification, Security Advisor review, documentation update, and unauthorized-path checks pass. Warnings caused solely by unavailable paid-only features may be explicitly accepted when a documented free alternative/risk treatment exists.

## Next checkpoint

**Phase 5F — Storage**
