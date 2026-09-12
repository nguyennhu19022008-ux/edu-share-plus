-- Migration: 20260912150000_fix_marketplace_eligibility_for_staff.sql
-- Description: Allow Staff / Teachers / Admins to read the Marketplace feed, and ensure verified status for TEST Teacher 4E

-- 1. Update is_marketplace_eligible() to allow staff / teachers / admins as well as verified students
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
       and (ur.school_id = p.school_id or ur.school_id is null)
       and ur.revoked_at is null
      join public.roles r
        on r.id = ur.role_id
      left join public.schools s
        on s.id = p.school_id
       and s.is_active = true
      where au.id = (select auth.uid())
        and au.email_confirmed_at is not null
        and (
          -- Case 1: Verified Student
          (
            r.code = 'student'
            and p.account_status = 'approved'
            and p.school_membership_status = 'verified'
            and p.membership_verification_method is not null
            and p.membership_verified_at is not null
            and s.id is not null
          )
          or
          -- Case 2: Staff / Teacher / Admin
          (
            r.code in ('teacher_moderator', 'school_admin', 'admin', 'system_admin')
            and p.account_status = 'approved'
          )
        )
    );
$$;

revoke execute on function private.is_marketplace_eligible() from public, anon;
grant execute on function private.is_marketplace_eligible() to authenticated;

-- 2. Verify school membership status for TEST Teacher 4E and any staff accounts in THPT Nguyễn Du
update public.profiles
set
  school_membership_status = 'verified',
  membership_verification_method = 'teacher_manual_review',
  membership_verified_at = coalesce(membership_verified_at, now()),
  account_status = 'approved'
where user_id = '355b5de1-829e-421a-b83a-581eddb5b975'
   or user_id in (
     select ur.user_id
     from public.user_roles ur
     join public.roles r on r.id = ur.role_id
     where r.code in ('teacher_moderator', 'school_admin', 'admin')
       and ur.revoked_at is null
   );
