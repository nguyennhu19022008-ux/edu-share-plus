-- Phase 5B — trusted school-scoped roster administration.
-- Private roster tables stay outside the browser API. Staff interact only through
-- these SECURITY DEFINER RPCs, with exact school scope for teachers and global
-- scope reserved for the network admin role.

create or replace function private.can_manage_student_roster(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and p_school_id is not null
    and exists (
      select 1
      from public.profiles p
      where p.user_id = (select auth.uid())
        and p.account_status = 'approved'
    )
    and (
      exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and ur.revoked_at is null
          and r.code = 'admin'
          and ur.school_id is null
      )
      or exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = (select auth.uid())
          and ur.revoked_at is null
          and r.code = 'teacher_moderator'
          and ur.school_id = p_school_id
      )
    );
$$;

revoke execute on function private.can_manage_student_roster(uuid)
  from public, anon, authenticated;

create or replace function public.import_student_roster(
  p_school_id uuid,
  p_academic_year text,
  p_source_filename text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;
  v_academic_year text := nullif(btrim(coalesce(p_academic_year, '')), '');
  v_source_filename text := nullif(btrim(coalesce(p_source_filename, '')), '');
  v_total_rows integer;
  v_invalid_rows integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_normalized_rows jsonb := '[]'::jsonb;
  v_row jsonb;
  v_row_number integer := 0;
  v_full_name text;
  v_class_name_input text;
  v_class_name text;
  v_class_normalized text;
  v_phone_input text;
  v_phone_normalized text;
  v_grade_text text;
  v_grade_level smallint;
  v_class_id uuid;
  v_batch_id uuid;
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'An authenticated staff session is required.';
  end if;

  if p_school_id is null then
    raise exception using message = 'EDU_SHARE_SCHOOL_REQUIRED';
  end if;

  if not (select private.can_manage_student_roster(p_school_id)) then
    raise exception using
      message = 'EDU_SHARE_ROSTER_MANAGEMENT_FORBIDDEN',
      detail = 'The current account cannot manage this school roster.';
  end if;

  if not exists (
    select 1
    from public.schools s
    where s.id = p_school_id
      and s.is_active = true
  ) then
    raise exception using message = 'EDU_SHARE_SCHOOL_NOT_FOUND';
  end if;

  if v_academic_year is null
     or char_length(v_academic_year) < 4
     or char_length(v_academic_year) > 32 then
    raise exception using message = 'EDU_SHARE_ACADEMIC_YEAR_INVALID';
  end if;

  if v_source_filename is null or char_length(v_source_filename) > 255 then
    raise exception using message = 'EDU_SHARE_ROSTER_SOURCE_FILENAME_INVALID';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception using message = 'EDU_SHARE_ROSTER_ROWS_ARRAY_REQUIRED';
  end if;

  v_total_rows := jsonb_array_length(p_rows);
  if v_total_rows < 1 then
    raise exception using message = 'EDU_SHARE_ROSTER_ROWS_REQUIRED';
  end if;
  if v_total_rows > 5000 then
    raise exception using
      message = 'EDU_SHARE_ROSTER_IMPORT_TOO_LARGE',
      detail = 'A roster import may contain at most 5000 rows.';
  end if;

  -- Validate and normalize the complete payload before the first persistent write.
  -- Up to the first 100 row errors are returned in the exception detail; the
  -- invalid row count still reflects the full payload.
  for v_row in
    select value from jsonb_array_elements(p_rows)
  loop
    v_row_number := v_row_number + 1;
    v_full_name := null;
    v_class_name_input := null;
    v_class_name := null;
    v_class_normalized := null;
    v_phone_input := null;
    v_phone_normalized := null;

    if jsonb_typeof(v_row) <> 'object' then
      v_invalid_rows := v_invalid_rows + 1;
      if jsonb_array_length(v_errors) < 100 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'code', 'row_must_be_object'
        ));
      end if;
      continue;
    end if;

    v_full_name := nullif(btrim(v_row ->> 'full_name'), '');
    v_class_name_input := nullif(btrim(v_row ->> 'class_name'), '');
    v_phone_input := nullif(btrim(v_row ->> 'phone'), '');

    if v_full_name is null or char_length(v_full_name) > 120 then
      v_invalid_rows := v_invalid_rows + 1;
      if jsonb_array_length(v_errors) < 100 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'field', 'full_name',
          'code', case when v_full_name is null then 'required' else 'too_long' end
        ));
      end if;
      continue;
    end if;

    if v_class_name_input is null then
      v_invalid_rows := v_invalid_rows + 1;
      if jsonb_array_length(v_errors) < 100 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'field', 'class_name',
          'code', 'required'
        ));
      end if;
      continue;
    end if;

    begin
      v_class_normalized := private.normalize_class_claim(v_class_name_input);
    exception
      when others then
        v_invalid_rows := v_invalid_rows + 1;
        if jsonb_array_length(v_errors) < 100 then
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_row_number,
            'field', 'class_name',
            'code', 'invalid'
          ));
        end if;
        continue;
    end;

    if v_phone_input is null then
      v_invalid_rows := v_invalid_rows + 1;
      if jsonb_array_length(v_errors) < 100 then
        v_errors := v_errors || jsonb_build_array(jsonb_build_object(
          'row', v_row_number,
          'field', 'phone',
          'code', 'required'
        ));
      end if;
      continue;
    end if;

    begin
      v_phone_normalized := private.normalize_vn_phone(v_phone_input);
    exception
      when others then
        v_invalid_rows := v_invalid_rows + 1;
        if jsonb_array_length(v_errors) < 100 then
          v_errors := v_errors || jsonb_build_array(jsonb_build_object(
            'row', v_row_number,
            'field', 'phone',
            'code', 'invalid'
          ));
        end if;
        continue;
    end;

    -- Persist a single canonical label per normalized class claim so inputs like
    -- "12 A1" and "12A1" resolve to the same school_classes row.
    v_class_name := upper(v_class_normalized);

    v_normalized_rows := v_normalized_rows || jsonb_build_array(jsonb_build_object(
      'full_name', v_full_name,
      'class_name', v_class_name,
      'class_normalized', v_class_normalized,
      'phone_normalized', v_phone_normalized
    ));
  end loop;

  if v_invalid_rows > 0 then
    raise exception using
      message = 'EDU_SHARE_ROSTER_IMPORT_INVALID',
      detail = jsonb_build_object(
        'total_rows', v_total_rows,
        'valid_rows', v_total_rows - v_invalid_rows,
        'invalid_rows', v_invalid_rows,
        'errors', v_errors,
        'errors_truncated', v_invalid_rows > jsonb_array_length(v_errors)
      )::text;
  end if;

  select case
    when exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = v_actor_id
        and ur.revoked_at is null
        and r.code = 'admin'
        and ur.school_id is null
    ) then 'admin'
    else 'teacher_moderator'
  end
  into v_actor_role;

  insert into private.roster_import_batches (
    school_id,
    academic_year,
    source_filename,
    status,
    total_rows,
    valid_rows,
    invalid_rows,
    imported_by
  )
  values (
    p_school_id,
    v_academic_year,
    v_source_filename,
    'previewed',
    v_total_rows,
    v_total_rows,
    0,
    v_actor_id
  )
  returning id into v_batch_id;

  for v_row in
    select value from jsonb_array_elements(v_normalized_rows)
  loop
    v_full_name := v_row ->> 'full_name';
    v_class_name := v_row ->> 'class_name';
    v_class_normalized := v_row ->> 'class_normalized';
    v_phone_normalized := v_row ->> 'phone_normalized';

    v_grade_text := substring(v_class_normalized from '^([0-9]{1,2})');
    if v_grade_text is not null
       and v_grade_text::integer between 1 and 12 then
      v_grade_level := v_grade_text::smallint;
    else
      v_grade_level := null;
    end if;

    insert into public.school_classes (
      school_id,
      label,
      grade_level,
      academic_year,
      is_active
    )
    values (
      p_school_id,
      v_class_name,
      v_grade_level,
      v_academic_year,
      true
    )
    on conflict (school_id, label, academic_year)
    do update set
      grade_level = coalesce(excluded.grade_level, school_classes.grade_level),
      is_active = true,
      updated_at = now()
    returning id into v_class_id;

    insert into private.student_roster (
      batch_id,
      school_id,
      class_id,
      academic_year,
      full_name,
      class_name,
      class_normalized,
      phone_normalized
    )
    values (
      v_batch_id,
      p_school_id,
      v_class_id,
      v_academic_year,
      v_full_name,
      v_class_name,
      v_class_normalized,
      v_phone_normalized
    );
  end loop;

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
    'student_roster_batch_imported',
    'roster_import_batch',
    v_batch_id,
    null,
    jsonb_build_object(
      'status', 'previewed',
      'total_rows', v_total_rows,
      'valid_rows', v_total_rows,
      'invalid_rows', 0
    ),
    'trusted_rpc',
    jsonb_build_object(
      'school_id', p_school_id,
      'academic_year', v_academic_year,
      'source_filename', v_source_filename
    )
  );

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'school_id', p_school_id,
    'academic_year', v_academic_year,
    'source_filename', v_source_filename,
    'status', 'previewed',
    'total_rows', v_total_rows,
    'valid_rows', v_total_rows,
    'invalid_rows', 0
  );
end;
$$;

create or replace function public.activate_student_roster_batch(p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_actor_role text;
  v_batch private.roster_import_batches%rowtype;
  v_previous_active_ids uuid[];
  v_now timestamptz := now();
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'An authenticated staff session is required.';
  end if;

  if p_batch_id is null then
    raise exception using message = 'EDU_SHARE_ROSTER_BATCH_REQUIRED';
  end if;

  select b.*
  into v_batch
  from private.roster_import_batches b
  where b.id = p_batch_id
  for update;

  if not found then
    raise exception using message = 'EDU_SHARE_ROSTER_BATCH_NOT_FOUND';
  end if;

  if not (select private.can_manage_student_roster(v_batch.school_id)) then
    raise exception using
      message = 'EDU_SHARE_ROSTER_MANAGEMENT_FORBIDDEN',
      detail = 'The current account cannot manage this school roster.';
  end if;

  if v_batch.status = 'failed' then
    raise exception using message = 'EDU_SHARE_ROSTER_BATCH_NOT_ACTIVATABLE';
  end if;

  select case
    when exists (
      select 1
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.user_id = v_actor_id
        and ur.revoked_at is null
        and r.code = 'admin'
        and ur.school_id is null
    ) then 'admin'
    else 'teacher_moderator'
  end
  into v_actor_role;

  select coalesce(array_agg(b.id order by b.id), array[]::uuid[])
  into v_previous_active_ids
  from private.roster_import_batches b
  where b.school_id = v_batch.school_id
    and b.status = 'active'
    and b.id <> v_batch.id;

  update private.roster_import_batches b
  set
    status = 'archived',
    archived_at = v_now
  where b.school_id = v_batch.school_id
    and b.status = 'active'
    and b.id <> v_batch.id;

  update private.roster_import_batches b
  set
    status = 'active',
    activated_at = coalesce(b.activated_at, v_now),
    archived_at = null
  where b.id = v_batch.id;

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
    'student_roster_batch_activated',
    'roster_import_batch',
    v_batch.id,
    jsonb_build_object(
      'status', v_batch.status,
      'previous_active_batch_ids', to_jsonb(v_previous_active_ids)
    ),
    jsonb_build_object(
      'status', 'active',
      'activated_at', coalesce(v_batch.activated_at, v_now)
    ),
    'trusted_rpc',
    jsonb_build_object(
      'school_id', v_batch.school_id,
      'academic_year', v_batch.academic_year
    )
  );

  return jsonb_build_object(
    'batch_id', v_batch.id,
    'school_id', v_batch.school_id,
    'academic_year', v_batch.academic_year,
    'status', 'active'
  );
end;
$$;

create or replace function public.list_student_roster_batches(p_school_id uuid)
returns table (
  id uuid,
  school_id uuid,
  academic_year text,
  source_filename text,
  status text,
  total_rows integer,
  valid_rows integer,
  invalid_rows integer,
  imported_by uuid,
  created_at timestamptz,
  activated_at timestamptz,
  archived_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  if p_school_id is null
     or not (select private.can_manage_student_roster(p_school_id)) then
    raise exception using message = 'EDU_SHARE_ROSTER_MANAGEMENT_FORBIDDEN';
  end if;

  return query
  select
    b.id,
    b.school_id,
    b.academic_year,
    b.source_filename,
    b.status,
    b.total_rows,
    b.valid_rows,
    b.invalid_rows,
    b.imported_by,
    b.created_at,
    b.activated_at,
    b.archived_at
  from private.roster_import_batches b
  where b.school_id = p_school_id
  order by b.created_at desc, b.id desc;
end;
$$;

create or replace function public.list_active_student_roster(p_school_id uuid)
returns table (
  id uuid,
  batch_id uuid,
  school_id uuid,
  class_id uuid,
  academic_year text,
  full_name text,
  class_name text,
  phone_normalized text,
  claim_status text,
  claimed_user_id uuid,
  claimed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  if p_school_id is null
     or not (select private.can_manage_student_roster(p_school_id)) then
    raise exception using message = 'EDU_SHARE_ROSTER_MANAGEMENT_FORBIDDEN';
  end if;

  return query
  select
    r.id,
    r.batch_id,
    r.school_id,
    r.class_id,
    r.academic_year,
    r.full_name,
    r.class_name,
    r.phone_normalized,
    case when rc.id is null then 'unclaimed' else 'claimed' end::text as claim_status,
    rc.user_id as claimed_user_id,
    rc.claimed_at
  from private.student_roster r
  join private.roster_import_batches b
    on b.id = r.batch_id
   and b.school_id = r.school_id
   and b.academic_year = r.academic_year
  left join private.student_roster_claims rc
    on rc.roster_entry_id = r.id
   and rc.released_at is null
  where r.school_id = p_school_id
    and b.status = 'active'
  order by r.class_name, r.full_name, r.id;
end;
$$;

revoke all on function public.import_student_roster(uuid, text, text, jsonb)
  from public, anon;
revoke all on function public.activate_student_roster_batch(uuid)
  from public, anon;
revoke all on function public.list_student_roster_batches(uuid)
  from public, anon;
revoke all on function public.list_active_student_roster(uuid)
  from public, anon;

grant execute on function public.import_student_roster(uuid, text, text, jsonb)
  to authenticated;
grant execute on function public.activate_student_roster_batch(uuid)
  to authenticated;
grant execute on function public.list_student_roster_batches(uuid)
  to authenticated;
grant execute on function public.list_active_student_roster(uuid)
  to authenticated;
