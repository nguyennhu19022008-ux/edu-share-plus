-- Phase 5F follow-up: Supabase Storage remove() requires SELECT + DELETE.
-- Grant SELECT only while the current Storage API operation is a delete,
-- so reserved/uploaded/orphaned objects do not become generally readable.

drop policy if exists phase5f_select_deletable_object_for_remove on storage.objects;
create policy phase5f_select_deletable_object_for_remove
on storage.objects
for select
to authenticated
using (
  storage.allow_any_operation(
    array['storage.object.delete','storage.object.delete_many']::text[]
  )
  and (select private.can_delete_phase5f_storage_object(bucket_id, name))
);
