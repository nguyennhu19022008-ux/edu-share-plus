# Phase 4E.2B2 — Student / Staff Role Separation

## Why this checkpoint exists

The Phase 4D student session guard originally loaded the caller's `profiles`
row and treated `account_status = approved` as sufficient for Student access.

After Phase 4E.2A, the project now has an approved `teacher_moderator` Auth
identity. Without a role check, that staff session could be mistaken for an
approved Student session by the frontend.

## Fix

- `private.is_approved_user()` now requires:
  - authenticated `auth.uid()`;
  - `profiles.account_status = approved`;
  - active `student` role;
  - student role school scope equals profile school.
- New `public.get_current_student_context()` RPC:
  - derives identity from `auth.uid()`;
  - verifies active Student role;
  - returns only safe Student session context.
- `authService.ts` loads Student session context through that RPC instead of
  reading `profiles` alone.
- `roles` and `user_roles` stay closed to browser SELECT.

## Expected regression behavior

- Vương Gia (student + pending_review): authenticates, Student context resolves,
  Marketplace remains blocked until approved.
- Approved Student: Student context resolves and Student routes may open.
- Teacher TEST (teacher_moderator + approved): Student context RPC rejects with
  `EDU_SHARE_STUDENT_ROLE_REQUIRED`.
- Teacher session therefore cannot be accepted by the Student guard merely
  because its profile is approved.

## Scope

No visible redesign.
No account migration.
No teacher UI yet.
