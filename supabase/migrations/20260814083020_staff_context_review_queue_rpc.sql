-- EDU SHARE+ / PHASE 4E.2B1
-- Trusted Staff Session Context + Account Review Queue RPCs
-- DEVELOPMENT Supabase project only.
--
-- Purpose:
--   1) Let authenticated staff prove their staff role without direct
--      browser SELECT on public.roles/public.user_roles.
--   2) Return a school-scoped account-review queue for Teacher/Moderator.
--   3) Return a global queue for Admin.
--   4) Keep all authorization server-side via auth.uid() + trusted helpers.
--
-- No direct table mutation is introduced in this migration.

-- =========================================================
-- 1. CURRENT STAFF CONTEXT
-- =========================================================

create or replace function public.get_current_staff_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;

  v_role_code text;
  v_school_id uuid;
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
      message = 'EDU_SHARE_STAFF_PROFILE_NOT_FOUND';
  end if;

  if v_profile.account_status <> 'approved' then
    raise exception using
      message = 'EDU_SHARE_STAFF_ACCOUNT_NOT_APPROVED';
  end if;

  -- Global Admin has priority.
  if (select private.has_role('admin', null)) then
    v_role_code := 'admin';
    v_school_id := null;
    v_school_name := null;
  else
    select
      r.code,
      ur.school_id,
      s.name
    into
      v_role_code,
      v_school_id,
      v_school_name
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
    left join public.schools s
      on s.id = ur.school_id
    where ur.user_id = v_actor_id
      and ur.revoked_at is null
      and r.code = 'teacher_moderator'
    order by ur.assigned_at asc, ur.id asc
    limit 1;

    if v_role_code is null then
      raise exception using
        message = 'EDU_SHARE_STAFF_ACCESS_REQUIRED',
        detail = 'The authenticated account is not an Admin or Teacher/Moderator.';
    end if;

    if v_school_id is null then
      raise exception using
        message = 'EDU_SHARE_TEACHER_SCHOOL_SCOPE_MISSING';
    end if;
  end if;

  return jsonb_build_object(
    'user_id', v_actor_id,
    'full_name', v_profile.full_name,
    'account_status', v_profile.account_status,
    'role_code', v_role_code,
    'school_id', v_school_id,
    'school_name', v_school_name
  );
end;
$$;

comment on function public.get_current_staff_context() is
  'Returns trusted current staff identity/scope derived from auth.uid(), profile status and user_roles.';


-- =========================================================
-- 2. SCHOOL-SCOPED ACCOUNT REVIEW QUEUE
-- =========================================================

create or replace function public.list_account_review_queue()
returns table (
  review_id uuid,
  user_id uuid,
  full_name text,
  contact_email text,
  phone text,
  student_reference_code text,
  school_id uuid,
  school_name text,
  class_name_claim text,
  review_status text,
  submitted_at timestamptz,
  current_reason text,
  submission_snapshot jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_admin boolean;
  v_has_teacher_role boolean;
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'An authenticated staff session is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = v_actor_id
      and p.account_status = 'approved'
  ) then
    raise exception using
      message = 'EDU_SHARE_STAFF_ACCOUNT_NOT_APPROVED';
  end if;

  v_is_admin := (select private.has_role('admin', null));

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
    where ur.user_id = v_actor_id
      and ur.revoked_at is null
      and r.code = 'teacher_moderator'
      and ur.school_id is not null
  )
  into v_has_teacher_role;

  if not v_is_admin and not v_has_teacher_role then
    raise exception using
      message = 'EDU_SHARE_STAFF_ACCESS_REQUIRED',
      detail = 'Only Admin or Teacher/Moderator may read the account-review queue.';
  end if;

  return query
  select
    ar.id as review_id,
    p.user_id,
    p.full_name,
    pp.contact_email,
    pp.phone,
    pp.student_reference_code,
    p.school_id,
    s.name as school_name,
    nullif(btrim(ar.submission_snapshot ->> 'class_name'), '') as class_name_claim,
    ar.status as review_status,
    ar.submitted_at,
    ar.reason as current_reason,
    ar.submission_snapshot
  from public.account_reviews ar
  join public.profiles p
    on p.user_id = ar.user_id
  join public.schools s
    on s.id = p.school_id
  left join public.profile_private pp
    on pp.user_id = p.user_id
  where ar.status in ('pending', 'needs_information')
    and p.account_status = 'pending_review'
    and (
      v_is_admin
      or (select private.can_review_user(p.user_id))
    )
  order by
    case when ar.status = 'needs_information' then 0 else 1 end,
    ar.submitted_at asc,
    ar.id asc;
end;
$$;

comment on function public.list_account_review_queue() is
  'Returns only pending/needs_information student account reviews within current Teacher/Moderator school scope, or globally for Admin.';


-- =========================================================
-- 3. FUNCTION PRIVILEGES
-- =========================================================

revoke all
on function public.get_current_staff_context()
from public, anon;

revoke all
on function public.list_account_review_queue()
from public, anon;

grant execute
on function public.get_current_staff_context()
to authenticated;

grant execute
on function public.list_account_review_queue()
to authenticated;


-- =========================================================
-- 4. REASSERT SENSITIVE TABLE BOUNDARIES
-- =========================================================

-- Browser must still not inspect role tables directly.
revoke all on public.roles from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;

-- Browser must still not mutate the review queue directly.
revoke insert, update, delete
on public.account_reviews
from anon, authenticated;

-- Keep private schema non-browser-accessible.
revoke all on schema private from public, anon, authenticated;
