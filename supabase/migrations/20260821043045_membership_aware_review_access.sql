-- Phase 5B — membership-aware student access and manual review.
-- Authentication alone is not student authorization: protected student access
-- requires an approved account plus currently verified school membership.

-- =========================================================
-- 1. HARDEN THE STUDENT AUTHORIZATION HELPER
-- =========================================================

create or replace function private.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      join public.user_roles ur
        on ur.user_id = p.user_id
       and ur.revoked_at is null
       and ur.school_id = p.school_id
      join public.roles r
        on r.id = ur.role_id
       and r.code = 'student'
      where p.user_id = (select auth.uid())
        and p.account_status = 'approved'
        and p.school_membership_status = 'verified'
        and p.membership_verification_method is not null
        and p.membership_verified_at is not null
    );
$$;

revoke execute on function private.is_approved_user()
  from public, anon;
grant execute on function private.is_approved_user()
  to authenticated;

-- =========================================================
-- 2. PROTECTED CURRENT-STUDENT CONTEXT
-- =========================================================

create or replace function public.get_current_student_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_school_name text;
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'An authenticated session is required.';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.user_id = v_actor_id;

  if not found then
    raise exception using message = 'EDU_SHARE_STUDENT_PROFILE_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_actor_id
      and ur.revoked_at is null
      and ur.school_id = v_profile.school_id
      and r.code = 'student'
  ) then
    raise exception using
      message = 'EDU_SHARE_STUDENT_ROLE_REQUIRED',
      detail = 'The authenticated identity is not an active Student account.';
  end if;

  if v_profile.account_status <> 'approved' then
    raise exception using
      message = 'EDU_SHARE_STUDENT_ACCOUNT_NOT_APPROVED',
      detail = 'The student account has not been approved.';
  end if;

  if v_profile.school_membership_status <> 'verified'
     or v_profile.membership_verification_method is null
     or v_profile.membership_verified_at is null then
    raise exception using
      message = 'EDU_SHARE_STUDENT_MEMBERSHIP_NOT_VERIFIED',
      detail = 'Current school membership has not been verified.';
  end if;

  select s.name
  into v_school_name
  from public.schools s
  where s.id = v_profile.school_id;

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'full_name', v_profile.full_name,
    'account_status', v_profile.account_status,
    'school_id', v_profile.school_id,
    'school_name', v_school_name,
    'class_id', v_profile.class_id,
    'school_membership_status', v_profile.school_membership_status,
    'membership_verification_method', v_profile.membership_verification_method,
    'membership_verified_at', v_profile.membership_verified_at
  );
end;
$$;

comment on function public.get_current_student_context() is
  'Protected Student context. Requires auth.uid(), active Student role, approved account and verified school membership.';

revoke all on function public.get_current_student_context()
  from public, anon;
grant execute on function public.get_current_student_context()
  to authenticated;

-- =========================================================
-- 3. MANUAL ACCOUNT REVIEW ALSO DECIDES SCHOOL MEMBERSHIP
-- =========================================================

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
  v_new_membership_status text;
  v_new_verification_method text;
  v_membership_verified_at timestamptz;
  v_decided_at timestamptz;
  v_before jsonb;
  v_after jsonb;
  v_notification_type text;
  v_notification_title text;
  v_notification_body text;
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'An authenticated staff session is required.';
  end if;

  if p_user_id is null then
    raise exception using message = 'EDU_SHARE_REVIEW_TARGET_REQUIRED';
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
    raise exception using message = 'EDU_SHARE_REVIEW_REASON_TOO_LONG';
  end if;

  if v_decision in ('rejected', 'needs_information') and v_reason is null then
    raise exception using
      message = 'EDU_SHARE_REVIEW_REASON_REQUIRED',
      detail = 'A reason is required for rejected or needs_information.';
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.user_id = p_user_id
  for update;

  if not found then
    raise exception using message = 'EDU_SHARE_REVIEW_TARGET_NOT_FOUND';
  end if;

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
    raise exception using message = 'EDU_SHARE_REVIEW_ROLE_MISSING';
  end if;

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

  v_before := jsonb_build_object(
    'user_id', v_profile.user_id,
    'school_id', v_profile.school_id,
    'account_status', v_profile.account_status,
    'school_membership_status', v_profile.school_membership_status,
    'membership_verification_method', v_profile.membership_verification_method,
    'membership_verified_at', v_profile.membership_verified_at,
    'review_id', v_review.id,
    'review_status', v_review.status,
    'reviewer_id', v_review.reviewer_id,
    'reason', v_review.reason,
    'decided_at', v_review.decided_at
  );

  if v_decision = 'approved' then
    v_new_account_status := 'approved';
    v_new_membership_status := 'verified';
    v_new_verification_method := 'teacher_manual_review';
    v_decided_at := now();
    v_membership_verified_at := v_decided_at;

    update public.account_reviews
    set
      status = 'approved',
      reviewer_id = v_actor_id,
      reason = v_reason,
      decided_at = v_decided_at
    where id = v_review.id;

    update public.profiles
    set
      account_status = v_new_account_status,
      school_membership_status = v_new_membership_status,
      membership_verification_method = v_new_verification_method,
      membership_verified_at = v_membership_verified_at,
      updated_at = now()
    where user_id = p_user_id;

    v_notification_type := 'account_review_approved';
    v_notification_title := 'Tài khoản đã được phê duyệt';
    v_notification_body :=
      'Tài khoản học sinh và tư cách thành viên trường của bạn đã được giáo viên/nhà trường xác minh.';

  elsif v_decision = 'rejected' then
    v_new_account_status := 'rejected';
    v_new_membership_status := 'needs_revalidation';
    v_new_verification_method := null;
    v_decided_at := now();
    v_membership_verified_at := null;

    update public.account_reviews
    set
      status = 'rejected',
      reviewer_id = v_actor_id,
      reason = v_reason,
      decided_at = v_decided_at
    where id = v_review.id;

    update public.profiles
    set
      account_status = v_new_account_status,
      school_membership_status = v_new_membership_status,
      membership_verification_method = null,
      membership_verified_at = null,
      updated_at = now()
    where user_id = p_user_id;

    v_notification_type := 'account_review_rejected';
    v_notification_title := 'Yêu cầu tài khoản chưa được chấp thuận';
    v_notification_body :=
      'Yêu cầu xác minh tài khoản học sinh chưa được chấp thuận. Vui lòng xem lý do và liên hệ giáo viên phụ trách nếu cần hỗ trợ.';

  else
    v_new_account_status := 'pending_review';
    v_new_membership_status := 'needs_revalidation';
    v_new_verification_method := null;
    v_decided_at := null;
    v_membership_verified_at := null;

    update public.account_reviews
    set
      status = 'needs_information',
      reviewer_id = v_actor_id,
      reason = v_reason,
      decided_at = null
    where id = v_review.id;

    update public.profiles
    set
      account_status = v_new_account_status,
      school_membership_status = v_new_membership_status,
      membership_verification_method = null,
      membership_verified_at = null,
      updated_at = now()
    where user_id = p_user_id;

    v_notification_type := 'account_review_needs_information';
    v_notification_title := 'Cần bổ sung thông tin tài khoản';
    v_notification_body :=
      'Giáo viên/nhà trường cần bạn bổ sung hoặc đối chiếu thêm thông tin trước khi phê duyệt tài khoản.';
  end if;

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

  v_after := jsonb_build_object(
    'user_id', p_user_id,
    'school_id', v_profile.school_id,
    'account_status', v_new_account_status,
    'school_membership_status', v_new_membership_status,
    'membership_verification_method', v_new_verification_method,
    'membership_verified_at', v_membership_verified_at,
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

  return jsonb_build_object(
    'ok', true,
    'user_id', p_user_id,
    'review_id', v_review.id,
    'decision', v_decision,
    'account_status', v_new_account_status,
    'school_membership_status', v_new_membership_status,
    'membership_verification_method', v_new_verification_method,
    'membership_verified_at', v_membership_verified_at
  );
end;
$$;

comment on function public.review_student_account(uuid, text, text) is
  'Trusted school-scoped account review. Manual approval also verifies current school membership.';

revoke all on function public.review_student_account(uuid, text, text)
  from public, anon;
grant execute on function public.review_student_account(uuid, text, text)
  to authenticated;

-- =========================================================
-- 4. STAFF REVIEW QUEUE WITH EXPLICIT ROSTER WORKFLOW REASON
-- =========================================================

-- Return type changes, therefore PostgreSQL requires dropping before recreation.
drop function if exists public.list_account_review_queue();

create function public.list_account_review_queue()
returns table (
  review_id uuid,
  user_id uuid,
  full_name text,
  contact_email text,
  phone text,
  student_reference_code text,
  school_id uuid,
  school_name text,
  class_name_claim text,
  review_status text,
  submitted_at timestamptz,
  current_reason text,
  roster_match_reason text,
  submission_snapshot jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_is_admin boolean;
  v_has_teacher_role boolean;
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'An authenticated staff session is required.';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = v_actor_id
      and p.account_status = 'approved'
  ) then
    raise exception using message = 'EDU_SHARE_STAFF_ACCOUNT_NOT_APPROVED';
  end if;

  v_is_admin := (select private.has_role('admin', null));

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = v_actor_id
      and ur.revoked_at is null
      and r.code = 'teacher_moderator'
      and ur.school_id is not null
  ) into v_has_teacher_role;

  if not v_is_admin and not v_has_teacher_role then
    raise exception using
      message = 'EDU_SHARE_STAFF_ACCESS_REQUIRED',
      detail = 'Only Admin or Teacher/Moderator may read the account-review queue.';
  end if;

  return query
  select
    ar.id as review_id,
    p.user_id,
    p.full_name,
    pp.contact_email,
    pp.phone,
    pp.student_reference_code,
    p.school_id,
    s.name as school_name,
    nullif(btrim(ar.submission_snapshot ->> 'class_name'), '') as class_name_claim,
    ar.status as review_status,
    ar.submitted_at,
    ar.reason as current_reason,
    nullif(btrim(ar.submission_snapshot ->> 'roster_match_reason'), '') as roster_match_reason,
    ar.submission_snapshot
  from public.account_reviews ar
  join public.profiles p on p.user_id = ar.user_id
  join public.schools s on s.id = p.school_id
  left join public.profile_private pp on pp.user_id = p.user_id
  where ar.status in ('pending', 'needs_information')
    and p.account_status = 'pending_review'
    and (
      v_is_admin
      or (select private.can_review_user(p.user_id))
    )
  order by
    case when ar.status = 'needs_information' then 0 else 1 end,
    ar.submitted_at asc,
    ar.id asc;
end;
$$;

comment on function public.list_account_review_queue() is
  'School-scoped open student review queue including staff-only roster workflow reason.';

revoke all on function public.list_account_review_queue()
  from public, anon;
grant execute on function public.list_account_review_queue()
  to authenticated;

-- =========================================================
-- 5. REASSERT DIRECT-MUTATION AND PRIVATE BOUNDARIES
-- =========================================================

revoke update on public.profiles from authenticated;
revoke update on public.account_reviews from authenticated;
grant update (show_name, show_class) on public.profiles to authenticated;

revoke all on public.roles from anon, authenticated;
revoke all on public.user_roles from anon, authenticated;
revoke all on schema private from public, anon, authenticated;
