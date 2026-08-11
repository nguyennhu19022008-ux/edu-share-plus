-- EDU SHARE+ / CHECKPOINT 3D
-- OFFLINE DRAFT ONLY — DO NOT EXECUTE ON A LIVE DATABASE YET.
-- Source of truth: docs/23_PHASE3C_POSTGRESQL_SCHEMA_CONTRACT.md
-- This draft has not been executed against Supabase/PostgreSQL in this checkpoint.


-- Read-only/introspection assertions intended for the later local Supabase/Postgres test run.
-- Each block raises if a critical security/schema property is missing.

do $$
declare missing_count integer;
begin
  select count(*) into missing_count
  from (values
    ('schools'),('school_classes'),('file_objects'),('profiles'),('profile_private'),('roles'),('user_roles'),('account_reviews'),
    ('categories'),('posts'),('post_media'),('post_status_history'),('favorites'),('comments'),('contact_events'),('notifications'),
    ('moderation_actions'),('reports'),('verification_requests'),('verification_results'),('verification_evidence'),
    ('transactions'),('transaction_events'),('cases'),('case_participants'),('case_updates'),('case_evidence'),
    ('price_model_versions'),('price_reference_data'),('price_estimates'),('price_estimate_references'),
    ('reputation_model_versions'),('reputation_events')
  ) expected(name)
  where not exists (
    select 1 from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=expected.name and c.relkind='r'
  );
  if missing_count <> 0 then
    raise exception 'EDU SHARE+ schema assertion failed: % required public tables missing', missing_count;
  end if;
end $$;

do $$
declare bad_count integer;
begin
  select count(*) into bad_count
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname in ('schools','school_classes','file_objects','profiles','profile_private','roles','user_roles','account_reviews','categories','posts','post_media','post_status_history','favorites','comments','contact_events','notifications','moderation_actions','reports','verification_requests','verification_results','verification_evidence','transactions','transaction_events','cases','case_participants','case_updates','case_evidence','price_model_versions','price_reference_data','price_estimates','price_estimate_references','reputation_model_versions','reputation_events')
    and not c.relrowsecurity;
  if bad_count <> 0 then
    raise exception 'EDU SHARE+ security assertion failed: % browser-facing tables do not have RLS enabled', bad_count;
  end if;
end $$;

do $$
begin
  if has_table_privilege('anon', 'private.audit_logs', 'SELECT')
     or has_table_privilege('authenticated', 'private.audit_logs', 'INSERT') then
    raise exception 'EDU SHARE+ security assertion failed: private.audit_logs browser privilege detected';
  end if;
end $$;
