-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


create table public.schools (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schools_code_length check (char_length(code) between 2 and 32),
  constraint schools_name_length check (char_length(name) between 2 and 160),
  constraint schools_code_unique unique (code)
);

create table public.school_classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  label text not null,
  grade_level smallint,
  academic_year text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_classes_school_fk foreign key (school_id) references public.schools(id) on delete restrict,
  constraint school_classes_label_length check (char_length(label) between 1 and 64),
  constraint school_classes_grade check (grade_level is null or grade_level between 1 and 12),
  constraint school_classes_academic_year_length check (char_length(academic_year) between 4 and 32),
  constraint school_classes_scope_unique unique (school_id, label, academic_year),
  constraint school_classes_id_school_unique unique (id, school_id)
);

-- Created before profiles because profiles refer to avatar files.
-- owner_id FK is added after profiles to break the intentional ownership cycle.
create table public.file_objects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  bucket text not null,
  storage_path text not null,
  purpose text not null,
  visibility text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text,
  width integer,
  height integer,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint file_objects_storage_path_unique unique (storage_path),
  constraint file_objects_purpose_check check (purpose in ('avatar','face_private','post_media','verification_evidence','case_evidence')),
  constraint file_objects_visibility_check check (visibility in ('public','private','restricted')),
  constraint file_objects_size_check check (size_bytes > 0 and size_bytes <= 20971520),
  constraint file_objects_dimension_check check (
    (width is null and height is null) or (width > 0 and height > 0)
  ),
  constraint file_objects_mime_check check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  constraint file_objects_pdf_purpose_check check (
    mime_type <> 'application/pdf' or purpose in ('verification_evidence','case_evidence')
  ),
  constraint file_objects_private_purpose_check check (
    purpose not in ('face_private','verification_evidence','case_evidence') or visibility <> 'public'
  )
);

create table public.profiles (
  user_id uuid primary key,
  school_id uuid not null,
  class_id uuid,
  full_name text not null,
  account_status text not null default 'pending_review',
  avatar_file_id uuid,
  show_name boolean not null default true,
  show_class boolean not null default true,
  reputation_score_cache numeric(6,2) not null default 0,
  reputation_label_cache text not null default 'Mới',
  reputation_model_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_auth_user_fk foreign key (user_id) references auth.users(id) on delete restrict,
  constraint profiles_school_fk foreign key (school_id) references public.schools(id) on delete restrict,
  constraint profiles_class_scope_fk foreign key (class_id, school_id) references public.school_classes(id, school_id) on delete restrict,
  constraint profiles_avatar_fk foreign key (avatar_file_id) references public.file_objects(id) on delete restrict,
  constraint profiles_name_length check (char_length(full_name) between 1 and 120),
  constraint profiles_status_check check (account_status in ('pending_review','approved','rejected','suspended')),
  constraint profiles_reputation_range check (reputation_score_cache between 0 and 10)
);

alter table public.file_objects
  add constraint file_objects_owner_fk foreign key (owner_id) references public.profiles(user_id) on delete restrict;

create table public.profile_private (
  user_id uuid primary key,
  student_reference_code text,
  contact_email text,
  phone text,
  show_email boolean not null default false,
  show_phone boolean not null default false,
  face_file_id uuid,
  updated_at timestamptz not null default now(),
  constraint profile_private_user_fk foreign key (user_id) references public.profiles(user_id) on delete cascade,
  constraint profile_private_face_fk foreign key (face_file_id) references public.file_objects(id) on delete restrict,
  constraint profile_private_reference_length check (student_reference_code is null or char_length(student_reference_code) <= 128),
  constraint profile_private_email_length check (contact_email is null or char_length(contact_email) <= 320),
  constraint profile_private_phone_length check (phone is null or char_length(phone) <= 32)
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint roles_code_unique unique (code),
  constraint roles_code_check check (code in ('student','teacher_moderator','verification_staff','admin')),
  constraint roles_name_length check (char_length(name) between 1 and 120)
);

insert into public.roles (code, name, description) values
  ('student', 'Student', 'Approved learner account.'),
  ('teacher_moderator', 'Teacher / Moderator', 'School-scoped moderation and support role.'),
  ('verification_staff', 'Verification Staff', 'Assigned physical product verification role.'),
  ('admin', 'Admin', 'Privileged platform administration role.')
on conflict (code) do nothing;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role_id uuid not null,
  school_id uuid,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint user_roles_user_fk foreign key (user_id) references public.profiles(user_id) on delete restrict,
  constraint user_roles_role_fk foreign key (role_id) references public.roles(id) on delete restrict,
  constraint user_roles_school_fk foreign key (school_id) references public.schools(id) on delete restrict,
  constraint user_roles_assigned_by_fk foreign key (assigned_by) references public.profiles(user_id) on delete restrict,
  constraint user_roles_revoked_order check (revoked_at is null or revoked_at >= assigned_at)
);

create table public.account_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  reviewer_id uuid,
  status text not null default 'pending',
  reason text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  constraint account_reviews_user_fk foreign key (user_id) references public.profiles(user_id) on delete restrict,
  constraint account_reviews_reviewer_fk foreign key (reviewer_id) references public.profiles(user_id) on delete restrict,
  constraint account_reviews_status_check check (status in ('pending','approved','rejected','needs_information')),
  constraint account_reviews_decision_time_check check (
    (status in ('approved','rejected') and decided_at is not null)
    or (status in ('pending','needs_information') and decided_at is null)
  ),
  constraint account_reviews_reason_length check (reason is null or char_length(reason) <= 5000)
);

create trigger schools_set_updated_at before update on public.schools
for each row execute function private.set_updated_at();
create trigger school_classes_set_updated_at before update on public.school_classes
for each row execute function private.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
