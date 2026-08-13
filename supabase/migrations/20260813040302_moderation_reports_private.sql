-- EDU SHARE+ / PHASE 3E.7
-- Moderation + Reports + Private Operational Foundation
-- DEVELOPMENT Supabase project only.
--
-- Creates:
--   public.moderation_actions
--   public.reports
--   private.audit_logs
--   private.analytics_events
--   private.legacy_import_map
--
-- Public tables have RLS enabled immediately with no browser policies yet.
-- Private tables remain non-browser-accessible by schema/object grants.
-- Material moderation/report transitions will later be executed through
-- trusted transactional RPC/functions rather than arbitrary browser writes.

-- =========================================================
-- 1. MODERATION ACTIONS
-- =========================================================

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

  constraint moderation_actions_post_fk
    foreign key (post_id)
    references public.posts(id)
    on delete restrict,

  constraint moderation_actions_history_fk
    foreign key (status_history_id)
    references public.post_status_history(id)
    on delete restrict,

  constraint moderation_actions_moderator_fk
    foreign key (moderator_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint moderation_actions_action_check
    check (
      action in (
        'approve',
        'reject',
        'force_hide',
        'force_show',
        'disable_comments',
        'enable_comments'
      )
    ),

  constraint moderation_actions_source_check
    check (source in ('human', 'automatic')),

  -- Human moderation must identify the staff actor.
  -- Automatic rules deliberately have no human moderator identity.
  constraint moderation_actions_actor_contract
    check (
      (source = 'human' and moderator_id is not null)
      or
      (source = 'automatic' and moderator_id is null)
    ),

  constraint moderation_actions_reject_reason_check
    check (
      action <> 'reject'
      or
      (reason is not null and char_length(btrim(reason)) > 0)
    ),

  constraint moderation_actions_reason_length
    check (reason is null or char_length(reason) <= 5000),

  constraint moderation_actions_rule_version_length
    check (rule_version is null or char_length(rule_version) <= 120)
);

create index moderation_actions_post_time_idx
  on public.moderation_actions(post_id, created_at desc, id desc);

create index moderation_actions_moderator_time_idx
  on public.moderation_actions(moderator_id, created_at desc, id desc)
  where moderator_id is not null;


-- =========================================================
-- 2. REPORTS
-- =========================================================

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

  constraint reports_reporter_fk
    foreign key (reporter_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint reports_post_fk
    foreign key (post_id)
    references public.posts(id)
    on delete restrict,

  constraint reports_comment_fk
    foreign key (comment_id)
    references public.comments(id)
    on delete restrict,

  constraint reports_user_fk
    foreign key (reported_user_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint reports_assigned_fk
    foreign key (assigned_to)
    references public.profiles(user_id)
    on delete restrict,

  constraint reports_target_type_check
    check (target_type in ('post', 'comment', 'user')),

  constraint reports_status_check
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),

  -- Exactly one target must be supplied and must match target_type.
  constraint reports_exact_target_check
    check (
      num_nonnulls(post_id, comment_id, reported_user_id) = 1
      and (
        (target_type = 'post' and post_id is not null)
        or
        (target_type = 'comment' and comment_id is not null)
        or
        (target_type = 'user' and reported_user_id is not null)
      )
    ),

  constraint reports_no_self_user_report
    check (
      target_type <> 'user'
      or reporter_id <> reported_user_id
    ),

  -- Only terminal report states carry resolved_at.
  constraint reports_terminal_timestamp_check
    check (
      (
        status in ('resolved', 'dismissed')
        and resolved_at is not null
      )
      or
      (
        status in ('open', 'reviewing')
        and resolved_at is null
      )
    ),

  constraint reports_resolved_after_created
    check (resolved_at is null or resolved_at >= created_at),

  constraint reports_reason_code_length
    check (char_length(btrim(reason_code)) between 1 and 80),

  constraint reports_description_length
    check (description is null or char_length(description) <= 3000),

  constraint reports_resolution_length
    check (resolution_note is null or char_length(resolution_note) <= 5000)
);

create trigger reports_set_updated_at
before update on public.reports
for each row execute function private.set_updated_at();

create index reports_status_time_idx
  on public.reports(status, created_at desc, id desc);

create index reports_assignee_status_idx
  on public.reports(assigned_to, status, created_at desc, id desc)
  where assigned_to is not null;

create index reports_post_idx
  on public.reports(post_id)
  where post_id is not null;

create index reports_comment_idx
  on public.reports(comment_id)
  where comment_id is not null;

create index reports_user_idx
  on public.reports(reported_user_id)
  where reported_user_id is not null;


-- =========================================================
-- 3. PRIVATE AUDIT LOGS
-- =========================================================

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

  constraint audit_logs_actor_fk
    foreign key (actor_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint audit_logs_actor_role_snapshot_length
    check (
      actor_role_snapshot is null
      or char_length(actor_role_snapshot) <= 120
    ),

  constraint audit_logs_action_length
    check (char_length(btrim(action)) between 1 and 120),

  constraint audit_logs_entity_type_length
    check (char_length(btrim(entity_type)) between 1 and 120),

  constraint audit_logs_source_length
    check (char_length(btrim(source)) between 1 and 120),

  constraint audit_logs_metadata_object
    check (jsonb_typeof(metadata) = 'object')
);

create index audit_logs_time_idx
  on private.audit_logs(created_at desc);

create index audit_logs_actor_time_idx
  on private.audit_logs(actor_id, created_at desc)
  where actor_id is not null;

create index audit_logs_entity_time_idx
  on private.audit_logs(entity_type, entity_id, created_at desc)
  where entity_id is not null;


-- =========================================================
-- 4. PRIVATE OPERATIONAL ANALYTICS EVENTS
-- =========================================================
-- This is operational analytics infrastructure, not a research dataset.
-- Arbitrary browser JSON inserts remain prohibited. A later trusted
-- ingestion boundary will allowlist event names/properties.

create table private.analytics_events (
  id bigint generated always as identity primary key,

  user_id uuid,
  session_id uuid,

  event_name text not null,

  post_id uuid,

  properties jsonb not null default '{}'::jsonb,

  occurred_at timestamptz not null default now(),

  constraint analytics_events_user_fk
    foreign key (user_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint analytics_events_post_fk
    foreign key (post_id)
    references public.posts(id)
    on delete restrict,

  constraint analytics_events_name_length
    check (char_length(btrim(event_name)) between 1 and 120),

  constraint analytics_events_properties_object
    check (jsonb_typeof(properties) = 'object')
);

create index analytics_events_name_time_idx
  on private.analytics_events(event_name, occurred_at desc);

create index analytics_events_user_time_idx
  on private.analytics_events(user_id, occurred_at desc)
  where user_id is not null;

create index analytics_events_post_time_idx
  on private.analytics_events(post_id, occurred_at desc)
  where post_id is not null;


-- =========================================================
-- 5. PRIVATE LEGACY IMPORT MAP
-- =========================================================
-- This does NOT migrate old accounts. It only preserves controlled migration
-- provenance for data classes later approved for import/dry-run.

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

  constraint legacy_import_map_source_unique
    unique (source_name, source_entity, legacy_id),

  constraint legacy_import_map_status_check
    check (
      status in (
        'valid',
        'invalid',
        'duplicate',
        'needs_review',
        'inserted',
        'skipped'
      )
    ),

  constraint legacy_import_map_source_name_length
    check (char_length(btrim(source_name)) between 1 and 160),

  constraint legacy_import_map_source_entity_length
    check (char_length(btrim(source_entity)) between 1 and 120),

  constraint legacy_import_map_legacy_id_length
    check (char_length(btrim(legacy_id)) between 1 and 240),

  constraint legacy_import_map_target_entity_length
    check (char_length(btrim(target_entity)) between 1 and 120)
);


-- =========================================================
-- 6. SECURITY GATE
-- =========================================================

alter table public.moderation_actions enable row level security;
alter table public.reports enable row level security;

-- No browser role may use private schema or its tables directly.
revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;