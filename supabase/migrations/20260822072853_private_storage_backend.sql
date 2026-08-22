-- Phase 5F — private Supabase Storage boundary.
-- Browser clients may upload only to a server-reserved immutable path.
-- Storage object overwrite/upsert semantics are intentionally unsupported.

-- =========================================================
-- 1. PRIVATE BUCKETS
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values
  (
    'post-media',
    'post-media',
    false,
    5242880,
    array['image/jpeg','image/png','image/webp']::text[]
  ),
  (
    'profile-media',
    'profile-media',
    false,
    3145728,
    array['image/jpeg','image/png','image/webp']::text[]
  ),
  (
    'private-evidence',
    'private-evidence',
    false,
    20971520,
    array['image/jpeg','image/png','image/webp','application/pdf']::text[]
  )
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- =========================================================
-- 2. FILE METADATA STATE
-- =========================================================

alter table public.file_objects
  add column school_id uuid,
  add column binding_status text not null default 'reserved',
  add column uploaded_at timestamptz,
  add column bound_at timestamptz;

update public.file_objects f
set school_id = p.school_id
from public.profiles p
where f.owner_id = p.user_id
  and f.school_id is null;

do $$
begin
  if exists (
    select 1
    from public.file_objects f
    where f.school_id is null
  ) then
    raise exception using
      message = 'EDU_SHARE_STORAGE_FILE_SCHOOL_BACKFILL_REQUIRED',
      detail = 'Existing file metadata must be reconciled to a school before Phase 5F can be applied.';
  end if;
end;
$$;

alter table public.file_objects
  alter column school_id set not null,
  add constraint file_objects_school_fk
    foreign key (school_id) references public.schools(id) on delete restrict,
  add constraint file_objects_binding_status_check
    check (binding_status in ('reserved','uploaded','bound','orphaned','deleted')),
  add constraint file_objects_binding_timestamps_check
    check (
      (binding_status = 'reserved' and uploaded_at is null and bound_at is null and deleted_at is null)
      or (binding_status = 'uploaded' and uploaded_at is not null and bound_at is null and deleted_at is null)
      or (binding_status = 'bound' and uploaded_at is not null and bound_at is not null and deleted_at is null)
      or (binding_status = 'orphaned' and uploaded_at is not null and bound_at is null and deleted_at is null)
      or (binding_status = 'deleted' and deleted_at is not null)
    ),
  add constraint file_objects_purpose_bucket_contract
    check (
      (purpose = 'avatar' and bucket = 'profile-media')
      or (purpose = 'face_private' and bucket = 'profile-media')
      or (purpose = 'post_media' and bucket = 'post-media')
      or (purpose in ('verification_evidence','case_evidence') and bucket = 'private-evidence')
    ),
  add constraint file_objects_purpose_size_contract
    check (
      (purpose in ('avatar','face_private') and size_bytes <= 3145728)
      or (purpose = 'post_media' and size_bytes <= 5242880)
      or (purpose in ('verification_evidence','case_evidence') and size_bytes <= 20971520)
    ),
  add constraint file_objects_purpose_mime_contract
    check (
      (
        purpose in ('avatar','face_private','post_media')
        and mime_type in ('image/jpeg','image/png','image/webp')
      )
      or (
        purpose in ('verification_evidence','case_evidence')
        and mime_type in ('image/jpeg','image/png','image/webp','application/pdf')
      )
    ),
  add constraint file_objects_application_visibility_contract
    check (
      purpose not in ('avatar','face_private','post_media')
      or visibility = 'private'
    );

alter table public.file_objects
  drop constraint if exists file_objects_storage_path_unique;

alter table public.file_objects
  add constraint file_objects_bucket_storage_path_unique
    unique (bucket, storage_path);

create index file_objects_owner_state_idx
  on public.file_objects(owner_id, binding_status, created_at desc)
  where deleted_at is null;

create index file_objects_school_bucket_idx
  on public.file_objects(school_id, bucket, created_at desc)
  where deleted_at is null;

-- File metadata remains read-only from the browser. All lifecycle writes use
-- the trusted RPCs below.
revoke insert, update, delete on table public.file_objects
  from public, anon, authenticated;
revoke insert, update, delete on table public.post_media
  from public, anon, authenticated;

-- =========================================================
-- 3. STORAGE AUTHORIZATION HELPERS
-- =========================================================

create or replace function private.can_read_phase5f_post_media_file(
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
    from public.file_objects f
    join public.post_media pm
      on pm.file_id = f.id
    join public.posts p
      on p.id = pm.post_id
    where f.id = p_file_id
      and f.purpose = 'post_media'
      and f.bucket = 'post-media'
      and f.binding_status = 'bound'
      and f.deleted_at is null
      and (
        p.owner_id = (select auth.uid())
        or (select private.can_moderate_school(p.school_id))
        or (
          p.moderation_status = 'approved'
          and p.lifecycle_status = 'active'
          and p.is_hidden = false
          and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope))
        )
      )
  );
$$;

create or replace function private.can_insert_phase5f_storage_object(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.is_marketplace_eligible())
    and exists (
      select 1
      from public.file_objects f
      where f.owner_id = (select auth.uid())
        and f.bucket = p_bucket
        and f.storage_path = p_path
        and f.binding_status = 'reserved'
        and f.deleted_at is null
    );
$$;

create or replace function private.can_read_phase5f_storage_object(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when f.bucket = 'post-media' then
          f.owner_id = (select auth.uid())
          or (select private.can_read_phase5f_post_media_file(f.id))
        when f.bucket = 'profile-media' then
          f.owner_id = (select auth.uid())
          and f.purpose = 'avatar'
        else false
      end
      from public.file_objects f
      where f.bucket = p_bucket
        and f.storage_path = p_path
        and f.binding_status in ('uploaded','bound','orphaned')
        and f.deleted_at is null
      limit 1
    ),
    false
  );
$$;

create or replace function private.can_delete_phase5f_storage_object(
  p_bucket text,
  p_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.file_objects f
    where f.owner_id = (select auth.uid())
      and f.bucket = p_bucket
      and f.storage_path = p_path
      and f.binding_status in ('reserved','uploaded','orphaned')
      and f.deleted_at is null
      and not exists (
        select 1
        from public.post_media pm
        where pm.file_id = f.id
      )
      and not exists (
        select 1
        from public.profiles p
        where p.avatar_file_id = f.id
      )
      and not exists (
        select 1
        from public.profile_private pp
        where pp.face_file_id = f.id
      )
  );
$$;

revoke all on function private.can_read_phase5f_post_media_file(uuid)
  from public, anon, authenticated;
revoke all on function private.can_insert_phase5f_storage_object(text,text)
  from public, anon, authenticated;
revoke all on function private.can_read_phase5f_storage_object(text,text)
  from public, anon, authenticated;
revoke all on function private.can_delete_phase5f_storage_object(text,text)
  from public, anon, authenticated;

grant execute on function private.can_read_phase5f_post_media_file(uuid)
  to authenticated;
grant execute on function private.can_insert_phase5f_storage_object(text,text)
  to authenticated;
grant execute on function private.can_read_phase5f_storage_object(text,text)
  to authenticated;
grant execute on function private.can_delete_phase5f_storage_object(text,text)
  to authenticated;

-- The browser needs metadata reads for its own files and for visible post media,
-- but never direct metadata writes.
grant select on public.file_objects to authenticated;

drop policy if exists file_objects_read_phase5f_owner on public.file_objects;
create policy file_objects_read_phase5f_owner
on public.file_objects
for select
to authenticated
using (
  owner_id = (select auth.uid())
  and deleted_at is null
);

drop policy if exists file_objects_read_phase5f_visible_post_media on public.file_objects;
create policy file_objects_read_phase5f_visible_post_media
on public.file_objects
for select
to authenticated
using (
  purpose = 'post_media'
  and binding_status = 'bound'
  and deleted_at is null
  and (select private.can_read_phase5f_post_media_file(id))
);

-- =========================================================
-- 4. TRUSTED RESERVATION / FINALIZE WORKFLOW
-- =========================================================

create or replace function public.reserve_my_file(
  p_purpose text,
  p_mime_type text,
  p_size_bytes bigint,
  p_post_id uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_context jsonb;
  v_school_id uuid;
  v_file_id uuid := gen_random_uuid();
  v_bucket text;
  v_extension text;
  v_path text;
  v_max_size bigint;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  if not (select private.is_marketplace_eligible()) then
    raise exception using message = 'EDU_SHARE_STORAGE_STUDENT_NOT_ELIGIBLE';
  end if;

  v_context := public.get_current_student_context();
  v_school_id := nullif(v_context ->> 'school_id', '')::uuid;

  if p_purpose not in ('post_media','avatar') then
    raise exception using message = 'EDU_SHARE_STORAGE_PURPOSE_INVALID';
  end if;

  if p_mime_type not in ('image/jpeg','image/png','image/webp') then
    raise exception using message = 'EDU_SHARE_STORAGE_MIME_INVALID';
  end if;

  if p_size_bytes is null or p_size_bytes <= 0 then
    raise exception using message = 'EDU_SHARE_STORAGE_SIZE_INVALID';
  end if;

  v_extension := case p_mime_type
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
  end;

  if p_purpose = 'post_media' then
    v_bucket := 'post-media';
    v_max_size := 5242880;

    if p_post_id is null then
      raise exception using message = 'EDU_SHARE_STORAGE_POST_REQUIRED';
    end if;

    if not exists (
      select 1
      from public.posts p
      where p.id = p_post_id
        and p.owner_id = v_actor_id
        and p.school_id = v_school_id
        and p.lifecycle_status = 'active'
    ) then
      raise exception using message = 'EDU_SHARE_STORAGE_POST_NOT_OWN_ACTIVE';
    end if;

    v_path := v_actor_id::text || '/' || p_post_id::text || '/' || v_file_id::text || '.' || v_extension;
  else
    v_bucket := 'profile-media';
    v_max_size := 3145728;

    if p_post_id is not null then
      raise exception using message = 'EDU_SHARE_STORAGE_AVATAR_POST_FORBIDDEN';
    end if;

    v_path := v_actor_id::text || '/avatar/' || v_file_id::text || '.' || v_extension;
  end if;

  if p_size_bytes > v_max_size then
    raise exception using message = 'EDU_SHARE_STORAGE_SIZE_LIMIT';
  end if;

  insert into public.file_objects (
    id,
    owner_id,
    school_id,
    bucket,
    storage_path,
    purpose,
    visibility,
    mime_type,
    size_bytes,
    binding_status
  ) values (
    v_file_id,
    v_actor_id,
    v_school_id,
    v_bucket,
    v_path,
    p_purpose,
    'private',
    p_mime_type,
    p_size_bytes,
    'reserved'
  );

  return jsonb_build_object(
    'id', v_file_id,
    'bucket', v_bucket,
    'path', v_path,
    'purpose', p_purpose,
    'mimeType', p_mime_type,
    'sizeBytes', p_size_bytes
  );
end;
$$;

create or replace function public.finalize_my_file(
  p_file_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_file public.file_objects%rowtype;
  v_actual_size bigint;
  v_actual_mime text;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  select f.*
  into v_file
  from public.file_objects f
  where f.id = p_file_id
    and f.owner_id = v_actor_id
  for update;

  if not found then
    raise exception using message = 'EDU_SHARE_STORAGE_FILE_NOT_FOUND';
  end if;

  if v_file.binding_status <> 'reserved' or v_file.deleted_at is not null then
    raise exception using message = 'EDU_SHARE_STORAGE_FILE_NOT_RESERVED';
  end if;

  select
    case
      when nullif(o.metadata ->> 'size', '') ~ '^[0-9]+$'
        then (o.metadata ->> 'size')::bigint
      else null
    end,
    nullif(o.metadata ->> 'mimetype', '')
  into v_actual_size, v_actual_mime
  from storage.objects o
  where o.bucket_id = v_file.bucket
    and o.name = v_file.storage_path
  limit 1;

  if not found then
    raise exception using message = 'EDU_SHARE_STORAGE_OBJECT_NOT_FOUND';
  end if;

  if v_actual_size is null
     or v_actual_mime is null
     or v_actual_size <> v_file.size_bytes
     or v_actual_mime <> v_file.mime_type then
    raise exception using message = 'EDU_SHARE_STORAGE_OBJECT_METADATA_MISMATCH';
  end if;

  update public.file_objects
  set
    binding_status = 'uploaded',
    uploaded_at = now()
  where id = v_file.id;

  return jsonb_build_object(
    'id', v_file.id,
    'bindingStatus', 'uploaded',
    'bucket', v_file.bucket,
    'path', v_file.storage_path
  );
end;
$$;

-- =========================================================
-- 5. TRUSTED POST MEDIA BINDING
-- =========================================================

create or replace function public.bind_my_post_media(
  p_post_id uuid,
  p_file_id uuid,
  p_sort_order integer default 0,
  p_is_primary boolean default false,
  p_alt_text text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_context jsonb;
  v_school_id uuid;
  v_post public.posts%rowtype;
  v_file public.file_objects%rowtype;
  v_count integer;
  v_primary boolean;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  v_context := public.get_current_student_context();
  v_school_id := nullif(v_context ->> 'school_id', '')::uuid;

  if p_sort_order is null or p_sort_order < 0 then
    raise exception using message = 'EDU_SHARE_STORAGE_SORT_ORDER_INVALID';
  end if;

  if p_alt_text is not null and char_length(p_alt_text) > 300 then
    raise exception using message = 'EDU_SHARE_STORAGE_ALT_TEXT_TOO_LONG';
  end if;

  select p.*
  into v_post
  from public.posts p
  where p.id = p_post_id
  for update;

  if not found
     or v_post.owner_id <> v_actor_id
     or v_post.school_id <> v_school_id
     or v_post.lifecycle_status <> 'active' then
    raise exception using message = 'EDU_SHARE_STORAGE_POST_NOT_OWN_ACTIVE';
  end if;

  select f.*
  into v_file
  from public.file_objects f
  where f.id = p_file_id
  for update;

  if not found
     or v_file.owner_id <> v_actor_id
     or v_file.school_id <> v_school_id
     or v_file.purpose <> 'post_media'
     or v_file.bucket <> 'post-media'
     or v_file.binding_status <> 'uploaded'
     or v_file.deleted_at is not null then
    raise exception using message = 'EDU_SHARE_STORAGE_FILE_NOT_BINDABLE';
  end if;

  select count(*)::integer
  into v_count
  from public.post_media pm
  where pm.post_id = p_post_id;

  if v_count >= 5 then
    raise exception using message = 'EDU_SHARE_STORAGE_POST_MEDIA_LIMIT';
  end if;

  v_primary := (v_count = 0) or coalesce(p_is_primary, false);

  if v_primary then
    update public.post_media
    set is_primary = false
    where post_id = p_post_id
      and is_primary = true;
  end if;

  insert into public.post_media (
    post_id,
    file_id,
    sort_order,
    is_primary,
    alt_text
  ) values (
    p_post_id,
    p_file_id,
    p_sort_order,
    v_primary,
    nullif(btrim(coalesce(p_alt_text, '')), '')
  );

  update public.file_objects
  set
    binding_status = 'bound',
    bound_at = now()
  where id = p_file_id;

  return jsonb_build_object(
    'postId', p_post_id,
    'fileId', p_file_id,
    'sortOrder', p_sort_order,
    'isPrimary', v_primary
  );
end;
$$;

create or replace function public.remove_my_post_media(
  p_post_id uuid,
  p_file_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_context jsonb;
  v_school_id uuid;
  v_post public.posts%rowtype;
  v_file public.file_objects%rowtype;
  v_was_primary boolean;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  v_context := public.get_current_student_context();
  v_school_id := nullif(v_context ->> 'school_id', '')::uuid;

  select p.*
  into v_post
  from public.posts p
  where p.id = p_post_id
  for update;

  if not found
     or v_post.owner_id <> v_actor_id
     or v_post.school_id <> v_school_id
     or v_post.lifecycle_status <> 'active' then
    raise exception using message = 'EDU_SHARE_STORAGE_POST_NOT_OWN_ACTIVE';
  end if;

  select f.*
  into v_file
  from public.file_objects f
  where f.id = p_file_id
  for update;

  if not found
     or v_file.owner_id <> v_actor_id
     or v_file.purpose <> 'post_media'
     or v_file.bucket <> 'post-media'
     or v_file.binding_status <> 'bound' then
    raise exception using message = 'EDU_SHARE_STORAGE_FILE_NOT_BOUND';
  end if;

  select pm.is_primary
  into v_was_primary
  from public.post_media pm
  where pm.post_id = p_post_id
    and pm.file_id = p_file_id
  for update;

  if not found then
    raise exception using message = 'EDU_SHARE_STORAGE_MEDIA_BINDING_NOT_FOUND';
  end if;

  delete from public.post_media
  where post_id = p_post_id
    and file_id = p_file_id;

  update public.file_objects
  set
    binding_status = 'orphaned',
    bound_at = null
  where id = p_file_id;

  if v_was_primary then
    update public.post_media pm
    set is_primary = true
    where pm.id = (
      select candidate.id
      from public.post_media candidate
      where candidate.post_id = p_post_id
      order by candidate.sort_order asc, candidate.created_at asc, candidate.id asc
      limit 1
    );
  end if;

  return jsonb_build_object(
    'fileId', v_file.id,
    'bucket', v_file.bucket,
    'path', v_file.storage_path,
    'bindingStatus', 'orphaned'
  );
end;
$$;

-- =========================================================
-- 6. TRUSTED AVATAR BINDING / METADATA TOMBSTONE
-- =========================================================

create or replace function public.set_my_avatar(
  p_file_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_context jsonb;
  v_school_id uuid;
  v_profile public.profiles%rowtype;
  v_file public.file_objects%rowtype;
  v_previous public.file_objects%rowtype;
  v_previous_json jsonb := null;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  v_context := public.get_current_student_context();
  v_school_id := nullif(v_context ->> 'school_id', '')::uuid;

  select p.*
  into v_profile
  from public.profiles p
  where p.user_id = v_actor_id
  for update;

  if not found or v_profile.school_id <> v_school_id then
    raise exception using message = 'EDU_SHARE_STORAGE_PROFILE_NOT_FOUND';
  end if;

  select f.*
  into v_file
  from public.file_objects f
  where f.id = p_file_id
  for update;

  if not found
     or v_file.owner_id <> v_actor_id
     or v_file.school_id <> v_school_id
     or v_file.purpose <> 'avatar'
     or v_file.bucket <> 'profile-media'
     or v_file.binding_status <> 'uploaded'
     or v_file.deleted_at is not null then
    raise exception using message = 'EDU_SHARE_STORAGE_AVATAR_NOT_BINDABLE';
  end if;

  if v_profile.avatar_file_id is not null then
    select old_file.*
    into v_previous
    from public.file_objects old_file
    where old_file.id = v_profile.avatar_file_id
    for update;

    if found then
      update public.file_objects
      set
        binding_status = 'orphaned',
        bound_at = null
      where id = v_previous.id;

      v_previous_json := jsonb_build_object(
        'fileId', v_previous.id,
        'bucket', v_previous.bucket,
        'path', v_previous.storage_path
      );
    end if;
  end if;

  update public.profiles
  set avatar_file_id = v_file.id,
      updated_at = now()
  where user_id = v_actor_id;

  update public.file_objects
  set
    binding_status = 'bound',
    bound_at = now()
  where id = v_file.id;

  return jsonb_build_object(
    'fileId', v_file.id,
    'bucket', v_file.bucket,
    'path', v_file.storage_path,
    'previousAvatar', v_previous_json
  );
end;
$$;

create or replace function public.mark_my_file_deleted(
  p_file_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
  v_file public.file_objects%rowtype;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  select f.*
  into v_file
  from public.file_objects f
  where f.id = p_file_id
    and f.owner_id = v_actor_id
  for update;

  if not found then
    raise exception using message = 'EDU_SHARE_STORAGE_FILE_NOT_FOUND';
  end if;

  if v_file.binding_status not in ('reserved','uploaded','orphaned')
     or v_file.deleted_at is not null then
    raise exception using message = 'EDU_SHARE_STORAGE_FILE_NOT_DELETABLE';
  end if;

  if exists (
    select 1
    from storage.objects o
    where o.bucket_id = v_file.bucket
      and o.name = v_file.storage_path
  ) then
    raise exception using message = 'EDU_SHARE_STORAGE_OBJECT_STILL_EXISTS';
  end if;

  if exists (select 1 from public.post_media pm where pm.file_id = v_file.id)
     or exists (select 1 from public.profiles p where p.avatar_file_id = v_file.id)
     or exists (select 1 from public.profile_private pp where pp.face_file_id = v_file.id) then
    raise exception using message = 'EDU_SHARE_STORAGE_FILE_STILL_REFERENCED';
  end if;

  update public.file_objects
  set
    binding_status = 'deleted',
    deleted_at = now(),
    bound_at = null
  where id = v_file.id;

  return jsonb_build_object(
    'fileId', v_file.id,
    'bindingStatus', 'deleted'
  );
end;
$$;

-- =========================================================
-- 7. PUBLIC RPC PRIVILEGES
-- =========================================================

revoke all on function public.reserve_my_file(text,text,bigint,uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_my_file(uuid)
  from public, anon, authenticated;
revoke all on function public.bind_my_post_media(uuid,uuid,integer,boolean,text)
  from public, anon, authenticated;
revoke all on function public.remove_my_post_media(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.set_my_avatar(uuid)
  from public, anon, authenticated;
revoke all on function public.mark_my_file_deleted(uuid)
  from public, anon, authenticated;

grant execute on function public.reserve_my_file(text,text,bigint,uuid)
  to authenticated;
grant execute on function public.finalize_my_file(uuid)
  to authenticated;
grant execute on function public.bind_my_post_media(uuid,uuid,integer,boolean,text)
  to authenticated;
grant execute on function public.remove_my_post_media(uuid,uuid)
  to authenticated;
grant execute on function public.set_my_avatar(uuid)
  to authenticated;
grant execute on function public.mark_my_file_deleted(uuid)
  to authenticated;

comment on function public.reserve_my_file(text,text,bigint,uuid) is
  'Phase 5F verified Student reservation boundary. Generates an immutable private Storage path; browser upsert/overwrite is unsupported.';
comment on function public.finalize_my_file(uuid) is
  'Phase 5F owner-only finalize boundary. Verifies actual Storage object metadata before marking the reservation uploaded.';
comment on function public.bind_my_post_media(uuid,uuid,integer,boolean,text) is
  'Phase 5F owner-only post media binding. Active own posts only; maximum five bound images.';
comment on function public.remove_my_post_media(uuid,uuid) is
  'Phase 5F owner-only unbind workflow. Marks metadata orphaned before authenticated Storage deletion.';
comment on function public.set_my_avatar(uuid) is
  'Phase 5F self-avatar binding. Superseded avatar metadata is atomically marked orphaned.';
comment on function public.mark_my_file_deleted(uuid) is
  'Phase 5F metadata tombstone after authenticated Storage object removal.';

-- =========================================================
-- 8. STORAGE OBJECT RLS
-- =========================================================

-- Supabase Storage owns the storage schema and object mutation API. We only add
-- RLS policies; application code never directly DELETEs storage.objects rows.
-- No UPDATE policy is created, intentionally preventing overwrite/upsert/move.

drop policy if exists phase5f_insert_reserved_object on storage.objects;
create policy phase5f_insert_reserved_object
on storage.objects
for insert
to authenticated
with check (
  (select private.can_insert_phase5f_storage_object(bucket_id, name))
);

drop policy if exists phase5f_read_authorized_object on storage.objects;
create policy phase5f_read_authorized_object
on storage.objects
for select
to authenticated
using (
  (select private.can_read_phase5f_storage_object(bucket_id, name))
);

drop policy if exists phase5f_delete_unbound_object on storage.objects;
create policy phase5f_delete_unbound_object
on storage.objects
for delete
to authenticated
using (
  (select private.can_delete_phase5f_storage_object(bucket_id, name))
);
