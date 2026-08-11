# Live Database Test Prerequisites — Not Yet Executed

Before any 3D SQL is promoted from `database/drafts/` to real migrations:

1. Project owner approves 3D.
2. A development Supabase project or local Supabase stack is created — never production first.
3. Supabase/PostgreSQL version and exposed schemas are recorded.
4. `private` is confirmed absent from Exposed Schemas.
5. Test users/roles use synthetic development identities, not legacy student credentials.
6. No legacy account migration is performed.
7. SQL files are promoted one-by-one into the real migration directory only after review.
8. Each migration run is followed by schema assertions and the relevant test matrix subset.
9. RLS is tested using anon/authenticated contexts, not only the postgres/service role.
10. A rollback/forward-fix note is recorded before each live migration wave.
