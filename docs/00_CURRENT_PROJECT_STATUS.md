# EDU SHARE+ — Current Project Status

## Current state

- Current implementation generation: React + Vite + TypeScript + Supabase.
- The Google Apps Script / Google Sheets generation is frozen as historical and research reference; operational legacy data is not migrated into V2.
- Phase 4G Auth lifecycle hardening is the latest completed product milestone before Core V2 Phase 5.
- Phase 5A — Foundation Stabilization is in progress on `phase/5a-foundation-stabilization`.

## Runtime architecture

Auth and teacher account-review flows use real Supabase. Marketplace, owner-post, profile simulation, and post-moderation flows still materially depend on the runtime mock repository boundary. `src/main.tsx` still constructs `createMockRepositories()`; removal belongs to Phase 5J.

## Live Supabase state

- PostgreSQL 17 project is operational.
- Public app tables use RLS.
- Trusted student/staff/account-review RPCs are live.
- Storage metadata tables exist, but application Storage buckets are not yet provisioned.
- `public.rls_auto_enable()` browser-role EXECUTE access was revoked in migration `20260820235606_harden_rls_auto_enable_execute`.
- Leaked-password protection remains a hosted Auth setting to enable before Phase 5A can be marked PASS.

## Approved Core V2 decisions

Core V2 is one multi-school EDU SHARE+ network. Teacher authority remains school-scoped. Student access requires a confirmed email, approved account, and verified school membership. School roster matching will provide automatic verification; unmatched registrations go to teacher review. Marketplace supports school/network visibility. Storage buckets will be private. Contact reveal is a trusted audited workflow. Phase 5 collects structured price inputs but does not yet implement a price estimator.

## Current checkpoint

**Phase 5A — Foundation Stabilization: IN PROGRESS**

## Known gaps

- Hosted leaked-password protection is still disabled.
- Local Auth confirmation configuration must be validated in a local Supabase runtime.
- Marketplace/profile/posts remain partially mock-backed.
- No operational Storage buckets exist yet.
- No roster subsystem exists yet.

## Definition of Done

A checkpoint passes only after build/tests, relevant database/RLS verification, Security Advisor review, documentation update, and unauthorized-path checks pass.

## Next checkpoint

**Phase 5B — Roster & Registration Trust Layer**
