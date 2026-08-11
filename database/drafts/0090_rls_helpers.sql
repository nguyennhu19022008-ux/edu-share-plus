-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


-- SECURITY DEFINER helpers are intentionally placed in the non-exposed private schema.
-- All referenced objects are schema-qualified and search_path is locked to ''.

create or replace function private.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.account_status='approved'
  );
$$;

create or replace function private.has_role(p_role_code text, p_school_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id=ur.role_id
    where ur.user_id=auth.uid()
      and ur.revoked_at is null
      and r.code=p_role_code
      and (ur.school_id is null or (p_school_id is not null and ur.school_id=p_school_id))
  );
$$;

create or replace function private.can_moderate_school(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_role('admin', p_school_id)
      or private.has_role('teacher_moderator', p_school_id);
$$;

create or replace function private.can_review_user(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id=p_user_id and private.can_moderate_school(p.school_id)
  );
$$;

create or replace function private.can_view_post(p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.posts p
    join public.profiles owner on owner.user_id=p.owner_id
    where p.id=p_post_id
      and (
        (p.moderation_status='approved' and p.lifecycle_status='active' and p.is_hidden=false and owner.account_status='approved')
        or p.owner_id=auth.uid()
        or private.can_moderate_school(p.school_id)
      )
  );
$$;

create or replace function private.can_view_verification_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.verification_requests vr
    join public.posts p on p.id=vr.post_id
    where vr.id=p_request_id
      and (
        vr.requester_id=auth.uid()
        or p.owner_id=auth.uid()
        or vr.assigned_verifier_id=auth.uid()
        or private.can_moderate_school(p.school_id)
        or private.has_role('admin', p.school_id)
      )
  );
$$;

create or replace function private.can_verify_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.verification_requests vr
    join public.posts p on p.id=vr.post_id
    where vr.id=p_request_id
      and (vr.assigned_verifier_id=auth.uid() or private.has_role('admin', p.school_id))
  );
$$;

create or replace function private.can_moderate_report(p_report_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reports r
    left join public.posts rp on rp.id=r.post_id
    left join public.comments rc on rc.id=r.comment_id
    left join public.posts rcp on rcp.id=rc.post_id
    left join public.profiles ru on ru.user_id=r.reported_user_id
    where r.id=p_report_id
      and private.can_moderate_school(coalesce(rp.school_id, rcp.school_id, ru.school_id))
  );
$$;

create or replace function private.can_view_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cases c
    left join public.posts p on p.id=c.post_id
    left join public.profiles opener on opener.user_id=c.opened_by
    where c.id=p_case_id
      and (
        c.opened_by=auth.uid()
        or c.assigned_to=auth.uid()
        or exists (select 1 from public.case_participants cp where cp.case_id=c.id and cp.user_id=auth.uid())
        or private.can_moderate_school(coalesce(p.school_id, opener.school_id))
        or private.has_role('admin', coalesce(p.school_id, opener.school_id))
      )
  );
$$;

create or replace function private.can_handle_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cases c
    left join public.posts p on p.id=c.post_id
    left join public.profiles opener on opener.user_id=c.opened_by
    where c.id=p_case_id
      and (
        c.assigned_to=auth.uid()
        or private.can_moderate_school(coalesce(p.school_id, opener.school_id))
        or private.has_role('admin', coalesce(p.school_id, opener.school_id))
      )
  );
$$;

revoke all on function private.is_approved_user() from public, anon, authenticated;
revoke all on function private.has_role(text, uuid) from public, anon, authenticated;
revoke all on function private.can_moderate_school(uuid) from public, anon, authenticated;
revoke all on function private.can_review_user(uuid) from public, anon, authenticated;
revoke all on function private.can_view_post(uuid) from public, anon, authenticated;
revoke all on function private.can_view_verification_request(uuid) from public, anon, authenticated;
revoke all on function private.can_verify_request(uuid) from public, anon, authenticated;
revoke all on function private.can_moderate_report(uuid) from public, anon, authenticated;
revoke all on function private.can_view_case(uuid) from public, anon, authenticated;
revoke all on function private.can_handle_case(uuid) from public, anon, authenticated;

-- The schema is not intended to be in Supabase Exposed Schemas. USAGE is required
-- only so RLS policies can invoke the narrowly granted helpers below.
grant usage on schema private to anon, authenticated;
grant execute on function private.can_view_post(uuid) to anon, authenticated;
grant execute on function private.is_approved_user() to authenticated;
grant execute on function private.has_role(text, uuid) to authenticated;
grant execute on function private.can_moderate_school(uuid) to authenticated;
grant execute on function private.can_review_user(uuid) to authenticated;
grant execute on function private.can_view_verification_request(uuid) to authenticated;
grant execute on function private.can_verify_request(uuid) to authenticated;
grant execute on function private.can_moderate_report(uuid) to authenticated;
grant execute on function private.can_view_case(uuid) to authenticated;
grant execute on function private.can_handle_case(uuid) to authenticated;
