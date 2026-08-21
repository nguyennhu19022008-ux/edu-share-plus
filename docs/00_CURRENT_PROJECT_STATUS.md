# EDU SHARE+ — Current Project Status

## Current state

- Current implementation generation: React + Vite + TypeScript + Supabase.
- The Google Apps Script / Google Sheets generation is frozen as historical and research reference; operational legacy data is not migrated into V2.
- Phase 4G Auth lifecycle hardening is the latest completed product milestone before Core V2 Phase 5.
- **Phase 5A — Foundation Stabilization is PASS** on `phase/5a-foundation-stabilization`; integration into `main` remains a separate release action.
- **Cost policy: Free-tier-first.** Core functionality must work on the Supabase Free Plan and other free/open-source tooling wherever practical. Paid-only platform features are optional hardening/scale upgrades, not Core release blockers unless the project owner explicitly changes this policy.

## Runtime architecture

Auth and teacher account-review flows use real Supabase. Marketplace, owner-post, profile simulation, and post-moderation flows still materially depend on the runtime mock repository boundary. `src/main.tsx` still constructs `createMockRepositories()`; removal belongs to Phase 5J.

## Live Supabase state

- PostgreSQL 17 project is operational.
- Public app tables use RLS.
- Trusted student/staff/account-review RPCs are live.
- Storage metadata tables exist, but application Storage buckets are not yet provisioned.
- `public.rls_auto_enable()` browser-role EXECUTE access was revoked in migration `20260820235606_harden_rls_auto_enable_execute`.
- Hosted verification confirms `anon` and `authenticated` cannot execute `public.rls_auto_enable()` while its database event trigger remains intact.
- Supabase Security Advisor reports leaked-password protection disabled. Supabase documents this feature as **Pro Plan and above**, so the warning is accepted on the Free Plan and does not block Core V2 release.

## Phase 5A verification evidence

GitHub Actions CI run `32433067195` verified the final implementation tree before the PASS status update:

- `npm ci`: PASS
- route-access unit tests: PASS (4/4)
- `tsc -b && vite build`: PASS
- clean local Supabase migration replay/start: PASS
- local Auth end-to-end flow: PASS
  - signup returns no session before email confirmation
  - password login is blocked before confirmation
  - confirmation email is captured and verified through local Mailpit
  - login succeeds after confirmation
  - trusted student context resolves the expected pending-review account
  - the student's own pending account-review record is visible under existing RLS
- hosted Supabase Security Advisor was rerun after the DDL change; the former exposed `rls_auto_enable()` warning is absent.

## Approved Core V2 decisions

Core V2 is one multi-school EDU SHARE+ network. Teacher authority remains school-scoped. Student access requires a confirmed email, approved account, and verified school membership. School roster matching will provide automatic verification; unmatched registrations go to teacher review. Marketplace supports school/network visibility. Storage buckets will be private. Contact reveal is a trusted audited workflow. Phase 5 collects structured price inputs but does not yet implement a price estimator.

## Current checkpoint

**Phase 5A — Foundation Stabilization: PASS**

## Known gaps / next-phase work

- Marketplace/profile/posts remain partially mock-backed.
- No operational Storage buckets exist yet.
- No roster subsystem exists yet.
- Performance Advisor findings are recorded for later query-driven optimization; development-time unused-index notices are not treated as evidence that indexes should be removed.

## Accepted Free-Plan limitations

- Supabase Leaked Password Protection is paid-only (Pro+), so it is not required for Phase 5A PASS.
- Security on Free Plan instead relies on mandatory email confirmation, strong application password rules, safe session handling, RLS, narrow RPC permissions, and school/teacher verification.
- Paid platform features may be adopted later only when they provide enough value to justify cost.

## Definition of Done

A checkpoint passes only after build/tests, relevant database/RLS verification, Security Advisor review, documentation update, and unauthorized-path checks pass. Warnings caused solely by unavailable paid-only features may be explicitly accepted when a documented free alternative/risk treatment exists.

## Next checkpoint

**Phase 5B — Roster & Registration Trust Layer**
