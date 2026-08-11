# EDU SHARE+ Database Drafts — Checkpoint 3D

**DO NOT EXECUTE THESE FILES ON A LIVE SUPABASE PROJECT YET.**

These SQL files are an offline implementation draft generated from the accepted 3C physical schema contract. They are deliberately stored under `database/drafts/` rather than `supabase/migrations/` so that downloading/copying this checkpoint cannot accidentally turn them into live migrations.

Intended review/execution order later:

1. `0000_bootstrap.sql`
2. `0010_identity_access.sql`
3. `0020_marketplace.sql`
4. `0030_interactions.sql`
5. `0040_moderation_reports_private.sql`
6. `0050_verification.sql`
7. `0060_transactions_cases.sql`
8. `0070_price_reputation.sql`
9. `0080_indexes.sql`
10. `0090_rls_helpers.sql`
11. `0100_rls_policies.sql`
12. `0110_grants.sql`
13. `0120_schema_assertions.sql`

Important boundaries:

- `auth.users` is referenced but never created by these drafts.
- No legacy accounts/users are inserted.
- No legacy posts/research data are inserted.
- No Storage bucket/policy is created in Phase 3.
- Complex workflows still require reviewed trusted RPC/function migrations before the frontend can use a live backend.
- A safe privacy-respecting seller/public-profile projection is intentionally deferred until live RLS tests can verify it; `profiles` is not directly readable by anonymous users.
- The draft diverges intentionally from examples that cascade Auth-user deletion: EDU SHARE+ uses controlled account closure and historical retention, so `profiles.user_id -> auth.users.id` is drafted as `ON DELETE RESTRICT`.
