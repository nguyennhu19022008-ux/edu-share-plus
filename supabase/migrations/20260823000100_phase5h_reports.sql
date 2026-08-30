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
