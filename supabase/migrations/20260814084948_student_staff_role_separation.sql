-- EDU SHARE+ / PHASE 4E.2B2
-- Student / Staff Role Separation Hardening
-- DEVELOPMENT Supabase project only.
--
-- Purpose:
--   1) Prevent an approved Teacher/Admin profile from being treated as an
--      approved Student merely because profiles.account_status='approved'.
--   2) Provide a trusted current-student context derived from auth.uid()
--      + active student role + profile.
--   3) Tighten private.is_approved_user() so student-only mutation policies
--      require an actual active Student assignment in the same school.
--
-- This migration does NOT change visible UI and does NOT migrate users.

-- =========================================================
-- 1. HARDEN APPROVED-STUDENT HELPER
-- =========================================================

create or replace function private.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.user_roles ur
        on ur.user_id = p.user_id
       and ur.revoked_at is null
       and ur.school_id = p.school_id
      join public.roles r
        on r.id = ur.role_id
       and r.code = 'student'
      where p.user_id = (select auth.uid())
        and p.account_status = 'approved'
    );
$$;

revoke execute
on function private.is_approved_user()
from public, anon;

grant execute
on function private.is_approved_user()
to authenticated;


-- =========================================================
-- 2. TRUSTED CURRENT STUDENT CONTEXT
-- =========================================================

create or replace function public.get_current_student_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_school_name text;
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'An authenticated session is required.';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.user_id = v_actor_id;

  if not found then
    raise exception using
      message = 'EDU_SHARE_STUDENT_PROFILE_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
    where ur.user_id = v_actor_id
      and ur.revoked_at is null
      and ur.school_id = v_profile.school_id
      and r.code = 'student'
  ) then
    raise exception using
      message = 'EDU_SHARE_STUDENT_ROLE_REQUIRED',
      detail = 'The authenticated identity is not an active Student account.';
  end if;

  select s.name
  into v_school_name
  from public.schools s
  where s.id = v_profile.school_id;

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'full_name', v_profile.full_name,
    'account_status', v_profile.account_status,
    'school_id', v_profile.school_id,
    'school_name', v_school_name,
    'class_id', v_profile.class_id
  );
end;
$$;

comment on function public.get_current_student_context() is
  'Returns trusted current Student identity/status derived from auth.uid(), active Student role and profile.';


-- =========================================================
-- 3. FUNCTION PRIVILEGES
-- =========================================================

revoke all
on function public.get_current_student_context()
from public, anon;

grant execute
on function public.get_current_student_context()
to authenticated;


-- =========================================================
-- 4. REASSERT ROLE TABLE BOUNDARY
-- =========================================================

revoke all on public.roles from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;
revoke all on schema private from public, anon, authenticated;
