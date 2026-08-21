-- Phase 5B — evaluate the private active school roster after email confirmation.
-- A unique unclaimed school+class+phone match auto-approves. Every other
-- outcome stays pending for same-school teacher review without exposing roster
-- existence to the signup client.

create or replace function private.verify_student_after_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim private.student_registration_claims%rowtype;
  v_profile public.profiles%rowtype;
  v_roster private.student_roster%rowtype;
  v_batch_id uuid;
  v_roster_enabled boolean;
  v_candidate_count integer := 0;
  v_reason text;
  v_active_claim_exists boolean := false;
  v_claim_inserted boolean := false;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  select c.*
  into v_claim
  from private.student_registration_claims c
  where c.user_id = new.id;

  -- Auth is shared infrastructure. Identities without the explicit student
  -- registration snapshot are not EDU SHARE+ students and are ignored here.
  if not found then
    return new;
  end if;

  select p.*
  into v_profile
  from public.profiles p
  where p.user_id = new.id
  for update;

  if not found then
    raise exception using message = 'EDU_SHARE_PROFILE_PROVISIONING_MISSING';
  end if;

  select s.roster_verification_enabled
  into v_roster_enabled
  from public.schools s
  where s.id = v_claim.school_id
    and s.is_active = true;

  if coalesce(v_roster_enabled, false) = false then
    v_reason := 'roster_disabled_manual_review';
  else
    select b.id
    into v_batch_id
    from private.roster_import_batches b
    where b.school_id = v_claim.school_id
      and b.status = 'active'
    limit 1;

    if v_batch_id is null then
      v_reason := 'roster_not_found';
    else
      select count(*)
      into v_candidate_count
      from private.student_roster r
      where r.batch_id = v_batch_id
        and r.school_id = v_claim.school_id
        and r.class_normalized = v_claim.class_normalized
        and r.phone_normalized = v_claim.phone_normalized;

      if v_candidate_count = 0 then
        v_reason := 'roster_not_found';
      elsif v_candidate_count > 1 then
        v_reason := 'roster_ambiguous';
      else
        select r.*
        into v_roster
        from private.student_roster r
        where r.batch_id = v_batch_id
          and r.school_id = v_claim.school_id
          and r.class_normalized = v_claim.class_normalized
          and r.phone_normalized = v_claim.phone_normalized
        limit 1
        for update;

        select exists (
          select 1
          from private.student_roster_claims rc
          where rc.roster_entry_id = v_roster.id
            and rc.released_at is null
        )
        into v_active_claim_exists;

        if v_active_claim_exists then
          v_reason := 'roster_already_claimed';
        else
          begin
            insert into private.student_roster_claims (
              user_id,
              roster_entry_id,
              school_id,
              verification_method,
              claimed_by,
              reason
            )
            values (
              new.id,
              v_roster.id,
              v_roster.school_id,
              'school_roster_match',
              null,
              'Automatic claim after verified email and unique school roster match.'
            );
            v_claim_inserted := true;
          exception
            when unique_violation then
              -- The partial unique indexes are the final race-condition barrier.
              -- Do not leak which account won the claim; route to staff review.
              v_reason := 'roster_already_claimed';
              v_claim_inserted := false;
          end;
        end if;
      end if;
    end if;
  end if;

  if v_claim_inserted then
    update public.profiles p
    set
      full_name = v_roster.full_name,
      class_id = v_roster.class_id,
      account_status = 'approved',
      school_membership_status = 'verified',
      membership_verification_method = 'school_roster_match',
      membership_verified_at = now(),
      updated_at = now()
    where p.user_id = new.id;

    -- A successful automatic decision is kept in the same review-history table
    -- as staff decisions. reviewer_id is null because the trusted auth trigger
    -- made the decision from school-controlled roster data.
    insert into public.account_reviews (
      user_id,
      reviewer_id,
      status,
      reason,
      submitted_at,
      decided_at,
      submission_snapshot
    )
    values (
      new.id,
      null,
      'approved',
      'Verified automatically from the active school roster.',
      now(),
      now(),
      jsonb_build_object(
        'full_name_entered', v_claim.entered_full_name,
        'full_name_official', v_roster.full_name,
        'school_id', v_roster.school_id,
        'class_name_entered', v_claim.class_name,
        'class_name_official', v_roster.class_name,
        'phone', v_claim.phone_normalized,
        'email', v_claim.contact_email,
        'email_confirmed_at', new.email_confirmed_at,
        'roster_match_reason', 'school_roster_match',
        'roster_entry_id', v_roster.id,
        'roster_batch_id', v_roster.batch_id
      )
    );

    insert into public.notifications (
      recipient_id,
      type,
      title,
      body,
      entity_type,
      entity_id
    )
    values (
      new.id,
      'account_approved',
      'Tài khoản đã được xác minh',
      'Email và thông tin học sinh đã khớp với danh sách của trường. Tài khoản EDU SHARE+ đã được phê duyệt.',
      'profile',
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
    )
    values (
      null,
      null,
      'student_account_auto_approved',
      'profile',
      new.id,
      jsonb_build_object(
        'account_status', v_profile.account_status,
        'school_membership_status', v_profile.school_membership_status,
        'full_name', v_profile.full_name,
        'class_id', v_profile.class_id
      ),
      jsonb_build_object(
        'account_status', 'approved',
        'school_membership_status', 'verified',
        'membership_verification_method', 'school_roster_match',
        'full_name', v_roster.full_name,
        'class_id', v_roster.class_id
      ),
      'auth_trigger',
      jsonb_build_object(
        'school_id', v_roster.school_id,
        'roster_entry_id', v_roster.id,
        'roster_batch_id', v_roster.batch_id
      )
    );

    return new;
  end if;

  -- Every non-automatic outcome intentionally looks the same to the student:
  -- pending review. The reason is private staff context in the review snapshot.
  insert into public.account_reviews (
    user_id,
    status,
    submission_snapshot
  )
  values (
    new.id,
    'pending',
    jsonb_build_object(
      'full_name', v_claim.entered_full_name,
      'school_id', v_claim.school_id,
      'class_name', v_claim.class_name,
      'phone', v_claim.phone_normalized,
      'email', v_claim.contact_email,
      'email_confirmed_at', new.email_confirmed_at,
      'roster_match_reason', v_reason
    )
  )
  on conflict (user_id) where status in ('pending', 'needs_information')
  do update set
    submission_snapshot = excluded.submission_snapshot;

  return new;
end;
$$;

-- Keep the stable trigger name, but move it from queue-only behavior to the
-- roster-aware verifier.
drop trigger if exists edu_share_on_auth_email_confirmed on auth.users;

create trigger edu_share_on_auth_email_confirmed
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function private.verify_student_after_email_confirmed();

-- The old queue-only trigger function is no longer part of the lifecycle.
drop function if exists private.queue_student_review_after_email_confirmed();

revoke execute on function private.verify_student_after_email_confirmed()
  from public, anon, authenticated;
