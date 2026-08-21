-- Phase 5C — trusted marketplace list/detail read RPCs.
-- These functions intentionally bypass table RLS as SECURITY DEFINER, but only
-- after enforcing the same verified-student eligibility and effective visibility
-- rules used by marketplace RLS. Returned fields are curated for student UI.

create or replace function public.list_marketplace_posts(
  p_keyword text default null,
  p_trade_type text default null,
  p_category_id uuid default null,
  p_class_id uuid default null,
  p_sort text default 'new',
  p_page integer default 1,
  p_page_size integer default 12
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_keyword text := nullif(btrim(coalesce(p_keyword, '')), '');
  v_trade_type text := nullif(btrim(coalesce(p_trade_type, '')), '');
  v_sort text := coalesce(nullif(btrim(coalesce(p_sort, '')), ''), 'new');
  v_page integer := coalesce(p_page, 1);
  v_page_size integer := coalesce(p_page_size, 12);
  v_offset integer;
  v_result jsonb;
begin
  if not (select private.is_marketplace_eligible()) then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_ACCESS_DENIED',
      detail = 'Marketplace browsing requires a confirmed, approved and verified Student account.';
  end if;

  if v_keyword is not null and char_length(v_keyword) > 200 then
    raise exception using message = 'EDU_SHARE_MARKETPLACE_KEYWORD_TOO_LONG';
  end if;

  if v_trade_type is not null
     and v_trade_type not in ('lend', 'give', 'exchange', 'low_price_sale') then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_TRADE_TYPE_INVALID',
      detail = 'Allowed trade types: lend, give, exchange, low_price_sale.';
  end if;

  if v_sort not in ('new', 'priceAsc', 'priceDesc', 'image') then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_SORT_INVALID',
      detail = 'Allowed sorts: new, priceAsc, priceDesc, image.';
  end if;

  if v_page < 1 then
    raise exception using message = 'EDU_SHARE_MARKETPLACE_PAGE_INVALID';
  end if;

  if v_page_size < 1 or v_page_size > 50 then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_PAGE_SIZE_INVALID',
      detail = 'Marketplace page size must be between 1 and 50.';
  end if;

  v_offset := (v_page - 1) * v_page_size;

  with visible as materialized (
    select
      p.id,
      p.owner_id,
      p.school_id,
      p.class_id,
      p.category_id,
      p.title,
      p.description,
      p.trade_type,
      p.sale_price,
      p.visibility_scope,
      p.published_at,
      p.created_at,
      p.search_tsv,
      c.code as category_code,
      c.name as category_name,
      sc.label as class_label,
      case
        when owner_profile.show_name then owner_profile.full_name
        else 'Học sinh EDU SHARE+'
      end as owner_display_name,
      case
        when owner_profile.show_class then sc.label
        else null
      end as owner_class_label,
      owner_profile.reputation_score_cache,
      owner_profile.reputation_label_cache,
      exists (
        select 1
        from public.post_media pm
        where pm.post_id = p.id
      ) as has_image,
      (
        select count(*)::integer
        from public.favorites f
        where f.post_id = p.id
      ) as favorite_count
    from public.posts p
    join public.categories c
      on c.id = p.category_id
     and c.is_active = true
    join public.profiles owner_profile
      on owner_profile.user_id = p.owner_id
    left join public.school_classes sc
      on sc.id = p.class_id
     and sc.school_id = p.school_id
    where p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
      and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope))
  ),
  filtered as materialized (
    select v.*
    from visible v
    where (v_keyword is null or v.search_tsv @@ plainto_tsquery('simple'::regconfig, v_keyword))
      and (v_trade_type is null or v.trade_type = v_trade_type)
      and (p_category_id is null or v.category_id = p_category_id)
      and (p_class_id is null or v.class_id = p_class_id)
  ),
  ranked as materialized (
    select
      f.*,
      row_number() over (
        order by
          case when v_sort = 'image' then f.has_image::integer end desc nulls last,
          case when v_sort = 'priceAsc' then f.sale_price end asc nulls last,
          case when v_sort = 'priceDesc' then f.sale_price end desc nulls last,
          f.created_at desc,
          f.id desc
      ) as sort_position
    from filtered f
  ),
  paged as materialized (
    select r.*
    from ranked r
    where r.sort_position > v_offset
      and r.sort_position <= v_offset + v_page_size
  ),
  visible_classes as (
    select distinct v.class_id as id, v.class_label as label
    from visible v
    where v.class_id is not null and v.class_label is not null
  ),
  visible_categories as (
    select distinct v.category_id as id, v.category_code as code, v.category_name as name
    from visible v
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
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
          'categoryCode', p.category_code,
          'categoryName', p.category_name,
          'ownerName', p.owner_display_name,
          'className', p.owner_class_label,
          'hasImage', p.has_image,
          'favoriteCount', p.favorite_count,
          'ownerReputationScore', p.reputation_score_cache,
          'ownerReputationLabel', p.reputation_label_cache
        ) order by p.sort_position
      )
      from paged p
    ), '[]'::jsonb),
    'totalCount', (select count(*)::integer from filtered),
    'page', v_page,
    'pageSize', v_page_size,
    'totalPages', case
      when (select count(*) from filtered) = 0 then 0
      else ceil((select count(*)::numeric from filtered) / v_page_size::numeric)::integer
    end,
    'stats', jsonb_build_object(
      'totalOpen', (select count(*)::integer from filtered),
      'free', (select count(*)::integer from filtered where trade_type = 'give'),
      'sale', (select count(*)::integer from filtered where trade_type = 'low_price_sale'),
      'hasImage', (select count(*)::integer from filtered where has_image)
    ),
    'classes', coalesce((
      select jsonb_agg(jsonb_build_object('id', vc.id, 'label', vc.label) order by vc.label, vc.id)
      from visible_classes vc
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object('id', vc.id, 'code', vc.code, 'name', vc.name) order by vc.name, vc.id)
      from visible_categories vc
    ), '[]'::jsonb)
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
    p.category_id
  into v_post, v_category_id
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
    'similarPosts', v_similar
  );
end;
$$;

comment on function public.list_marketplace_posts(text, text, uuid, uuid, text, integer, integer) is
  'Verified Student marketplace feed with school/network visibility and server-side filter/sort/pagination.';
comment on function public.get_marketplace_post(uuid) is
  'Verified Student marketplace detail with the same effective visibility rule as the feed.';

revoke all on function public.list_marketplace_posts(text, text, uuid, uuid, text, integer, integer)
  from public, anon;
revoke all on function public.get_marketplace_post(uuid)
  from public, anon;
grant execute on function public.list_marketplace_posts(text, text, uuid, uuid, text, integer, integer)
  to authenticated;
grant execute on function public.get_marketplace_post(uuid)
  to authenticated;
