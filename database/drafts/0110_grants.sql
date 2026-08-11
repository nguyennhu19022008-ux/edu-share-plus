-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


-- Remove broad table privileges before granting the smallest direct-browser surface.
revoke all on all tables in schema public from anon, authenticated;

-- Guest/reference/public read surfaces. RLS still filters rows.
grant select on public.schools, public.school_classes, public.categories,
  public.posts, public.post_media, public.comments, public.file_objects to anon;

-- Authenticated read surfaces. RLS still filters rows.
grant select on public.schools, public.school_classes, public.file_objects,
  public.profiles, public.profile_private, public.roles, public.user_roles, public.account_reviews,
  public.categories, public.posts, public.post_media, public.post_status_history,
  public.favorites, public.comments, public.contact_events, public.notifications,
  public.moderation_actions, public.reports,
  public.verification_requests, public.verification_results, public.verification_evidence,
  public.transactions, public.transaction_events,
  public.cases, public.case_participants, public.case_updates, public.case_evidence,
  public.price_model_versions, public.price_reference_data, public.price_estimates, public.price_estimate_references,
  public.reputation_model_versions, public.reputation_events
  to authenticated;

-- Deliberately small direct-mutation surface.
grant insert (user_id, post_id) on public.favorites to authenticated;
grant delete on public.favorites to authenticated;
grant insert (post_id, author_id, parent_comment_id, body) on public.comments to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant update (full_name, class_id, avatar_file_id, show_name, show_class) on public.profiles to authenticated;
grant update (student_reference_code, contact_email, phone, show_email, show_phone, face_file_id) on public.profile_private to authenticated;

-- No browser role receives direct privileges on private tables.
revoke all on all tables in schema private from public, anon, authenticated;

-- Sequences/identity objects in private remain inaccessible to browser roles.
revoke all on all sequences in schema private from public, anon, authenticated;
