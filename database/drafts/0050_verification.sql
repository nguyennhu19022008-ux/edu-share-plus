-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  requester_id uuid not null,
  request_origin text not null,
  status text not null default 'requested',
  assigned_verifier_id uuid,
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz,
  location_note text,
  completed_at timestamptz,
  expired_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint verification_requests_post_fk foreign key (post_id) references public.posts(id) on delete restrict,
  constraint verification_requests_requester_fk foreign key (requester_id) references public.profiles(user_id) on delete restrict,
  constraint verification_requests_verifier_fk foreign key (assigned_verifier_id) references public.profiles(user_id) on delete restrict,
  constraint verification_requests_origin_check check (request_origin in ('seller','buyer')),
  constraint verification_requests_status_check check (status in ('requested','scheduled','checking','awaiting_information','completed','cancelled','expired')),
  constraint verification_requests_completed_time_check check (
    (status='completed' and completed_at is not null and expired_at is null)
    or (status<>'completed' and completed_at is null)
  ),
  constraint verification_requests_expired_time_check check (
    (status='expired' and expired_at is not null and completed_at is null)
    or (status<>'expired' and expired_at is null)
  ),
  constraint verification_requests_location_length check (location_note is null or char_length(location_note) <= 1000)
);

create table public.verification_results (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  verifier_id uuid not null,
  revision_no integer not null,
  supersedes_result_id uuid,
  outcome text not null,
  scope_checked jsonb not null default '{}'::jsonb,
  notes text,
  inspected_at timestamptz not null,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  constraint verification_results_request_fk foreign key (request_id) references public.verification_requests(id) on delete restrict,
  constraint verification_results_verifier_fk foreign key (verifier_id) references public.profiles(user_id) on delete restrict,
  constraint verification_results_revision_check check (revision_no >= 1),
  constraint verification_results_outcome_check check (outcome in ('verified','verified_with_note','failed','needs_more_information')),
  constraint verification_results_note_length check (notes is null or char_length(notes) <= 5000),
  constraint verification_results_note_required check (outcome <> 'verified_with_note' or (notes is not null and char_length(btrim(notes)) > 0)),
  constraint verification_results_request_revision_unique unique (request_id, revision_no),
  constraint verification_results_id_request_unique unique (id, request_id),
  constraint verification_results_supersedes_same_request_fk foreign key (supersedes_result_id, request_id)
    references public.verification_results(id, request_id) on delete restrict
);

create table public.verification_evidence (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  result_id uuid,
  file_id uuid not null,
  uploaded_by uuid not null,
  caption text,
  created_at timestamptz not null default now(),
  constraint verification_evidence_request_fk foreign key (request_id) references public.verification_requests(id) on delete restrict,
  constraint verification_evidence_result_request_fk foreign key (result_id, request_id)
    references public.verification_results(id, request_id) on delete restrict,
  constraint verification_evidence_file_fk foreign key (file_id) references public.file_objects(id) on delete restrict,
  constraint verification_evidence_uploader_fk foreign key (uploaded_by) references public.profiles(user_id) on delete restrict,
  constraint verification_evidence_caption_length check (caption is null or char_length(caption) <= 1000)
);

create trigger verification_requests_set_updated_at before update on public.verification_requests
for each row execute function private.set_updated_at();
