-- =========================================================
-- Phase 6 — Deploy Verified Outcomes & Transactions Backend
-- Tables: public.transactions
-- RPCs: private.estimate_transaction_impact, complete_post_transaction, get_school_impact_summary
-- =========================================================

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  owner_id uuid not null references auth.users(id),
  requester_id uuid references auth.users(id),
  school_id uuid not null references public.schools(id),
  trade_type text not null check (trade_type in ('give', 'exchange', 'sale', 'loan', 'low_price_sale', 'lend')),
  sale_price bigint default 0 check (sale_price >= 0),
  financial_saved bigint default 0 check (financial_saved >= 0),
  waste_reduced_kg numeric(6, 2) default 0.50 check (waste_reduced_kg >= 0),
  status text not null check (status in ('pending_confirmation', 'completed', 'cancelled')) default 'completed',
  rating smallint check (rating is null or (rating >= 1 and rating <= 5)),
  feedback_note text,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.transactions enable row level security;

drop policy if exists transactions_select_policy on public.transactions;
create policy transactions_select_policy
on public.transactions
for select
to authenticated
using (
  (select auth.uid()) = owner_id
  or (select auth.uid()) = requester_id
  or (select private.can_read_marketplace_post(school_id, 'school'))
);

grant select on public.transactions to authenticated;

create or replace function private.estimate_transaction_impact(
  p_category_code text,
  p_trade_type text,
  p_sale_price bigint default 0
)
returns table(financial_saved bigint, waste_reduced_kg numeric)
language plpgsql
immutable
as $$
declare
  v_kg numeric := 0.40;
  v_saved bigint := 45000;
begin
  if p_category_code in ('textbook', 'book') then
    v_kg := 0.45;
    v_saved := 50000;
  elsif p_category_code = 'reference_book' then
    v_kg := 0.55;
    v_saved := 75000;
  elsif p_category_code = 'calculator' then
    v_kg := 0.25;
    v_saved := 350000;
  elsif p_category_code in ('school_supplies', 'stationery', 'notebook') then
    v_kg := 0.20;
    v_saved := 25000;
  elsif p_category_code in ('uniform', 'backpack') then
    v_kg := 0.75;
    v_saved := 120000;
  else
    v_kg := 0.40;
    v_saved := 40000;
  end if;

  if p_trade_type in ('sale', 'low_price_sale') and p_sale_price > 0 then
    v_saved := greatest(0, v_saved - p_sale_price);
  elsif p_trade_type in ('loan', 'lend') then
    v_saved := v_saved / 2;
  end if;

  return query select v_saved, v_kg;
end;
$$;

create or replace function public.complete_post_transaction(
  p_post_id uuid,
  p_requester_id uuid default null,
  p_rating smallint default null,
  p_feedback text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_post record;
  v_caller_id uuid := (select auth.uid());
  v_category_code text := null;
  v_actual_requester_id uuid := null;
  v_saved bigint;
  v_kg numeric;
  v_transaction_id uuid;
begin
  if v_caller_id is null then
    raise exception 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  -- Select post for update without outer join
  select p.*
  into v_post
  from public.posts p
  where p.id = p_post_id and p.owner_id = v_caller_id
  for update;

  if v_post.id is null then
    raise exception 'EDU_SHARE_POST_NOT_FOUND_OR_UNAUTHORIZED';
  end if;

  if v_post.lifecycle_status = 'completed' then
    raise exception 'EDU_SHARE_POST_ALREADY_COMPLETED';
  end if;

  -- Lookup category code
  if v_post.category_id is not null then
    select c.code into v_category_code
    from public.categories c
    where c.id = v_post.category_id;
  end if;

  -- Resolve actual requester user id if provided (could be contact_event.id or user_id)
  if p_requester_id is not null then
    if exists (select 1 from auth.users where id = p_requester_id) then
      v_actual_requester_id := p_requester_id;
    else
      select ce.requester_id into v_actual_requester_id
      from public.contact_events ce
      where ce.id = p_requester_id and ce.post_id = p_post_id
      limit 1;
    end if;
  end if;

  select financial_saved, waste_reduced_kg
  into v_saved, v_kg
  from private.estimate_transaction_impact(
    v_category_code,
    v_post.trade_type,
    coalesce(v_post.sale_price, 0)
  );

  insert into public.transactions (
    post_id,
    owner_id,
    requester_id,
    school_id,
    trade_type,
    sale_price,
    financial_saved,
    waste_reduced_kg,
    status,
    rating,
    feedback_note,
    completed_at
  ) values (
    v_post.id,
    v_caller_id,
    v_actual_requester_id,
    v_post.school_id,
    v_post.trade_type,
    coalesce(v_post.sale_price, 0),
    coalesce(v_saved, 0),
    coalesce(v_kg, 0.50),
    'completed',
    p_rating,
    p_feedback,
    now()
  )
  returning id into v_transaction_id;

  update public.posts
  set lifecycle_status = 'completed',
      completed_at = now(),
      updated_at = now()
  where id = v_post.id;

  -- Log into post_status_history
  insert into public.post_status_history (
    post_id,
    actor_id,
    actor_kind,
    dimension,
    old_value,
    new_value,
    reason,
    source,
    created_at
  ) values (
    v_post.id,
    v_caller_id,
    'user',
    'lifecycle',
    v_post.lifecycle_status,
    'completed',
    'Hoàn tất giao dịch đồ dùng',
    'owner_action',
    now()
  );

  -- Award reputation points (scale 0 - 10)
  update public.profiles
  set reputation_score_cache = least(10.00, coalesce(reputation_score_cache, 5.00) + 0.50),
      updated_at = now()
  where user_id = v_caller_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'post_id', v_post.id,
    'financial_saved', v_saved,
    'waste_reduced_kg', v_kg,
    'status', 'completed'
  );
end;
$$;

revoke all on function public.complete_post_transaction(uuid, uuid, smallint, text) from public, anon;
grant execute on function public.complete_post_transaction(uuid, uuid, smallint, text) to authenticated;

create or replace function public.get_school_impact_summary(
  p_school_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_school_id uuid := p_school_id;
  v_total_transactions bigint := 0;
  v_total_financial_saved bigint := 0;
  v_total_waste_kg numeric := 0;
  v_active_posts bigint := 0;
begin
  if v_school_id is null then
    select school_id into v_school_id
    from public.profiles
    where user_id = (select auth.uid());
  end if;

  if v_school_id is not null then
    select
      count(*),
      coalesce(sum(financial_saved), 0),
      coalesce(sum(waste_reduced_kg), 0)
    into
      v_total_transactions,
      v_total_financial_saved,
      v_total_waste_kg
    from public.transactions
    where school_id = v_school_id and status = 'completed';

    select count(*)
    into v_active_posts
    from public.posts
    where school_id = v_school_id and moderation_status = 'approved' and lifecycle_status = 'active';
  else
    select
      count(*),
      coalesce(sum(financial_saved), 0),
      coalesce(sum(waste_reduced_kg), 0)
    into
      v_total_transactions,
      v_total_financial_saved,
      v_total_waste_kg
    from public.transactions
    where status = 'completed';

    select count(*)
    into v_active_posts
    from public.posts
    where moderation_status = 'approved' and lifecycle_status = 'active';
  end if;

  return jsonb_build_object(
    'school_id', v_school_id,
    'completed_transactions', v_total_transactions,
    'financial_saved', v_total_financial_saved,
    'waste_reduced_kg', v_total_waste_kg,
    'active_posts', v_active_posts
  );
end;
$$;

revoke all on function public.get_school_impact_summary(uuid) from public, anon;
grant execute on function public.get_school_impact_summary(uuid) to authenticated;
