# Checkpoint 3D — Migration SQL Draft + RLS Policy Draft + Database Test Matrix

## Status

**CANDIDATE / OFFLINE ONLY. No Supabase project was created and no SQL in this checkpoint was executed.**

Checkpoint 3D converts the accepted 3C physical contract into auditable SQL drafts while deliberately preventing accidental live execution. The files live under `database/drafts/`, not `supabase/migrations/`.

## Deliverables

- `database/drafts/0000_bootstrap.sql`
- `database/drafts/0010_identity_access.sql`
- `database/drafts/0020_marketplace.sql`
- `database/drafts/0030_interactions.sql`
- `database/drafts/0040_moderation_reports_private.sql`
- `database/drafts/0050_verification.sql`
- `database/drafts/0060_transactions_cases.sql`
- `database/drafts/0070_price_reputation.sql`
- `database/drafts/0080_indexes.sql`
- `database/drafts/0090_rls_helpers.sql`
- `database/drafts/0100_rls_policies.sql`
- `database/drafts/0110_grants.sql`
- `database/drafts/0120_schema_assertions.sql`
- `database/tests/00_DATABASE_TEST_MATRIX.md`
- `database/tests/01_LIVE_TEST_PREREQUISITES.md`

## Security decisions implemented in the draft

1. Every browser-facing app table has an explicit `ENABLE ROW LEVEL SECURITY` statement.
2. RLS and SQL object privileges are treated separately; broad table privileges are revoked before a small browser grant surface is added.
3. Browser identity is derived from `auth.uid()`, never from client-supplied email or owner UUID.
4. Security helper functions are in non-exposed `private`, are `SECURITY DEFINER` only where necessary, lock `search_path=''`, fully qualify relations and receive narrow EXECUTE grants.
5. Anonymous users cannot directly query `profiles` or `profile_private`; a privacy-safe seller projection/RPC will be added only after live RLS testing.
6. Complex workflow tables intentionally have no browser mutation policy. Post submission/moderation, reports, verification, transactions, cases, role changes, estimator writes, reputation writes, audit and analytics remain trusted operations.
7. Direct mutations are restricted to low-risk surfaces such as own favorites, initial own comments, own profile display fields and marking own notifications read.
8. Private audit/analytics/legacy-import tables receive no browser table privileges.

## Important implementation caveat

This checkpoint is intentionally not claiming executable validation. SQL structure has been mechanically/static-reviewed only. Actual PostgreSQL/Supabase parsing, dependency execution, RLS behavior and query plans must be proven in the next live/local database checkpoint before any frontend repository adapter changes.

## Draft-specific review points before execution

- Confirm controlled Auth-user deletion strategy (`profiles -> auth.users` is drafted `ON DELETE RESTRICT`, intentionally different from common cascade examples).
- Confirm whether Teacher/Moderator may see full `profile_private` during account review or whether a narrower review projection is required before production.
- Confirm public Marketplace seller presentation through a dedicated privacy-safe RPC/projection before browser backend integration.
- Confirm category seed codes and hierarchy; visible Vietnamese labels remain frozen.
- Confirm future Storage MIME/size limits per bucket; 3D only stores metadata constraints.
- Confirm business RPC signatures before promoting workflow tables to live use.

## Acceptance gate

3D is accepted when:

- SQL drafts match 3C without redesigning the frontend;
- no credentials/Supabase project are introduced;
- direct browser grants are least-privilege;
- RLS default-deny behavior exists for unapproved operations;
- private data is structurally isolated;
- database test matrix covers integrity, permission bypass and performance;
- project owner approves moving to a development database setup checkpoint.
