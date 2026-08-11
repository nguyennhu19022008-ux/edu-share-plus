-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  status_history_id uuid unique,
  moderator_id uuid,
  action text not null,
  reason text,
  source text not null,
  rule_version text,
  created_at timestamptz not null default now(),
  constraint moderation_actions_post_fk foreign key (post_id) references public.posts(id) on delete restrict,
  constraint moderation_actions_history_fk foreign key (status_history_id) references public.post_status_history(id) on delete restrict,
  constraint moderation_actions_moderator_fk foreign key (moderator_id) references public.profiles(user_id) on delete restrict,
  constraint moderation_actions_action_check check (action in ('approve','reject','force_hide','force_show','disable_comments','enable_comments')),
  constraint moderation_actions_source_check check (source in ('human','automatic')),
  constraint moderation_actions_reject_reason_check check (action <> 'reject' or (reason is not null and char_length(btrim(reason)) > 0)),
  constraint moderation_actions_reason_length check (reason is null or char_length(reason) <= 5000)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null,
  target_type text not null,
  post_id uuid,
  comment_id uuid,
  reported_user_id uuid,
  reason_code text not null,
  description text,
  status text not null default 'open',
  assigned_to uuid,
  resolution_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint reports_reporter_fk foreign key (reporter_id) references public.profiles(user_id) on delete restrict,
  constraint reports_post_fk foreign key (post_id) references public.posts(id) on delete restrict,
  constraint reports_comment_fk foreign key (comment_id) references public.comments(id) on delete restrict,
  constraint reports_user_fk foreign key (reported_user_id) references public.profiles(user_id) on delete restrict,
  constraint reports_assigned_fk foreign key (assigned_to) references public.profiles(user_id) on delete restrict,
  constraint reports_target_type_check check (target_type in ('post','comment','user')),
  constraint reports_status_check check (status in ('open','reviewing','resolved','dismissed')),
  constraint reports_exact_target_check check (
    num_nonnulls(post_id, comment_id, reported_user_id) = 1
    and ((target_type='post' and post_id is not null)
      or (target_type='comment' and comment_id is not null)
      or (target_type='user' and reported_user_id is not null))
  ),
  constraint reports_no_self_user_report check (target_type <> 'user' or reporter_id <> reported_user_id),
  constraint reports_terminal_timestamp_check check (
    (status in ('resolved','dismissed') and resolved_at is not null)
    or (status in ('open','reviewing') and resolved_at is null)
  ),
  constraint reports_description_length check (description is null or char_length(description) <= 3000),
  constraint reports_resolution_length check (resolution_note is null or char_length(resolution_note) <= 5000)
);

create table private.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  actor_role_snapshot text,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  source text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_actor_fk foreign key (actor_id) references public.profiles(user_id) on delete restrict
);

create table private.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid,
  session_id uuid,
  event_name text not null,
  post_id uuid,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint analytics_events_user_fk foreign key (user_id) references public.profiles(user_id) on delete restrict,
  constraint analytics_events_post_fk foreign key (post_id) references public.posts(id) on delete restrict
);

create table private.legacy_import_map (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_entity text not null,
  legacy_id text not null,
  target_entity text not null,
  target_id uuid,
  status text not null,
  issue_detail jsonb,
  created_at timestamptz not null default now(),
  constraint legacy_import_map_source_unique unique (source_name, source_entity, legacy_id),
  constraint legacy_import_map_status_check check (status in ('valid','invalid','duplicate','needs_review','inserted','skipped'))
);

create trigger reports_set_updated_at before update on public.reports
for each row execute function private.set_updated_at();

revoke all on all tables in schema private from public, anon, authenticated;
