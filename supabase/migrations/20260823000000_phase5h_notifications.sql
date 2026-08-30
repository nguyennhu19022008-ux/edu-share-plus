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
