-- Phase 5G — live favorites boundary and saved-post projection.

-- Phase 5G forbids self-favorites. Remove any pre-feature rows that violate the new invariant.
delete from public.favorites f
using public.posts p
where p.id = f.post_id
  and p.owner_id = f.user_id;

drop policy if exists favorites_insert_self_approved on public.favorites;
drop policy if exists favorites_insert_self_marketplace on public.favorites;

create policy favorites_insert_self_marketplace
on public.favorites
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (select private.is_marketplace_eligible())
  and exists (
    select 1
    from public.posts p
    where p.id = favorites.post_id
      and p.owner_id <> (select auth.uid())
      and p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
      and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope))
  )
);

revoke update on table public.favorites from public, anon, authenticated;

create or replace function public.list_my_saved_posts(
  p_limit integer default 20,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_limit integer := coalesce(p_limit, 20);
  v_offset integer := coalesce(p_offset, 0);
  v_result jsonb;
begin
  if v_actor_id is null or not (select private.is_marketplace_eligible()) then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_ACCESS_DENIED',
      detail = 'Saved posts require a confirmed, approved and verified Student account.';
  end if;

  if v_limit < 1 or v_limit > 50 then
    raise exception using
      message = 'EDU_SHARE_SAVED_POST_LIMIT_INVALID',
      detail = 'Saved-post limit must be between 1 and 50.';
  end if;

  if v_offset < 0 then
    raise exception using
      message = 'EDU_SHARE_SAVED_POST_OFFSET_INVALID',
      detail = 'Saved-post offset cannot be negative.';
  end if;

  with visible as materialized (
    select
      f.post_id,
      f.created_at as saved_at,
      p.title,
      p.trade_type,
      p.sale_price,
      p.published_at,
      p.created_at,
      c.name as category_name,
      (
        select count(*)::integer
        from public.favorites fx
        where fx.post_id = p.id
      ) as favorite_count
    from public.favorites f
    join public.posts p
      on p.id = f.post_id
    join public.categories c
      on c.id = p.category_id
     and c.is_active = true
    where f.user_id = v_actor_id
      and p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
      and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope))
  ),
  paged as materialized (
    select v.*
    from visible v
    order by v.saved_at desc, v.post_id desc
    limit v_limit
    offset v_offset
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.post_id,
          'title', p.title,
          'tradeType', p.trade_type,
          'categoryName', p.category_name,
          'price', p.sale_price,
          'publishedAt', p.published_at,
          'createdAt', p.created_at,
          'favoriteCount', p.favorite_count
        )
        order by p.saved_at desc, p.post_id desc
      )
      from paged p
    ), '[]'::jsonb),
    'totalCount', (select count(*)::integer from visible),
    'limit', v_limit,
    'offset', v_offset
  )
  into v_result;

  return v_result;
end;
$$;

create or replace function public.get_marketplace_post(p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_post jsonb;
  v_category_id uuid;
  v_owner_id uuid;
  v_similar jsonb;
begin
  if not (select private.is_marketplace_eligible()) then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_ACCESS_DENIED',
      detail = 'Marketplace browsing requires a confirmed, approved and verified Student account.';
  end if;

  if p_post_id is null then
    raise exception using message = 'EDU_SHARE_MARKETPLACE_POST_REQUIRED';
  end if;

  select
    jsonb_build_object(
      'id', p.id,
      'schoolId', p.school_id,
      'classId', p.class_id,
      'categoryId', p.category_id,
      'title', p.title,
      'description', p.description,
      'tradeType', p.trade_type,
      'price', p.sale_price,
      'visibilityScope', p.visibility_scope,
      'publishedAt', p.published_at,
      'createdAt', p.created_at,
      'categoryCode', c.code,
      'categoryName', c.name,
      'ownerName', case when owner_profile.show_name then owner_profile.full_name else 'Học sinh EDU SHARE+' end,
      'className', case when owner_profile.show_class then sc.label else null end,
      'hasImage', exists (select 1 from public.post_media pm where pm.post_id = p.id),
      'favoriteCount', (select count(*)::integer from public.favorites f where f.post_id = p.id),
      'ownerReputationScore', owner_profile.reputation_score_cache,
      'ownerReputationLabel', owner_profile.reputation_label_cache,
      'commentsEnabled', p.comments_enabled
    ),
    p.category_id,
    p.owner_id
  into v_post, v_category_id, v_owner_id
  from public.posts p
  join public.categories c
    on c.id = p.category_id
   and c.is_active = true
  join public.profiles owner_profile
    on owner_profile.user_id = p.owner_id
  left join public.school_classes sc
    on sc.id = p.class_id
   and sc.school_id = p.school_id
  where p.id = p_post_id
    and p.moderation_status = 'approved'
    and p.lifecycle_status = 'active'
    and p.is_hidden = false
    and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope));

  if v_post is null then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_POST_NOT_FOUND',
      detail = 'The post does not exist or is not visible to the current marketplace viewer.';
  end if;

  select coalesce(jsonb_agg(s.item order by s.created_at desc, s.id desc), '[]'::jsonb)
  into v_similar
  from (
    select
      p.id,
      p.created_at,
      jsonb_build_object(
        'id', p.id,
        'schoolId', p.school_id,
        'classId', p.class_id,
        'categoryId', p.category_id,
        'title', p.title,
        'description', p.description,
        'tradeType', p.trade_type,
        'price', p.sale_price,
        'visibilityScope', p.visibility_scope,
        'publishedAt', p.published_at,
        'createdAt', p.created_at,
        'categoryCode', c.code,
        'categoryName', c.name,
        'ownerName', case when owner_profile.show_name then owner_profile.full_name else 'Học sinh EDU SHARE+' end,
        'className', case when owner_profile.show_class then sc.label else null end,
        'hasImage', exists (select 1 from public.post_media pm where pm.post_id = p.id),
        'favoriteCount', (select count(*)::integer from public.favorites f where f.post_id = p.id),
        'ownerReputationScore', owner_profile.reputation_score_cache,
        'ownerReputationLabel', owner_profile.reputation_label_cache
      ) as item
    from public.posts p
    join public.categories c
      on c.id = p.category_id
     and c.is_active = true
    join public.profiles owner_profile
      on owner_profile.user_id = p.owner_id
    left join public.school_classes sc
      on sc.id = p.class_id
     and sc.school_id = p.school_id
    where p.id <> p_post_id
      and p.category_id = v_category_id
      and p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
      and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope))
    order by p.created_at desc, p.id desc
    limit 4
  ) s;

  return jsonb_build_object(
    'post', v_post,
    'similarPosts', v_similar,
    'viewerSaved', exists (
      select 1
      from public.favorites f
      where f.user_id = (select auth.uid())
        and f.post_id = p_post_id
    ),
    'viewerOwnsPost', v_owner_id = (select auth.uid())
  );
end;
$$;

comment on function public.list_my_saved_posts(integer, integer) is
  'Current verified Student saved posts, filtered by current marketplace visibility.';

revoke all on function public.list_my_saved_posts(integer, integer) from public, anon;
grant execute on function public.list_my_saved_posts(integer, integer) to authenticated;
