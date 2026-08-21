-- Phase 5B — roster-assisted registration trust foundation.
-- This migration intentionally stops before automatic roster matching.
-- It introduces trusted membership state, private registration snapshots,
-- roster storage, and a student-signup intent discriminator.

alter table public.profiles
  add column school_membership_status text not null default 'needs_revalidation',
  add column membership_verification_method text,
  add column membership_verified_at timestamptz;

alter table public.profiles
  add constraint profiles_school_membership_status_check
    check (school_membership_status in ('verified', 'needs_revalidation', 'revoked')),
  add constraint profiles_membership_verification_method_check
    check (
      membership_verification_method is null
      or membership_verification_method in ('school_roster_match', 'teacher_manual_review')
    ),
  add constraint profiles_verified_membership_has_evidence_check
    check (
      school_membership_status <> 'verified'
      or (
        membership_verification_method is not null
        and membership_verified_at is not null
      )
    );

alter table public.schools
  add column registration_enabled boolean not null default true,
  add column roster_verification_enabled boolean not null default true;

create or replace function private.normalize_class_claim(p_class_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_normalized text;
begin
  v_normalized := lower(
    regexp_replace(
      btrim(coalesce(p_class_name, '')),
      '[^[:alnum:]]',
      '',
      'g'
    )
  );

  if v_normalized = '' then
    raise exception using
      message = 'EDU_SHARE_CLASS_REQUIRED',
      detail = 'A non-empty class is required.';
  end if;

  if char_length(v_normalized) > 64 then
    raise exception using
      message = 'EDU_SHARE_CLASS_NAME_TOO_LONG';
  end if;

  return v_normalized;
end;
$$;

create or replace function private.normalize_vn_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text;
  v_normalized text;
begin
  v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');

  if char_length(v_digits) = 11 and left(v_digits, 2) = '84' then
    v_normalized := '0' || substr(v_digits, 3);
  elsif char_length(v_digits) = 10 and left(v_digits, 1) = '0' then
    v_normalized := v_digits;
  else
    raise exception using
      message = 'EDU_SHARE_PHONE_INVALID',
      detail = 'Vietnamese student phone must normalize to 10 digits beginning with 0.';
  end if;

  if v_normalized !~ '^0[0-9]{9}$' then
    raise exception using
      message = 'EDU_SHARE_PHONE_INVALID';
  end if;

  return v_normalized;
end;
$$;

create table private.student_registration_claims (
  user_id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete restrict,
  entered_full_name text not null check (char_length(entered_full_name) between 1 and 120),
  class_name text not null check (char_length(class_name) between 1 and 64),
  class_normalized text not null check (char_length(class_normalized) between 1 and 64),
  phone_normalized text not null check (phone_normalized ~ '^0[0-9]{9}$'),
  contact_email text not null check (char_length(contact_email) between 3 and 320),
  created_at timestamptz not null default now()
);

create index student_registration_claims_school_lookup_idx
  on private.student_registration_claims(school_id, class_normalized, phone_normalized);

create table private.roster_import_batches (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  academic_year text not null check (char_length(btrim(academic_year)) between 4 and 32),
  source_filename text not null check (char_length(btrim(source_filename)) between 1 and 255),
  status text not null default 'previewed'
    check (status in ('previewed', 'active', 'archived', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  invalid_rows integer not null default 0 check (invalid_rows >= 0),
  imported_by uuid not null references public.profiles(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  archived_at timestamptz,
  constraint roster_import_counts_check
    check (valid_rows + invalid_rows = total_rows),
  constraint roster_import_batch_school_year_uniq
    unique (id, school_id, academic_year)
);

create unique index roster_import_one_active_per_school_uniq
  on private.roster_import_batches(school_id)
  where status = 'active';

create index roster_import_batches_school_time_idx
  on private.roster_import_batches(school_id, created_at desc);

create table private.student_roster (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  school_id uuid not null references public.schools(id) on delete restrict,
  class_id uuid not null,
  academic_year text not null,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 120),
  class_name text not null check (char_length(btrim(class_name)) between 1 and 64),
  class_normalized text not null check (char_length(class_normalized) between 1 and 64),
  phone_normalized text not null check (phone_normalized ~ '^0[0-9]{9}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_roster_batch_school_year_fk
    foreign key (batch_id, school_id, academic_year)
    references private.roster_import_batches(id, school_id, academic_year)
    on delete restrict,
  constraint student_roster_class_school_fk
    foreign key (class_id, school_id)
    references public.school_classes(id, school_id)
    on delete restrict,
  constraint student_roster_id_school_uniq unique (id, school_id)
);

create index student_roster_match_idx
  on private.student_roster(school_id, class_normalized, phone_normalized, batch_id);

create index student_roster_batch_idx
  on private.student_roster(batch_id, id);

create table private.student_roster_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete restrict,
  roster_entry_id uuid not null,
  school_id uuid not null references public.schools(id) on delete restrict,
  verification_method text not null
    check (verification_method in ('school_roster_match', 'teacher_manual_review')),
  claimed_by uuid references public.profiles(user_id) on delete restrict,
  reason text check (reason is null or char_length(reason) <= 5000),
  claimed_at timestamptz not null default now(),
  released_at timestamptz,
  constraint student_roster_claim_entry_school_fk
    foreign key (roster_entry_id, school_id)
    references private.student_roster(id, school_id)
    on delete restrict,
  constraint student_roster_claim_release_time_check
    check (released_at is null or released_at >= claimed_at)
);

create unique index roster_claim_one_active_entry_uniq
  on private.student_roster_claims(roster_entry_id)
  where released_at is null;

create unique index roster_claim_one_active_user_uniq
  on private.student_roster_claims(user_id)
  where released_at is null;

create index student_roster_claims_school_time_idx
  on private.student_roster_claims(school_id, claimed_at desc);

create or replace function private.provision_new_student_from_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_registration_intent text;
  v_full_name text;
  v_school_text text;
  v_school_id uuid;
  v_class_name text;
  v_class_normalized text;
  v_phone_raw text;
  v_phone_normalized text;
  v_student_reference_code text;
  v_student_role_id uuid;
begin
  v_registration_intent := nullif(btrim(v_meta ->> 'registration_intent'), '');

  -- Auth may host identities other than EDU SHARE+ students. Only the explicit
  -- student flow is provisioned into application profile/role tables.
  if v_registration_intent is distinct from 'student_v2' then
    return new;
  end if;

  if new.email is null or btrim(new.email) = '' then
    raise exception using
      message = 'EDU_SHARE_AUTH_EMAIL_REQUIRED',
      detail = 'Student signup requires an email address.';
  end if;

  v_full_name := nullif(btrim(v_meta ->> 'full_name'), '');
  v_school_text := nullif(btrim(v_meta ->> 'school_id'), '');
  v_class_name := nullif(btrim(v_meta ->> 'class_name'), '');
  v_phone_raw := nullif(btrim(v_meta ->> 'phone'), '');
  v_student_reference_code := nullif(btrim(v_meta ->> 'student_reference_code'), '');

  if v_full_name is null then
    raise exception using message = 'EDU_SHARE_FULL_NAME_REQUIRED';
  end if;
  if char_length(v_full_name) > 120 then
    raise exception using message = 'EDU_SHARE_FULL_NAME_TOO_LONG';
  end if;

  if v_school_text is null then
    raise exception using message = 'EDU_SHARE_SCHOOL_REQUIRED';
  end if;

  begin
    v_school_id := v_school_text::uuid;
  exception
    when invalid_text_representation then
      raise exception using message = 'EDU_SHARE_INVALID_SCHOOL_ID';
  end;

  if not exists (
    select 1
    from public.schools s
    where s.id = v_school_id
      and s.is_active = true
      and s.registration_enabled = true
  ) then
    raise exception using
      message = 'EDU_SHARE_SCHOOL_NOT_ALLOWED',
      detail = 'The selected school is inactive or registration is disabled.';
  end if;

  if v_class_name is null then
    raise exception using message = 'EDU_SHARE_CLASS_REQUIRED';
  end if;
  if v_phone_raw is null then
    raise exception using message = 'EDU_SHARE_PHONE_REQUIRED';
  end if;

  v_class_normalized := private.normalize_class_claim(v_class_name);
  v_phone_normalized := private.normalize_vn_phone(v_phone_raw);

  if v_student_reference_code is not null
     and char_length(v_student_reference_code) > 128 then
    raise exception using message = 'EDU_SHARE_STUDENT_REFERENCE_TOO_LONG';
  end if;

  select r.id
  into v_student_role_id
  from public.roles r
  where r.code = 'student';

  if v_student_role_id is null then
    raise exception using message = 'EDU_SHARE_STUDENT_ROLE_MISSING';
  end if;

  insert into public.profiles (
    user_id,
    school_id,
    class_id,
    full_name,
    account_status,
    school_membership_status,
    membership_verification_method,
    membership_verified_at
  )
  values (
    new.id,
    v_school_id,
    null,
    v_full_name,
    'pending_review',
    'needs_revalidation',
    null,
    null
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
    lower(btrim(new.email)),
    v_phone_normalized,
    false,
    false
  )
  on conflict (user_id) do nothing;

  insert into private.student_registration_claims (
    user_id,
    school_id,
    entered_full_name,
    class_name,
    class_normalized,
    phone_normalized,
    contact_email
  )
  values (
    new.id,
    v_school_id,
    v_full_name,
    v_class_name,
    v_class_normalized,
    v_phone_normalized,
    lower(btrim(new.email))
  )
  on conflict (user_id) do nothing;

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

  -- Trusted/admin creation can insert an already-confirmed identity. Until the
  -- roster-matching migration lands, keep the existing safe manual-review path.
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
        'phone', v_phone_normalized,
        'student_reference_code', v_student_reference_code,
        'email', lower(btrim(new.email)),
        'email_confirmed_at', new.email_confirmed_at
      )
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

create or replace function private.queue_student_review_after_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim private.student_registration_claims%rowtype;
  v_profile public.profiles%rowtype;
  v_student_reference_code text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  select c.*
  into v_claim
  from private.student_registration_claims c
  where c.user_id = new.id;

  -- Non-student Auth identities intentionally have no application claim and
  -- therefore must not enter the student-review lifecycle.
  if not found then
    return new;
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.user_id = new.id;

  if not found then
    raise exception using
      message = 'EDU_SHARE_PROFILE_PROVISIONING_MISSING';
  end if;

  select pp.student_reference_code
  into v_student_reference_code
  from public.profile_private pp
  where pp.user_id = new.id;

  insert into public.account_reviews (
    user_id,
    status,
    submission_snapshot
  )
  values (
    new.id,
    'pending',
    jsonb_build_object(
      'full_name', v_profile.full_name,
      'school_id', v_claim.school_id,
      'class_name', v_claim.class_name,
      'phone', v_claim.phone_normalized,
      'student_reference_code', v_student_reference_code,
      'email', v_claim.contact_email,
      'email_confirmed_at', new.email_confirmed_at
    )
  )
  on conflict do nothing;

  return new;
end;
$$;

-- Private schema is not an application API surface.
revoke all on schema private from public, anon, authenticated;
revoke all on table private.student_registration_claims from public, anon, authenticated;
revoke all on table private.roster_import_batches from public, anon, authenticated;
revoke all on table private.student_roster from public, anon, authenticated;
revoke all on table private.student_roster_claims from public, anon, authenticated;
revoke execute on function private.normalize_class_claim(text) from public, anon, authenticated;
revoke execute on function private.normalize_vn_phone(text) from public, anon, authenticated;
revoke execute on function private.provision_new_student_from_auth() from public, anon, authenticated;
revoke execute on function private.queue_student_review_after_email_confirmed() from public, anon, authenticated;
