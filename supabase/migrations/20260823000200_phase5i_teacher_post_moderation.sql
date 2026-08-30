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
