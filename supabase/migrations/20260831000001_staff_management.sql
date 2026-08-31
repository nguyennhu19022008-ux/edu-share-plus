-- =========================================================
-- Teacher & Staff Web Role Management Migration
-- RPCs: list_school_staff, assign_school_staff, revoke_school_staff
-- =========================================================

create or replace function public.list_school_staff(
  p_school_id uuid default null
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role_code text,
  role_name text,
  assigned_at timestamptz,
  status text
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_school_id uuid := p_school_id;
  v_caller_id uuid := (select auth.uid());
begin
  if v_caller_id is null then
    raise exception 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  if v_school_id is null then
    select school_id into v_school_id
    from public.profiles
    where user_id = v_caller_id;
  end if;

  return query
  select
    ur.user_id,
    u.email::text,
    coalesce(p.full_name, u.raw_user_meta_data->>'full_name', 'Chưa cập nhật')::text as full_name,
    r.code::text as role_code,
    r.name::text as role_name,
    ur.assigned_at,
    coalesce(p.status, 'active')::text as status
  from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  join auth.users u on u.id = ur.user_id
  left join public.profiles p on p.user_id = ur.user_id
  where (v_school_id is null or ur.school_id = v_school_id)
    and r.code in ('teacher_moderator', 'school_admin', 'system_admin')
  order by ur.assigned_at desc;
end;
$$;

create or replace function public.assign_school_staff(
  p_email text,
  p_role_code text,
  p_school_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_caller_id uuid := (select auth.uid());
  v_school_id uuid := p_school_id;
  v_target_user_id uuid;
  v_role_id uuid;
  v_target_email text := lower(trim(p_email));
  v_role_name text;
begin
  if v_caller_id is null then
    raise exception 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  if v_school_id is null then
    select school_id into v_school_id
    from public.profiles
    where user_id = v_caller_id;
  end if;

  if v_school_id is null then
    raise exception 'EDU_SHARE_SCHOOL_REQUIRED';
  end if;

  if p_role_code not in ('teacher_moderator', 'school_admin') then
    raise exception 'EDU_SHARE_INVALID_STAFF_ROLE';
  end if;

  select id, name into v_role_id, v_role_name
  from public.roles
  where code = p_role_code;

  if v_role_id is null then
    raise exception 'EDU_SHARE_ROLE_NOT_FOUND';
  end if;

  select id into v_target_user_id
  from auth.users
  where lower(email) = v_target_email;

  if v_target_user_id is not null then
    -- Assign role
    insert into public.user_roles (user_id, role_id, school_id, assigned_by, assigned_at)
    values (v_target_user_id, v_role_id, v_school_id, v_caller_id, now())
    on conflict (user_id, role_id, school_id)
    do update set assigned_at = now(), assigned_by = v_caller_id;

    -- Update profile status
    update public.profiles
    set school_id = coalesce(school_id, v_school_id),
        status = 'active',
        updated_at = now()
    where user_id = v_target_user_id;

    return jsonb_build_object(
      'success', true,
      'is_preauthorized', false,
      'user_id', v_target_user_id,
      'email', v_target_email,
      'role_code', p_role_code,
      'role_name', v_role_name,
      'message', 'Đã cấp quyền ' || v_role_name || ' cho tài khoản ' || v_target_email || ' thành công.'
    );
  else
    -- Pre-authorize teacher roster
    insert into public.roster_entries (
      school_id,
      full_name,
      identifier_hash,
      normalized_email,
      grade_level,
      status,
      created_at
    ) values (
      v_school_id,
      'Giáo viên (' || v_target_email || ')',
      encode(sha256(v_target_email::bytea), 'hex'),
      v_target_email,
      'staff',
      'active',
      now()
    )
    on conflict do nothing;

    return jsonb_build_object(
      'success', true,
      'is_preauthorized', true,
      'email', v_target_email,
      'role_code', p_role_code,
      'role_name', v_role_name,
      'message', 'Đã lưu danh sách chờ cấp quyền. Khi tài khoản ' || v_target_email || ' đăng ký, quyền sẽ được tự động kích hoạt.'
    );
  end if;
end;
$$;

create or replace function public.revoke_school_staff(
  p_user_id uuid,
  p_role_code text,
  p_school_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_caller_id uuid := (select auth.uid());
  v_school_id uuid := p_school_id;
  v_role_id uuid;
begin
  if v_caller_id is null then
    raise exception 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  if v_caller_id = p_user_id and p_role_code = 'school_admin' then
    raise exception 'EDU_SHARE_CANNOT_REVOKE_OWN_ADMIN';
  end if;

  if v_school_id is null then
    select school_id into v_school_id
    from public.profiles
    where user_id = v_caller_id;
  end if;

  select id into v_role_id
  from public.roles
  where code = p_role_code;

  if v_role_id is null then
    raise exception 'EDU_SHARE_ROLE_NOT_FOUND';
  end if;

  delete from public.user_roles
  where user_id = p_user_id
    and role_id = v_role_id
    and (v_school_id is null or school_id = v_school_id);

  return jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'role_code', p_role_code,
    'message', 'Đã thu hồi vai trò thành công.'
  );
end;
$$;
