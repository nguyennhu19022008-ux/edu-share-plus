-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


-- Identity/access
create unique index user_roles_active_school_assignment_uniq
  on public.user_roles(user_id, role_id, school_id)
  where revoked_at is null and school_id is not null;
create unique index user_roles_active_global_assignment_uniq
  on public.user_roles(user_id, role_id)
  where revoked_at is null and school_id is null;
create index user_roles_active_lookup_idx
  on public.user_roles(user_id, school_id, role_id)
  where revoked_at is null;
create index account_reviews_user_time_idx on public.account_reviews(user_id, submitted_at desc);
create index account_reviews_queue_idx on public.account_reviews(status, submitted_at);
create index profiles_school_status_idx on public.profiles(school_id, account_status, created_at desc);

-- Marketplace
create unique index post_media_one_primary_idx on public.post_media(post_id) where is_primary=true;
create index posts_public_feed_idx on public.posts(school_id, created_at desc, id desc)
  where moderation_status='approved' and lifecycle_status='active' and is_hidden=false;
create index posts_public_category_idx on public.posts(school_id, category_id, created_at desc, id desc)
  where moderation_status='approved' and lifecycle_status='active' and is_hidden=false;
create index posts_public_trade_idx on public.posts(school_id, trade_type, created_at desc, id desc)
  where moderation_status='approved' and lifecycle_status='active' and is_hidden=false;
create index posts_public_class_idx on public.posts(school_id, class_id, created_at desc, id desc)
  where moderation_status='approved' and lifecycle_status='active' and is_hidden=false;
create index posts_public_sale_price_idx on public.posts(school_id, sale_price, created_at desc, id desc)
  where moderation_status='approved' and lifecycle_status='active' and is_hidden=false and trade_type='low_price_sale';
create index posts_owner_time_idx on public.posts(owner_id, created_at desc, id desc);
create index posts_owner_state_idx on public.posts(owner_id, moderation_status, lifecycle_status, created_at desc);
create index posts_search_tsv_idx on public.posts using gin(search_tsv);
create index post_status_history_post_time_idx on public.post_status_history(post_id, created_at desc, id desc);

-- Interactions
create index favorites_post_idx on public.favorites(post_id);
create index comments_post_time_idx on public.comments(post_id, created_at, id);
create index comments_parent_idx on public.comments(parent_comment_id);
create index contact_events_post_time_idx on public.contact_events(post_id, created_at desc);
create index contact_events_post_requester_time_idx on public.contact_events(post_id, requester_id, created_at desc);
create index contact_events_requester_time_idx on public.contact_events(requester_id, created_at desc);
create index notifications_recipient_time_idx on public.notifications(recipient_id, created_at desc);
create index notifications_unread_idx on public.notifications(recipient_id, created_at desc) where read_at is null;

-- Moderation/report
create index moderation_actions_post_time_idx on public.moderation_actions(post_id, created_at desc);
create index moderation_actions_moderator_time_idx on public.moderation_actions(moderator_id, created_at desc);
create index reports_status_time_idx on public.reports(status, created_at desc);
create index reports_assignee_status_idx on public.reports(assigned_to, status, created_at desc);
create index reports_post_idx on public.reports(post_id) where post_id is not null;
create index reports_comment_idx on public.reports(comment_id) where comment_id is not null;
create index reports_user_idx on public.reports(reported_user_id) where reported_user_id is not null;

-- Verification
create index verification_requests_post_time_idx on public.verification_requests(post_id, requested_at desc);
create index verification_requests_queue_idx on public.verification_requests(status, requested_at);
create index verification_requests_verifier_queue_idx on public.verification_requests(assigned_verifier_id, status, requested_at);
create index verification_results_request_time_idx on public.verification_results(request_id, revision_no desc);

-- Transactions/cases
create index transactions_post_time_idx on public.transactions(post_id, created_at desc);
create index transactions_owner_time_idx on public.transactions(owner_id, created_at desc);
create index transactions_counterparty_time_idx on public.transactions(counterparty_id, created_at desc);
create index transaction_events_tx_time_idx on public.transaction_events(transaction_id, created_at, id);
create index cases_status_time_idx on public.cases(status, updated_at desc);
create index cases_assignee_status_idx on public.cases(assigned_to, status, updated_at desc);
create index cases_post_idx on public.cases(post_id) where post_id is not null;
create index cases_transaction_idx on public.cases(transaction_id) where transaction_id is not null;
create index cases_verification_idx on public.cases(verification_request_id) where verification_request_id is not null;
create index case_updates_case_time_idx on public.case_updates(case_id, created_at, id);

-- Price/reputation
create unique index price_model_one_active_idx on public.price_model_versions((1)) where status='active';
create index price_reference_eligible_category_time_idx on public.price_reference_data(category_id, observed_at desc) where is_eligible=true;
create index price_estimates_requester_time_idx on public.price_estimates(requested_by, created_at desc);
create unique index reputation_model_one_active_idx on public.reputation_model_versions((1)) where status='active';
create index reputation_events_user_time_idx on public.reputation_events(user_id, created_at desc);

-- Private operational
create index audit_logs_time_idx on private.audit_logs(created_at desc);
create index audit_logs_actor_time_idx on private.audit_logs(actor_id, created_at desc);
create index audit_logs_entity_time_idx on private.audit_logs(entity_type, entity_id, created_at desc);
create index analytics_events_name_time_idx on private.analytics_events(event_name, occurred_at desc);
create index analytics_events_user_time_idx on private.analytics_events(user_id, occurred_at desc) where user_id is not null;
create index analytics_events_post_time_idx on private.analytics_events(post_id, occurred_at desc) where post_id is not null;
