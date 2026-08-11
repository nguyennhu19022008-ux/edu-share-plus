-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


create table public.categories (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  parent_id uuid,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_code_unique unique (code),
  constraint categories_parent_fk foreign key (parent_id) references public.categories(id) on delete restrict,
  constraint categories_name_length check (char_length(name) between 1 and 120),
  constraint categories_not_self_parent check (parent_id is null or parent_id <> id)
);

insert into public.categories (code, name, sort_order) values
  ('sach', 'Sách', 10),
  ('dung_cu_hoc_tap', 'Dụng cụ học tập', 20),
  ('vo', 'Vở', 30),
  ('but', 'Bút', 40),
  ('dong_phuc', 'Đồng phục', 50),
  ('do_dien_tu_nho', 'Đồ điện tử nhỏ', 60),
  ('khac', 'Khác', 90)
on conflict (code) do nothing;

insert into public.categories (code, name, parent_id, sort_order)
select 'sach_giao_khoa', 'Sách giáo khoa', id, 11 from public.categories where code='sach'
on conflict (code) do nothing;
insert into public.categories (code, name, parent_id, sort_order)
select 'sach_tham_khao', 'Sách tham khảo', id, 12 from public.categories where code='sach'
on conflict (code) do nothing;

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
    to_tsvector('simple'::regconfig, coalesce(title,'') || ' ' || coalesce(description,''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_owner_fk foreign key (owner_id) references public.profiles(user_id) on delete restrict,
  constraint posts_school_fk foreign key (school_id) references public.schools(id) on delete restrict,
  constraint posts_class_scope_fk foreign key (class_id, school_id) references public.school_classes(id, school_id) on delete restrict,
  constraint posts_category_fk foreign key (category_id) references public.categories(id) on delete restrict,
  constraint posts_title_length check (char_length(title) between 5 and 160),
  constraint posts_description_length check (char_length(description) between 10 and 5000),
  constraint posts_trade_type_check check (trade_type in ('lend','give','exchange','low_price_sale')),
  constraint posts_moderation_status_check check (moderation_status in ('pending','approved','rejected')),
  constraint posts_lifecycle_status_check check (lifecycle_status in ('active','completed','withdrawn')),
  constraint posts_sale_price_check check (
    (trade_type='low_price_sale' and sale_price is not null and sale_price > 0)
    or (trade_type<>'low_price_sale' and sale_price is null)
  ),
  constraint posts_completed_timestamp_check check (
    (lifecycle_status='completed' and completed_at is not null and withdrawn_at is null)
    or (lifecycle_status<>'completed' and completed_at is null)
  ),
  constraint posts_withdrawn_timestamp_check check (
    (lifecycle_status='withdrawn' and withdrawn_at is not null and completed_at is null)
    or (lifecycle_status<>'withdrawn' and withdrawn_at is null)
  )
);

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  file_id uuid not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  alt_text text,
  created_at timestamptz not null default now(),
  constraint post_media_post_fk foreign key (post_id) references public.posts(id) on delete cascade,
  constraint post_media_file_fk foreign key (file_id) references public.file_objects(id) on delete restrict,
  constraint post_media_post_file_unique unique (post_id, file_id),
  constraint post_media_sort_check check (sort_order >= 0),
  constraint post_media_alt_length check (alt_text is null or char_length(alt_text) <= 300)
);

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
  constraint post_status_history_post_fk foreign key (post_id) references public.posts(id) on delete restrict,
  constraint post_status_history_actor_fk foreign key (actor_id) references public.profiles(user_id) on delete restrict,
  constraint post_status_history_dimension_check check (dimension in ('moderation','lifecycle','visibility','comments')),
  constraint post_status_history_actor_kind_check check (actor_kind in ('user','staff','system','migration')),
  constraint post_status_history_source_check check (source in ('owner_action','moderation','automatic_rule','migration','trusted_workflow')),
  constraint post_status_history_reason_length check (reason is null or char_length(reason) <= 5000)
);

create trigger categories_set_updated_at before update on public.categories
for each row execute function private.set_updated_at();
create trigger posts_set_updated_at before update on public.posts
for each row execute function private.set_updated_at();
