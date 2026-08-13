-- EDU SHARE+ / PHASE 3E.5
-- Marketplace Core migration for DEVELOPMENT Supabase project.
-- Creates categories, posts, post_media and post_status_history.
-- RLS is enabled immediately with no browser policies in this migration,
-- so all four tables remain default-deny until the later RLS policy wave.

-- =========================================================
-- 1. CATEGORIES
-- =========================================================

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  parent_id uuid,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_code_unique
    unique (code),

  constraint categories_parent_fk
    foreign key (parent_id)
    references public.categories(id)
    on delete restrict,

  constraint categories_code_length
    check (char_length(code) between 2 and 64),

  constraint categories_code_format
    check (code ~ '^[a-z0-9_]+$'),

  constraint categories_name_length
    check (char_length(btrim(name)) between 1 and 120),

  constraint categories_sort_order_check
    check (sort_order >= 0),

  constraint categories_not_self_parent
    check (parent_id is null or parent_id <> id)
);

-- Preserve the frozen legacy category labels.
-- No hierarchy is imposed yet because the frozen UI currently treats them
-- as selectable category labels rather than a nested navigation tree.
insert into public.categories (code, name, sort_order) values
  ('book', 'Sách', 10),
  ('textbook', 'Sách giáo khoa', 20),
  ('reference_book', 'Sách tham khảo', 30),
  ('school_supplies', 'Dụng cụ học tập', 40),
  ('notebook', 'Vở', 50),
  ('pen', 'Bút', 60),
  ('uniform', 'Đồng phục', 70),
  ('small_electronics', 'Đồ điện tử nhỏ', 80),
  ('other', 'Khác', 90)
on conflict (code) do nothing;


-- =========================================================
-- 2. POSTS
-- =========================================================

create table public.posts (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null,
  school_id uuid not null,
  class_id uuid,
  category_id uuid not null,

  title text not null,
  description text not null,

  trade_type text not null,
  sale_price bigint,

  moderation_status text not null default 'pending',
  lifecycle_status text not null default 'active',

  is_hidden boolean not null default false,
  comments_enabled boolean not null default true,

  published_at timestamptz,
  completed_at timestamptz,
  withdrawn_at timestamptz,

  search_tsv tsvector generated always as (
    setweight(
      to_tsvector('simple'::regconfig, coalesce(title, '')),
      'A'
    )
    ||
    setweight(
      to_tsvector('simple'::regconfig, coalesce(description, '')),
      'B'
    )
  ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint posts_owner_fk
    foreign key (owner_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint posts_school_fk
    foreign key (school_id)
    references public.schools(id)
    on delete restrict,

  -- Enforces that a selected class belongs to the same school snapshot.
  constraint posts_class_scope_fk
    foreign key (class_id, school_id)
    references public.school_classes(id, school_id)
    on delete restrict,

  constraint posts_category_fk
    foreign key (category_id)
    references public.categories(id)
    on delete restrict,

  constraint posts_title_length
    check (char_length(btrim(title)) between 5 and 160),

  constraint posts_description_length
    check (char_length(btrim(description)) between 10 and 5000),

  constraint posts_trade_type_check
    check (trade_type in ('lend', 'give', 'exchange', 'low_price_sale')),

  constraint posts_moderation_status_check
    check (moderation_status in ('pending', 'approved', 'rejected')),

  constraint posts_lifecycle_status_check
    check (lifecycle_status in ('active', 'completed', 'withdrawn')),

  -- V1 money values are integer Vietnamese dong.
  constraint posts_sale_price_nonnegative
    check (sale_price is null or sale_price > 0),

  -- "Bán giá rẻ" requires a price; all other trade types must not carry one.
  constraint posts_trade_price_contract
    check (
      (trade_type = 'low_price_sale' and sale_price is not null and sale_price > 0)
      or
      (trade_type <> 'low_price_sale' and sale_price is null)
    ),

  -- Lifecycle timestamp contract.
  constraint posts_lifecycle_timestamp_contract
    check (
      (
        lifecycle_status = 'active'
        and completed_at is null
        and withdrawn_at is null
      )
      or
      (
        lifecycle_status = 'completed'
        and completed_at is not null
        and withdrawn_at is null
      )
      or
      (
        lifecycle_status = 'withdrawn'
        and withdrawn_at is not null
        and completed_at is null
      )
    ),

  constraint posts_completed_after_created
    check (completed_at is null or completed_at >= created_at),

  constraint posts_withdrawn_after_created
    check (withdrawn_at is null or withdrawn_at >= created_at),

  constraint posts_published_after_created
    check (published_at is null or published_at >= created_at)
);


-- =========================================================
-- 3. POST MEDIA
-- =========================================================

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  file_id uuid not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  alt_text text,
  created_at timestamptz not null default now(),

  constraint post_media_post_fk
    foreign key (post_id)
    references public.posts(id)
    on delete cascade,

  constraint post_media_file_fk
    foreign key (file_id)
    references public.file_objects(id)
    on delete restrict,

  constraint post_media_post_file_unique
    unique (post_id, file_id),

  constraint post_media_sort_order_check
    check (sort_order >= 0),

  constraint post_media_alt_text_length
    check (alt_text is null or char_length(alt_text) <= 300)
);

-- At most one primary media item per post.
create unique index post_media_one_primary_per_post_uniq
  on public.post_media(post_id)
  where is_primary = true;


-- =========================================================
-- 4. POST STATUS HISTORY
-- =========================================================

create table public.post_status_history (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,

  dimension text not null,
  old_value text,
  new_value text not null,

  actor_id uuid,
  actor_kind text not null,

  reason text,
  source text not null,

  created_at timestamptz not null default now(),

  constraint post_status_history_post_fk
    foreign key (post_id)
    references public.posts(id)
    on delete restrict,

  constraint post_status_history_actor_fk
    foreign key (actor_id)
    references public.profiles(user_id)
    on delete restrict,

  constraint post_status_history_dimension_check
    check (dimension in ('moderation', 'lifecycle', 'visibility', 'comments')),

  constraint post_status_history_actor_kind_check
    check (actor_kind in ('user', 'staff', 'system', 'migration')),

  constraint post_status_history_source_check
    check (
      source in (
        'owner_action',
        'moderation',
        'automatic_rule',
        'migration',
        'trusted_workflow'
      )
    ),

  constraint post_status_history_old_value_length
    check (old_value is null or char_length(old_value) <= 128),

  constraint post_status_history_new_value_length
    check (char_length(new_value) between 1 and 128),

  constraint post_status_history_reason_length
    check (reason is null or char_length(reason) <= 5000),

  -- Human actors must resolve to an authenticated application profile.
  -- System/migration actors may intentionally have no actor_id.
  constraint post_status_history_actor_contract
    check (
      (actor_kind in ('user', 'staff') and actor_id is not null)
      or
      (actor_kind in ('system', 'migration'))
    )
);

create index post_status_history_post_time_idx
  on public.post_status_history(post_id, created_at desc, id desc);


-- =========================================================
-- 5. SEARCH / STRUCTURAL INDEXES
-- =========================================================

create index posts_search_tsv_idx
  on public.posts
  using gin (search_tsv);

create index posts_owner_created_idx
  on public.posts(owner_id, created_at desc, id desc);

-- Baseline public-feed index. Additional benchmark-driven filter indexes
-- remain a later performance wave rather than being created speculatively.
create index posts_public_feed_idx
  on public.posts(school_id, created_at desc, id desc)
  where moderation_status = 'approved'
    and lifecycle_status = 'active'
    and is_hidden = false;


-- =========================================================
-- 6. UPDATED_AT TRIGGERS
-- =========================================================

create trigger categories_set_updated_at
before update on public.categories
for each row execute function private.set_updated_at();

create trigger posts_set_updated_at
before update on public.posts
for each row execute function private.set_updated_at();


-- =========================================================
-- 7. SECURITY GATE
-- =========================================================
-- No browser policies are introduced in this migration.
-- With RLS enabled and no matching policies, browser access remains
-- default-deny until the dedicated RLS policy wave.

alter table public.categories enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_status_history enable row level security;