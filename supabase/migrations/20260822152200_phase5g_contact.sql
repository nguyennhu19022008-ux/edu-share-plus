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
