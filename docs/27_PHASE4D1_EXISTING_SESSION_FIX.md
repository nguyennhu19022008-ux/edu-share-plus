# 4D.1 — Existing Session Login Fix

## Root cause

The browser may already contain a persisted Supabase session after email
confirmation or a previous successful login. A later `signInWithPassword()`
attempt with the wrong password correctly returns an error, but that error does
not mean the previous valid browser session no longer exists.

## Fix

- Login form is disabled while an existing session is present.
- User must explicitly click **Đăng xuất phiên hiện tại** before attempting a
  new password login.
- Current-device logout uses `signOut({ scope: 'local' })`.
- Wrong-password testing therefore starts from a known signed-out state.
- No database migration or UI redesign is introduced.

## Regression test

1. Open student login with an existing session.
2. Confirm form is disabled and logout action is visible.
3. Log out current session.
4. Enter correct email + wrong password.
5. Expected: `Email hoặc mật khẩu không đúng.`
6. Confirm protected routes redirect to login.
7. Enter correct password.
8. Pending-review account must authenticate but remain blocked from Marketplace.
