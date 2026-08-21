-- Phase 5D — narrow, verified-student self privacy mutation.
-- Profile/private-profile reads remain RLS-protected SELECTs. Browser roles do
-- not receive direct UPDATE access; only this trusted RPC may change privacy flags.

drop policy if exists profiles_update_privacy_self on public.profiles;
drop policy if exists profile_private_update_privacy_self on public.profile_private;

revoke update on public.profiles from public, anon, authenticated;
revoke update on public.profile_private from public, anon, authenticated;
revoke update (show_name, show_class) on public.profiles from authenticated;
revoke update (show_email, show_phone) on public.profile_private from authenticated;

create or replace function public.update_my_profile_privacy(
  p_show_name boolean,
  p_show_class boolean,
  p_show_email boolean,
  p_show_phone boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := (select auth.uid());
begin
  if v_actor_id is null then
    raise exception using
      message = 'EDU_SHARE_AUTH_REQUIRED',
      detail = 'An authenticated session is required.';
  end if;

  -- Reuse the canonical Student trust gate: active Student role, approved
  -- account, verified current-school membership and matching school scope.
  perform public.get_current_student_context();

  if p_show_name is null
     or p_show_class is null
     or p_show_email is null
     or p_show_phone is null then
    raise exception using
      message = 'EDU_SHARE_PROFILE_PRIVACY_INVALID',
      detail = 'Every profile privacy flag must be an explicit boolean.';
  end if;

  update public.profiles
  set
    show_name = p_show_name,
    show_class = p_show_class,
    updated_at = now()
  where user_id = v_actor_id;

  if not found then
    raise exception using message = 'EDU_SHARE_STUDENT_PROFILE_NOT_FOUND';
  end if;

  update public.profile_private
  set
    show_email = p_show_email,
    show_phone = p_show_phone,
    updated_at = now()
  where user_id = v_actor_id;

  if not found then
    raise exception using message = 'EDU_SHARE_PROFILE_PRIVATE_NOT_FOUND';
  end if;

  return jsonb_build_object(
    'showName', p_show_name,
    'showClass', p_show_class,
    'showEmail', p_show_email,
    'showPhone', p_show_phone
  );
end;
$$;

comment on function public.update_my_profile_privacy(boolean, boolean, boolean, boolean) is
  'Verified Student self-only privacy update. Actor comes from auth.uid(); only the four profile display/contact privacy flags are mutable.';

revoke all on function public.update_my_profile_privacy(boolean, boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.update_my_profile_privacy(boolean, boolean, boolean, boolean)
  to authenticated;
