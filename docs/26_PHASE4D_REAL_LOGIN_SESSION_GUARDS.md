# 26 — PHASE 4D: Real Student Login, Session & Approval Guards

## Scope

Checkpoint 4D replaces the Phase-1 simulated student login/logout path with the existing Supabase Auth development project while preserving the frozen EDU SHARE+ visual shell.

This checkpoint does **not** implement teacher login, teacher approval mutation, password recovery, or migration of legacy GAS accounts.

## Runtime flow

```text
Email + password
  -> supabase.auth.signInWithPassword()
  -> authenticated Supabase session
  -> SELECT own public.profiles row through RLS
  -> account_status gate
       approved       -> student route allowed
       pending_review -> login/status screen
       rejected       -> login/status screen
       suspended      -> login/status screen
```

Email verification and school approval remain separate controls.

## Session ownership

`AuthSessionProvider` is mounted once at the application root. It listens to Supabase Auth state changes, keeps the current session/profile in React context, and allows the session persisted by Supabase JS to survive browser refreshes.

The client continues to use only the browser-safe publishable key from `.env.local`.

## Student route guard

These frozen student routes are protected at the application shell:

- `index`
- `add`
- `editPost`
- `detail`
- `myPosts`
- `myDetail`
- `profile`

Unauthenticated users are redirected to `loginStudent` with a same-origin `next` target. Authenticated users whose profile is not `approved` are also redirected to the login/status screen.

This frontend guard is UX/access-flow enforcement only. Database authorization remains RLS/grants.

## Logout

The Student Header now calls `supabase.auth.signOut()` before returning to Landing. A pending/rejected/suspended authenticated user can also clear the current session from the login page.

## Deliberately deferred

- Teacher login and teacher account approval mutation
- Password recovery
- Real Profile data replacement for all local Phase-1 profile features
- Real notifications
- Real marketplace repositories
- Auth/RLS multi-account test matrix

## 4D acceptance gate

1. Existing confirmed test student can submit email/password to Supabase Auth.
2. Wrong password is rejected without entering Marketplace.
3. `pending_review` student remains blocked from protected student routes.
4. Direct visit to `?page=index` while signed out returns to Student Login.
5. Session state persists across browser refresh.
6. Pending session can be signed out from Login.
7. Student Header uses the Auth user's name/email whenever an approved session is later available.
8. Student Header logout clears the Supabase session.
9. Production build passes.
10. `.env.local` remains untracked.
