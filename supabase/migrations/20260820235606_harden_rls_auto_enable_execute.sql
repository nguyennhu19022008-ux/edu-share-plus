-- EDU SHARE+ / PHASE 5A
-- Harden SECURITY DEFINER event-trigger helper exposure.
-- The event trigger still executes this function internally; browser roles do not need RPC access.

revoke execute on function public.rls_auto_enable() from public;
revoke execute on function public.rls_auto_enable() from anon;
revoke execute on function public.rls_auto_enable() from authenticated;
