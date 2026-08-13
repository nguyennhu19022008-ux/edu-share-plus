-- EDU SHARE+ / PHASE 3E.9
-- School-scoped Staff Read Policies + RLS Structural Audit foundation
-- DEVELOPMENT Supabase project only.
--
-- Adds narrowly scoped read authorization for Teacher/Moderator and global Admin
-- without opening direct staff mutations.
--
-- Important:
--   - Teacher/Moderator is school-scoped.
--   - Admin is global through private.can_moderate_school().
--   - Account-review private data is readable by Teacher/Moderator only while
--     an account review is pending/needs_information in that same school.
--   - Direct moderation/account-review/report mutations remain closed.
--   - Verification Staff permissions are NOT introduced in this migration.
--   - private schema remains non-browser-exposed.

-- =========================================================
-- 1. NARROW STAFF AUTHORIZATION HELPERS
-- =========================================================

create or replace function private.can_review_user(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select private.can_moderate_school(p.school_id)
      from public.profiles p
      where p.user_id = p_user_id
    ),
    false
  );
$$;

create or replace function private.can_read_private_for_account_review(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.has_role('admin', null))
    or (
      (select private.can_review_user(p_user_id))
      and exists (
        select 1
        from public.account_reviews ar
        where ar.user_id = p_user_id
          and ar.status in ('pending', 'needs_information')
      )
    );
$$;

create or replace function private.can_moderate_post(
  p_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select private.can_moderate_school(p.school_id)
      from public.posts p
      where p.id = p_post_id
    ),
    false
  );
$$;

create or replace function private.can_moderate_report(
  p_report_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select private.can_moderate_school(
        coalesce(
          post_target.school_id,
          comment_target.school_id,
          user_target.school_id
        )
      )
      from public.reports r

      left join public.posts post_target
        on post_target.id = r.post_id

      left join public.comments report_comment
        on report_comment.id = r.comment_id
      left join public.posts comment_target
        on comment_target.id = report_comment.post_id

      left join public.profiles user_target
        on user_target.user_id = r.reported_user_id

      where r.id = p_report_id
    ),
    false
  );
$$;

create or replace function private.can_moderate_post_media_file(
  p_file_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.post_media pm
    join public.posts p
      on p.id = pm.post_id
    where pm.file_id = p_file_id
      and private.can_moderate_school(p.school_id)
  );
$$;

revoke execute on function private.can_review_user(uuid)
  from public, anon;
revoke execute on function private.can_read_private_for_account_review(uuid)
  from public, anon;
revoke execute on function private.can_moderate_post(uuid)
  from public, anon;
revoke execute on function private.can_moderate_report(uuid)
  from public, anon;
revoke execute on function private.can_moderate_post_media_file(uuid)
  from public, anon;

grant execute on function private.can_review_user(uuid)
  to authenticated;
grant execute on function private.can_read_private_for_account_review(uuid)
  to authenticated;
grant execute on function private.can_moderate_post(uuid)
  to authenticated;
grant execute on function private.can_moderate_report(uuid)
  to authenticated;
grant execute on function private.can_moderate_post_media_file(uuid)
  to authenticated;


-- =========================================================
-- 2. STAFF REFERENCE / IDENTITY READS
-- =========================================================

create policy schools_read_staff_scope
on public.schools
for select
to authenticated
using (
  (select private.can_moderate_school(id))
);

create policy school_classes_read_staff_scope
on public.school_classes
for select
to authenticated
using (
  (select private.can_moderate_school(school_id))
);

create policy profiles_read_staff_scope
on public.profiles
for select
to authenticated
using (
  (select private.can_moderate_school(school_id))
);

-- Cross-user private profile reads are intentionally narrower than profile
-- reads: a Teacher/Moderator only gets this row while an actionable account
-- review exists. Global Admin is allowed through the helper.
create policy profile_private_read_account_review_staff
on public.profile_private
for select
to authenticated
using (
  (select private.can_read_private_for_account_review(user_id))
);

create policy account_reviews_read_staff_scope
on public.account_reviews
for select
to authenticated
using (
  (select private.can_review_user(user_id))
);


-- =========================================================
-- 3. STAFF MODERATION QUEUE READS
-- =========================================================

create policy posts_read_staff_scope
on public.posts
for select
to authenticated
using (
  (select private.can_moderate_school(school_id))
);

create policy post_status_history_read_staff_scope
on public.post_status_history
for select
to authenticated
using (
  (select private.can_moderate_post(post_id))
);

-- Moderators need comment content to evaluate comment reports and moderation
-- context, including hidden/removed comments in their school scope.
create policy comments_read_staff_scope
on public.comments
for select
to authenticated
using (
  (select private.can_moderate_post(post_id))
);

-- File metadata remains row-scoped. This does not grant Storage object bytes.
grant select on public.file_objects to authenticated;

create policy file_objects_read_post_media_staff
on public.file_objects
for select
to authenticated
using (
  purpose = 'post_media'
  and (select private.can_moderate_post_media_file(id))
);


-- =========================================================
-- 4. MODERATION ACTION HISTORY READS
-- =========================================================

grant select on public.moderation_actions to authenticated;

create policy moderation_actions_read_staff_scope
on public.moderation_actions
for select
to authenticated
using (
  (select private.can_moderate_post(post_id))
);


-- =========================================================
-- 5. REPORT QUEUE READS
-- =========================================================

create policy reports_read_staff_scope
on public.reports
for select
to authenticated
using (
  (select private.can_moderate_report(id))
);


-- =========================================================
-- 6. CONTACT SUPPORT DATA — INTENTIONALLY DEFERRED
-- =========================================================
-- contact_events remains requester/post-owner only from 3E.8.
-- Broader staff access will be introduced only together with support/case
-- purpose controls, avoiding an unnecessary school-wide contact-history grant.


-- =========================================================
-- 7. DIRECT STAFF MUTATIONS REMAIN CLOSED
-- =========================================================
-- Do NOT grant INSERT/UPDATE/DELETE to authenticated for:
--   public.account_reviews
--   public.posts
--   public.post_status_history
--   public.moderation_actions
--   public.reports
--   public.user_roles
--
-- Account decisions, moderation, report resolution, role assignment and
-- lifecycle changes remain trusted transactional workflow/RPC operations.


-- =========================================================
-- 8. REASSERT PRIVATE BOUNDARY
-- =========================================================

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;