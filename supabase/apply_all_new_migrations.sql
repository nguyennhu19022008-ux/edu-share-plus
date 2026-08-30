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
-- Phase 5G — trusted marketplace comments, two-level replies, and author soft-delete.

-- Student browser mutation moves behind trusted RPCs. Keep SELECT grant because
-- the existing staff-only RLS policy remains useful for moderation reads.
revoke insert, update, delete on table public.comments from public, anon, authenticated;

drop policy if exists comments_insert_self_approved on public.comments;
drop policy if exists comments_read_visible_public on public.comments;
drop policy if exists comments_read_own on public.comments;

create or replace function public.create_my_comment(
  p_post_id uuid,
  p_body text,
  p_reply_to_comment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_body text := btrim(coalesce(p_body, ''));
  v_parent_id uuid;
  v_target public.comments%rowtype;
  v_created public.comments%rowtype;
begin
  if v_actor_id is null or not (select private.is_marketplace_eligible()) then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_ACCESS_DENIED',
      detail = 'Commenting requires a confirmed, approved and verified Student account.';
  end if;

  if p_post_id is null then
    raise exception using message = 'EDU_SHARE_COMMENT_POST_REQUIRED';
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception using
      message = 'EDU_SHARE_COMMENT_BODY_INVALID',
      detail = 'Comment body must contain between 1 and 2000 characters.';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
      and p.comments_enabled = true
      and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope))
  ) then
    raise exception using
      message = 'EDU_SHARE_COMMENT_POST_UNAVAILABLE',
      detail = 'The target post is not currently available for comments.';
  end if;

  if p_reply_to_comment_id is not null then
    select c.*
    into v_target
    from public.comments c
    where c.id = p_reply_to_comment_id
      and c.post_id = p_post_id
      and c.visibility_status = 'visible'
      and c.deleted_at is null;

    if not found then
      raise exception using
        message = 'EDU_SHARE_COMMENT_REPLY_TARGET_INVALID',
        detail = 'Reply target must be a visible, non-deleted comment on the same post.';
    end if;

    -- Two visible levels only: replying to a reply is normalized to its root.
    v_parent_id := coalesce(v_target.parent_comment_id, v_target.id);
  end if;

  insert into public.comments (
    post_id,
    author_id,
    parent_comment_id,
    body,
    visibility_status,
    deleted_at
  )
  values (
    p_post_id,
    v_actor_id,
    v_parent_id,
    v_body,
    'visible',
    null
  )
  returning * into v_created;

  return jsonb_build_object(
    'id', v_created.id,
    'postId', v_created.post_id,
    'parentId', v_created.parent_comment_id,
    'createdAt', v_created.created_at
  );
end;
$$;

create or replace function public.delete_my_comment(p_comment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_comment public.comments%rowtype;
  v_already_deleted boolean;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  if p_comment_id is null then
    raise exception using message = 'EDU_SHARE_COMMENT_ID_REQUIRED';
  end if;

  select c.*
  into v_comment
  from public.comments c
  where c.id = p_comment_id
  for update;

  if not found then
    raise exception using message = 'EDU_SHARE_COMMENT_NOT_FOUND';
  end if;

  if v_comment.author_id <> v_actor_id then
    raise exception using message = 'EDU_SHARE_COMMENT_DELETE_FORBIDDEN';
  end if;

  v_already_deleted := v_comment.deleted_at is not null;

  if not v_already_deleted then
    update public.comments c
    set deleted_at = now()
    where c.id = p_comment_id
    returning c.* into v_comment;
  end if;

  return jsonb_build_object(
    'id', v_comment.id,
    'deletedAt', v_comment.deleted_at,
    'alreadyDeleted', v_already_deleted
  );
end;
$$;

create or replace function public.list_post_comments(p_post_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_result jsonb;
begin
  if v_actor_id is null or not (select private.is_marketplace_eligible()) then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_ACCESS_DENIED',
      detail = 'Reading marketplace comments requires a confirmed, approved and verified Student account.';
  end if;

  if p_post_id is null then
    raise exception using message = 'EDU_SHARE_COMMENT_POST_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
      and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope))
  ) then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_POST_NOT_FOUND',
      detail = 'The post does not exist or is not visible to the current marketplace viewer.';
  end if;

  with projected as materialized (
    select
      c.id,
      c.parent_comment_id,
      case when c.deleted_at is not null then null else c.body end as body,
      (c.deleted_at is not null) as is_deleted,
      case when author_profile.show_name then author_profile.full_name else 'Học sinh EDU SHARE+' end as author_name,
      case when author_profile.show_class then sc.label else null end as author_class_name,
      c.created_at,
      (c.author_id = v_actor_id and c.deleted_at is null) as can_delete
    from public.comments c
    join public.profiles author_profile
      on author_profile.user_id = c.author_id
    left join public.school_classes sc
      on sc.id = author_profile.class_id
     and sc.school_id = author_profile.school_id
    where c.post_id = p_post_id
      and c.visibility_status = 'visible'
      and (
        c.deleted_at is null
        or (
          c.parent_comment_id is null
          and exists (
            select 1
            from public.comments child
            where child.parent_comment_id = c.id
              and child.post_id = c.post_id
              and child.visibility_status = 'visible'
              and child.deleted_at is null
          )
        )
      )
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'parentId', p.parent_comment_id,
          'body', p.body,
          'isDeleted', p.is_deleted,
          'authorName', p.author_name,
          'authorClassName', p.author_class_name,
          'createdAt', p.created_at,
          'canDelete', p.can_delete
        )
        order by p.created_at asc, p.id asc
      )
      from projected p
    ), '[]'::jsonb),
    'totalCount', (select count(*)::integer from projected)
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.create_my_comment(uuid, text, uuid) is
  'Creates a verified Student marketplace comment and normalizes replies to two visible levels.';
comment on function public.delete_my_comment(uuid) is
  'Soft-deletes the authenticated author own comment without mutating stored body.';
comment on function public.list_post_comments(uuid) is
  'Returns current marketplace-visible comments with privacy-masked author identity and deleted-root tombstones.';

revoke all on function public.create_my_comment(uuid, text, uuid) from public, anon;
revoke all on function public.delete_my_comment(uuid) from public, anon;
revoke all on function public.list_post_comments(uuid) from public, anon;
grant execute on function public.create_my_comment(uuid, text, uuid) to authenticated;
grant execute on function public.delete_my_comment(uuid) to authenticated;
grant execute on function public.list_post_comments(uuid) to authenticated;
-- Phase 5G — audited contact reveal, 15-minute dedupe, and owner interaction history.

alter table public.contact_events
  add column if not exists revealed_method text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint c
    join pg_catalog.pg_class r on r.oid = c.conrelid
    join pg_catalog.pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public'
      and r.relname = 'contact_events'
      and c.conname = 'contact_events_revealed_method_check'
  ) then
    alter table public.contact_events
      add constraint contact_events_revealed_method_check
      check (revealed_method is null or revealed_method in ('email', 'phone'));
  end if;
end;
$$;

create index if not exists contact_events_requester_post_created_idx
  on public.contact_events (requester_id, post_id, created_at desc);

-- Raw audit rows are not a browser API in Phase 5G. All reads/writes go through
-- the trusted reveal/history functions below.
revoke select, insert, update, delete on table public.contact_events
  from public, anon, authenticated;

drop policy if exists contact_events_read_requester on public.contact_events;
drop policy if exists contact_events_read_post_owner on public.contact_events;

create or replace function public.reveal_post_contact(p_post_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_id uuid := (select auth.uid());
  v_owner_id uuid;
  v_method text;
  v_value text;
  v_show_email boolean;
  v_show_phone boolean;
  v_event_id uuid;
  v_event_created_at timestamptz;
  v_recent_method text;
  v_event_reused boolean := false;
begin
  if v_requester_id is null or not (select private.is_marketplace_eligible()) then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_ACCESS_DENIED',
      detail = 'Contact reveal requires a confirmed, approved and verified Student account.';
  end if;

  if p_post_id is null then
    raise exception using message = 'EDU_SHARE_CONTACT_POST_REQUIRED';
  end if;

  -- Serialize reveal decisions for the same requester/post pair. This prevents
  -- parallel clicks from creating multiple audit rows inside the dedupe window.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_requester_id::text || ':' || p_post_id::text, 0::bigint)
  );

  -- Hold the post row stable for the remainder of this transaction so the selected
  -- contact method cannot change between validation, audit choice, and return.
  select p.owner_id, p.preferred_contact_method
  into v_owner_id, v_method
  from public.posts p
  where p.id = p_post_id
    and p.moderation_status = 'approved'
    and p.lifecycle_status = 'active'
    and p.is_hidden = false
    and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope))
  for share;

  if not found then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_POST_NOT_FOUND',
      detail = 'The post does not exist or is not currently visible to this marketplace viewer.';
  end if;

  if v_owner_id = v_requester_id then
    raise exception using
      message = 'EDU_SHARE_CONTACT_SELF_REVEAL_FORBIDDEN',
      detail = 'Post owners do not use the audited viewer reveal workflow for their own contact information.';
  end if;

  if v_method not in ('email', 'phone') then
    raise exception using message = 'EDU_SHARE_CONTACT_METHOD_INVALID';
  end if;

  -- Lock the private-profile row so its privacy/value cannot change between the
  -- check and the successful return from this transaction.
  select
    case when v_method = 'email' then nullif(btrim(pp.contact_email), '')
         when v_method = 'phone' then nullif(btrim(pp.phone), '')
    end,
    pp.show_email,
    pp.show_phone
  into v_value, v_show_email, v_show_phone
  from public.profile_private pp
  where pp.user_id = v_owner_id
  for share;

  if not found or v_value is null then
    raise exception using
      message = 'EDU_SHARE_CONTACT_VALUE_UNAVAILABLE',
      detail = 'The selected contact channel does not currently contain a usable value.';
  end if;

  if (v_method = 'email' and coalesce(v_show_email, false) = false)
     or (v_method = 'phone' and coalesce(v_show_phone, false) = false) then
    raise exception using
      message = 'EDU_SHARE_CONTACT_PRIVACY_DISABLED',
      detail = 'The post owner currently does not permit reveal of the selected contact channel.';
  end if;

  select ce.id, ce.created_at, ce.revealed_method
  into v_event_id, v_event_created_at, v_recent_method
  from public.contact_events ce
  where ce.post_id = p_post_id
    and ce.requester_id = v_requester_id
    and ce.event_type = 'view_contact'
    and ce.created_at >= pg_catalog.now() - interval '15 minutes'
  order by ce.created_at desc, ce.id desc
  limit 1;

  if found then
    if v_recent_method is distinct from v_method then
      raise exception using
        message = 'EDU_SHARE_CONTACT_METHOD_CHANGED_DURING_DEDUPE',
        detail = 'The selected contact method changed during the active audit dedupe window.';
    end if;
    v_event_reused := true;
  else
    insert into public.contact_events (
      post_id,
      requester_id,
      event_type,
      revealed_method
    ) values (
      p_post_id,
      v_requester_id,
      'view_contact',
      v_method
    )
    returning id, created_at into v_event_id, v_event_created_at;
  end if;

  return jsonb_build_object(
    'method', v_method,
    'value', v_value,
    'eventId', v_event_id,
    'eventCreatedAt', v_event_created_at,
    'eventReused', v_event_reused
  );
end;
$$;

create or replace function public.list_my_post_contact_events(
  p_post_id uuid,
  p_limit integer default 20
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
  v_result jsonb;
begin
  if v_actor_id is null or not (select private.is_marketplace_eligible()) then
    raise exception using
      message = 'EDU_SHARE_MARKETPLACE_ACCESS_DENIED',
      detail = 'Owner interaction history requires a confirmed, approved and verified Student account.';
  end if;

  if p_post_id is null then
    raise exception using message = 'EDU_SHARE_CONTACT_POST_REQUIRED';
  end if;

  if v_limit < 1 or v_limit > 50 then
    raise exception using
      message = 'EDU_SHARE_CONTACT_HISTORY_LIMIT_INVALID',
      detail = 'Contact history limit must be between 1 and 50.';
  end if;

  if not exists (
    select 1
    from public.posts p
    where p.id = p_post_id
      and p.owner_id = v_actor_id
  ) then
    raise exception using
      message = 'EDU_SHARE_CONTACT_HISTORY_FORBIDDEN',
      detail = 'Only the post owner may read its contact reveal history.';
  end if;

  with scoped as materialized (
    select
      ce.id,
      ce.created_at,
      ce.revealed_method,
      case
        when requester_profile.show_name then requester_profile.full_name
        else 'Học sinh EDU SHARE+'
      end as requester_name,
      case
        when requester_profile.show_class then sc.label
        else null
      end as requester_class_name
    from public.contact_events ce
    join public.profiles requester_profile
      on requester_profile.user_id = ce.requester_id
    left join public.school_classes sc
      on sc.id = requester_profile.class_id
     and sc.school_id = requester_profile.school_id
    where ce.post_id = p_post_id
      and ce.event_type = 'view_contact'
      and ce.revealed_method in ('email', 'phone')
  ),
  paged as materialized (
    select s.*
    from scoped s
    order by s.created_at desc, s.id desc
    limit v_limit
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'requesterName', p.requester_name,
          'requesterClassName', p.requester_class_name,
          'revealedMethod', p.revealed_method,
          'createdAt', p.created_at
        )
        order by p.created_at desc, p.id desc
      )
      from paged p
    ), '[]'::jsonb),
    'totalCount', (select count(*)::integer from scoped),
    'favoriteCount', (
      select count(*)::integer
      from public.favorites f
      where f.post_id = p_post_id
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.reveal_post_contact(uuid) is
  'Reveals exactly one currently permitted owner contact channel to an eligible marketplace viewer and records a deduplicated audit event without storing the PII value.';

comment on function public.list_my_post_contact_events(uuid, integer) is
  'Returns privacy-masked contact reveal history and aggregate favorite count for the authenticated post owner.';

revoke all on function public.reveal_post_contact(uuid) from public, anon;
revoke all on function public.list_my_post_contact_events(uuid, integer) from public, anon;
grant execute on function public.reveal_post_contact(uuid) to authenticated;
grant execute on function public.list_my_post_contact_events(uuid, integer) to authenticated;
-- Phase 5H — Notifications Backend & RPCs
-- Secures public.notifications and provides trusted query/mutation RPCs.

alter table public.notifications enable row level security;

drop policy if exists notifications_select_self on public.notifications;
drop policy if exists notifications_read_own on public.notifications;
drop policy if exists notifications_insert_self on public.notifications;

create policy notifications_select_self
on public.notifications
for select
to authenticated
using (
  (select auth.uid()) = recipient_id
);

-- Client roles cannot directly insert/update/delete notifications.
revoke insert, update, delete on table public.notifications from public, anon, authenticated;

-- List current user notifications with unread count
create or replace function public.list_my_notifications(
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
  v_unread_count bigint;
  v_total_count bigint;
  v_items jsonb;
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'Must be signed in to view notifications.';
  end if;

  if v_limit < 1 or v_limit > 50 then
    raise exception using
      message = 'EDU_SHARE_NOTIFICATION_LIMIT_INVALID',
      detail = 'Limit must be between 1 and 50.';
  end if;

  if v_offset < 0 then
    raise exception using
      message = 'EDU_SHARE_NOTIFICATION_OFFSET_INVALID',
      detail = 'Offset must be greater than or equal to 0.';
  end if;

  select count(*) into v_unread_count
  from public.notifications n
  where n.recipient_id = v_actor_id
    and n.read_at is null;

  select count(*) into v_total_count
  from public.notifications n
  where n.recipient_id = v_actor_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'type', n.type,
        'title', n.title,
        'body', n.body,
        'entityType', n.entity_type,
        'entityId', n.entity_id,
        'readAt', n.read_at,
        'createdAt', n.created_at
      )
      order by n.created_at desc, n.id desc
    ),
    '[]'::jsonb
  ) into v_items
  from (
    select *
    from public.notifications n
    where n.recipient_id = v_actor_id
    order by n.created_at desc, n.id desc
    limit v_limit
    offset v_offset
  ) n;

  return jsonb_build_object(
    'items', v_items,
    'unreadCount', v_unread_count,
    'totalCount', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

-- Mark specified notifications or all unread notifications as read
create or replace function public.mark_my_notifications_read(
  p_notification_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_updated_count integer := 0;
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'Must be signed in to mark notifications as read.';
  end if;

  if p_notification_ids is not null and cardinality(p_notification_ids) > 0 then
    update public.notifications
    set read_at = now()
    where recipient_id = v_actor_id
      and id = any(p_notification_ids)
      and read_at is null;
  else
    update public.notifications
    set read_at = now()
    where recipient_id = v_actor_id
      and read_at is null;
  end if;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

revoke all on function public.list_my_notifications(integer, integer) from public, anon;
grant execute on function public.list_my_notifications(integer, integer) to authenticated;

revoke all on function public.mark_my_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_my_notifications_read(uuid[]) to authenticated;
-- Phase 5H — Moderation Reports Submission Backend
-- Secures public.reports and provides trusted report creation RPC.

alter table public.reports enable row level security;

-- Client roles cannot directly insert/update/delete reports.
revoke insert, update, delete on table public.reports from public, anon, authenticated;

-- Trusted report submission RPC for students & users
create or replace function public.submit_moderation_report(
  p_target_type text,
  p_target_id uuid,
  p_reason_code text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_target_type text := lower(btrim(coalesce(p_target_type, '')));
  v_reason_code text := btrim(coalesce(p_reason_code, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
  v_post_id uuid := null;
  v_comment_id uuid := null;
  v_reported_user_id uuid := null;
  v_report_id uuid;
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'Must be signed in to submit a report.';
  end if;

  if v_target_type not in ('post', 'comment', 'user') then
    raise exception using
      message = 'EDU_SHARE_REPORT_TARGET_TYPE_INVALID',
      detail = 'Target type must be post, comment, or user.';
  end if;

  if p_target_id is null then
    raise exception using
      message = 'EDU_SHARE_REPORT_TARGET_REQUIRED',
      detail = 'A valid target ID is required.';
  end if;

  if char_length(v_reason_code) < 1 or char_length(v_reason_code) > 80 then
    raise exception using
      message = 'EDU_SHARE_REPORT_REASON_INVALID',
      detail = 'Reason code must be between 1 and 80 characters.';
  end if;

  if v_description is not null and char_length(v_description) > 3000 then
    raise exception using
      message = 'EDU_SHARE_REPORT_DESCRIPTION_TOO_LONG',
      detail = 'Description must not exceed 3000 characters.';
  end if;

  if v_target_type = 'post' then
    if not exists (select 1 from public.posts where id = p_target_id) then
      raise exception using
        message = 'EDU_SHARE_REPORT_TARGET_NOT_FOUND',
        detail = 'Target post does not exist.';
    end if;
    v_post_id := p_target_id;
  elsif v_target_type = 'comment' then
    if not exists (select 1 from public.comments where id = p_target_id and deleted_at is null) then
      raise exception using
        message = 'EDU_SHARE_REPORT_TARGET_NOT_FOUND',
        detail = 'Target comment does not exist or has been deleted.';
    end if;
    v_comment_id := p_target_id;
  elsif v_target_type = 'user' then
    if p_target_id = v_actor_id then
      raise exception using
        message = 'EDU_SHARE_REPORT_SELF_FORBIDDEN',
        detail = 'Users cannot report themselves.';
    end if;
    if not exists (select 1 from public.profiles where user_id = p_target_id) then
      raise exception using
        message = 'EDU_SHARE_REPORT_TARGET_NOT_FOUND',
        detail = 'Target user does not exist.';
    end if;
    v_reported_user_id := p_target_id;
  end if;

  insert into public.reports (
    reporter_id,
    target_type,
    post_id,
    comment_id,
    reported_user_id,
    reason_code,
    description,
    status
  ) values (
    v_actor_id,
    v_target_type,
    v_post_id,
    v_comment_id,
    v_reported_user_id,
    v_reason_code,
    v_description,
    'open'
  )
  returning id into v_report_id;

  return jsonb_build_object(
    'id', v_report_id,
    'targetType', v_target_type,
    'targetId', p_target_id,
    'status', 'open',
    'createdAt', now()
  );
end;
$$;

revoke all on function public.submit_moderation_report(text, uuid, text, text) from public, anon;
grant execute on function public.submit_moderation_report(text, uuid, text, text) to authenticated;
-- Phase 5I — Teacher Post Moderation & Report Resolution RPCs
-- Provides trusted school-scoped post moderation and report workflows for staff.

-- 1. List staff post queue with school scoping and filtering
create or replace function public.list_staff_posts_queue(
  p_status text default null,
  p_search text default null,
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
  v_staff_ctx jsonb := (select public.get_current_staff_context());
  v_role_code text := v_staff_ctx->>'role_code';
  v_school_id uuid := nullif(v_staff_ctx->>'school_id', '')::uuid;
  v_limit integer := coalesce(p_limit, 20);
  v_offset integer := coalesce(p_offset, 0);
  v_search text := btrim(coalesce(p_search, ''));
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_total_count bigint;
  v_items jsonb;
begin
  if v_limit < 1 or v_limit > 100 then
    raise exception using message = 'EDU_SHARE_MODERATION_LIMIT_INVALID';
  end if;

  if v_offset < 0 then
    raise exception using message = 'EDU_SHARE_MODERATION_OFFSET_INVALID';
  end if;

  select count(*) into v_total_count
  from public.posts p
  join public.profiles pr on pr.user_id = p.owner_id
  where (v_role_code = 'admin' or p.school_id = v_school_id)
    and (v_status is null or v_status = '' or p.moderation_status = v_status)
    and (
      v_search = ''
      or p.title ilike '%' || v_search || '%'
      or pr.full_name ilike '%' || v_search || '%'
      or coalesce(pr.student_class, '') ilike '%' || v_search || '%'
    );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'description', p.description,
        'tradeType', p.trade_type,
        'category', c.name,
        'className', pr.student_class,
        'ownerName', pr.full_name,
        'ownerEmail', (select email from auth.users where id = p.owner_id),
        'price', p.price,
        'moderationStatus', p.moderation_status,
        'lifecycleStatus', p.lifecycle_status,
        'isHidden', p.is_hidden,
        'commentsEnabled', p.comments_enabled,
        'rejectionReason', p.rejection_reason,
        'createdAt', p.created_at,
        'publishedAt', p.published_at,
        'reportCount', (select count(*) from public.reports r where r.post_id = p.id and r.status in ('open', 'reviewing')),
        'favoriteCount', (select count(*) from public.favorites f where f.post_id = p.id)
      )
      order by p.created_at desc, p.id desc
    ),
    '[]'::jsonb
  ) into v_items
  from (
    select p.*
    from public.posts p
    join public.profiles pr on pr.user_id = p.owner_id
    where (v_role_code = 'admin' or p.school_id = v_school_id)
      and (v_status is null or v_status = '' or p.moderation_status = v_status)
      and (
        v_search = ''
        or p.title ilike '%' || v_search || '%'
        or pr.full_name ilike '%' || v_search || '%'
        or coalesce(pr.student_class, '') ilike '%' || v_search || '%'
      )
    order by p.created_at desc, p.id desc
    limit v_limit
    offset v_offset
  ) p
  left join public.categories c on c.id = p.category_id
  join public.profiles pr on pr.user_id = p.owner_id;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

-- 2. Execute post moderation action
create or replace function public.moderate_post(
  p_post_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_ctx jsonb := (select public.get_current_staff_context());
  v_actor_id uuid := (select auth.uid());
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_post public.posts%rowtype;
begin
  if p_post_id is null then
    raise exception using message = 'EDU_SHARE_POST_REQUIRED';
  end if;

  select * into v_post
  from public.posts
  where id = p_post_id;

  if not found then
    raise exception using message = 'EDU_SHARE_POST_NOT_FOUND';
  end if;

  if not (select private.can_moderate_post(p_post_id)) then
    raise exception using
      message = 'EDU_SHARE_MODERATION_SCOPE_DENIED',
      detail = 'Teacher cannot moderate posts from other schools.';
  end if;

  if v_action not in ('approve', 'reject', 'force_hide', 'force_show', 'disable_comments', 'enable_comments') then
    raise exception using message = 'EDU_SHARE_MODERATION_ACTION_INVALID';
  end if;

  if v_action = 'reject' and v_reason is null then
    raise exception using
      message = 'EDU_SHARE_REJECT_REASON_REQUIRED',
      detail = 'A rejection reason is mandatory.';
  end if;

  if v_action = 'approve' then
    update public.posts
    set moderation_status = 'approved',
        published_at = coalesce(published_at, now()),
        rejection_reason = null
    where id = p_post_id;

    insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id)
    values (v_post.owner_id, 'post_approved', 'Bài viết đã được duyệt', 'Bài đăng "' || v_post.title || '" của bạn đã được giáo viên phê duyệt và hiển thị trên chợ tài liệu.', 'post', p_post_id);

  elsif v_action = 'reject' then
    update public.posts
    set moderation_status = 'rejected',
        rejection_reason = v_reason
    where id = p_post_id;

    insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id)
    values (v_post.owner_id, 'post_rejected', 'Bài viết bị từ chối', 'Bài đăng "' || v_post.title || '" của bạn chưa được duyệt với lý do: ' || v_reason, 'post', p_post_id);

  elsif v_action = 'force_hide' then
    update public.posts
    set is_hidden = true
    where id = p_post_id;

  elsif v_action = 'force_show' then
    update public.posts
    set is_hidden = false
    where id = p_post_id;

  elsif v_action = 'disable_comments' then
    update public.posts
    set comments_enabled = false
    where id = p_post_id;

  elsif v_action = 'enable_comments' then
    update public.posts
    set comments_enabled = true
    where id = p_post_id;
  end if;

  insert into public.moderation_actions (
    post_id,
    moderator_id,
    action,
    reason,
    source
  ) values (
    p_post_id,
    v_actor_id,
    v_action,
    v_reason,
    'human'
  );

  return jsonb_build_object(
    'postId', p_post_id,
    'action', v_action,
    'moderatedAt', now()
  );
end;
$$;

-- 3. List staff reports queue
create or replace function public.list_staff_reports_queue(
  p_status text default null,
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
  v_staff_ctx jsonb := (select public.get_current_staff_context());
  v_role_code text := v_staff_ctx->>'role_code';
  v_school_id uuid := nullif(v_staff_ctx->>'school_id', '')::uuid;
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_limit integer := coalesce(p_limit, 20);
  v_offset integer := coalesce(p_offset, 0);
  v_total_count bigint;
  v_items jsonb;
begin
  select count(*) into v_total_count
  from public.reports r
  left join public.posts p on p.id = r.post_id
  where (v_role_code = 'admin' or p.school_id = v_school_id or p.school_id is null)
    and (v_status is null or v_status = '' or r.status = v_status);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'targetType', r.target_type,
        'targetId', coalesce(r.post_id, r.comment_id, r.reported_user_id),
        'targetTitle', p.title,
        'reasonCode', r.reason_code,
        'description', r.description,
        'status', r.status,
        'resolutionNote', r.resolution_note,
        'reporterName', pr.full_name,
        'createdAt', r.created_at,
        'resolvedAt', r.resolved_at
      )
      order by r.created_at desc, r.id desc
    ),
    '[]'::jsonb
  ) into v_items
  from (
    select r.*
    from public.reports r
    left join public.posts p on p.id = r.post_id
    where (v_role_code = 'admin' or p.school_id = v_school_id or p.school_id is null)
      and (v_status is null or v_status = '' or r.status = v_status)
    order by r.created_at desc, r.id desc
    limit v_limit
    offset v_offset
  ) r
  left join public.posts p on p.id = r.post_id
  join public.profiles pr on pr.user_id = r.reporter_id;

  return jsonb_build_object(
    'items', v_items,
    'totalCount', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
end;
$$;

-- 4. Resolve moderation report
create or replace function public.resolve_moderation_report(
  p_report_id uuid,
  p_decision text,
  p_resolution_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff_ctx jsonb := (select public.get_current_staff_context());
  v_actor_id uuid := (select auth.uid());
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_note text := nullif(btrim(coalesce(p_resolution_note, '')), '');
begin
  if p_report_id is null then
    raise exception using message = 'EDU_SHARE_REPORT_REQUIRED';
  end if;

  if not (select private.can_moderate_report(p_report_id)) then
    raise exception using
      message = 'EDU_SHARE_REPORT_SCOPE_DENIED',
      detail = 'Teacher cannot resolve reports from other schools.';
  end if;

  if v_decision not in ('resolved', 'dismissed') then
    raise exception using message = 'EDU_SHARE_REPORT_DECISION_INVALID';
  end if;

  update public.reports
  set status = v_decision,
      assigned_to = v_actor_id,
      resolution_note = v_note,
      resolved_at = now()
  where id = p_report_id;

  return jsonb_build_object(
    'reportId', p_report_id,
    'status', v_decision,
    'resolvedAt', now()
  );
end;
$$;

revoke all on function public.list_staff_posts_queue(text, text, integer, integer) from public, anon;
grant execute on function public.list_staff_posts_queue(text, text, integer, integer) to authenticated;

revoke all on function public.moderate_post(uuid, text, text) from public, anon;
grant execute on function public.moderate_post(uuid, text, text) to authenticated;

revoke all on function public.list_staff_reports_queue(text, integer, integer) from public, anon;
grant execute on function public.list_staff_reports_queue(text, integer, integer) to authenticated;

revoke all on function public.resolve_moderation_report(uuid, text, text) from public, anon;
grant execute on function public.resolve_moderation_report(uuid, text, text) to authenticated;
