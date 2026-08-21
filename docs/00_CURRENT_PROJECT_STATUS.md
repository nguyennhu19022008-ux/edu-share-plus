# EDU SHARE+ — Current Project Status

## Current state

- Current implementation generation: React + Vite + TypeScript + Supabase.
- The Google Apps Script / Google Sheets generation is frozen as historical and research reference; operational legacy data is not migrated into V2.
- **Phase 5A — Foundation Stabilization: PASS and integrated into `main`.**
- **Phase 5B — Roster & Registration Trust Layer: PASS and integrated into `main`.**
- **Phase 5C — Marketplace Read: PASS and integrated into `main`.**
- **Phase 5D — Profile Backend: PASS** on `phase/5d-profile-backend`; integration into `main` remains a separate release action.
- **Cost policy: Free-tier-first.** Core functionality must work on the Supabase Free Plan and other free/open-source tooling wherever practical. Paid-only platform features are optional hardening/scale upgrades, not Core release blockers unless the project owner explicitly changes this policy.

## Runtime architecture

Auth, roster-assisted registration, school membership verification, teacher roster administration, teacher account review, marketplace feed/detail reads, self profile/private-profile reads, profile privacy updates, and profile password changes use real Supabase. Owner-post writes/reads, favorites, comments, contact reveal, reports, Storage media delivery, and post-moderation writes still materially depend on later phases or the runtime mock boundary. `src/main.tsx` still constructs `createMockRepositories()`; complete removal belongs to Phase 5J.

## Live Supabase development state

- PostgreSQL 17 project is operational and public application tables use RLS.
- Student authorization requires `account_status='approved'` plus verified school membership evidence.
- Phase 5B private roster and trusted teacher-review workflows remain active.
- Marketplace browsing requires confirmed email, active Student role, approved account and verified school membership.
- `schools.marketplace_scope` is `school|network`; `posts.visibility_scope` is `inherit|school|network`. A post may narrow but never widen its school's marketplace policy.
- `public.list_marketplace_posts(...)` and `public.get_marketplace_post(uuid)` provide the Phase 5C read surface.
- Self profile reads use `profiles`, `profile_private`, and `school_classes` under existing RLS. Missing rows are errors; there is no mock fallback.
- `public.update_my_profile_privacy(boolean,boolean,boolean,boolean)` is the only browser-accessible profile privacy mutation. It derives the actor from `auth.uid()`, reuses the verified Student trust gate, and can mutate only `show_name`, `show_class`, `show_email`, and `show_phone`.
- Browser roles have no direct UPDATE grant on `profiles` or `profile_private`; authenticated UPDATE policies for those tables are absent.
- Hosted Phase 5D migration history is aligned with the repository filename: `20260821095817_profile_privacy_backend`.
- Profile password change explicitly verifies the current password through `signInWithPassword()` using the authenticated user's email, then performs `updateUser({ password })`. It does not depend on a hosted-only current-password enforcement toggle or service-role credentials.
- Storage metadata tables exist, but application Storage buckets/private media delivery remain deferred to Phase 5F.

## Phase 5D verification evidence

The Phase 5D release matrix covers:

- anonymous profile/profile-private reads denied;
- a Student reads only their own profile/private-profile rows;
- another student's private/profile rows are not exposed;
- verified Student privacy RPC allowed;
- teacher and anonymous identities denied the Student self-privacy RPC;
- privacy mutation cannot target another user because no user ID is accepted;
- direct authenticated UPDATE on `profiles` and `profile_private` denied;
- privacy RPC PUBLIC/anon EXECUTE denied, authenticated EXECUTE intentional;
- privacy RPC is `SECURITY DEFINER` with a fixed `search_path`;
- ProfilePage primary data comes from Supabase rather than `ProfileRepository`;
- mock activity, saved-post, notification and image-persistence claims were removed from the real profile view;
- avatar/face persistence remains explicitly deferred to Phase 5F;
- saved/favorites remain Phase 5G and notifications remain Phase 5H;
- wrong current password is rejected through explicit password sign-in verification;
- correct current password permits Auth password update; old password then fails and new password succeeds;
- Phase 5A Auth E2E, full Phase 5B trust/roster matrix, Phase 5C marketplace matrix, source secret scan, unit tests and production build remain release gates.

Clean-local CI passed before hosted migration. After hosted migration, repository migration history was renamed byte-for-byte to the hosted version and clean replay passed again.

## Security / performance advisor review

Post-Phase-5D hosted audit confirmed:

- `update_my_profile_privacy` exists, is `SECURITY DEFINER`, and has a fixed search path;
- PUBLIC/anon cannot execute the privacy RPC; authenticated execution is intentional and internally guarded;
- `authenticated` has no direct UPDATE privilege on `profiles` or `profile_private`;
- anonymous roles have no SELECT privilege on those profile tables;
- RLS remains enabled on both profile tables;
- there are zero authenticated UPDATE policies on the two profile tables.

Security Advisor findings are classified as follows:

- `public.roles` and `public.user_roles`: RLS enabled without policies is intentional because browser table privileges are revoked.
- Trusted public RPCs intentionally trigger the authenticated `SECURITY DEFINER` warning when they must be callable by signed-in users. They validate identity/role/school or self scope internally and use safe search paths.
- The new `update_my_profile_privacy` warning is intentional under this model.
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

**Phase 5D — Profile Backend: PASS**

## Known gaps / next-phase work

- Owner post create/edit/list/detail and withdraw remain scheduled for Phase 5E.
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

**Phase 5E — Create/Edit/My Posts**
