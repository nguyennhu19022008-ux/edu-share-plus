# Phase 4F — Password Recovery

## Goal

Connect the existing Student and Teacher `Quên mật khẩu?` actions to Supabase Auth without changing account roles, school scope, profile approval state, or the frozen visual language.

## Flow

1. Login portal -> `forgotPassword?portal=student|teacher`.
2. `resetPasswordForEmail()` sends the recovery link.
3. Redirect returns to `updatePassword?portal=...`.
4. The app records Supabase `PASSWORD_RECOVERY` as a session-scoped recovery marker.
5. Update page requires both an authenticated recovery session and that marker.
6. New password follows EDU SHARE+ policy: >=8 chars, lower, upper, number.
7. `updateUser({ password })` updates the Auth password.
8. Local recovery session is signed out.
9. User returns to the original login portal and signs in again.

## Security boundaries

- Browser uses only the publishable Supabase key.
- No service-role/admin API.
- Reset does not update `profiles`, `user_roles`, `account_reviews`, school scope, or approval status.
- A manually opened `updatePassword` route is rejected unless the browser has a marked recovery session.
- Sign-out clears the recovery marker.

## Configuration prerequisite

The redirect URL used in development is based on the current origin/path and resolves to:
`http://localhost:5173/?page=updatePassword&portal=...`

The Supabase Auth Redirect URLs allowlist must permit the localhost callback. Before public release, production callback URLs and Custom SMTP must be configured and tested.
