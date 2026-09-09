-- ====================================================================
-- EDU SHARE+ MIGRATION: Pre-authorize teacher phuongpp_thpt_nguyendu
-- School: THPT Nguyễn Du (code: THPT_NGUYEN_DU)
-- Role: teacher_moderator
-- Email: phuongpp_thpt_nguyendu@bariavungtau.edu.vn
-- ====================================================================

do \$\$
declare
  v_school_id uuid;
  v_role_id uuid;
  v_user_id uuid;
begin
  -- 1. Find school ID for THPT Nguyễn Du
  select id into v_school_id
  from public.schools
  where code = 'THPT_NGUYEN_DU';

  -- 2. Find teacher_moderator role ID
  select id into v_role_id
  from public.roles
  where code = 'teacher_moderator';

  -- 3. If user already registered in auth.users, assign role and approve profile immediately
  select id into v_user_id
  from auth.users
  where lower(email) = 'phuongpp_thpt_nguyendu@bariavungtau.edu.vn';

  if v_user_id is not null and v_role_id is not null and v_school_id is not null then
    insert into public.user_roles (user_id, role_id, school_id, assigned_at)
    values (v_user_id, v_role_id, v_school_id, now())
    on conflict (user_id, role_id, school_id)
    do update set assigned_at = now();

    update public.profiles
    set school_id = v_school_id,
        account_status = 'approved',
        updated_at = now()
    where user_id = v_user_id;
  end if;
end;
\$\$;
