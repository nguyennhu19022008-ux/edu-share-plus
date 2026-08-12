-- EDU SHARE+ / PHASE 3E.3
-- Bootstrap private schema and shared timestamp trigger helper.

create schema if not exists private;

comment on schema private is
  'EDU SHARE+ non-browser-exposed security, audit, analytics and migration schema.';

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all
on function private.set_updated_at()
from public, anon, authenticated;