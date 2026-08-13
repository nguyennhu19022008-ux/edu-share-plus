-- EDU SHARE+ / PHASE 4B
-- Auth Provisioning Foundation
-- DEVELOPMENT Supabase project only.
--
-- Purpose:
--   1) Provision application rows when a Supabase Auth email user signs up.
--   2) Keep school approval separate from email verification.
--   3) Queue teacher account review only after email confirmation.
--   4) Never use raw_user_meta_data directly for authorization/RLS.
--
-- Expected signUp metadata contract for Phase 4C:
--   full_name             required
--   school_id             required UUID of an active public.schools row
--   class_name            optional/free-text claim preserved for review
--   phone                 optional
--   student_reference_code optional
--
-- NOTE:
--   profiles.class_id remains NULL at signup in this version unless a later
--   trusted review workflow resolves the student's claimed class to a
--   public.school_classes row. This preserves the legacy free-text class UX
--   without inventing class reference data.

-- =========================================================
-- 1. ACCOUNT REVIEW SUBMISSION SNAPSHOT
-- =========================================================

alter table public.account_reviews
  add column if not exists submission_snapshot jsonb
  not null default '{}'::jsonb;

alter table public.account_reviews
  drop constraint if exists account_reviews_submission_snapshot_object;

alter table public.account_reviews
  add constraint account_reviews_submission_snapshot_object
  check (jsonb_typeof(submission_snapshot) = 'object');

-- At most one non-terminal review request may be open for a user.
create unique index if not exists account_reviews_one_open_per_user_uniq
  on public.account_reviews(user_id)
  where status in ('pending', 'needs_information');


-- =========================================================
-- 2. NEW AUTH USER PROVISIONING
-- =========================================================

create or replace function private.provision_new_student_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);

  v_full_name text;
  v_school_text text;
  v_school_id uuid;
  v_class_name text;
  v_phone text;
  v_student_reference_code text;

  v_student_role_id uuid;
begin
  -- This trigger is intentionally for email-auth student signup only.
  if new.email is null or btrim(new.email) = '' then
    raise exception using
      message = 'EDU_SHARE_AUTH_EMAIL_REQUIRED',
      detail = 'Student signup requires an email address.';
  end if;

  v_full_name := nullif(btrim(v_meta ->> 'full_name'), '');
  v_school_text := nullif(btrim(v_meta ->> 'school_id'), '');
  v_class_name := nullif(btrim(v_meta ->> 'class_name'), '');
  v_phone := nullif(btrim(v_meta ->> 'phone'), '');
  v_student_reference_code :=
    nullif(btrim(v_meta ->> 'student_reference_code'), '');

  if v_full_name is null then
    raise exception using
      message = 'EDU_SHARE_FULL_NAME_REQUIRED',
      detail = 'raw_user_meta_data.full_name is required.';
  end if;

  if char_length(v_full_name) > 120 then
    raise exception using
      message = 'EDU_SHARE_FULL_NAME_TOO_LONG';
  end if;

  if v_school_text is null then
    raise exception using
      message = 'EDU_SHARE_SCHOOL_REQUIRED',
      detail = 'raw_user_meta_data.school_id is required.';
  end if;

  begin
    v_school_id := v_school_text::uuid;
  exception
    when invalid_text_representation then
      raise exception using
        message = 'EDU_SHARE_INVALID_SCHOOL_ID',
        detail = 'raw_user_meta_data.school_id must be a valid UUID.';
  end;

  if not exists (
    select 1
    from public.schools s
    where s.id = v_school_id
      and s.is_active = true
  ) then
    raise exception using
      message = 'EDU_SHARE_SCHOOL_NOT_ALLOWED',
      detail = 'The selected school does not exist or is inactive.';
  end if;

  if v_class_name is not null and char_length(v_class_name) > 64 then
    raise exception using
      message = 'EDU_SHARE_CLASS_NAME_TOO_LONG';
  end if;

  if v_phone is not null and char_length(v_phone) > 32 then
    raise exception using
      message = 'EDU_SHARE_PHONE_TOO_LONG';
  end if;

  if v_student_reference_code is not null
     and char_length(v_student_reference_code) > 128 then
    raise exception using
      message = 'EDU_SHARE_STUDENT_REFERENCE_TOO_LONG';
  end if;

  select r.id
  into v_student_role_id
  from public.roles r
  where r.code = 'student';

  if v_student_role_id is null then
    raise exception using
      message = 'EDU_SHARE_STUDENT_ROLE_MISSING';
  end if;

  -- Profile is provisioned at signup so metadata/foreign-key problems fail
  -- immediately in the signup request instead of surfacing later at confirm.
  insert into public.profiles (
    user_id,
    school_id,
    class_id,
    full_name,
    account_status
  )
  values (
    new.id,
    v_school_id,
    null,
    v_full_name,
    'pending_review'
  )
  on conflict (user_id) do nothing;

  insert into public.profile_private (
    user_id,
    student_reference_code,
    contact_email,
    phone,
    show_email,
    show_phone
  )
  values (
    new.id,
    v_student_reference_code,
    new.email,
    v_phone,
    false,
    false
  )
  on conflict (user_id) do nothing;

  -- Role assignment does not itself authorize marketplace mutations.
  -- private.is_approved_user() still requires profiles.account_status='approved'.
  insert into public.user_roles (
    user_id,
    role_id,
    school_id,
    assigned_by
  )
  values (
    new.id,
    v_student_role_id,
    v_school_id,
    null
  )
  on conflict do nothing;

  -- If a trusted/admin flow ever creates an already-confirmed email user,
  -- queue the review immediately. Normal public signUp with Confirm Email ON
  -- reaches this later through the email-confirmed UPDATE trigger.
  if new.email_confirmed_at is not null then
    insert into public.account_reviews (
      user_id,
      status,
      submission_snapshot
    )
    values (
      new.id,
      'pending',
      jsonb_build_object(
        'full_name', v_full_name,
        'school_id', v_school_id,
        'class_name', v_class_name,
        'phone', v_phone,
        'student_reference_code', v_student_reference_code,
        'email', new.email,
        'email_confirmed_at', new.email_confirmed_at
      )
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke execute
on function private.provision_new_student_from_auth()
from public, anon, authenticated;


-- =========================================================
-- 3. EMAIL-CONFIRMED REVIEW QUEUE
-- =========================================================

create or replace function private.queue_student_review_after_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_class_name text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = new.id
  ) then
    raise exception using
      message = 'EDU_SHARE_PROFILE_PROVISIONING_MISSING',
      detail = 'Email confirmation cannot queue review without a profile.';
  end if;

  v_class_name := nullif(btrim(v_meta ->> 'class_name'), '');

  insert into public.account_reviews (
    user_id,
    status,
    submission_snapshot
  )
  select
    new.id,
    'pending',
    jsonb_build_object(
      'full_name', p.full_name,
      'school_id', p.school_id,
      'class_name', v_class_name,
      'phone', pp.phone,
      'student_reference_code', pp.student_reference_code,
      'email', new.email,
      'email_confirmed_at', new.email_confirmed_at
    )
  from public.profiles p
  left join public.profile_private pp
    on pp.user_id = p.user_id
  where p.user_id = new.id
  on conflict do nothing;

  return new;
end;
$$;

revoke execute
on function private.queue_student_review_after_email_confirmed()
from public, anon, authenticated;


-- =========================================================
-- 4. AUTH TRIGGERS
-- =========================================================

drop trigger if exists edu_share_on_auth_user_created
on auth.users;

create trigger edu_share_on_auth_user_created
after insert on auth.users
for each row
execute function private.provision_new_student_from_auth();


drop trigger if exists edu_share_on_auth_email_confirmed
on auth.users;

create trigger edu_share_on_auth_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (
  old.email_confirmed_at is null
  and new.email_confirmed_at is not null
)
execute function private.queue_student_review_after_email_confirmed();


-- =========================================================
-- 5. PRIVATE BOUNDARY REASSERTION
-- =========================================================

revoke all on schema private from public, anon, authenticated;
