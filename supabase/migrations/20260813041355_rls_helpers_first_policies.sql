-- EDU SHARE+ / PHASE 3E.8
-- RLS Helpers + First Real Browser Policies
-- DEVELOPMENT Supabase project only.
--
-- This is the first opt-in Data API surface.
-- It intentionally exposes only low-risk/public/self-service operations.
-- Staff-wide moderation/account-review policies remain for a later validated wave.
--
-- Core principles:
--   1) auth.uid() is the browser identity source.
--   2) RLS and object/column grants are both required.
--   3) Complex multi-row/material workflows remain DENY-direct.
--   4) private helper functions are SECURITY DEFINER, STABLE,
--      search_path='', and fully qualified.
--   5) private schema itself remains unexposed/no USAGE to browser roles.

-- =========================================================
-- 1. SECURITY HELPERS
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
      where p.user_id = (select auth.uid())
        and p.account_status = 'approved'
    );
$$;

create or replace function private.has_role(
  p_role_code text,
  p_school_id uuid default null
)
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
      from public.user_roles ur
      join public.roles r
        on r.id = ur.role_id
      where ur.user_id = (select auth.uid())
        and ur.revoked_at is null
        and r.code = p_role_code
        and (
          (p_school_id is null and ur.school_id is null)
          or
          (
            p_school_id is not null
            and (ur.school_id is null or ur.school_id = p_school_id)
          )
        )
    );
$$;

create or replace function private.can_moderate_school(
  p_school_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.has_role('admin', null))
    or
    (select private.has_role('teacher_moderator', p_school_id));
$$;

-- Functions are not generally executable by browser roles by default.
-- These narrow helpers need EXECUTE for use inside RLS policy expressions,
-- while the private schema remains outside Data API exposed schemas.
revoke execute on function private.is_approved_user() from public, anon;
revoke execute on function private.has_role(text, uuid) from public, anon;
revoke execute on function private.can_moderate_school(uuid) from public, anon;

grant execute on function private.is_approved_user() to authenticated;
grant execute on function private.has_role(text, uuid) to authenticated;
grant execute on function private.can_moderate_school(uuid) to authenticated;


-- =========================================================
-- 2. RESET BROWSER OBJECT PRIVILEGES TO OPT-IN
-- =========================================================
-- Supabase projects may have default privileges that automatically make new
-- public tables reachable by anon/authenticated. We explicitly revoke first.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Ensure future public tables/functions do not become browser-reachable merely
-- because they were created. Later migrations must explicitly grant access.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;


-- =========================================================
-- 3. PUBLIC REFERENCE DATA
-- =========================================================

grant select on public.schools to anon, authenticated;
grant select on public.school_classes to anon, authenticated;
grant select on public.categories to anon, authenticated;

create policy schools_read_active
on public.schools
for select
to anon, authenticated
using (is_active = true);

create policy school_classes_read_active
on public.school_classes
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.schools s
    where s.id = school_classes.school_id
      and s.is_active = true
  )
);

create policy categories_read_active
on public.categories
for select
to anon, authenticated
using (is_active = true);


-- =========================================================
-- 4. OWN IDENTITY / ACCOUNT-REVIEW READS
-- =========================================================

grant select on public.profiles to authenticated;
grant select on public.profile_private to authenticated;
grant select on public.account_reviews to authenticated;

-- Only privacy display switches are directly mutable in this first wave.
grant update (show_name, show_class)
  on public.profiles
  to authenticated;

grant update (show_email, show_phone)
  on public.profile_private
  to authenticated;

create policy profiles_read_self
on public.profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profiles_update_privacy_self
on public.profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy profile_private_read_self
on public.profile_private
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy profile_private_update_privacy_self
on public.profile_private
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy account_reviews_read_self
on public.account_reviews
for select
to authenticated
using ((select auth.uid()) = user_id);


-- =========================================================
-- 5. MARKETPLACE READ POLICIES
-- =========================================================

grant select on public.posts to anon, authenticated;
grant select on public.post_media to anon, authenticated;
grant select on public.post_status_history to authenticated;

-- Guest feed: only approved + active + visible posts.
create policy posts_read_public_anon
on public.posts
for select
to anon
using (
  moderation_status = 'approved'
  and lifecycle_status = 'active'
  and is_hidden = false
);

-- Signed-in users also see the same public feed.
create policy posts_read_public_authenticated
on public.posts
for select
to authenticated
using (
  moderation_status = 'approved'
  and lifecycle_status = 'active'
  and is_hidden = false
);

-- Owner dashboard: owners may read their own workflow states.
create policy posts_read_own_authenticated
on public.posts
for select
to authenticated
using ((select auth.uid()) = owner_id);

-- Media visibility follows the caller's ability to read the parent post.
create policy post_media_read_anon
on public.post_media
for select
to anon
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
  )
);

create policy post_media_read_authenticated
on public.post_media
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_media.post_id
  )
);

-- Detailed workflow history is owner-only in this first policy wave.
create policy post_status_history_read_owner
on public.post_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = post_status_history.post_id
      and p.owner_id = (select auth.uid())
  )
);


-- =========================================================
-- 6. FAVORITES
-- =========================================================

grant select, insert, delete
  on public.favorites
  to authenticated;

create policy favorites_read_self
on public.favorites
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy favorites_insert_self_approved
on public.favorites
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and (select private.is_approved_user())
  and exists (
    select 1
    from public.posts p
    where p.id = favorites.post_id
      and p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
  )
);

create policy favorites_delete_self
on public.favorites
for delete
to authenticated
using ((select auth.uid()) = user_id);


-- =========================================================
-- 7. COMMENTS
-- =========================================================

grant select, insert
  on public.comments
  to authenticated;

-- Visible comments on a public active post are readable.
create policy comments_read_visible_public
on public.comments
for select
to authenticated
using (
  visibility_status = 'visible'
  and deleted_at is null
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
  )
);

-- Authors retain read access to their own rows for feedback/history.
create policy comments_read_own
on public.comments
for select
to authenticated
using ((select auth.uid()) = author_id);

create policy comments_insert_self_approved
on public.comments
for insert
to authenticated
with check (
  (select auth.uid()) = author_id
  and (select private.is_approved_user())
  and visibility_status = 'visible'
  and deleted_at is null
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
      and p.comments_enabled = true
  )
);


-- =========================================================
-- 8. CONTACT EVENTS
-- =========================================================
-- Creation/contact disclosure stays a later trusted workflow. This wave only
-- allows the requester and the post owner to read related event rows.

grant select on public.contact_events to authenticated;

create policy contact_events_read_requester
on public.contact_events
for select
to authenticated
using ((select auth.uid()) = requester_id);

create policy contact_events_read_post_owner
on public.contact_events
for select
to authenticated
using (
  exists (
    select 1
    from public.posts p
    where p.id = contact_events.post_id
      and p.owner_id = (select auth.uid())
  )
);


-- =========================================================
-- 9. NOTIFICATIONS
-- =========================================================

grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_read_self
on public.notifications
for select
to authenticated
using ((select auth.uid()) = recipient_id);

create policy notifications_mark_read_self
on public.notifications
for update
to authenticated
using ((select auth.uid()) = recipient_id)
with check ((select auth.uid()) = recipient_id);


-- =========================================================
-- 10. REPORTS: OWN READ ONLY
-- =========================================================
-- Report creation/resolution remains trusted workflow; staff queue access is
-- deliberately deferred until school-scoped staff policies are live-tested.

grant select on public.reports to authenticated;

create policy reports_read_own
on public.reports
for select
to authenticated
using ((select auth.uid()) = reporter_id);


-- =========================================================
-- 11. INTENTIONALLY STILL CLOSED
-- =========================================================
-- No anon/authenticated grants or browser mutation policies are added for:
--   public.roles
--   public.user_roles
--   public.file_objects
--   public.moderation_actions
--   private.audit_logs
--   private.analytics_events
--   private.legacy_import_map
--
-- Also intentionally absent:
--   post INSERT/UPDATE/DELETE
--   account-review mutation
--   contact-event INSERT
--   report INSERT/UPDATE
--   moderation mutation
--
-- Those require trusted workflow functions/RPCs or later validated staff scope.


-- =========================================================
-- 12. REASSERT PRIVATE SCHEMA BOUNDARY
-- =========================================================

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on all sequences in schema private from public, anon, authenticated;