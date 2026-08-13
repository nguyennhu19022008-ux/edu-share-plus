# Phase 4C — React Supabase Client + Real Student Registration

## Scope

This checkpoint connects only the student registration surface to the DEVELOPMENT Supabase project.

It does not migrate legacy students and does not make the rest of the application use live Supabase data yet.

## Runtime boundaries

- Browser uses `VITE_SUPABASE_URL` + low-privilege publishable key only.
- No secret/service-role key is used in React.
- Schools are loaded from `public.schools` through existing guest RLS policy.
- Registration uses `supabase.auth.signUp()` with metadata required by Phase 4B provisioning triggers.
- With email confirmation enabled, a successful signup does not navigate into Marketplace; the user must verify email first.
- School approval remains distinct from email verification.

## Metadata contract

`signUp()` sends `full_name`, `school_id`, `class_name`, and `phone`.

The Phase 4B database trigger provisions `profiles`, `profile_private`, student role, then queues account review only after email confirmation.

## Not in scope

Login/session enforcement, teacher account approval actions, password reset, real marketplace repositories, Storage, and legacy account migration remain later checkpoints.
