-- Phase 5F follow-up: file_objects.school_id is server-derived from owner profile.
-- This preserves the NOT NULL tenancy invariant while keeping internal/admin
-- metadata inserts from having to duplicate an authorization-sensitive value.

create or replace function private.enforce_file_object_school()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  if new.owner_id is null then
    raise exception using message = 'EDU_SHARE_STORAGE_FILE_OWNER_REQUIRED';
  end if;

  select p.school_id
  into v_school_id
  from public.profiles p
  where p.user_id = new.owner_id;

  if not found or v_school_id is null then
    raise exception using message = 'EDU_SHARE_STORAGE_FILE_OWNER_PROFILE_REQUIRED';
  end if;

  if new.school_id is null then
    new.school_id := v_school_id;
  elsif new.school_id <> v_school_id then
    raise exception using
      message = 'EDU_SHARE_STORAGE_FILE_SCHOOL_MISMATCH',
      detail = 'File school scope is derived from the owner profile.';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_file_object_school()
  from public, anon, authenticated;

drop trigger if exists file_objects_enforce_school on public.file_objects;
create trigger file_objects_enforce_school
before insert or update of owner_id, school_id
on public.file_objects
for each row
execute function private.enforce_file_object_school();
