# EDU SHARE+ — Current Project Status

## Current state

- Current implementation generation: React + Vite + TypeScript + Supabase.
- The Google Apps Script / Google Sheets generation is frozen as historical and research reference; operational legacy data is not migrated into V2.
- **Phase 5A — Foundation Stabilization: PASS.**
- **Phase 5B — Roster & Registration Trust Layer: PASS** on `phase/5b-roster-registration-trust`; integration into `main` remains a separate release action.
- **Cost policy: Free-tier-first.** Core functionality must work on the Supabase Free Plan and other free/open-source tooling wherever practical. Paid-only platform features are optional hardening/scale upgrades, not Core release blockers unless the project owner explicitly changes this policy.

## Runtime architecture

Auth, roster-assisted registration, school membership verification, teacher roster administration, and teacher account-review flows use real Supabase. Marketplace, owner-post, profile simulation, and post-moderation flows still materially depend on the runtime mock repository boundary. `src/main.tsx` still constructs `createMockRepositories()`; removal belongs to Phase 5J.

## Live Supabase development state

- PostgreSQL 17 project is operational.
- Public app tables use RLS.
- Student authorization now requires `account_status='approved'` plus verified school membership evidence.
- Private roster data lives in `private.student_registration_claims`, `private.roster_import_batches`, `private.student_roster`, and `private.student_roster_claims`.
- Email confirmation triggers `private.verify_student_after_email_confirmed()`; a unique current-school/class/phone roster match atomically approves and verifies membership using canonical roster identity. No/ambiguous/already-claimed outcomes remain pending for teacher review.
- Trusted roster RPCs support import, batch activation/history, and active-roster listing with same-school teacher scope and global admin scope.
- Hosted Phase 5B migration history is aligned with repository filenames: `20260821042916_roster_registration_foundation`, `20260821042937_roster_email_verification`, `20260821043013_roster_management_rpcs`, and `20260821043045_membership_aware_review_access`.
- Hosted verification found no `anon`, `authenticated`, or `PUBLIC` table grants on the four private roster/claim tables.
- Existing development profiles were not grandfathered into trusted membership: legacy approved profiles defaulted to `needs_revalidation` with no verification method, so approval alone no longer grants protected student access.
- Storage metadata tables exist, but application Storage buckets are not yet provisioned.

## Phase 5B verification evidence

The final Phase 5B release gate includes:

- dependency-free CSV parsing and validation preview for teacher roster import;
- school-scoped roster import, batch history/activation, active roster search, and claim-state UI;
- account-review UI with staff-facing roster-match reasons while preserving teacher-entered review reasons separately;
- non-student Auth identities are not silently provisioned as EDU SHARE+ students;
- student signup validates school, class, phone, name, and email and does not receive a session before confirmation;
- unique roster match after email confirmation applies canonical roster name/class and verifies membership with `school_roster_match`;
- no-match, ambiguous, and already-claimed cases stay pending for manual review;
- atomic uniqueness prevents a second active account from taking a claimed roster row;
- manual teacher approval verifies membership with `teacher_manual_review`;
- cross-school teachers, ordinary students, and anonymous callers are denied roster administration;
- only one active roster batch is allowed per school;
- browser source checks prevent service-role/secret credentials from entering the Vite application;
- clean local Supabase migration replay, Phase 5A email-confirmation E2E, the consolidated Phase 5B integration matrix, unit tests, and production build are CI release gates.

Hosted development was migrated only after the clean local release matrix passed. A post-migration audit confirmed the roster-aware Auth trigger and private-table grant boundary.

## Security Advisor review

Post-Phase-5B hosted Security Advisor findings are reviewed and classified as follows:

- `public.roles` and `public.user_roles`: RLS enabled without policies is intentional because browser table privileges are revoked; these are not direct browser data surfaces.
- Trusted public RPCs are `SECURITY DEFINER` and executable by `authenticated` intentionally. Each validates `auth.uid()` and the required role/school boundary internally and uses `set search_path = ''`.
- Supabase Leaked Password Protection remains disabled. It is a paid-plan hardening feature and is accepted under the Free-tier-first policy; mandatory email confirmation, strong application password rules, RLS, narrow RPCs, and school verification remain the Core controls.

Advisor references:
- RLS enabled without policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Authenticated SECURITY DEFINER RPC: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

## Approved Core V2 decisions

Core V2 is one multi-school EDU SHARE+ network. Teacher authority remains school-scoped. Student access requires a confirmed email, approved account, and verified school membership. School roster matching provides automatic verification; unmatched registrations go to teacher review. Marketplace supports school/network visibility. Storage buckets will be private. Contact reveal is a trusted audited workflow. Phase 5 collects structured price inputs but does not yet implement a price estimator.

## Current checkpoint

**Phase 5B — Roster & Registration Trust Layer: PASS**

## Known gaps / next-phase work

- Marketplace/profile/posts remain partially mock-backed.
- No operational Storage buckets exist yet.
- Development users created before Phase 5B may require roster reconciliation or explicit teacher verification before protected student access.
- Performance Advisor findings remain query-driven follow-up work; development-time unused-index notices are not treated as evidence that indexes should be removed.

## Accepted Free-Plan limitations

- Supabase Leaked Password Protection is paid-only, so it is not required for the current Core release gate.
- Security on Free Plan instead relies on mandatory email confirmation, strong application password rules, safe session handling, RLS, narrow trusted RPC permissions, and school/teacher verification.
- Paid platform features may be adopted later only when they provide enough value to justify cost.

## Definition of Done

A checkpoint passes only after build/tests, relevant database/RLS verification, Security Advisor review, documentation update, and unauthorized-path checks pass. Warnings caused solely by unavailable paid-only features may be explicitly accepted when a documented free alternative/risk treatment exists.

## Next checkpoint

**Phase 5C — Marketplace Read**
