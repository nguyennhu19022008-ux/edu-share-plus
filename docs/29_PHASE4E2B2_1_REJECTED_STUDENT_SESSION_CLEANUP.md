# Phase 4E.2B2.1 — Rejected Student Session Cleanup

## Problem

A Teacher can have valid Supabase credentials. `signInWithPassword()` therefore
creates a valid Auth session before Student-role authorization runs.

When `get_current_student_context()` rejects the Teacher with
`EDU_SHARE_STUDENT_ROLE_REQUIRED`, the Auth session must be removed immediately.
Otherwise the Student Login page sees a persisted session and replaces the
useful role error with the generic "existing session" state.

## Fix

`StudentLoginPage` now treats Student login as two gates:

1. Authentication: email + password.
2. Authorization: trusted Student context RPC.

If gate 2 fails after gate 1 succeeded, the newly-created local Supabase session
is explicitly signed out before the authorization error is shown.

## Expected Teacher-on-Student-Portal result

- Correct Teacher email/password: Auth succeeds internally.
- Student context: denied.
- Local Auth session: removed.
- Visible message:
  `Tài khoản này không phải tài khoản học sinh. Vui lòng sử dụng cổng đăng nhập phù hợp.`
- Marketplace: not entered.
- Student login form: usable again, not stuck in "existing session".
