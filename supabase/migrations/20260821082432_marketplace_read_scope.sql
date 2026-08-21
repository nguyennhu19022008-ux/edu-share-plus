-- Phase 5C — authenticated marketplace visibility foundation.
-- Marketplace browsing requires a confirmed email, approved Student account,
-- and verified current-school membership. School policy is the upper bound:
-- a post may narrow visibility to its school but never widen a school-only tenant.

alter table public.schools
  add column marketplace_scope text not null default 'school';

alter table public.schools
  add constraint schools_marketplace_scope_check
    check (marketplace_scope in ('school', 'network'));

alter table public.posts
  add column visibility_scope text not null default 'inherit';

alter table public.posts
  add constraint posts_visibility_scope_check
    check (visibility_scope in ('inherit', 'school', 'network'));

create or replace function private.is_marketplace_eligible()
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
      from auth.users au
      join public.profiles p
        on p.user_id = au.id
      join public.user_roles ur
        on ur.user_id = p.user_id
       and ur.school_id = p.school_id
       and ur.revoked_at is null
      join public.roles r
        on r.id = ur.role_id
       and r.code = 'student'
      join public.schools s
        on s.id = p.school_id
       and s.is_active = true
      where au.id = (select auth.uid())
        and au.email_confirmed_at is not null
        and p.account_status = 'approved'
        and p.school_membership_status = 'verified'
        and p.membership_verification_method is not null
        and p.membership_verified_at is not null
    );
$$;

create or replace function private.can_read_marketplace_post(
  p_post_school_id uuid,
  p_visibility_scope text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_marketplace_eligible())
    and p_post_school_id is not null
    and p_visibility_scope in ('inherit', 'school', 'network')
    and exists (
      select 1
      from public.profiles viewer
      join public.schools source_school
        on source_school.id = p_post_school_id
       and source_school.is_active = true
      where viewer.user_id = (select auth.uid())
        and (
          viewer.school_id = p_post_school_id
          or (
            source_school.marketplace_scope = 'network'
            and p_visibility_scope in ('inherit', 'network')
          )
        )
    );
$$;

revoke execute on function private.is_marketplace_eligible()
  from public, anon;
revoke execute on function private.can_read_marketplace_post(uuid, text)
  from public, anon;
grant execute on function private.is_marketplace_eligible()
  to authenticated;
grant execute on function private.can_read_marketplace_post(uuid, text)
  to authenticated;

-- Anonymous browsing is intentionally removed in Core V2.
drop policy if exists posts_read_public_anon on public.posts;
drop policy if exists posts_read_public_authenticated on public.posts;

create policy posts_read_marketplace_authenticated
on public.posts
for select
to authenticated
using (
  moderation_status = 'approved'
  and lifecycle_status = 'active'
  and is_hidden = false
  and (select private.can_read_marketplace_post(posts.school_id, posts.visibility_scope))
);

-- Media visibility follows the linked post under authenticated RLS. No public
--/anonymous media policy is allowed because Phase 5F will use private buckets.
drop policy if exists post_media_read_anon on public.post_media;

-- Existing authenticated media policy remains and can only see a row when its
-- linked post is itself visible through posts RLS (marketplace, owner or staff).

-- Existing school-leading feed index supports same-school reads. Network scope
-- also needs an efficient newest-first visible feed path without a school prefix.
create index if not exists posts_marketplace_newest_idx
  on public.posts(created_at desc, id desc)
  where moderation_status = 'approved'
    and lifecycle_status = 'active'
    and is_hidden = false;
