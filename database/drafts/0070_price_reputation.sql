-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


create table public.price_model_versions (
  id uuid primary key default gen_random_uuid(),
  version_code text not null unique,
  status text not null,
  name text not null,
  description text not null,
  parameters jsonb not null,
  effective_from timestamptz,
  effective_to timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint price_model_versions_created_by_fk foreign key (created_by) references public.profiles(user_id) on delete restrict,
  constraint price_model_versions_status_check check (status in ('draft','active','retired')),
  constraint price_model_versions_effective_order check (effective_to is null or effective_from is null or effective_to > effective_from),
  constraint price_model_versions_active_time check (status <> 'active' or (effective_from is not null and effective_to is null))
);

create table public.price_reference_data (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null,
  source_type text not null,
  source_label text not null,
  observed_price bigint not null,
  original_price bigint,
  condition_level text,
  age_months integer,
  observed_at timestamptz,
  confidence_weight numeric(6,5),
  metadata jsonb not null default '{}'::jsonb,
  is_eligible boolean not null default false,
  created_at timestamptz not null default now(),
  constraint price_reference_category_fk foreign key (category_id) references public.categories(id) on delete restrict,
  constraint price_reference_source_type_check check (source_type in ('verified_transaction','audited_legacy','manual_reference','other_approved')),
  constraint price_reference_observed_price_check check (observed_price > 0),
  constraint price_reference_original_price_check check (original_price is null or original_price > 0),
  constraint price_reference_age_check check (age_months is null or age_months >= 0),
  constraint price_reference_confidence_check check (confidence_weight is null or confidence_weight between 0 and 1),
  constraint price_reference_source_label_length check (char_length(source_label) between 1 and 300)
);

create table public.price_estimates (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null,
  post_id uuid,
  model_version_id uuid not null,
  input_snapshot jsonb not null,
  estimated_min bigint not null,
  estimated_max bigint not null,
  confidence text not null,
  explanation jsonb not null,
  seller_price_snapshot bigint,
  currency char(3) not null default 'VND',
  created_at timestamptz not null default now(),
  constraint price_estimates_requester_fk foreign key (requested_by) references public.profiles(user_id) on delete restrict,
  constraint price_estimates_post_fk foreign key (post_id) references public.posts(id) on delete restrict,
  constraint price_estimates_model_fk foreign key (model_version_id) references public.price_model_versions(id) on delete restrict,
  constraint price_estimates_range_check check (estimated_min >= 0 and estimated_min <= estimated_max),
  constraint price_estimates_confidence_check check (confidence in ('low','medium','high')),
  constraint price_estimates_seller_price_check check (seller_price_snapshot is null or seller_price_snapshot > 0),
  constraint price_estimates_currency_check check (currency='VND')
);

create table public.price_estimate_references (
  estimate_id uuid not null,
  reference_id uuid not null,
  weight_used numeric(12,8),
  constraint price_estimate_references_pk primary key (estimate_id, reference_id),
  constraint price_estimate_references_estimate_fk foreign key (estimate_id) references public.price_estimates(id) on delete cascade,
  constraint price_estimate_references_reference_fk foreign key (reference_id) references public.price_reference_data(id) on delete restrict,
  constraint price_estimate_references_weight_check check (weight_used is null or weight_used >= 0)
);

create table public.reputation_model_versions (
  id uuid primary key default gen_random_uuid(),
  version_code text not null unique,
  status text not null,
  rules jsonb not null,
  description text not null,
  created_at timestamptz not null default now(),
  constraint reputation_model_versions_status_check check (status in ('draft','active','retired'))
);

create table public.reputation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  model_version_id uuid not null,
  event_type text not null,
  points_delta numeric(8,2) not null,
  source_type text,
  source_id uuid,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint reputation_events_user_fk foreign key (user_id) references public.profiles(user_id) on delete restrict,
  constraint reputation_events_model_fk foreign key (model_version_id) references public.reputation_model_versions(id) on delete restrict,
  constraint reputation_events_reason_length check (char_length(reason) between 1 and 1000)
);

alter table public.profiles
  add constraint profiles_reputation_model_fk
  foreign key (reputation_model_version_id) references public.reputation_model_versions(id) on delete restrict;
