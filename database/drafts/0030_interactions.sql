-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


create table public.favorites (
  user_id uuid not null,
  post_id uuid not null,
  created_at timestamptz not null default now(),
  constraint favorites_pk primary key (user_id, post_id),
  constraint favorites_user_fk foreign key (user_id) references public.profiles(user_id) on delete cascade,
  constraint favorites_post_fk foreign key (post_id) references public.posts(id) on delete cascade
);

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
  constraint comments_post_fk foreign key (post_id) references public.posts(id) on delete restrict,
  constraint comments_author_fk foreign key (author_id) references public.profiles(user_id) on delete restrict,
  constraint comments_body_length check (char_length(body) between 1 and 2000),
  constraint comments_visibility_check check (visibility_status in ('visible','hidden','removed')),
  constraint comments_id_post_unique unique (id, post_id),
  constraint comments_parent_same_post_fk foreign key (parent_comment_id, post_id)
    references public.comments(id, post_id) on delete restrict
);

create table public.contact_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  requester_id uuid not null,
  event_type text not null default 'view_contact',
  created_at timestamptz not null default now(),
  owner_handled_at timestamptz,
  owner_handled_by uuid,
  constraint contact_events_post_fk foreign key (post_id) references public.posts(id) on delete restrict,
  constraint contact_events_requester_fk foreign key (requester_id) references public.profiles(user_id) on delete restrict,
  constraint contact_events_owner_handled_by_fk foreign key (owner_handled_by) references public.profiles(user_id) on delete restrict,
  constraint contact_events_type_check check (event_type in ('view_contact')),
  constraint contact_events_handled_pair_check check (
    (owner_handled_at is null and owner_handled_by is null)
    or (owner_handled_at is not null and owner_handled_by is not null)
  )
);

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
  constraint notifications_recipient_fk foreign key (recipient_id) references public.profiles(user_id) on delete restrict,
  constraint notifications_title_length check (char_length(title) between 1 and 160),
  constraint notifications_body_length check (char_length(body) between 1 and 2000)
);

create trigger comments_set_updated_at before update on public.comments
for each row execute function private.set_updated_at();
