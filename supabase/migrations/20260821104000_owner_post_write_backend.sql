-- Phase 5E — trusted owner post write boundary.
-- Student identities keep SELECT-only table access. Create/edit/lifecycle writes
-- run through narrow authenticated RPCs that derive owner/school/class server-side.

alter table public.posts
  add column preferred_contact_method text not null default 'email',
  add column original_purchase_price bigint,
  add column original_price_is_estimate boolean,
  add column purchase_date date,
  add column condition_grade text,
  add column brand text,
  add column model text;

alter table public.posts
  add constraint posts_preferred_contact_method_check
    check (preferred_contact_method in ('phone', 'email')),
  add constraint posts_original_purchase_price_positive
    check (original_purchase_price is null or original_purchase_price > 0),
  add constraint posts_condition_grade_check
    check (
      condition_grade is null
      or condition_grade in ('like_new', 'good', 'fair', 'well_used')
    ),
  add constraint posts_brand_length_check
    check (brand is null or char_length(btrim(brand)) between 1 and 120),
  add constraint posts_model_length_check
    check (model is null or char_length(btrim(model)) between 1 and 120),
  add constraint posts_low_price_structured_input_contract
    check (
      (
        trade_type = 'low_price_sale'
        and original_purchase_price is not null
        and original_purchase_price > 0
        and original_price_is_estimate is not null
        and condition_grade in ('like_new', 'good', 'fair', 'well_used')
      )
      or
      (
        trade_type <> 'low_price_sale'
        and original_purchase_price is null
        and original_price_is_estimate is null
        and purchase_date is null
        and condition_grade is null
        and brand is null
        and model is null
      )
    );

-- Defense in depth: exposed browser roles never write post rows directly.
revoke insert, update, delete on table public.posts from public, anon, authenticated;

create or replace function private.assert_owner_post_payload(
  p_actor_id uuid,
  p_school_id uuid,
  p_category_id uuid,
  p_title text,
  p_description text,
  p_trade_type text,
  p_sale_price bigint,
  p_visibility_scope text,
  p_preferred_contact_method text,
  p_original_purchase_price bigint,
  p_original_price_is_estimate boolean,
  p_purchase_date date,
  p_condition_grade text,
  p_brand text,
  p_model text
)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_school_scope text;
  v_contact_email text;
  v_phone text;
begin
  if p_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from auth.users au
    where au.id = p_actor_id
      and au.email_confirmed_at is not null
  ) then
    raise exception using
      message = 'EDU_SHARE_EMAIL_NOT_CONFIRMED',
      detail = 'A confirmed email is required before creating or editing posts.';
  end if;

  select s.marketplace_scope
  into v_school_scope
  from public.schools s
  where s.id = p_school_id
    and s.is_active = true;

  if not found then
    raise exception using message = 'EDU_SHARE_SCHOOL_NOT_ACTIVE';
  end if;

  if p_visibility_scope not in ('inherit', 'school', 'network') then
    raise exception using message = 'EDU_SHARE_POST_VISIBILITY_INVALID';
  end if;

  if p_visibility_scope = 'network' and v_school_scope <> 'network' then
    raise exception using
      message = 'EDU_SHARE_POST_VISIBILITY_WIDENS_SCHOOL_POLICY',
      detail = 'A post may narrow but never widen the school marketplace policy.';
  end if;

  if not exists (
    select 1
    from public.categories c
    where c.id = p_category_id
      and c.is_active = true
  ) then
    raise exception using message = 'EDU_SHARE_POST_CATEGORY_INVALID';
  end if;

  if p_title is null
     or char_length(btrim(p_title)) < 5
     or char_length(btrim(p_title)) > 160 then
    raise exception using message = 'EDU_SHARE_POST_TITLE_INVALID';
  end if;

  if p_description is null
     or char_length(btrim(p_description)) < 10
     or char_length(btrim(p_description)) > 5000 then
    raise exception using message = 'EDU_SHARE_POST_DESCRIPTION_INVALID';
  end if;

  if p_trade_type not in ('lend', 'give', 'exchange', 'low_price_sale') then
    raise exception using message = 'EDU_SHARE_POST_TRADE_TYPE_INVALID';
  end if;

  if p_preferred_contact_method not in ('phone', 'email') then
    raise exception using message = 'EDU_SHARE_POST_CONTACT_METHOD_INVALID';
  end if;

  select pp.contact_email, pp.phone
  into v_contact_email, v_phone
  from public.profile_private pp
  where pp.user_id = p_actor_id;

  if not found then
    raise exception using message = 'EDU_SHARE_PROFILE_PRIVATE_NOT_FOUND';
  end if;

  if p_preferred_contact_method = 'email'
     and nullif(btrim(coalesce(v_contact_email, '')), '') is null then
    raise exception using message = 'EDU_SHARE_POST_CONTACT_EMAIL_MISSING';
  end if;

  if p_preferred_contact_method = 'phone'
     and nullif(btrim(coalesce(v_phone, '')), '') is null then
    raise exception using message = 'EDU_SHARE_POST_CONTACT_PHONE_MISSING';
  end if;

  if p_trade_type = 'low_price_sale' then
    if p_sale_price is null or p_sale_price <= 0 then
      raise exception using message = 'EDU_SHARE_POST_SALE_PRICE_REQUIRED';
    end if;
    if p_original_purchase_price is null or p_original_purchase_price <= 0 then
      raise exception using message = 'EDU_SHARE_POST_ORIGINAL_PRICE_REQUIRED';
    end if;
    if p_original_price_is_estimate is null then
      raise exception using message = 'EDU_SHARE_POST_ORIGINAL_PRICE_ESTIMATE_REQUIRED';
    end if;
    if p_condition_grade not in ('like_new', 'good', 'fair', 'well_used') then
      raise exception using message = 'EDU_SHARE_POST_CONDITION_REQUIRED';
    end if;
    if p_purchase_date is not null and p_purchase_date > current_date then
      raise exception using message = 'EDU_SHARE_POST_PURCHASE_DATE_FUTURE';
    end if;
    if p_brand is not null and (char_length(btrim(p_brand)) < 1 or char_length(btrim(p_brand)) > 120) then
      raise exception using message = 'EDU_SHARE_POST_BRAND_INVALID';
    end if;
    if p_model is not null and (char_length(btrim(p_model)) < 1 or char_length(btrim(p_model)) > 120) then
      raise exception using message = 'EDU_SHARE_POST_MODEL_INVALID';
    end if;
  else
    if p_sale_price is not null
       or p_original_purchase_price is not null
       or p_original_price_is_estimate is not null
       or p_purchase_date is not null
       or p_condition_grade is not null
       or p_brand is not null
       or p_model is not null then
      raise exception using
        message = 'EDU_SHARE_POST_PRICE_FIELDS_NOT_APPLICABLE',
        detail = 'Structured estimator inputs are only accepted for low-price-sale posts.';
    end if;
  end if;
end;
$$;

revoke all on function private.assert_owner_post_payload(
  uuid, uuid, uuid, text, text, text, bigint, text, text,
  bigint, boolean, date, text, text, text
) from public, anon, authenticated;

create or replace function public.create_my_post(
  p_category_id uuid,
  p_title text,
  p_description text,
  p_trade_type text,
  p_sale_price bigint,
  p_visibility_scope text,
  p_preferred_contact_method text,
  p_original_purchase_price bigint,
  p_original_price_is_estimate boolean,
  p_purchase_date date,
  p_condition_grade text,
  p_brand text,
  p_model text
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
  v_class_id uuid;
  v_post public.posts%rowtype;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  v_context := public.get_current_student_context();
  v_school_id := nullif(v_context ->> 'school_id', '')::uuid;
  v_class_id := nullif(v_context ->> 'class_id', '')::uuid;

  -- Only carry a current active class snapshot. Missing/inactive class is valid
  -- and results in a school-level post with class_id = null.
  if v_class_id is not null and not exists (
    select 1
    from public.school_classes sc
    where sc.id = v_class_id
      and sc.school_id = v_school_id
      and sc.is_active = true
  ) then
    v_class_id := null;
  end if;

  perform private.assert_owner_post_payload(
    v_actor_id, v_school_id, p_category_id, p_title, p_description,
    p_trade_type, p_sale_price, p_visibility_scope, p_preferred_contact_method,
    p_original_purchase_price, p_original_price_is_estimate, p_purchase_date,
    p_condition_grade, p_brand, p_model
  );

  insert into public.posts (
    owner_id, school_id, class_id, category_id,
    title, description, trade_type, sale_price,
    moderation_status, lifecycle_status, is_hidden, comments_enabled,
    published_at, completed_at, withdrawn_at, visibility_scope,
    preferred_contact_method, original_purchase_price,
    original_price_is_estimate, purchase_date, condition_grade, brand, model
  ) values (
    v_actor_id, v_school_id, v_class_id, p_category_id,
    btrim(p_title), btrim(p_description), p_trade_type, p_sale_price,
    'pending', 'active', false, true,
    null, null, null, p_visibility_scope,
    p_preferred_contact_method, p_original_purchase_price,
    p_original_price_is_estimate, p_purchase_date, p_condition_grade,
    nullif(btrim(p_brand), ''), nullif(btrim(p_model), '')
  )
  returning * into v_post;

  insert into public.post_status_history (
    post_id, dimension, old_value, new_value,
    actor_id, actor_kind, reason, source
  ) values
    (v_post.id, 'moderation', null, 'pending', v_actor_id, 'user', 'Owner created post for moderation.', 'owner_action'),
    (v_post.id, 'lifecycle', null, 'active', v_actor_id, 'user', 'Owner created active listing.', 'owner_action'),
    (v_post.id, 'visibility', null, v_post.visibility_scope, v_actor_id, 'user', 'Owner selected listing visibility.', 'owner_action');

  return jsonb_build_object(
    'id', v_post.id,
    'moderationStatus', v_post.moderation_status,
    'lifecycleStatus', v_post.lifecycle_status,
    'visibilityScope', v_post.visibility_scope,
    'updatedAt', v_post.updated_at
  );
end;
$$;

create or replace function public.update_my_post(
  p_post_id uuid,
  p_category_id uuid,
  p_title text,
  p_description text,
  p_trade_type text,
  p_sale_price bigint,
  p_visibility_scope text,
  p_preferred_contact_method text,
  p_original_purchase_price bigint,
  p_original_price_is_estimate boolean,
  p_purchase_date date,
  p_condition_grade text,
  p_brand text,
  p_model text
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
  v_class_id uuid;
  v_old public.posts%rowtype;
  v_post public.posts%rowtype;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  v_context := public.get_current_student_context();
  v_school_id := nullif(v_context ->> 'school_id', '')::uuid;
  v_class_id := nullif(v_context ->> 'class_id', '')::uuid;

  select p.*
  into v_old
  from public.posts p
  where p.id = p_post_id
    and p.owner_id = v_actor_id
  for update;

  if not found then
    raise exception using message = 'EDU_SHARE_POST_NOT_FOUND';
  end if;

  if v_old.school_id <> v_school_id then
    raise exception using message = 'EDU_SHARE_POST_SCHOOL_MISMATCH';
  end if;

  if v_old.lifecycle_status <> 'active' then
    raise exception using message = 'EDU_SHARE_POST_NOT_EDITABLE';
  end if;

  if v_class_id is not null and not exists (
    select 1 from public.school_classes sc
    where sc.id = v_class_id
      and sc.school_id = v_school_id
      and sc.is_active = true
  ) then
    v_class_id := null;
  end if;

  perform private.assert_owner_post_payload(
    v_actor_id, v_school_id, p_category_id, p_title, p_description,
    p_trade_type, p_sale_price, p_visibility_scope, p_preferred_contact_method,
    p_original_purchase_price, p_original_price_is_estimate, p_purchase_date,
    p_condition_grade, p_brand, p_model
  );

  update public.posts
  set
    class_id = v_class_id,
    category_id = p_category_id,
    title = btrim(p_title),
    description = btrim(p_description),
    trade_type = p_trade_type,
    sale_price = p_sale_price,
    visibility_scope = p_visibility_scope,
    preferred_contact_method = p_preferred_contact_method,
    original_purchase_price = p_original_purchase_price,
    original_price_is_estimate = p_original_price_is_estimate,
    purchase_date = p_purchase_date,
    condition_grade = p_condition_grade,
    brand = nullif(btrim(p_brand), ''),
    model = nullif(btrim(p_model), ''),
    moderation_status = 'pending',
    published_at = null,
    updated_at = now()
  where id = v_old.id
  returning * into v_post;

  if v_old.moderation_status <> 'pending' then
    insert into public.post_status_history (
      post_id, dimension, old_value, new_value,
      actor_id, actor_kind, reason, source
    ) values (
      v_post.id, 'moderation', v_old.moderation_status, 'pending',
      v_actor_id, 'user', 'Owner edited post; moderation is required again.', 'owner_action'
    );
  end if;

  if v_old.visibility_scope <> v_post.visibility_scope then
    insert into public.post_status_history (
      post_id, dimension, old_value, new_value,
      actor_id, actor_kind, reason, source
    ) values (
      v_post.id, 'visibility', v_old.visibility_scope, v_post.visibility_scope,
      v_actor_id, 'user', 'Owner changed post visibility.', 'owner_action'
    );
  end if;

  return jsonb_build_object(
    'id', v_post.id,
    'moderationStatus', v_post.moderation_status,
    'lifecycleStatus', v_post.lifecycle_status,
    'visibilityScope', v_post.visibility_scope,
    'updatedAt', v_post.updated_at
  );
end;
$$;

create or replace function public.change_my_post_lifecycle(
  p_post_id uuid,
  p_action text
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
  v_old public.posts%rowtype;
  v_post public.posts%rowtype;
  v_next text;
begin
  if v_actor_id is null then
    raise exception using message = 'EDU_SHARE_AUTH_REQUIRED';
  end if;

  v_context := public.get_current_student_context();
  v_school_id := nullif(v_context ->> 'school_id', '')::uuid;

  if p_action not in ('complete', 'withdraw') then
    raise exception using message = 'EDU_SHARE_POST_LIFECYCLE_ACTION_INVALID';
  end if;

  select p.*
  into v_old
  from public.posts p
  where p.id = p_post_id
    and p.owner_id = v_actor_id
  for update;

  if not found then
    raise exception using message = 'EDU_SHARE_POST_NOT_FOUND';
  end if;

  if v_old.school_id <> v_school_id then
    raise exception using message = 'EDU_SHARE_POST_SCHOOL_MISMATCH';
  end if;

  if v_old.lifecycle_status <> 'active' then
    raise exception using message = 'EDU_SHARE_POST_LIFECYCLE_FINAL';
  end if;

  if p_action = 'complete' and v_old.moderation_status <> 'approved' then
    raise exception using
      message = 'EDU_SHARE_POST_NOT_APPROVED_FOR_COMPLETION',
      detail = 'Only a listing that reached approved marketplace state may be marked completed.';
  end if;

  v_next := case when p_action = 'complete' then 'completed' else 'withdrawn' end;

  update public.posts
  set
    lifecycle_status = v_next,
    completed_at = case when v_next = 'completed' then now() else null end,
    withdrawn_at = case when v_next = 'withdrawn' then now() else null end,
    updated_at = now()
  where id = v_old.id
  returning * into v_post;

  insert into public.post_status_history (
    post_id, dimension, old_value, new_value,
    actor_id, actor_kind, reason, source
  ) values (
    v_post.id, 'lifecycle', 'active', v_next,
    v_actor_id, 'user',
    case when v_next = 'completed'
      then 'Owner closed the listing as completed. This is not verified transaction evidence.'
      else 'Owner withdrew the listing.'
    end,
    'owner_action'
  );

  return jsonb_build_object(
    'id', v_post.id,
    'moderationStatus', v_post.moderation_status,
    'lifecycleStatus', v_post.lifecycle_status,
    'visibilityScope', v_post.visibility_scope,
    'updatedAt', v_post.updated_at
  );
end;
$$;

comment on function public.create_my_post(uuid,text,text,text,bigint,text,text,bigint,boolean,date,text,text,text) is
  'Verified Student owner-only create workflow. Owner/school/class and initial moderation/lifecycle state are server-controlled.';
comment on function public.update_my_post(uuid,uuid,text,text,text,bigint,text,text,bigint,boolean,date,text,text,text) is
  'Verified Student owner-only edit workflow. Active own posts only; every edit returns moderation to pending without changing staff-only hidden/comments state.';
comment on function public.change_my_post_lifecycle(uuid,text) is
  'Verified Student owner-only listing lifecycle workflow. Supports complete or withdraw; no hard delete or reopen.';

revoke all on function public.create_my_post(uuid,text,text,text,bigint,text,text,bigint,boolean,date,text,text,text)
  from public, anon, authenticated;
revoke all on function public.update_my_post(uuid,uuid,text,text,text,bigint,text,text,bigint,boolean,date,text,text,text)
  from public, anon, authenticated;
revoke all on function public.change_my_post_lifecycle(uuid,text)
  from public, anon, authenticated;

grant execute on function public.create_my_post(uuid,text,text,text,bigint,text,text,bigint,boolean,date,text,text,text)
  to authenticated;
grant execute on function public.update_my_post(uuid,uuid,text,text,text,bigint,text,text,bigint,boolean,date,text,text,text)
  to authenticated;
grant execute on function public.change_my_post_lifecycle(uuid,text)
  to authenticated;
