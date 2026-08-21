# EDU SHARE+ Core Platform V2 — Architecture Specification

**Date:** 2026-08-21  
**Status:** Approved baseline  
**Cost policy:** Free-tier-first

## 1. Purpose

EDU SHARE+ V2 replaces the operational Google Apps Script/Google Sheets generation with React, Vite, TypeScript, Git/GitHub, Supabase Auth, PostgreSQL, RLS, and Supabase Storage. Legacy operational data remains frozen as research/history and is not migrated. Students register again when V2 launches.

The first priority is a working, secure, maintainable website on free/open tooling. Price estimation, reputation, recommendation, and research algorithms come only after the operational Core works end-to-end on real V2 data.

## 2. Approved decisions

1. One EDU SHARE+ network serves multiple schools; each school is a logical tenant, not a separate Supabase server.
2. Marketplace access requires a valid Auth session, confirmed email, approved account, and verified current school membership.
3. School marketplace visibility may later be `school` or `network`, but teacher authority is always school-scoped.
4. Student registration always requires email verification.
5. The school's private roster is the primary automatic school-membership verification source.
6. Automatic roster matching uses school + normalized class + normalized phone. Entered name is not authorization evidence.
7. A unique unclaimed roster match may auto-approve only after email verification; canonical full name/class come from the roster.
8. No match, ambiguous match, or already-claimed match routes to teacher review.
9. One roster entry may have only one active account claim; one user may have only one active roster claim. Claim history is auditable.
10. `account_status` and current school-membership status are separate.
11. Teacher/account/post/roster writes use narrow trusted workflows; browser UI controls are not authorization.
12. Storage buckets are private; no public product-media bucket.
13. Contact information is private and is revealed only through a trusted audited workflow.
14. Runtime mock repositories are temporary and must be removed from core production flows by Phase 5J.
15. No service-role or Supabase secret key may appear in Vite/browser code.
16. Core functionality must work on Supabase Free Plan. Paid-only platform features are optional and cannot block a Core release unless the project policy is explicitly changed.

## 3. Existing baseline to preserve

Current useful foundations include:

- `schools`, `school_classes`, `profiles`, `profile_private`, `roles`, `user_roles`, `account_reviews`
- `categories`, `posts`, `post_media`, `file_objects`, `post_status_history`
- `comments`, `favorites`, `contact_events`, `notifications`
- `reports`, `moderation_actions`
- private audit/analytics helpers and school-scoped authorization functions

The current frontend still constructs `createMockRepositories()` in `src/main.tsx`; real remote features move behind async services/repositories/hooks incrementally.

## 4. Trust chain

```text
Supabase Auth identity
-> confirmed email
-> verified school membership
-> approved account
-> scoped application access
-> teacher-moderated content
-> trusted interactions
-> later verified transactions
```

Mutable Auth user metadata may carry signup claims but is never authorization state.

## 5. School and membership model

Keep one current school per Core V2 student profile.

Extend `profiles` with:

- `school_membership_status`: `verified | needs_revalidation | revoked`, default `needs_revalidation`
- `membership_verification_method`: `school_roster_match | teacher_manual_review | null`
- `membership_verified_at timestamptz null`

Keep `account_status` separately:

- `pending_review`
- `approved`
- `rejected`
- `suspended`

Student protected access requires:

```text
Auth session valid
email confirmed
account_status = approved
school_membership_status = verified
active student role belongs to profiles.school_id
school is active
```

School configuration includes at minimum:

- `registration_enabled boolean default true`
- `roster_verification_enabled boolean default true`

Marketplace scope/settings are introduced in Phase 5C rather than mixed into roster work.

## 6. Private roster subsystem

Roster data lives in `private` schema and is never directly selectable by ordinary students or anonymous clients.

### `private.roster_import_batches`

Track school, academic year, source filename metadata, uploader, status (`previewed | active | archived | failed`), row counts, and timestamps. Only one batch may be active for a school at a time; activating a new batch archives the previous active batch atomically.

### `private.student_roster`

Store normalized school-supplied identity rows with:

- roster/batch ID
- school ID
- academic year
- canonical full name
- canonical class ID/name
- normalized class key
- normalized phone key
- timestamps

Do not use global phone uniqueness because siblings can share a parent phone.

### Claims

Keep active/historical roster claims explicitly so one roster entry and one user cannot participate in more than one active claim. Claim/release/reassign operations are audited.

### Normalization

Server-side normalization is authoritative. Accept common Vietnamese phone formatting such as `+84`, spaces, dots, and dashes and persist one canonical form. Invalid phone data is rejected rather than fuzzy-matched. Classes are normalized for deterministic matching while preserving the school's display label.

## 7. Roster import workflow

Teacher/admin flow:

```text
CSV/XLSX selected
-> client parses for preview
-> server validates again
-> trusted import RPC creates normalized preview batch + rows
-> teacher reviews counts/errors
-> teacher activates batch
-> previous active batch for school archived atomically
```

Raw school files do not need to be retained after import. Only normalized rows, batch metadata, counts, and audit history persist.

Import workflow must derive actor from `auth.uid()`, validate same-school teacher/admin authority, enforce a bounded row count, never accept `imported_by` from client input, and synchronize valid class labels into `school_classes`.

The first operational UI may use CSV to keep the free-tier Core dependency-light; the backend contract remains parsed-row JSON so XLSX support can be added without schema redesign.

## 8. Registration lifecycle

Student signup collects email, password, selected school, entered full name, class, and phone.

The frontend passes an explicit student registration intent plus claims to Supabase Auth. The provisioning trigger only creates EDU SHARE+ student rows for that intent; unrelated Auth identities are not automatically made students.

At signup:

- validate active/registration-enabled school
- snapshot normalized registration claims in private schema
- create profile as `pending_review`
- set school membership to `needs_revalidation`
- create private contact data and active student role
- do not approve from metadata

After email confirmation:

1. load the private registration snapshot;
2. if roster verification is enabled, inspect only the school's current active roster;
3. match normalized class + normalized phone;
4. if exactly one active eligible row exists and atomic claim succeeds, set canonical roster name/class, account approved, membership verified, method `school_roster_match`, verification timestamp, notification, account-review history, and audit;
5. otherwise keep account pending and create exactly one open teacher review with internal reason such as `roster_not_found`, `roster_ambiguous`, `roster_already_claimed`, or `roster_disabled_manual_review`.

Signup responses must not reveal whether a phone/class combination exists in a private roster.

## 9. Teacher account review

Teacher review remains restricted to the target student's school; global admin may act across schools.

Queue may show the minimum information required for verification: name, class claim, school, phone, email, email confirmation state, internal roster reason, and review history.

Existing decisions remain:

- approve
- reject
- needs information

Manual approval atomically sets:

```text
account_status = approved
school_membership_status = verified
membership_verification_method = teacher_manual_review
membership_verified_at = now()
```

Reject/needs-information do not verify school membership.

Teacher cannot read passwords, tokens, sessions, or unrelated private data.

## 10. Marketplace and post boundary

Phase 5C introduces authenticated marketplace reads with school/network scope and server-side pagination/filtering. Phase 5B only establishes the trust prerequisite and must not prematurely couple roster tables to marketplace queries.

Post moderation and lifecycle remain separate:

```text
moderation_status = pending | approved | rejected
lifecycle_status = active | completed | withdrawn
is_hidden
comments_enabled
```

Editing an approved post returns it to pending in Core V2.

## 11. Storage and privacy boundary

Later Phase 5F provisions three private buckets:

- `post-media`
- `profile-media`
- `private-evidence`

Existing `file_objects`/`post_media` metadata is evolved rather than replaced. No service-role key is used in browser code.

Contact email/phone stay in private profile data and are not ordinary marketplace fields. Future contact reveal is a trusted audited operation.

## 12. Frontend data architecture

Real remote features follow:

```text
Page / Component
-> feature hook/query state
-> feature service
-> Supabase repository/adapter
-> Supabase
```

Search/filter/pagination execute on the server/database, not by downloading complete datasets to React.

## 13. Read/write boundary

Preferred Core rule:

- safe scoped reads: direct SELECTs protected by RLS and adapters
- material/security-sensitive writes: trusted RPCs deriving actor/owner/school from `auth.uid()` and trusted profile/role data
- private schemas: no ordinary browser grants

Do not fix permission errors by granting broad UPDATE/INSERT/DELETE on sensitive tables.

## 14. Security requirements

- All exposed public app tables use RLS.
- SECURITY DEFINER functions set `search_path=''`, validate actor and school scope, and grant EXECUTE only to intended roles.
- `public.rls_auto_enable()` is not browser-executable.
- Local/hosted email confirmation behavior matches required registration flow.
- Leaked Password Protection is a Pro+ Supabase feature and is an accepted Free Plan limitation, not a Core release blocker.
- Strong password requirements, verified email, RLS, narrow RPCs, roster verification, teacher review, session lifecycle checks, and auditability form the free-tier security baseline.

## 15. Testing requirements

Every checkpoint must include applicable automated tests for happy paths and unauthorized paths plus clean migration replay.

Roster/account minimum tests:

- non-student Auth identity not auto-provisioned as student
- unconfirmed student cannot sign in
- unique roster match auto-approves only after email confirm
- no/ambiguous/claimed rows route to teacher review
- roster row cannot be double-claimed
- student/anonymous cannot access roster management RPCs
- teacher cannot operate another school's roster/account review
- manual approval verifies membership
- approved-but-unverified membership is denied protected student access
- TypeScript/build pass
- Security Advisor reviewed after DDL/RPC changes

## 16. Phase sequence

```text
5A Foundation Stabilization — PASS
5B Roster & Registration Trust Layer
5C Marketplace Read
5D Profile Backend
5E Create/Edit/My Posts
5F Storage
5G Interactions + Contact
5H Notifications + Reports
5I Teacher Post Moderation
5J Remove Runtime Mock
6A Transactions
6B Price Estimator V1
6C Reputation V2
6D Explainable Recommendation V1
7 Performance / Mobile UX / KHKT evaluation
```

## 17. Definition of Done

A checkpoint is complete only when implementation is complete, TypeScript/build passes, relevant automated tests pass, schema migrations replay from scratch, permission/RLS tests pass, unauthorized paths are verified, Supabase advisors are reviewed after database changes, docs are updated, and no new browser secret exposure is introduced.
