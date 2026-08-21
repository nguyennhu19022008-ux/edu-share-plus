-- EDU SHARE+ / PHASE 5A
-- Harden SECURITY DEFINER event-trigger helper exposure when that helper exists.
-- Hosted development had this helper from an earlier database-hardening step,
-- while a clean local migration replay may not. Keep this migration replay-safe.

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public';
    execute 'revoke execute on function public.rls_auto_enable() from anon';
    execute 'revoke execute on function public.rls_auto_enable() from authenticated';
  end if;
end;
$$;
