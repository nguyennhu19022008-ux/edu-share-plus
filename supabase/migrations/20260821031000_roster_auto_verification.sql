-- Phase 5B: resolve an email-confirmed student registration against the active
-- school roster. Roster data remains private; normal mismatch outcomes are
-- converted into manual review instead of being exposed to the client.

create or replace function private.queue_student_review_after_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_registration private.student_registration_claims%rowtype;
  v_profile public.profiles%rowtype;
  v_roster_enabled boolean := true;
  v_match_count integer := 0;
  v_roster private.student_roster%rowtype;
  v_existing_claim private.student_roster_claims%rowtype;
  v_reason text;
  v_now timestamptz := now();
  v_snapshot jsonb;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  select src.*
  into v_registration
  from private.student_registration_claims src
  where src.user_id = new.id;

  -- Auth is shared infrastructure. Only explicit student-v2 registrations are
  -- processed by this workflow.
  if not found then
    return new;
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.user_id = new.id
  for update;

  if not found then
    return new;
  end if;

  -- Idempotent exit for an already verified account.
  if v_profile.account_status = 'approved'
     and v_profile.school_membership_status = 'verified'
     and v_profile.membership_verification_method is not null then
    return new;
  end if;

  select coalesce(s.roster_verification_enabled, true)
  into v_roster_enabled
  from public.schools s
  where s.id = v_registration.school_id
    and s.is_active = true;

  if not coalesce(v_roster_enabled, false) then
    v_reason := 'roster_disabled_manual_review';
  else
    select count(*)
    into v_match_count
    from private.student_roster sr
    join private.roster_import_batches rb
      on rb.id = sr.batch_id
     and rb.school_id = sr.school_id
     and rb.academic_year = sr.academic_year
    where sr.school_id = v_registration.school_id
      and rb.status = 'active'
      and sr.class_normalized = v_registration.class_normalized
      and sr.phone_normalized = v_registration.phone_normalized;

    if v_match_count = 0 then
      v_reason := 'roster_not_found';
    elsif v_match_count > 1 then
      v_reason := 'roster_ambiguous';
    else
      select sr.*
      into v_roster
      from private.student_roster sr
      join private.roster_import_batches rb
        on rb.id = sr.batch_id
       and rb.school_id = sr.school_id
       and rb.academic_year = sr.academic_year
      where sr.school_id = v_registration.school_id
        and rb.status = 'active'
        and sr.class_normalized = v_registration.class_normalized
        and sr.phone_normalized = v_registration.phone_normalized
      limit 1
      for update of sr;

      select rc.*
      into v_existing_claim
      from private.student_roster_claims rc
      where rc.roster_entry_id = v_roster.id
        and rc.released_at is null
      limit 1
      for update;

      if found and v_existing_claim.user_id <> new.id then
        v_reason := 'roster_already_claimed';
      else
        begin
          if v_existing_claim.id is null then
            insert into private.student_roster_claims (
              user_id,
              roster_entry_id,
              school_id,
              verification_method,
              claimed_by,
              reason,
              claimed_at
            ) values (
              new.id,
              v_roster.id,
              v_roster.school_id,
              'school_roster_match',
              null,
              'unique_school_class_phone_match',
              v_now
            );
          end if;
        exception
          when unique_violation then
            v_reason := 'roster_already_claimed';
        end;
      end if;
    end if;
  end if;

  v_snapshot := jsonb_build_object(
    'email', v_registration.email,
    'email_confirmed_at', new.email_confirmed_at,
    'school_id', v_registration.school_id,
    'entered_full_name', v_registration.entered_full_name,
    'class_name', v_registration.class_name,
    'class_normalized', v_registration.class_normalized,
    'phone_normalized', v_registration.phone_normalized,
    'roster_match_reason', coalesce(v_reason, 'school_roster_match')
  );

  if v_reason is null then
    v_snapshot := v_snapshot || jsonb_build_object(
      'roster_entry_id', v_roster.id,
      'roster_batch_id', v_roster.batch_id,
      'canonical_full_name', v_roster.full_name,
      'canonical_class_name', v_roster.class_name
    );

    update public.profiles p
    set full_name = v_roster.full_name,
        class_id = v_roster.class_id,
        account_status = 'approved',
        school_membership_status = 'verified',
        membership_verification_method = 'school_roster_match',
        membership_verified_at = v_now,
        updated_at = v_now
    where p.user_id = new.id;

    -- Close any stale open review defensively before appending immutable
    -- automatic approval history.
    update public.account_reviews ar
    set status = 'approved',
        reason = 'school_roster_match',
        decided_at = v_now,
        submission_snapshot = coalesce(ar.submission_snapshot, '{}'::jsonb) || v_snapshot
    where ar.user_id = new.id
      and ar.status in ('pending', 'needs_information');

    if not found then
      insert into public.account_reviews (
        user_id,
        reviewer_id,
        status,
        reason,
        submitted_at,
        decided_at,
        submission_snapshot
      ) values (
        new.id,
        null,
        'approved',
        'school_roster_match',
        v_now,
        v_now,
        v_snapshot
      );
    end if;

    insert into public.notifications (
      recipient_id,
      type,
      title,
      body,
      entity_type,
      entity_id
    ) values (
      new.id,
      'account_review_approved',
      'Tài khoản đã được xác minh',
      'Email và thông tin học sinh của bạn đã được xác minh với danh sách nhà trường.',
      'account',
      new.id
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
    ) values (
      null,
      'system',
      'student_roster_auto_verified',
      'profile',
      new.id,
      jsonb_build_object(
        'account_status', v_profile.account_status,
        'school_membership_status', v_profile.school_membership_status
      ),
      jsonb_build_object(
        'account_status', 'approved',
        'school_membership_status', 'verified',
        'membership_verification_method', 'school_roster_match',
        'roster_entry_id', v_roster.id
      ),
      'auth_email_confirmation',
      jsonb_build_object(
        'school_id', v_roster.school_id,
        'roster_batch_id', v_roster.batch_id
      )
    );

    return new;
  end if;

  -- Expected mismatch/ambiguity/conflict conditions are not Auth errors.
  -- Keep the student pending and create exactly one open manual-review item.
  update public.profiles p
  set account_status = 'pending_review',
      school_membership_status = 'needs_revalidation',
      membership_verification_method = null,
      membership_verified_at = null,
      updated_at = v_now
  where p.user_id = new.id;

  if exists (
    select 1
    from public.account_reviews ar
    where ar.user_id = new.id
      and ar.status in ('pending', 'needs_information')
  ) then
    update public.account_reviews ar
    set status = 'pending',
        reason = v_reason,
        submission_snapshot = coalesce(ar.submission_snapshot, '{}'::jsonb) || v_snapshot
    where ar.user_id = new.id
      and ar.status in ('pending', 'needs_information');
  else
    insert into public.account_reviews (
      user_id,
      reviewer_id,
      status,
      reason,
      submitted_at,
      decided_at,
      submission_snapshot
    ) values (
      new.id,
      null,
      'pending',
      v_reason,
      v_now,
      null,
      v_snapshot
    );
  end if;

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
  ) values (
    null,
    'system',
    'student_roster_manual_review_queued',
    'profile',
    new.id,
    jsonb_build_object(
      'account_status', v_profile.account_status,
      'school_membership_status', v_profile.school_membership_status
    ),
    jsonb_build_object(
      'account_status', 'pending_review',
      'school_membership_status', 'needs_revalidation',
      'roster_match_reason', v_reason
    ),
    'auth_email_confirmation',
    jsonb_build_object('school_id', v_registration.school_id)
  );

  return new;
end;
$$;

revoke all on function private.queue_student_review_after_email_confirmed() from public;
revoke all on function private.queue_student_review_after_email_confirmed() from anon;
revoke all on function private.queue_student_review_after_email_confirmed() from authenticated;
