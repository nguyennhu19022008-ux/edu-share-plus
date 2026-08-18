# Phase 4G — Auth Lifecycle Hardening

## Why this checkpoint exists

After 4F, the main sign-in/recovery flows work, but the lifecycle audit found two gaps:

1. Teacher/Admin `Thoát` only navigated to Landing; it did not end the Supabase session.
2. Database authorization (student approval/status, staff role/school scope) was checked primarily on route entry. A long-lived open tab needed a foreground/token-change recheck.

## Changes

### Real Teacher/Admin logout
`AdminTopbar` now calls `signOutStaff()` before navigating to Landing.
The existing staff auth service uses `supabase.auth.signOut({ scope: 'local' })`.

### Foreground authorization revalidation
`LegacyApplicationShell` revalidates when:
- a protected route is entered/changed;
- the browser window receives focus;
- the document becomes visible again;
- the Supabase access token changes.

Student protected routes call the trusted student context RPC again through `refreshProfile()`.
Admin route calls the trusted staff context RPC again through `inspectExistingStaffSession()`.

## Boundaries

- No database migration.
- No role/status mutation is performed by the lifecycle layer.
- No service-role key in browser.
- Student logout behavior is unchanged and remains Auth-backed.
- UI structure is preserved.

## Next

After this checkpoint passes, Phase 4H performs the final Auth integration/security audit including regression checks across signup, login, approval, recovery, logout, wrong-portal authorization and session persistence.
