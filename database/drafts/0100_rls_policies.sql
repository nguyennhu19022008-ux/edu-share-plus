-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


-- RLS is enabled explicitly because these tables are drafted for raw-SQL creation.

alter table public.schools enable row level security;
alter table public.school_classes enable row level security;
alter table public.file_objects enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.account_reviews enable row level security;
alter table public.categories enable row level security;
alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.post_status_history enable row level security;
alter table public.favorites enable row level security;
alter table public.comments enable row level security;
alter table public.contact_events enable row level security;
alter table public.notifications enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.reports enable row level security;
alter table public.verification_requests enable row level security;
alter table public.verification_results enable row level security;
alter table public.verification_evidence enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_events enable row level security;
alter table public.cases enable row level security;
alter table public.case_participants enable row level security;
alter table public.case_updates enable row level security;
alter table public.case_evidence enable row level security;
alter table public.price_model_versions enable row level security;
alter table public.price_reference_data enable row level security;
alter table public.price_estimates enable row level security;
alter table public.price_estimate_references enable row level security;
alter table public.reputation_model_versions enable row level security;
alter table public.reputation_events enable row level security;

-- Reference data
create policy schools_read_active_or_staff on public.schools for select to anon, authenticated
using (is_active or (auth.uid() is not null and private.can_moderate_school(id)));
create policy classes_read_active_or_staff on public.school_classes for select to anon, authenticated
using (is_active or (auth.uid() is not null and private.can_moderate_school(school_id)));
create policy categories_read_active on public.categories for select to anon, authenticated using (is_active);
create policy roles_read_authenticated on public.roles for select to authenticated using (true);

-- Profiles: no anonymous direct profile read; seller privacy will use a safe projection/RPC later.
create policy profiles_read_self_or_staff on public.profiles for select to authenticated
using ((select auth.uid())=user_id or private.can_moderate_school(school_id));
create policy profiles_update_self on public.profiles for update to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

create policy profile_private_read_self_or_reviewer on public.profile_private for select to authenticated
using ((select auth.uid())=user_id or private.can_review_user(user_id));
create policy profile_private_update_self on public.profile_private for update to authenticated
using ((select auth.uid())=user_id)
with check ((select auth.uid())=user_id);

create policy user_roles_read_self_or_staff on public.user_roles for select to authenticated
using ((select auth.uid())=user_id or private.can_moderate_school(school_id) or private.has_role('admin', school_id));

create policy account_reviews_read_self_or_staff on public.account_reviews for select to authenticated
using ((select auth.uid())=user_id or private.can_review_user(user_id));

-- Marketplace
create policy posts_read_allowed on public.posts for select to anon, authenticated
using (private.can_view_post(id));

create policy post_media_read_with_post on public.post_media for select to anon, authenticated
using (private.can_view_post(post_id));

create policy post_status_history_read_owner_or_staff on public.post_status_history for select to authenticated
using (exists (
  select 1 from public.posts p
  where p.id=post_id and (p.owner_id=(select auth.uid()) or private.can_moderate_school(p.school_id))
));

-- Public file metadata is readable only for public objects. Owners and operational staff
-- may additionally read their own/authorized evidence metadata.
create policy file_objects_read_allowed on public.file_objects for select to anon, authenticated
using (
  (visibility='public' and deleted_at is null)
  or owner_id=(select auth.uid())
  or exists (
    select 1 from public.verification_evidence ve
    where ve.file_id=id and private.can_verify_request(ve.request_id)
  )
  or exists (
    select 1 from public.case_evidence ce
    where ce.file_id=id and private.can_handle_case(ce.case_id)
  )
);

-- Favorites are an intentionally direct, disposable join.
create policy favorites_read_own on public.favorites for select to authenticated
using ((select auth.uid())=user_id);
create policy favorites_insert_own on public.favorites for insert to authenticated
with check ((select auth.uid())=user_id and private.is_approved_user() and private.can_view_post(post_id));
create policy favorites_delete_own on public.favorites for delete to authenticated
using ((select auth.uid())=user_id);

-- Visible comments are readable wherever the post itself is viewable.
create policy comments_read_visible on public.comments for select to anon, authenticated
using ((visibility_status='visible' and deleted_at is null and private.can_view_post(post_id))
  or (auth.uid() is not null and author_id=(select auth.uid())));
create policy comments_insert_own on public.comments for insert to authenticated
with check (
  author_id=(select auth.uid())
  and private.is_approved_user()
  and visibility_status='visible'
  and deleted_at is null
  and private.can_view_post(post_id)
  and exists (select 1 from public.posts p where p.id=post_id and p.comments_enabled=true)
);

create policy contact_events_read_parties_or_staff on public.contact_events for select to authenticated
using (
  requester_id=(select auth.uid())
  or exists (select 1 from public.posts p where p.id=post_id and (p.owner_id=(select auth.uid()) or private.can_moderate_school(p.school_id)))
);

create policy notifications_read_own on public.notifications for select to authenticated
using (recipient_id=(select auth.uid()));
create policy notifications_mark_read_own on public.notifications for update to authenticated
using (recipient_id=(select auth.uid()))
with check (recipient_id=(select auth.uid()));

-- Moderation/reporting
create policy moderation_actions_read_staff on public.moderation_actions for select to authenticated
using (exists (select 1 from public.posts p where p.id=post_id and private.can_moderate_school(p.school_id)));

create policy reports_read_reporter_or_staff on public.reports for select to authenticated
using (reporter_id=(select auth.uid()) or private.can_moderate_report(id));

-- Verification: students may see request/result surfaces relevant to them, but raw evidence is tighter.
create policy verification_requests_read_related on public.verification_requests for select to authenticated
using (private.can_view_verification_request(id));
create policy verification_results_read_related on public.verification_results for select to authenticated
using (private.can_view_verification_request(request_id));
create policy verification_evidence_read_staff_or_uploader on public.verification_evidence for select to authenticated
using (uploaded_by=(select auth.uid()) or private.can_verify_request(request_id));

-- Transactions
create policy transactions_read_parties_or_staff on public.transactions for select to authenticated
using (
  owner_id=(select auth.uid()) or counterparty_id=(select auth.uid())
  or exists (select 1 from public.posts p where p.id=post_id and private.can_moderate_school(p.school_id))
);
create policy transaction_events_read_with_transaction on public.transaction_events for select to authenticated
using (exists (
  select 1 from public.transactions t
  where t.id=transaction_id and (
    t.owner_id=(select auth.uid()) or t.counterparty_id=(select auth.uid())
    or exists (select 1 from public.posts p where p.id=t.post_id and private.can_moderate_school(p.school_id))
  )
));

-- Cases
create policy cases_read_allowed on public.cases for select to authenticated
using (private.can_view_case(id));
create policy case_participants_read_with_case on public.case_participants for select to authenticated
using (private.can_view_case(case_id));
create policy case_updates_read_with_visibility on public.case_updates for select to authenticated
using (private.can_view_case(case_id) and (visibility='participants' or private.can_handle_case(case_id)));
create policy case_evidence_read_with_case on public.case_evidence for select to authenticated
using (private.can_view_case(case_id));

-- Price estimator/reputation transparency surfaces
create policy price_model_versions_read_active_or_staff on public.price_model_versions for select to authenticated
using (status in ('active','retired') or private.has_role('admin', null));
create policy price_reference_data_read_staff on public.price_reference_data for select to authenticated
using (private.has_role('admin', null) or exists (
  select 1 from public.profiles p where p.user_id=(select auth.uid()) and private.can_moderate_school(p.school_id)
));
create policy price_estimates_read_own_or_staff on public.price_estimates for select to authenticated
using (requested_by=(select auth.uid()) or private.has_role('admin', null));
create policy price_estimate_references_read_with_estimate on public.price_estimate_references for select to authenticated
using (exists (
  select 1 from public.price_estimates pe
  where pe.id=estimate_id and (pe.requested_by=(select auth.uid()) or private.has_role('admin', null))
));
create policy reputation_model_versions_read_active_or_staff on public.reputation_model_versions for select to authenticated
using (status in ('active','retired') or private.has_role('admin', null));
create policy reputation_events_read_own_or_staff on public.reputation_events for select to authenticated
using (user_id=(select auth.uid()) or private.has_role('admin', null));

-- IMPORTANT: no INSERT/UPDATE/DELETE policies are intentionally created for complex workflow tables.
-- Account approval, role assignment, posts, reports, moderation, verification, transactions, cases,
-- price estimation, reputation scoring and audit/analytics writes remain trusted transactional operations.
