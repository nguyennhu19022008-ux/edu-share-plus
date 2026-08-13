-- EDU SHARE+ / PHASE 4E.1
-- Trusted Student Account Review Decision RPC
-- DEVELOPMENT Supabase project only.
--
-- Purpose:
--   - Teacher/Moderator may review students only inside their school scope.
--   - Global Admin may review across schools.
--   - Reviewer identity always comes from auth.uid(); never from client input.
--   - profiles.account_status and account_reviews are updated atomically.
--   - Student receives a notification.
--   - Material action is written to private.audit_logs.
--   - Browser still has NO direct UPDATE grant on profiles/account_reviews.
--
-- Supported decisions:
--   approved
--   rejected
--   needs_information
--
-- This function is intentionally in public schema so authenticated clients
-- can call it through Supabase RPC. Authorization is enforced inside the
-- SECURITY DEFINER function before any material change is made.

create or replace function public.review_student_account(
  p_user_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;

  v_profile public.profiles%rowtype;
  v_review public.account_reviews%rowtype;

  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');

  v_new_account_status text;
  v_decided_at timestamptz;

  v_before jsonb;
  v_after jsonb;

  v_notification_type text;
  v_notification_title text;
  v_notification_body text;
begin
  -- -------------------------------------------------------
  -- 1. AUTHENTICATION + INPUT VALIDATION
  -- -------------------------------------------------------

  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'An authenticated staff session is required.';
  end if;

  if p_user_id is null then
    raise exception using
      message = 'EDU_SHARE_REVIEW_TARGET_REQUIRED';
  end if;

  if v_actor_id = p_user_id then
    raise exception using
      message = 'EDU_SHARE_SELF_REVIEW_FORBIDDEN',
      detail = 'A reviewer cannot review their own account.';
  end if;

  if v_decision not in ('approved', 'rejected', 'needs_information') then
    raise exception using
      message = 'EDU_SHARE_INVALID_ACCOUNT_DECISION',
      detail = 'Allowed decisions: approved, rejected, needs_information.';
  end if;

  if v_reason is not null and char_length(v_reason) > 5000 then
    raise exception using
      message = 'EDU_SHARE_REVIEW_REASON_TOO_LONG';
  end if;

  if v_decision in ('rejected', 'needs_information') and v_reason is null then
    raise exception using
      message = 'EDU_SHARE_REVIEW_REASON_REQUIRED',
      detail = 'A reason is required for rejected or needs_information.';
  end if;


  -- -------------------------------------------------------
  -- 2. LOCK TARGET PROFILE
  -- -------------------------------------------------------

  select p.*
  into v_profile
  from public.profiles p
  where p.user_id = p_user_id
  for update;

  if not found then
    raise exception using
      message = 'EDU_SHARE_REVIEW_TARGET_NOT_FOUND';
  end if;


  -- -------------------------------------------------------
  -- 3. SCHOOL-SCOPED AUTHORIZATION
  -- -------------------------------------------------------

  if not (select private.can_review_user(p_user_id)) then
    raise exception using
      message = 'EDU_SHARE_REVIEW_FORBIDDEN',
      detail = 'The current account cannot review this student or school.';
  end if;

  if (select private.has_role('admin', null)) then
    v_actor_role := 'admin';
  elsif (select private.has_role('teacher_moderator', v_profile.school_id)) then
    v_actor_role := 'teacher_moderator';
  else
    -- Defensive fallback: can_review_user() should already have denied this.
    raise exception using
      message = 'EDU_SHARE_REVIEW_ROLE_MISSING';
  end if;


  -- -------------------------------------------------------
  -- 4. LOCK THE SINGLE CURRENT OPEN REVIEW
  -- -------------------------------------------------------

  select ar.*
  into v_review
  from public.account_reviews ar
  where ar.user_id = p_user_id
    and ar.status in ('pending', 'needs_information')
  order by ar.submitted_at desc, ar.id desc
  limit 1
  for update;

  if not found then
    raise exception using
      message = 'EDU_SHARE_OPEN_REVIEW_NOT_FOUND',
      detail = 'No pending/needs_information review exists for this user.';
  end if;

  if v_profile.account_status <> 'pending_review' then
    raise exception using
      message = 'EDU_SHARE_ACCOUNT_NOT_PENDING_REVIEW',
      detail = 'Only pending_review accounts may be decided by this workflow.';
  end if;


  -- -------------------------------------------------------
  -- 5. CAPTURE BEFORE STATE
  -- -------------------------------------------------------

  v_before := jsonb_build_object(
    'user_id', v_profile.user_id,
    'school_id', v_profile.school_id,
    'account_status', v_profile.account_status,
    'review_id', v_review.id,
    'review_status', v_review.status,
    'reviewer_id', v_review.reviewer_id,
    'reason', v_review.reason,
    'decided_at', v_review.decided_at
  );


  -- -------------------------------------------------------
  -- 6. APPLY DECISION
  -- -------------------------------------------------------

  if v_decision = 'approved' then
    v_new_account_status := 'approved';
    v_decided_at := now();

    update public.account_reviews
    set
      status = 'approved',
      reviewer_id = v_actor_id,
      reason = v_reason,
      decided_at = v_decided_at
    where id = v_review.id;

    update public.profiles
    set account_status = 'approved'
    where user_id = p_user_id;

    v_notification_type := 'account_review_approved';
    v_notification_title := 'Tài khoản đã được phê duyệt';
    v_notification_body :=
      'Tài khoản học sinh của bạn đã được giáo viên/nhà trường phê duyệt. Bạn có thể đăng nhập và sử dụng khu vực học sinh.';

  elsif v_decision = 'rejected' then
    v_new_account_status := 'rejected';
    v_decided_at := now();

    update public.account_reviews
    set
      status = 'rejected',
      reviewer_id = v_actor_id,
      reason = v_reason,
      decided_at = v_decided_at
    where id = v_review.id;

    update public.profiles
    set account_status = 'rejected'
    where user_id = p_user_id;

    v_notification_type := 'account_review_rejected';
    v_notification_title := 'Yêu cầu tài khoản chưa được chấp thuận';
    v_notification_body :=
      'Yêu cầu xác minh tài khoản học sinh chưa được chấp thuận. Vui lòng xem lý do và liên hệ giáo viên phụ trách nếu cần hỗ trợ.';

  else
    -- needs_information is non-terminal:
    -- account remains pending_review and decided_at must stay NULL.
    v_new_account_status := 'pending_review';
    v_decided_at := null;

    update public.account_reviews
    set
      status = 'needs_information',
      reviewer_id = v_actor_id,
      reason = v_reason,
      decided_at = null
    where id = v_review.id;

    update public.profiles
    set account_status = 'pending_review'
    where user_id = p_user_id;

    v_notification_type := 'account_review_needs_information';
    v_notification_title := 'Cần bổ sung thông tin tài khoản';
    v_notification_body :=
      'Giáo viên/nhà trường cần bạn bổ sung hoặc đối chiếu thêm thông tin trước khi phê duyệt tài khoản.';
  end if;


  -- -------------------------------------------------------
  -- 7. STUDENT NOTIFICATION
  -- -------------------------------------------------------

  insert into public.notifications (
    recipient_id,
    type,
    title,
    body,
    entity_type,
    entity_id
  )
  values (
    p_user_id,
    v_notification_type,
    v_notification_title,
    v_notification_body,
    'account_review',
    v_review.id
  );


  -- -------------------------------------------------------
  -- 8. AUDIT LOG
  -- -------------------------------------------------------

  v_after := jsonb_build_object(
    'user_id', p_user_id,
    'school_id', v_profile.school_id,
    'account_status', v_new_account_status,
    'review_id', v_review.id,
    'review_status', v_decision,
    'reviewer_id', v_actor_id,
    'reason', v_reason,
    'decided_at', v_decided_at
  );

  insert into private.audit_logs (
    actor_id,
    actor_role_snapshot,
    action,
    entity_type,
    entity_id,
    before_state,
    after_state,
    source,
    metadata
  )
  values (
    v_actor_id,
    v_actor_role,
    'student_account_review_decision',
    'account_review',
    v_review.id,
    v_before,
    v_after,
    'trusted_rpc',
    jsonb_build_object(
      'target_user_id', p_user_id,
      'school_id', v_profile.school_id,
      'decision', v_decision
    )
  );


  -- -------------------------------------------------------
  -- 9. RETURN NON-SECRET RESULT
  -- -------------------------------------------------------

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'review_id', v_review.id,
    'decision', v_decision,
    'account_status', v_new_account_status
  );
end;
$$;

comment on function public.review_student_account(uuid, text, text) is
  'Trusted EDU SHARE+ school-scoped student account review decision workflow. Reviewer identity comes from auth.uid().';

-- Functions are not protected by table RLS. Keep EXECUTE opt-in.
revoke all
on function public.review_student_account(uuid, text, text)
from public, anon;

grant execute
on function public.review_student_account(uuid, text, text)
to authenticated;

-- Reassert direct browser mutations remain closed.
revoke update on public.profiles from authenticated;
revoke update on public.account_reviews from authenticated;

-- The student self-service column UPDATE grants from Phase 3E.8 must remain
-- available. Re-grant only those explicit profile privacy columns.
grant update (show_name, show_class)
  on public.profiles
  to authenticated;

-- Keep private schema non-browser-accessible.
revoke all on schema private from public, anon, authenticated;
