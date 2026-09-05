# EDU SHARE+ — Current Project Status

## Current state

- Current implementation generation: React + Vite + TypeScript + Supabase.
- The Google Apps Script / Google Sheets generation is frozen as historical and research reference; operational legacy data is not migrated into V2.
- **Phase 5A — Foundation Stabilization: PASS and integrated into `main`.**
- **Phase 5B — Roster & Registration Trust Layer: PASS and integrated into `main`.**
- **Phase 5C — Marketplace Read: PASS and integrated into `main`.**
- **Phase 5D — Profile Backend: PASS and integrated into `main`.**
- **Phase 5E — Create/Edit/My Posts: PASS and integrated into `main`.**
- **Phase 5F — Storage: PASS and integrated into `main`.**
- **Phase 5G — Interactions + Contact: PASS.**
- **Phase 5H — Notifications + Reports: PASS.**
- **Phase 5I — Teacher Post Moderation: PASS.**
- **Phase 5J — Remove Runtime Mock: PASS.**
- **Phase 5 — Full Core V2 Supabase Migration: 100% PASS.**
- **Phase 6A — Two-Party Transactions & Live Impact Estimation: PASS.**
- **Phase 6B — Smart Price Estimator V1: PASS.**
- **Phase 6C — School Membership & Rating-based Reputation Engine V2: PASS.**
- **Phase 6D — Explainable Recommendations V1: PASS.**
- **Phase 6 — Verified Outcomes & Research Features: 100% PASS.**
- **Phase 7 — Codebase Optimization, Mobile UX Refinement, Scientific Data Integrity & PII Protection: 100% PASS.**
- **Cost policy: Free-tier-first.** Core functionality must work on Supabase Free Plan and free/open-source infrastructure wherever practical.

## Runtime architecture

Auth, roster-assisted registration, school membership verification, teacher roster administration, account review, marketplace reads, profile reads/privacy/password changes, owner post create/edit/list/detail/lifecycle, private post media, self-avatar persistence, marketplace favorites, two-level comments/replies, audited contact reveal, live saved posts, notifications query/read, moderation report submissions, and teacher post moderation / report resolution now run 100% on real Supabase backend services.

All mock repositories and `DataAccessProvider` have been removed from the application runtime.

## Phase 5F — private Storage

Phase 5F uses private Supabase Storage with a reservation-first immutable-object workflow.

Buckets:

- `post-media`: private, JPEG/PNG/WebP, 5 MiB per object.
- `profile-media`: private, JPEG/PNG/WebP, 3 MiB per object.
- `private-evidence`: private, JPEG/PNG/WebP/PDF, 20 MiB per object.

Core rules:

- Browser uploads require an authenticated, approved, verified Student identity.
- Owner/school/path scope is server-derived; browser input cannot choose another owner or school.
- Storage paths contain UUID object identifiers and are reserved before upload.
- Browser uploads use `upsert:false`; no authenticated Storage UPDATE policy exists.
- Post media is capped at five bound images.
- Post media reads follow owner/staff/marketplace visibility; avatar reads are self-only in Phase 5F.
- Public Storage URLs are not used; delivery uses short-lived signed URLs.
- `file_objects` stores school-aware lifecycle metadata including `binding_status`, `uploaded_at`, and `bound_at`.
- Browser roles have no direct INSERT/UPDATE/DELETE privileges on `file_objects` or `post_media`.
- Storage deletion uses the Storage API; metadata is tombstoned only after the object is removed.
- Face/biometric upload remains disabled.
- No service-role/secret credential is exposed browser-side.

Trusted public RPC boundary:

- `reserve_my_file(...)`
- `finalize_my_file(...)`
- `bind_my_post_media(...)`
- `remove_my_post_media(...)`
- `set_my_avatar(...)`
- `mark_my_file_deleted(...)`

These RPCs are `SECURITY DEFINER`, use fixed `search_path=''`, deny anon execution, intentionally allow authenticated execution, and perform authorization internally.

## Hosted Supabase development state

Phase 5F migrations are deployed to hosted development and repository migration filenames are aligned byte-for-byte with hosted migration history:

- `20260822072853_private_storage_backend.sql`
- `20260822072914_file_object_school_guard.sql`
- `20260822072921_storage_delete_select_guard.sql`

Hosted audit confirms:

- all three buckets are private with the exact size/MIME contracts above;
- `public.file_objects` has RLS enabled;
- the expected school, binding-state, timestamp, purpose/bucket, size, MIME, private-visibility, and `(bucket, storage_path)` uniqueness constraints exist;
- authenticated Storage policies include only reservation INSERT, authorized SELECT, delete-scoped SELECT, and unbound DELETE; there is no UPDATE policy;
- anon cannot execute the six public Phase 5F RPCs;
- authenticated execution is intentional and internally guarded;
- browser roles have no direct INSERT/UPDATE/DELETE grant on `file_objects` or `post_media`;
- the school guard derives `file_objects.school_id` from the owner profile;
- Storage remove is supported without making deletable unbound objects generally readable.

## Verification evidence

The Phase 5F release matrix covers:

- anonymous, teacher, pending/unverified and wrong-owner reservation/binding attempts denied;
- arbitrary unreserved Storage paths denied;
- unsupported MIME and oversized files denied;
- immutable-path overwrite denied;
- finalize rejects actual Storage metadata mismatch;
- post-media maximum-five enforcement;
- pending post media visible to owner but not another Student;
- approved active school-visible media readable only to eligible marketplace readers in scope;
- bound media cannot be physically removed before trusted unbind;
- avatar is self-only in Phase 5F;
- object cleanup and metadata tombstone lifecycle;
- strict client-side JPEG/PNG/WebP validation;
- no public URL generation or browser service-role secret;
- signing occurs before post/avatar bind commit so transient signed-URL failure cannot be reported after backend binding has already succeeded.

CI moved from quota-limited GitHub-hosted runners to the repository-scoped self-hosted runner `edu-share-ci-01` under the Free-tier-first policy. The workflow runs feature-branch verification via pull requests, `main` via push, rejects fork PR execution on the self-hosted runner, and cancels superseded runs.

CI #426 proved the new self-hosted path end-to-end. CI #427 on exact implementation/migration-history head `c13aa25b29560c4e725711563885915ac12e70c6` passed both jobs:

- unit tests;
- production build;
- Phase 5A Auth E2E;
- Phase 5B full trust/roster matrix;
- Phase 5C marketplace matrix;
- Phase 5D profile matrix;
- Phase 5E owner-write and owner-read matrices;
- Phase 5F private Storage matrix.

## Security / performance advisor review

Security Advisor findings after Phase 5F are classified as follows:

- Trusted public RPCs intentionally trigger the authenticated `SECURITY DEFINER` warning when they must be callable by signed-in users; fixed search paths and unauthorized-path tests are the control.
- `public.roles` and `public.user_roles` RLS-without-policy notices remain intentional because browser table access is not granted.
- Supabase Leaked Password Protection remains unavailable under the accepted Free-tier baseline and is not a Core release blocker.

Performance Advisor continues to report unindexed foreign-key candidates, unused development indexes, and multiple permissive SELECT policies. New Phase 5F indexes may appear unused immediately after deployment. No index or policy is added/removed merely to silence advisor output; optimization remains query-plan-driven.

Advisor references:
- RLS enabled without policy: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Authenticated SECURITY DEFINER RPC: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Leaked password protection: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
- Multiple permissive policies: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies
- Unindexed foreign keys: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

## Approved Core V2 decisions

Core V2 is one multi-school EDU SHARE+ network. Teacher authority remains school-scoped. Student access requires a confirmed email, approved account, and verified school membership. Marketplace visibility may span the network where school policy permits without granting cross-school moderation authority. Storage buckets are private. Contact reveal will be a trusted audited workflow. Phase 5 collects structured price inputs but does not yet implement a price estimator.

## Current checkpoint

**Phase 5J — Remove Runtime Mock: PASS.**
**Phase 5 (All 10 Sub-phases 5A–5J) Complete & Verified.**

## Known gaps / next-phase work

- Phase 6 introduces verified outcome tracking, AI price helper / reputation indicators based on real transactions, and production telemetry.
- Development users created before Phase 5B may require roster reconciliation or explicit teacher verification before protected student access.
- Performance Advisor findings remain evidence for later query-plan-driven optimization, not automatic schema changes.

## Accepted Free-Plan limitations

- Supabase Leaked Password Protection is not required for the current Core release gate under the Free-tier-first policy.
- GitHub-hosted Actions overage is disabled; CI uses a repository-scoped self-hosted Linux runner instead.
- Security relies on mandatory email confirmation, strong application password rules, safe sessions, RLS, narrow trusted RPC permissions, explicit current-password verification, private Storage, and school/teacher verification.
- Paid platform features may be adopted later only when their value justifies cost.

## Definition of Done

A checkpoint passes only after build/tests, relevant database/RLS verification, Security Advisor review, documentation update, and unauthorized-path checks pass. Warnings caused solely by unavailable paid-only features may be explicitly accepted when a documented free alternative/risk treatment exists.

## Next checkpoint

**Phase 6 — Verified outcomes and research features**
