-- EDU SHARE+ / PHASE 3E.6
-- Marketplace Interactions migration for DEVELOPMENT Supabase project.
-- Creates favorites, comments, contact_events and notifications.
-- RLS is enabled immediately with no browser policies in this migration.
-- Browser access therefore remains default-deny until the later RLS/grants wave.

-- =========================================================
-- 1. FAVORITES
-- =========================================================

create table public.favorites (
  user_id uuid not null,
  post_id uuid not null,
  created_at timestamptz not null default now(),

  constraint favorites_pk
    primary key (user_id, post_id),

  constraint favorites_user_fk
    foreign key (user_id)
    references public.profiles(user_id)
    on delete cascade,

  constraint favorites_post_fk
    foreign key (post_id)
    references public.posts(id)
    on delete cascade
);

create index favorites_post_idx
  on public.favorites(post_id);


-- =========================================================
-- 2. COMMENTS
-- =========================================================

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  author_id uuid not null,
  parent_comment_id uuid,

  body text not null,
  visibility_status text not null default 'visible',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,

  constraint comments_post_fk
    foreign key (post_id)
    references public.posts(id)
    on delete restrict,

  constraint comments_author_fk
    foreign key (author_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint comments_id_post_unique
    unique (id, post_id),

  constraint comments_parent_same_post_fk
    foreign key (parent_comment_id, post_id)
    references public.comments(id, post_id)
    on delete restrict,

  constraint comments_body_length
    check (char_length(btrim(body)) between 1 and 2000),

  constraint comments_visibility_status_check
    check (visibility_status in ('visible', 'hidden', 'removed')),

  constraint comments_deleted_after_created
    check (deleted_at is null or deleted_at >= created_at),

  constraint comments_not_self_parent
    check (parent_comment_id is null or parent_comment_id <> id)
);

create index comments_post_time_idx
  on public.comments(post_id, created_at desc, id desc);

create index comments_parent_idx
  on public.comments(parent_comment_id)
  where parent_comment_id is not null;

create index comments_author_time_idx
  on public.comments(author_id, created_at desc, id desc);

create trigger comments_set_updated_at
before update on public.comments
for each row execute function private.set_updated_at();


-- =========================================================
-- 3. CONTACT EVENTS
-- =========================================================

create table public.contact_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  requester_id uuid not null,

  event_type text not null default 'view_contact',

  created_at timestamptz not null default now(),

  owner_handled_at timestamptz,
  owner_handled_by uuid,

  constraint contact_events_post_fk
    foreign key (post_id)
    references public.posts(id)
    on delete restrict,

  constraint contact_events_requester_fk
    foreign key (requester_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint contact_events_owner_handled_by_fk
    foreign key (owner_handled_by)
    references public.profiles(user_id)
    on delete restrict,

  constraint contact_events_type_check
    check (event_type in ('view_contact')),

  constraint contact_events_handled_contract
    check (
      (owner_handled_at is null and owner_handled_by is null)
      or
      (owner_handled_at is not null and owner_handled_by is not null)
    ),

  constraint contact_events_handled_after_created
    check (owner_handled_at is null or owner_handled_at >= created_at)
);

create index contact_events_post_time_idx
  on public.contact_events(post_id, created_at desc, id desc);

create index contact_events_post_requester_time_idx
  on public.contact_events(post_id, requester_id, created_at desc, id desc);

create index contact_events_requester_time_idx
  on public.contact_events(requester_id, created_at desc, id desc);


-- =========================================================
-- 4. NOTIFICATIONS
-- =========================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null,

  type text not null,
  title text not null,
  body text not null,

  entity_type text,
  entity_id uuid,

  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_recipient_fk
    foreign key (recipient_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint notifications_type_length
    check (char_length(btrim(type)) between 1 and 80),

  constraint notifications_title_length
    check (char_length(btrim(title)) between 1 and 160),

  constraint notifications_body_length
    check (char_length(btrim(body)) between 1 and 2000),

  constraint notifications_entity_type_length
    check (
      entity_type is null
      or char_length(btrim(entity_type)) between 1 and 80
    ),

  constraint notifications_entity_anchor_contract
    check (
      (entity_type is null and entity_id is null)
      or
      (entity_type is not null and entity_id is not null)
    ),

  constraint notifications_read_after_created
    check (read_at is null or read_at >= created_at)
);

create index notifications_recipient_time_idx
  on public.notifications(recipient_id, created_at desc, id desc);

create index notifications_recipient_unread_idx
  on public.notifications(recipient_id, created_at desc, id desc)
  where read_at is null;


-- =========================================================
-- 5. SECURITY GATE
-- =========================================================

alter table public.favorites enable row level security;
alter table public.comments enable row level security;
alter table public.contact_events enable row level security;
alter table public.notifications enable row level security;