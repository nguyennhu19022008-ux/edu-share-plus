-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  owner_id uuid not null,
  counterparty_id uuid not null,
  origin_contact_event_id uuid,
  trade_type_snapshot text not null,
  agreed_price bigint,
  agreed_terms text,
  status text not null default 'initiated',
  loan_due_at timestamptz,
  returned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint transactions_post_fk foreign key (post_id) references public.posts(id) on delete restrict,
  constraint transactions_owner_fk foreign key (owner_id) references public.profiles(user_id) on delete restrict,
  constraint transactions_counterparty_fk foreign key (counterparty_id) references public.profiles(user_id) on delete restrict,
  constraint transactions_contact_fk foreign key (origin_contact_event_id) references public.contact_events(id) on delete restrict,
  constraint transactions_no_self check (owner_id <> counterparty_id),
  constraint transactions_trade_type_check check (trade_type_snapshot in ('lend','give','exchange','low_price_sale')),
  constraint transactions_price_check check (
    (trade_type_snapshot='low_price_sale' and agreed_price is not null and agreed_price > 0)
    or (trade_type_snapshot<>'low_price_sale' and agreed_price is null)
  ),
  constraint transactions_status_check check (status in ('initiated','awaiting_confirmation','in_progress','completed','cancelled')),
  constraint transactions_completed_time_check check (
    (status='completed' and completed_at is not null and cancelled_at is null)
    or (status<>'completed' and completed_at is null)
  ),
  constraint transactions_cancelled_time_check check (
    (status='cancelled' and cancelled_at is not null and completed_at is null)
    or (status<>'cancelled' and cancelled_at is null)
  ),
  constraint transactions_lend_fields_check check (
    trade_type_snapshot='lend' or (loan_due_at is null and returned_at is null)
  ),
  constraint transactions_terms_length check (agreed_terms is null or char_length(agreed_terms) <= 5000)
);

create table public.transaction_events (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null,
  actor_id uuid,
  event_type text not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint transaction_events_transaction_fk foreign key (transaction_id) references public.transactions(id) on delete cascade,
  constraint transaction_events_actor_fk foreign key (actor_id) references public.profiles(user_id) on delete restrict,
  constraint transaction_events_type_check check (event_type in ('initiated','accepted','owner_confirmed','counterparty_confirmed','in_progress','completed','cancelled','returned')),
  constraint transaction_events_note_length check (note is null or char_length(note) <= 5000)
);

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  case_type text not null,
  opened_by uuid not null,
  assigned_to uuid,
  origin_report_id uuid unique,
  post_id uuid,
  transaction_id uuid,
  verification_request_id uuid,
  status text not null default 'open',
  priority text not null default 'normal',
  summary text not null,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint cases_opened_by_fk foreign key (opened_by) references public.profiles(user_id) on delete restrict,
  constraint cases_assigned_to_fk foreign key (assigned_to) references public.profiles(user_id) on delete restrict,
  constraint cases_report_fk foreign key (origin_report_id) references public.reports(id) on delete restrict,
  constraint cases_post_fk foreign key (post_id) references public.posts(id) on delete restrict,
  constraint cases_transaction_fk foreign key (transaction_id) references public.transactions(id) on delete restrict,
  constraint cases_verification_fk foreign key (verification_request_id) references public.verification_requests(id) on delete restrict,
  constraint cases_type_check check (case_type in ('product_not_as_described','return_exchange','seller_unresponsive','contact_problem','blocked','damaged','transaction_dispute','general_support')),
  constraint cases_status_check check (status in ('open','reviewing','waiting_buyer','waiting_seller','resolved','dismissed')),
  constraint cases_priority_check check (priority in ('low','normal','high','urgent')),
  constraint cases_summary_length check (char_length(summary) between 5 and 500),
  constraint cases_resolution_length check (resolution is null or char_length(resolution) <= 5000),
  constraint cases_context_check check (
    case_type='general_support' or num_nonnulls(post_id, transaction_id, verification_request_id, origin_report_id) >= 1
  ),
  constraint cases_terminal_check check (
    (status in ('resolved','dismissed') and resolved_at is not null and resolution is not null and char_length(btrim(resolution)) > 0)
    or (status not in ('resolved','dismissed') and resolved_at is null)
  )
);

create table public.case_participants (
  case_id uuid not null,
  user_id uuid not null,
  participant_role text not null,
  joined_at timestamptz not null default now(),
  constraint case_participants_pk primary key (case_id, user_id, participant_role),
  constraint case_participants_case_fk foreign key (case_id) references public.cases(id) on delete cascade,
  constraint case_participants_user_fk foreign key (user_id) references public.profiles(user_id) on delete restrict,
  constraint case_participants_role_length check (char_length(participant_role) between 1 and 64)
);

create table public.case_updates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  actor_id uuid not null,
  update_type text not null,
  visibility text not null,
  body text,
  from_status text,
  to_status text,
  created_at timestamptz not null default now(),
  constraint case_updates_case_fk foreign key (case_id) references public.cases(id) on delete cascade,
  constraint case_updates_actor_fk foreign key (actor_id) references public.profiles(user_id) on delete restrict,
  constraint case_updates_visibility_check check (visibility in ('participants','staff_only')),
  constraint case_updates_body_length check (body is null or char_length(body) <= 5000),
  constraint case_updates_status_check check ((from_status is null or from_status in ('open','reviewing','waiting_buyer','waiting_seller','resolved','dismissed')) and (to_status is null or to_status in ('open','reviewing','waiting_buyer','waiting_seller','resolved','dismissed')))
);

create table public.case_evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null,
  file_id uuid not null,
  uploaded_by uuid not null,
  caption text,
  created_at timestamptz not null default now(),
  constraint case_evidence_case_fk foreign key (case_id) references public.cases(id) on delete cascade,
  constraint case_evidence_file_fk foreign key (file_id) references public.file_objects(id) on delete restrict,
  constraint case_evidence_uploader_fk foreign key (uploaded_by) references public.profiles(user_id) on delete restrict,
  constraint case_evidence_caption_length check (caption is null or char_length(caption) <= 1000)
);

create trigger transactions_set_updated_at before update on public.transactions
for each row execute function private.set_updated_at();
create trigger cases_set_updated_at before update on public.cases
for each row execute function private.set_updated_at();
