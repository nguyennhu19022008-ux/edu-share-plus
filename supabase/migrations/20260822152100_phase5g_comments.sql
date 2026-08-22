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
