# Phase 4E.2B3 — Real Teacher Login + Trusted Staff Session Guard

## Source-preservation

This checkpoint keeps the existing Teacher Login visual structure and labels.
It changes only authentication/authorization behavior.

## Teacher login flow

1. `signInWithPassword()` authenticates email/password.
2. `get_current_staff_context()` verifies:
   - current `auth.uid()`;
   - approved profile;
   - active `teacher_moderator` or `admin` role;
   - school scope for Teacher/Moderator.
3. Only a trusted staff context may enter `?page=admin`.
4. If credentials belong to a Student/non-staff identity, the newly-created
   local Auth session is immediately removed and Teacher Portal access is denied.

## Existing sessions

- Existing trusted staff session: Teacher Login redirects to Admin.
- Existing non-staff session: form remains blocked until user explicitly signs
  out the current local session.
- No service-role/secret key is used in browser code.

## Admin route guard

Opening `?page=admin` directly triggers a trusted staff-session check.

- No session -> `loginGV`
- Non-staff session -> `loginGV`
- Trusted Teacher/Admin -> Admin Dashboard
- Refresh while trusted staff session exists -> Admin remains available

## Out of scope

- Account Review Queue UI
- Approve/reject buttons
- Report/moderation mutations

Those are Phase 4E.2B4.
