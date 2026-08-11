# Checkpoint 3C — PostgreSQL Schema Contract + Constraints + Index/RLS Blueprint

## Status

**Design candidate for project-owner acceptance. No Supabase project/database has been created and no SQL has been executed.**

This checkpoint turns the accepted 3B ERD into a physical PostgreSQL contract. It is intentionally detailed enough that the later migration files can be generated mechanically, while still keeping implementation separate from design approval.

The Phase 1 UI/UX/legacy routes and Phase 2 repository contracts remain frozen.

---

## 1. Physical-design principles

1. **Business identifiers use UUID.** Application tables use `uuid` primary keys; Auth identity is `auth.users.id`.
2. **Email is never a relational identity key.** User-owned rows relate to the Auth UUID/profile UUID only.
3. **Money is integer VND in V1.** Monetary columns use `bigint` and must be non-negative. No floating-point money.
4. **Time is timezone-aware.** Operational timestamps use `timestamptz` and are stored/compared as absolute instants.
5. **Mutable current state + append history.** Fast current-state columns may be updated, but material workflow changes append domain history and security audit records.
6. **No broad client hard delete.** Material records are retained/soft-deactivated; hard delete is reserved for safe joins or controlled retention jobs.
7. **Closed vocabularies use `text + CHECK` in V1, not PostgreSQL ENUM.** This keeps competition/pilot iteration safer while still rejecting invalid values. Stable role codes remain seeded relational data.
8. **RLS is authoritative.** Frontend role checks are presentation only.
9. **Privileges and RLS are separate layers.** A role must have object privilege *and* satisfy row policy.
10. **Views/functions are explicit API contracts.** Normalized tables are not sent directly to every React page.
11. **Private schema is not browser-exposed.** Audit, analytics, migration provenance and security helpers stay outside the normal Data API exposure.
12. **Indexes follow measured query patterns.** Baseline indexes cover known frozen UI flows; later indexes require `EXPLAIN (ANALYZE, BUFFERS)` evidence.

---

## 2. PostgreSQL conventions

### 2.1 Identifier and timestamp defaults

For app-owned UUID entities, the later migration should use:

```text
id uuid primary key default gen_random_uuid()
```

For append-heavy internal telemetry tables, `bigint generated always as identity` is preferred.

Common timestamps:

```text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```

`updated_at` will later be maintained by one trusted database trigger function, not by trusting client timestamps.

### 2.2 Text length contracts

PostgreSQL `text` is used instead of arbitrary `varchar(n)` unless the length itself is a business/security constraint. Length constraints are named `CHECK` constraints.

Baseline limits:

| Field | Contract |
|---|---:|
| School code | 2–32 chars |
| School/class label | 1–64 chars |
| Full name | 1–120 chars |
| Post title | 5–160 chars |
| Post description | 10–5000 chars |
| Comment body | 1–2000 chars |
| Report description | 0–3000 chars |
| Case summary | 5–500 chars |
| Case/update body | 0–5000 chars |
| Moderation/verification note | 0–5000 chars |
| Notification title | 1–160 chars |
| Notification body | 1–2000 chars |

These are abuse/safety limits, not redesign decisions.

### 2.3 Status representation

V1 deliberately uses `text NOT NULL` plus named checks, for example conceptually:

```text
moderation_status text not null
  check (moderation_status in ('pending','approved','rejected'))
```

This is preferred to PostgreSQL ENUM for EDU SHARE+ V1 because the approved workflows are still evolving and status additions should not require enum-type surgery. The allowed sets remain schema-controlled.

---

## 3. Exact table contract — identity and school scope

### 3.1 `public.schools`

| Column | Type / nullability | Rule |
|---|---|---|
| `id` | uuid PK | generated UUID |
| `code` | text NOT NULL | unique, normalized uppercase/lowercase policy decided in seed |
| `name` | text NOT NULL | 2–160 chars |
| `is_active` | boolean NOT NULL | default true |
| `created_at` | timestamptz NOT NULL | default now |
| `updated_at` | timestamptz NOT NULL | default now |

Constraints:

- unique `code`;
- no physical delete while referenced (`ON DELETE RESTRICT`).

### 3.2 `public.school_classes`

| Column | Type / nullability |
|---|---|
| `id` uuid PK |
| `school_id` uuid NOT NULL FK -> schools |
| `label` text NOT NULL |
| `grade_level` smallint NULL |
| `academic_year` text NOT NULL |
| `is_active` boolean NOT NULL default true |
| timestamps |

Constraints:

- `grade_level IS NULL OR grade_level BETWEEN 1 AND 12`;
- unique `(school_id, label, academic_year)`;
- school delete RESTRICT.

### 3.3 `public.file_objects`

Created early because profile/post/evidence records reference it.

| Column | Type / nullability |
|---|---|
| `id` uuid PK |
| `owner_id` uuid NULL FK -> profiles (deferred creation order handled by migrations) |
| `bucket` text NOT NULL |
| `storage_path` text NOT NULL UNIQUE |
| `purpose` text NOT NULL |
| `visibility` text NOT NULL |
| `mime_type` text NOT NULL |
| `size_bytes` bigint NOT NULL |
| `sha256` text NULL |
| `width` integer NULL |
| `height` integer NULL |
| `created_at` timestamptz NOT NULL |
| `deleted_at` timestamptz NULL |

Allowed purposes:

`avatar | face_private | post_media | verification_evidence | case_evidence`

Allowed visibility:

`public | private | restricted`

Constraints:

- `size_bytes > 0`;
- image dimensions are both null or both positive;
- `storage_path` unique;
- purpose/visibility compatibility enforced: `face_private`, verification evidence and case evidence cannot be `public`;
- general hard maximum 20 MiB in metadata; upload layer may be stricter by purpose;
- allowed image MIME: JPEG, PNG, WEBP; evidence may additionally allow PDF only when the later Storage policy explicitly enables it.

### 3.4 `public.profiles`

| Column | Type / nullability |
|---|---|
| `user_id` uuid PK/FK -> auth.users.id |
| `school_id` uuid NOT NULL FK -> schools |
| `class_id` uuid NULL FK -> school_classes |
| `full_name` text NOT NULL |
| `account_status` text NOT NULL default `pending_review` |
| `avatar_file_id` uuid NULL FK -> file_objects |
| `show_name` boolean NOT NULL default true |
| `show_class` boolean NOT NULL default true |
| `reputation_score_cache` numeric(6,2) NOT NULL default 0 |
| `reputation_label_cache` text NOT NULL default `Mới` |
| `reputation_model_version_id` uuid NULL (FK added with reputation wave) |
| timestamps |

Allowed account status:

`pending_review | approved | rejected | suspended`

Constraints:

- `reputation_score_cache BETWEEN 0 AND 10` for the current frozen `/10` UI;
- `class_id`, when present, must belong to the same school. This cross-table invariant is enforced by a trusted function/trigger or by carrying a composite school/class FK in the physical migration;
- Auth user delete **RESTRICT**, not broad cascade. Account removal is a controlled workflow.

### 3.5 `public.profile_private`

| Column | Type / nullability |
|---|---|
| `user_id` uuid PK/FK -> profiles |
| `student_reference_code` text NULL |
| `contact_email` text NULL |
| `phone` text NULL |
| `show_email` boolean NOT NULL default false |
| `show_phone` boolean NOT NULL default false |
| `face_file_id` uuid NULL FK -> file_objects |
| `updated_at` timestamptz NOT NULL |

Delete behavior: `profile_private` may `ON DELETE CASCADE` from `profiles` because it contains private dependent data, but profile deletion itself is a controlled workflow.

Direct browser access is owner/staff-purpose restricted; never exposed to Guest marketplace reads.

### 3.6 `public.roles`

Seeded relational codes rather than an enum.

Required codes:

- `student`
- `teacher_moderator`
- `verification_staff`
- `admin`

`code` unique and immutable after use.

### 3.7 `public.user_roles`

| Column | Type / nullability |
|---|---|
| `id` uuid PK |
| `user_id` uuid NOT NULL FK -> profiles |
| `role_id` uuid NOT NULL FK -> roles |
| `school_id` uuid NULL FK -> schools |
| `assigned_by` uuid NULL FK -> profiles |
| `assigned_at` timestamptz NOT NULL |
| `revoked_at` timestamptz NULL |

Constraints/index:

- partial unique active assignment on `(user_id, role_id, school_id)` where `revoked_at IS NULL`;
- users cannot assign/revoke their own staff roles through browser CRUD;
- role mutation is trusted-RPC/admin only.

### 3.8 `public.account_reviews`

Status set:

`pending | approved | rejected | needs_information`

`reviewer_id` nullable until decision. `decided_at` must be non-null for terminal approved/rejected decisions. A new review attempt appends a row; old review history is not overwritten.

---

## 4. Exact table contract — marketplace

### 4.1 `public.categories`

- UUID PK;
- `code text UNIQUE NOT NULL`;
- `name text NOT NULL`;
- `parent_id uuid NULL` self FK, delete RESTRICT;
- `sort_order integer NOT NULL default 0`;
- `is_active boolean NOT NULL default true`.

Initial seed preserves frozen legacy labels.

### 4.2 `public.posts`

| Column | Type / nullability |
|---|---|
| `id` uuid PK |
| `owner_id` uuid NOT NULL FK -> profiles |
| `school_id` uuid NOT NULL FK -> schools |
| `class_id` uuid NULL FK -> school_classes |
| `category_id` uuid NOT NULL FK -> categories |
| `title` text NOT NULL |
| `description` text NOT NULL |
| `trade_type` text NOT NULL |
| `sale_price` bigint NULL |
| `moderation_status` text NOT NULL default `pending` |
| `lifecycle_status` text NOT NULL default `active` |
| `is_hidden` boolean NOT NULL default false |
| `comments_enabled` boolean NOT NULL default true |
| `published_at` timestamptz NULL |
| `completed_at` timestamptz NULL |
| `withdrawn_at` timestamptz NULL |
| `created_at` timestamptz NOT NULL |
| `updated_at` timestamptz NOT NULL |

Trade type:

`lend | give | exchange | low_price_sale`

Moderation:

`pending | approved | rejected`

Lifecycle:

`active | completed | withdrawn`

Named hard invariants:

1. low-price sale requires `sale_price > 0`;
2. all non-sale types require `sale_price IS NULL`;
3. `completed_at` is present iff lifecycle is `completed`;
4. `withdrawn_at` is present iff lifecycle is `withdrawn`;
5. `published_at` can be present only after at least one approval; material transitions are made by trusted functions;
6. title 5–160 chars, description 10–5000;
7. `sale_price` cannot be negative and V1 values are VND integer amounts.

Cross-table invariant: owner, school and class scope must be consistent. It will be enforced in trusted mutation functions and verified by automated DB tests.

### 4.3 Search contract

V1 creates a stored `tsvector` search projection over title + description using PostgreSQL's `simple` text-search configuration and a GIN index.

Reasoning:

- no third-party search service in pilot;
- no full-table download/filter in browser;
- works with indexed token search;
- Vietnamese accent-insensitive/fuzzy search may later add a benchmarked `unaccent`/`pg_trgm` strategy, but it is not silently assumed in the baseline.

### 4.4 `public.post_media`

- UUID PK;
- `post_id` FK -> posts `ON DELETE CASCADE` only because a post can only be hard-deleted by trusted maintenance;
- `file_id` FK -> file_objects `ON DELETE RESTRICT`;
- `sort_order integer NOT NULL default 0 CHECK >= 0`;
- `is_primary boolean NOT NULL default false`;
- optional `alt_text` max 300 chars.

Constraints/indexes:

- unique `(post_id, file_id)`;
- partial unique `(post_id)` where `is_primary = true` — at most one primary image.

### 4.5 `public.post_status_history`

Append-oriented. No normal UPDATE/DELETE permission.

Dimension:

`moderation | lifecycle | visibility | comments`

Actor kind:

`user | staff | system | migration`

Source:

`owner_action | moderation | automatic_rule | migration | trusted_workflow`

Index: `(post_id, created_at DESC, id DESC)`.

---

## 5. Exact table contract — interactions

### 5.1 `public.favorites`

Composite PK `(user_id, post_id)`, both FKs `ON DELETE CASCADE` because favorite is a disposable join. Index `(post_id)` supports save counts.

### 5.2 `public.comments`

| Column | Contract |
|---|---|
| `id` | uuid PK |
| `post_id` | uuid NOT NULL |
| `author_id` | uuid NOT NULL |
| `parent_comment_id` | uuid NULL |
| `body` | text NOT NULL 1–2000 chars |
| `visibility_status` | `visible | hidden | removed` |
| timestamps | created/updated/deleted |

Same-post reply invariant is **declarative**, not frontend-only:

- add `UNIQUE (id, post_id)`;
- composite FK `(parent_comment_id, post_id) -> comments(id, post_id)`.

Comments use soft removal. Author/profile delete is RESTRICT/controlled, not cascade.

### 5.3 `public.contact_events`

Initial event type: `view_contact`.

Repeated events are allowed. Owner handled columns must only be set by the post owner or trusted staff override. Indexes:

- `(post_id, created_at DESC)`;
- `(post_id, requester_id, created_at DESC)`;
- `(requester_id, created_at DESC)`.

### 5.4 `public.notifications`

Recipient-owned records. Baseline index:

- `(recipient_id, created_at DESC)`;
- partial `(recipient_id, created_at DESC) WHERE read_at IS NULL`.

Client can mark own notification read; client cannot create arbitrary notifications.

---

## 6. Exact table contract — moderation/reports

### 6.1 `public.moderation_actions`

Action set:

`approve | reject | force_hide | force_show | disable_comments | enable_comments`

Source:

`human | automatic`

Material moderation is performed by one trusted function transaction that:

1. authorizes staff scope;
2. updates current `posts` state;
3. appends `post_status_history`;
4. appends `moderation_actions`;
5. writes `private.audit_logs`;
6. creates notification when required.

No browser direct insert to this table.

### 6.2 `public.reports`

Target type:

`post | comment | user`

Status:

`open | reviewing | resolved | dismissed`

Exactly-one-target constraint:

- target `post` -> only `post_id` non-null;
- target `comment` -> only `comment_id` non-null;
- target `user` -> only `reported_user_id` non-null.

Additional constraints:

- reporter cannot report self as user target;
- terminal status requires `resolved_at`;
- report target cannot be changed after creation;
- reports are append/controlled-state, not client hard delete.

Indexes:

- `(status, created_at DESC)`;
- `(assigned_to, status, created_at DESC)`;
- target FK indexes for post/comment/reported user.

---

## 7. Exact table contract — verification

### 7.1 `public.verification_requests`

Origin:

`seller | buyer`

Status:

`requested | scheduled | checking | awaiting_information | completed | cancelled | expired`

Constraints:

- seller-origin requester must be post owner;
- buyer-origin requester must not be post owner;
- assigned verifier cannot be post owner/requester where that would create self-verification;
- terminal completion/expiry timestamps align with status;
- no request row represents `not_requested`.

Cross-table authorization/invariants are enforced by trusted functions rather than client insert.

Indexes:

- `(post_id, requested_at DESC)`;
- `(status, requested_at)`;
- `(assigned_verifier_id, status, requested_at)`.

### 7.2 `public.verification_results`

Outcome:

`verified | verified_with_note | failed | needs_more_information`

Constraints:

- `revision_no >= 1`;
- unique `(request_id, revision_no)`;
- unique `(id, request_id)` to support composite self-reference;
- `(supersedes_result_id, request_id)` references `(id, request_id)` so a revision cannot supersede a result from another request;
- verifier must be authorized and not self-verify;
- completed request/result transition happens in one trusted transaction.

### 7.3 `public.verification_evidence`

Composite consistency:

- evidence request is required;
- optional result must belong to the same request via composite FK `(result_id, request_id)`;
- file purpose must be `verification_evidence` (trusted mutation validation);
- raw evidence remains private/restricted.

---

## 8. Exact table contract — transactions

### 8.1 `public.transactions`

Status:

`initiated | awaiting_confirmation | in_progress | completed | cancelled`

Constraints:

- `owner_id <> counterparty_id`;
- owner must match post owner at transaction creation;
- `trade_type_snapshot` restricted to the same four trade types;
- `agreed_price > 0` only for low-price sale and null otherwise unless an explicit later rule permits a monetary adjustment;
- loan due/return fields are valid only for lending;
- terminal timestamps align with status;
- legacy post completion never auto-creates transaction rows.

Material status changes are RPC/transaction-event driven, not arbitrary row updates.

### 8.2 `public.transaction_events`

Append-only. Event vocabulary initially:

`initiated | accepted | owner_confirmed | counterparty_confirmed | in_progress | completed | cancelled | returned`

Index `(transaction_id, created_at, id)`.

---

## 9. Exact table contract — support/cases

### 9.1 `public.cases`

Status:

`open | reviewing | waiting_buyer | waiting_seller | resolved | dismissed`

Priority:

`low | normal | high | urgent`

The approved case types from 3B remain supported. Constraints:

- origin report is unique when present;
- at least one operational context must normally be present (`post_id`, `transaction_id`, `verification_request_id`, or origin report) unless `case_type='general_support'`;
- resolved/dismissed require `resolved_at` and resolution text according to workflow;
- assignment/status transitions are trusted operations.

Indexes:

- `(status, updated_at DESC)`;
- `(assigned_to, status, updated_at DESC)`;
- post/transaction/verification FK indexes.

### 9.2 `case_participants`, `case_updates`, `case_evidence`

- participants unique `(case_id, user_id, participant_role)`;
- case updates append-only from participants/staff under visibility rules;
- `staff_only` updates are never visible to student participants;
- evidence file purpose must be `case_evidence`;
- evidence is restricted/private.

---

## 10. Exact table contract — price estimator

### 10.1 `price_model_versions`

Status: `draft | active | retired`.

A partial unique index enforces at most one active price model in V1.

Once activated, `version_code`, parameters and core model definition are immutable. Retirement sets an end time; it does not rewrite previous estimates.

### 10.2 `price_reference_data`

Source type:

`verified_transaction | audited_legacy | manual_reference | other_approved`

Constraints:

- observed price > 0;
- original price null or > 0;
- age months null or >= 0;
- confidence weight null or between 0 and 1;
- `is_eligible` must be explicitly true before estimator can use the row;
- auto-completed legacy posts are not automatically eligible.

Index: partial `(category_id, observed_at DESC)` where `is_eligible=true`.

### 10.3 `price_estimates`

- monetary outputs `bigint`;
- confidence `low | medium | high`;
- currency `char(3)` with V1 default/check `VND`;
- required `input_snapshot jsonb` and `explanation jsonb`;
- immutable after insert except controlled administrative invalidation metadata if later needed;
- hard invariant `estimated_min >= 0 AND estimated_min <= estimated_max`.

### 10.4 `price_estimate_references`

Composite PK `(estimate_id, reference_id)` and optional non-negative `weight_used`.

This table is required for exact lineage; it is not an optimization that may be omitted.

---

## 11. Exact table contract — reputation

`reputation_model_versions` mirrors the price model lifecycle (`draft | active | retired`) with at most one active V1 model.

`reputation_events` is append-only, with a numeric `points_delta`, a model version and source provenance. Students cannot insert/update their own scoring events.

`profiles.reputation_*_cache` is refreshed only through trusted scoring logic.

---

## 12. Private operational schema

### 12.1 `private.audit_logs`

Recommended key: `bigint generated always as identity`.

No `anon`/`authenticated` direct INSERT/UPDATE/DELETE privileges. Read access is only through explicit staff functions/projections when required.

Baseline indexes:

- `(created_at DESC)`;
- `(actor_id, created_at DESC)`;
- `(entity_type, entity_id, created_at DESC)`.

### 12.2 `private.analytics_events`

Recommended key: bigint identity.

Client does not insert arbitrary JSON directly. A trusted analytics ingestion function/endpoint allowlists event names and strips unnecessary properties.

Indexes:

- `(event_name, occurred_at DESC)`;
- `(user_id, occurred_at DESC)` where user is not null;
- `(post_id, occurred_at DESC)` where post is not null.

### 12.3 `private.legacy_import_map`

Unique source identity:

`(source_name, source_entity, legacy_id)`.

Migration status:

`valid | invalid | duplicate | needs_review | inserted | skipped`.

No browser access.

---

## 13. Foreign-key / `ON DELETE` contract

Broad rule: material historical data uses `RESTRICT`/controlled anonymization rather than cascading away evidence.

| Relationship | ON DELETE |
|---|---|
| auth.users -> profiles | RESTRICT / controlled account closure |
| schools -> classes/profiles/posts | RESTRICT |
| classes -> current profile/post snapshot | SET NULL only where historical meaning remains clear; otherwise inactive rows are preferred over deletion |
| profiles -> profile_private | CASCADE after controlled profile deletion |
| profiles -> posts/comments/reports/transactions/cases/history | RESTRICT |
| roles -> user_roles | RESTRICT |
| profiles/schools/roles -> revoked role assignments | RESTRICT |
| categories -> posts | RESTRICT |
| categories -> child categories | RESTRICT |
| posts -> favorites | CASCADE |
| profiles -> favorites | CASCADE |
| posts -> post_media | CASCADE only under trusted hard delete |
| file_objects -> media/evidence/profile refs | RESTRICT |
| posts -> comments/contact/moderation/report/verification/transaction/case | RESTRICT |
| comments -> replies | RESTRICT; soft remove comments |
| transactions -> transaction_events | CASCADE only if a trusted maintenance hard delete ever occurs; operationally transactions are retained |
| cases -> participants/updates/evidence | CASCADE only under trusted retention hard delete; no client delete |
| model versions -> estimates/events | RESTRICT |
| estimates -> estimate references | CASCADE only if an invalid pre-production estimate is administratively deleted; normal estimates retained |

The actual migration will use named FK constraints and this matrix as the source of truth.

---

## 14. Index blueprint

Indexes are designed around frozen UI flows and RLS predicates.

### 14.1 Core identity/access

- `school_classes(school_id, academic_year, label)` unique;
- active role lookup: partial index on `user_roles(user_id, school_id, role_id) WHERE revoked_at IS NULL`;
- `account_reviews(user_id, submitted_at DESC)`;
- `account_reviews(status, submitted_at)` for staff queues.

### 14.2 Marketplace feed

Baseline partial indexes:

1. public feed: `(school_id, created_at DESC, id DESC)` where approved + active + not hidden;
2. category feed: `(school_id, category_id, created_at DESC, id DESC)` same predicate;
3. trade-type feed: `(school_id, trade_type, created_at DESC, id DESC)` same predicate;
4. class feed: `(school_id, class_id, created_at DESC, id DESC)` same predicate;
5. sale price: `(school_id, sale_price, created_at DESC, id DESC)` where public predicate + low-price sale;
6. owner dashboard: `(owner_id, created_at DESC, id DESC)`;
7. owner state: `(owner_id, moderation_status, lifecycle_status, created_at DESC)`;
8. GIN on stored search vector.

The application must still send explicit filters; RLS is security, not the query/filter engine.

### 14.3 Interactions/moderation

- favorites PK plus `favorites(post_id)`;
- comments `(post_id, created_at, id)` and `(parent_comment_id)`;
- contact events indexes listed above;
- unread notification partial index;
- moderation `(post_id, created_at DESC)` and `(moderator_id, created_at DESC)`;
- reports queue/assignee/target indexes.

### 14.4 Verification/cases/price/audit

Use the status+assignee/date indexes specified in sections 7–12. Do **not** add one index per possible filter combination before measurement.

### 14.5 Pagination

Marketplace and staff queues should be **keyset/cursor-ready** using deterministic ordering such as:

```text
ORDER BY created_at DESC, id DESC
```

A later repository implementation can still emulate legacy page numbers while querying the backend efficiently. Offset pagination may be tolerated for small admin/result sets, but is not the default scaling strategy for the main marketplace.

---

## 15. RLS blueprint — security model

Every browser-facing `public` table introduced in implementation must have RLS enabled before client use. If RLS is enabled and no policy permits a row, access is denied by default.

Policies should be command-specific (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) and target `anon` or `authenticated` explicitly. For user identity predicates, later SQL should prefer the optimized fixed-statement form conceptually equivalent to:

```text
(select auth.uid())
```

rather than trusting user-supplied email/user IDs.

### 15.1 Security helper functions

A non-exposed `private` schema will contain narrow boolean/security helper functions such as:

- `private.is_approved_user()`
- `private.has_role(role_code, school_id)`
- `private.can_moderate_school(school_id)`
- `private.can_verify_request(request_id)`
- `private.can_handle_case(case_id)`

If a helper must use `SECURITY DEFINER`, it must:

- have `search_path` explicitly empty/restricted;
- fully qualify referenced relations;
- return only the minimum authorization result;
- have execution privileges explicitly controlled;
- be tested for RLS recursion and scope escalation.

### 15.2 Base policy inventory

The detailed matrix is in `docs/08_SECURITY_MODEL.md`. Summary:

- Guests: public approved/active/non-hidden marketplace projections only.
- Students: own profile/private data; approved public marketplace; own posts including non-public workflow states; own favorites/comments/contact/notifications; own/request-related verification/case surfaces.
- Teacher/Moderator: school-scoped account review/moderation/report/case capabilities only.
- Verification Staff: assigned verification work and minimum related post/evidence fields; no general account/role administration.
- Admin: privileged system operations, still through explicit policies/RPCs and audit; Admin does not automatically grant research-dataset access.

### 15.3 Do not grant direct mutation for complex workflows

RLS alone should not be forced to encode multi-row transactional invariants. The following use trusted DB functions/RPC or backend operations:

- account approval/rejection;
- role assignment/revocation;
- post moderation;
- owner resubmit transition;
- post lifecycle completion/withdrawal when history/audit must be atomic;
- verification request assignment/result submission;
- transaction progression/completion;
- case assignment/status transition;
- price model activation/estimation;
- reputation recalculation;
- audit writes;
- analytics ingestion.

---

## 16. Views/projections contract

Frontend repositories should consume projection contracts rather than normalized table joins copied into every component.

Candidate API projections retained from 3B:

- `marketplace_posts_v`
- `post_detail_v`
- `owner_posts_v`
- `owner_post_detail_v`
- `saved_posts_v`
- `profile_activity_v`
- `moderation_queue_v`
- `post_metrics_v`
- `admin_dashboard_metrics_v`
- `post_current_verification_v`

Rules:

1. public projections must not leak `profile_private`, raw verification/case evidence, internal notes or hidden posts;
2. views intended to obey caller RLS should use PostgreSQL 15+ `security_invoker=true` where appropriate;
3. if a privacy-respecting projection genuinely requires privileged lookup, prefer a narrowly scoped function rather than a broad SECURITY DEFINER view;
4. grants on underlying tables/views/functions must be explicit and least-privilege;
5. repository return shapes continue to match the frozen Phase 2 interfaces.

---

## 17. Trusted function/RPC boundary inventory

This is a contract, not executable SQL yet.

| Operation | Why trusted/transactional |
|---|---|
| `register_profile_after_auth` | derive `auth.uid`, initialize pending profile safely |
| `submit_post` | derive owner/school; force pending moderation; validate price/media |
| `update_own_post` | prevent owner from editing moderation/admin fields |
| `resubmit_rejected_post` | atomically clear rejection projection, set pending, append history |
| `set_owner_post_visibility` | ownership + history |
| `complete_or_withdraw_post` | lifecycle timestamp/history/audit consistency |
| `moderate_post` | scope check + post/history/action/audit/notification atomicity |
| `create_report` | target consistency + rate/abuse checks |
| `request_verification` | seller/buyer origin invariants |
| `assign_verification` | coordinator permission + no self-verification |
| `submit_verification_result` | revision lineage + request transition + audit |
| `create_transaction` / `transition_transaction` | participants, status evidence, post relationship |
| `create_case` / `transition_case` | participant/staff scope, history and evidence |
| `estimate_price` | active model + eligible references + immutable snapshot/lineage |
| `assign_role` / `revoke_role` | privilege escalation boundary |
| `record_analytics_event` | allowlist/minimize payload |

Every SECURITY DEFINER function introduced later must default-deny execution and receive explicit grants.

---

## 18. Grants blueprint

RLS does not replace GRANT/REVOKE.

Baseline intent:

- `anon`: only approved public views/read surfaces; no private schema; no direct mutation except specifically allowed public registration/auth is handled by Auth, not app tables;
- `authenticated`: explicit SELECT/INSERT/UPDATE privileges only on tables/actions that have corresponding RLS policies; no blanket table ownership privileges;
- `service_role`/secret credentials: backend only, never browser; use only for operations that genuinely need RLS bypass;
- `private` schema: revoke ordinary browser access by default;
- function EXECUTE: revoke broadly, then grant per allowed RPC and Postgres role.

---

## 19. Required database tests before production use

When SQL is finally implemented, every critical rule requires automated tests.

### Integrity tests

- sale price invariant;
- same-post comment parent FK;
- one primary image per post;
- active role assignment uniqueness;
- report exactly-one-target;
- verification revision lineage;
- verification evidence same-request linkage;
- no self transaction;
- price min <= max;
- one active price/reputation model;
- legacy auto-complete does not generate transaction.

### RLS/authorization tests

For Guest, Student A, Student B, Teacher School A, Teacher School B, Verification Staff, Admin:

- SELECT allowed/denied rows;
- INSERT ownership spoof attempt;
- UPDATE owner_id/user_id spoof;
- moderator cross-school attempt;
- self-role escalation;
- self-verification;
- case/evidence unauthorized read;
- private profile read;
- direct audit insertion;
- hidden/rejected post leakage;
- security-definer function execution grants.

### Performance tests

- marketplace feed/filter/search with realistic row counts;
- owner dashboard state counts;
- moderation/report queues;
- notification unread query;
- RLS-on vs equivalent non-RLS benchmark in non-production;
- `EXPLAIN (ANALYZE, BUFFERS)` for critical queries;
- index usage and write overhead.

---

## 20. Implementation ordering contract

3C still does not authorize creating the database. When implementation is approved, use small migrations in this order:

1. extensions/private schema/security defaults;
2. schools/classes/file metadata/auth-linked profile core;
3. roles/user_roles/account review;
4. categories/posts/media/status history;
5. marketplace interactions;
6. moderation/reports/audit foundation;
7. RLS helpers/grants/policies;
8. compatibility projections and repository smoke tests;
9. later feature waves: verification -> transactions/cases -> price/reputation -> analytics/migration.

Each migration must be reversible in development or have an explicit forward-fix strategy before production.

---

## 21. Explicit non-goals of 3C

Checkpoint 3C does **not**:

- create Supabase;
- create PostgreSQL schemas/tables;
- execute migration SQL;
- create Auth users;
- migrate legacy users/posts;
- upload files;
- add `.env` or credentials;
- connect React to Supabase;
- deploy anything;
- claim RLS has been tested in a live database.

---

## 22. Acceptance criteria

3C is accepted when the project owner agrees that:

1. physical types and state vocabularies are appropriate;
2. money/timestamps/UUID conventions are clear;
3. PK/FK and deletion behavior preserve historical evidence;
4. cross-row invariants are classified as declarative vs trusted-function rules;
5. index plan covers frozen UI flows without premature over-indexing;
6. RLS roles/scopes match the approved permission matrix;
7. complex workflows use transactional trusted boundaries rather than frontend security;
8. private student/evidence/audit data is structurally separated;
9. database implementation can be generated from this contract without redesigning the UI.

---

## 23. Primary documentation references used for the blueprint

- PostgreSQL — Constraints: https://www.postgresql.org/docs/current/ddl-constraints.html
- PostgreSQL — Row Security Policies: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- PostgreSQL — CREATE INDEX / partial indexes: https://www.postgresql.org/docs/current/sql-createindex.html
- Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase — Securing your data/API: https://supabase.com/docs/guides/database/secure-data
- Supabase — Database Functions: https://supabase.com/docs/guides/database/functions


---

# Appendix A — Physical column dictionary

This appendix is normative for the later migration draft. `created_at` defaults to `now()` unless explicitly stated; UUID IDs default to `gen_random_uuid()` for application-owned records.

## A1. Identity/access

### `schools`
`id uuid PK`; `code text NOT NULL UNIQUE`; `name text NOT NULL`; `is_active boolean NOT NULL DEFAULT true`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`.

### `school_classes`
`id uuid PK`; `school_id uuid NOT NULL FK`; `label text NOT NULL`; `grade_level smallint NULL`; `academic_year text NOT NULL`; `is_active boolean NOT NULL DEFAULT true`; timestamps; `UNIQUE(school_id,label,academic_year)`.

### `profiles`
`user_id uuid PK/FK auth.users`; `school_id uuid NOT NULL`; `class_id uuid NULL`; `full_name text NOT NULL`; `account_status text NOT NULL`; `avatar_file_id uuid NULL`; `show_name boolean NOT NULL DEFAULT true`; `show_class boolean NOT NULL DEFAULT true`; `reputation_score_cache numeric(6,2) NOT NULL DEFAULT 0`; `reputation_label_cache text NOT NULL DEFAULT 'Mới'`; `reputation_model_version_id uuid NULL`; timestamps.

### `profile_private`
`user_id uuid PK/FK profiles`; `student_reference_code text NULL`; `contact_email text NULL`; `phone text NULL`; `show_email boolean NOT NULL DEFAULT false`; `show_phone boolean NOT NULL DEFAULT false`; `face_file_id uuid NULL`; `updated_at timestamptz NOT NULL`.

### `roles`
`id uuid PK`; `code text NOT NULL UNIQUE`; `name text NOT NULL`; `description text NULL`; `created_at timestamptz NOT NULL`.

### `user_roles`
`id uuid PK`; `user_id uuid NOT NULL`; `role_id uuid NOT NULL`; `school_id uuid NULL`; `assigned_by uuid NULL`; `assigned_at timestamptz NOT NULL`; `revoked_at timestamptz NULL`.

### `account_reviews`
`id uuid PK`; `user_id uuid NOT NULL`; `reviewer_id uuid NULL`; `status text NOT NULL`; `reason text NULL`; `submitted_at timestamptz NOT NULL`; `decided_at timestamptz NULL`.

## A2. Marketplace

### `categories`
`id uuid PK`; `code text NOT NULL UNIQUE`; `name text NOT NULL`; `parent_id uuid NULL`; `sort_order integer NOT NULL DEFAULT 0`; `is_active boolean NOT NULL DEFAULT true`; timestamps.

### `posts`
`id uuid PK`; `owner_id uuid NOT NULL`; `school_id uuid NOT NULL`; `class_id uuid NULL`; `category_id uuid NOT NULL`; `title text NOT NULL`; `description text NOT NULL`; `trade_type text NOT NULL`; `sale_price bigint NULL`; `moderation_status text NOT NULL DEFAULT 'pending'`; `lifecycle_status text NOT NULL DEFAULT 'active'`; `is_hidden boolean NOT NULL DEFAULT false`; `comments_enabled boolean NOT NULL DEFAULT true`; `published_at timestamptz NULL`; `completed_at timestamptz NULL`; `withdrawn_at timestamptz NULL`; `search_tsv tsvector` stored/generated in migration; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`.

### `post_media`
`id uuid PK`; `post_id uuid NOT NULL`; `file_id uuid NOT NULL`; `sort_order integer NOT NULL DEFAULT 0`; `is_primary boolean NOT NULL DEFAULT false`; `alt_text text NULL`; `created_at timestamptz NOT NULL`.

### `post_status_history`
`id uuid PK`; `post_id uuid NOT NULL`; `dimension text NOT NULL`; `old_value text NULL`; `new_value text NOT NULL`; `actor_id uuid NULL`; `actor_kind text NOT NULL`; `reason text NULL`; `source text NOT NULL`; `created_at timestamptz NOT NULL`.

## A3. Interactions

### `favorites`
`user_id uuid NOT NULL`; `post_id uuid NOT NULL`; `created_at timestamptz NOT NULL`; composite PK `(user_id,post_id)`.

### `comments`
`id uuid PK`; `post_id uuid NOT NULL`; `author_id uuid NOT NULL`; `parent_comment_id uuid NULL`; `body text NOT NULL`; `visibility_status text NOT NULL DEFAULT 'visible'`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`; `deleted_at timestamptz NULL`; plus `UNIQUE(id,post_id)` for same-post parent FK.

### `contact_events`
`id uuid PK`; `post_id uuid NOT NULL`; `requester_id uuid NOT NULL`; `event_type text NOT NULL DEFAULT 'view_contact'`; `created_at timestamptz NOT NULL`; `owner_handled_at timestamptz NULL`; `owner_handled_by uuid NULL`.

### `notifications`
`id uuid PK`; `recipient_id uuid NOT NULL`; `type text NOT NULL`; `title text NOT NULL`; `body text NOT NULL`; `entity_type text NULL`; `entity_id uuid NULL`; `read_at timestamptz NULL`; `created_at timestamptz NOT NULL`.

## A4. Moderation/reporting

### `moderation_actions`
`id uuid PK`; `post_id uuid NOT NULL`; `status_history_id uuid NULL UNIQUE`; `moderator_id uuid NULL`; `action text NOT NULL`; `reason text NULL`; `source text NOT NULL`; `rule_version text NULL`; `created_at timestamptz NOT NULL`.

### `reports`
`id uuid PK`; `reporter_id uuid NOT NULL`; `target_type text NOT NULL`; `post_id uuid NULL`; `comment_id uuid NULL`; `reported_user_id uuid NULL`; `reason_code text NOT NULL`; `description text NULL`; `status text NOT NULL DEFAULT 'open'`; `assigned_to uuid NULL`; `resolution_note text NULL`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`; `resolved_at timestamptz NULL`.

## A5. Verification

### `verification_requests`
`id uuid PK`; `post_id uuid NOT NULL`; `requester_id uuid NOT NULL`; `request_origin text NOT NULL`; `status text NOT NULL DEFAULT 'requested'`; `assigned_verifier_id uuid NULL`; `requested_at timestamptz NOT NULL`; `scheduled_at timestamptz NULL`; `location_note text NULL`; `completed_at timestamptz NULL`; `expired_at timestamptz NULL`; `updated_at timestamptz NOT NULL`.

### `verification_results`
`id uuid PK`; `request_id uuid NOT NULL`; `verifier_id uuid NOT NULL`; `revision_no integer NOT NULL`; `supersedes_result_id uuid NULL`; `outcome text NOT NULL`; `scope_checked jsonb NOT NULL DEFAULT '{}'::jsonb`; `notes text NULL`; `inspected_at timestamptz NOT NULL`; `valid_until timestamptz NULL`; `created_at timestamptz NOT NULL`; `UNIQUE(request_id,revision_no)`; `UNIQUE(id,request_id)`.

### `verification_evidence`
`id uuid PK`; `request_id uuid NOT NULL`; `result_id uuid NULL`; `file_id uuid NOT NULL`; `uploaded_by uuid NOT NULL`; `caption text NULL`; `created_at timestamptz NOT NULL`.

## A6. Transactions

### `transactions`
`id uuid PK`; `post_id uuid NOT NULL`; `owner_id uuid NOT NULL`; `counterparty_id uuid NOT NULL`; `origin_contact_event_id uuid NULL`; `trade_type_snapshot text NOT NULL`; `agreed_price bigint NULL`; `agreed_terms text NULL`; `status text NOT NULL DEFAULT 'initiated'`; `loan_due_at timestamptz NULL`; `returned_at timestamptz NULL`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`; `completed_at timestamptz NULL`; `cancelled_at timestamptz NULL`.

### `transaction_events`
`id uuid PK`; `transaction_id uuid NOT NULL`; `actor_id uuid NULL`; `event_type text NOT NULL`; `note text NULL`; `metadata jsonb NOT NULL DEFAULT '{}'::jsonb`; `created_at timestamptz NOT NULL`.

## A7. Cases

### `cases`
`id uuid PK`; `case_type text NOT NULL`; `opened_by uuid NOT NULL`; `assigned_to uuid NULL`; `origin_report_id uuid NULL UNIQUE`; `post_id uuid NULL`; `transaction_id uuid NULL`; `verification_request_id uuid NULL`; `status text NOT NULL DEFAULT 'open'`; `priority text NOT NULL DEFAULT 'normal'`; `summary text NOT NULL`; `resolution text NULL`; `created_at timestamptz NOT NULL`; `updated_at timestamptz NOT NULL`; `resolved_at timestamptz NULL`.

### `case_participants`
`case_id uuid NOT NULL`; `user_id uuid NOT NULL`; `participant_role text NOT NULL`; `joined_at timestamptz NOT NULL`; composite PK `(case_id,user_id,participant_role)`.

### `case_updates`
`id uuid PK`; `case_id uuid NOT NULL`; `actor_id uuid NOT NULL`; `update_type text NOT NULL`; `visibility text NOT NULL`; `body text NULL`; `from_status text NULL`; `to_status text NULL`; `created_at timestamptz NOT NULL`.

### `case_evidence`
`id uuid PK`; `case_id uuid NOT NULL`; `file_id uuid NOT NULL`; `uploaded_by uuid NOT NULL`; `caption text NULL`; `created_at timestamptz NOT NULL`.

## A8. Price/reputation

### `price_model_versions`
`id uuid PK`; `version_code text NOT NULL UNIQUE`; `status text NOT NULL`; `name text NOT NULL`; `description text NOT NULL`; `parameters jsonb NOT NULL`; `effective_from timestamptz NULL`; `effective_to timestamptz NULL`; `created_by uuid NULL`; `created_at timestamptz NOT NULL`.

### `price_reference_data`
`id uuid PK`; `category_id uuid NOT NULL`; `source_type text NOT NULL`; `source_label text NOT NULL`; `observed_price bigint NOT NULL`; `original_price bigint NULL`; `condition_level text NULL`; `age_months integer NULL`; `observed_at timestamptz NULL`; `confidence_weight numeric(6,5) NULL`; `metadata jsonb NOT NULL DEFAULT '{}'::jsonb`; `is_eligible boolean NOT NULL DEFAULT false`; `created_at timestamptz NOT NULL`.

### `price_estimates`
`id uuid PK`; `requested_by uuid NOT NULL`; `post_id uuid NULL`; `model_version_id uuid NOT NULL`; `input_snapshot jsonb NOT NULL`; `estimated_min bigint NOT NULL`; `estimated_max bigint NOT NULL`; `confidence text NOT NULL`; `explanation jsonb NOT NULL`; `seller_price_snapshot bigint NULL`; `currency char(3) NOT NULL DEFAULT 'VND'`; `created_at timestamptz NOT NULL`.

### `price_estimate_references`
`estimate_id uuid NOT NULL`; `reference_id uuid NOT NULL`; `weight_used numeric(12,8) NULL`; composite PK `(estimate_id,reference_id)`.

### `reputation_model_versions`
`id uuid PK`; `version_code text NOT NULL UNIQUE`; `status text NOT NULL`; `rules jsonb NOT NULL`; `description text NOT NULL`; `created_at timestamptz NOT NULL`.

### `reputation_events`
`id uuid PK`; `user_id uuid NOT NULL`; `model_version_id uuid NOT NULL`; `event_type text NOT NULL`; `points_delta numeric(8,2) NOT NULL`; `source_type text NULL`; `source_id uuid NULL`; `reason text NOT NULL`; `created_at timestamptz NOT NULL`.

## A9. Files/private ops

### `file_objects`
`id uuid PK`; `owner_id uuid NULL`; `bucket text NOT NULL`; `storage_path text NOT NULL UNIQUE`; `purpose text NOT NULL`; `visibility text NOT NULL`; `mime_type text NOT NULL`; `size_bytes bigint NOT NULL`; `sha256 text NULL`; `width integer NULL`; `height integer NULL`; `created_at timestamptz NOT NULL`; `deleted_at timestamptz NULL`.

### `private.audit_logs`
`id bigint GENERATED ALWAYS AS IDENTITY PK`; `actor_id uuid NULL`; `actor_role_snapshot text NULL`; `action text NOT NULL`; `entity_type text NOT NULL`; `entity_id uuid NULL`; `before_state jsonb NULL`; `after_state jsonb NULL`; `source text NOT NULL`; `metadata jsonb NOT NULL DEFAULT '{}'::jsonb`; `created_at timestamptz NOT NULL`.

### `private.analytics_events`
`id bigint GENERATED ALWAYS AS IDENTITY PK`; `user_id uuid NULL`; `session_id uuid NULL`; `event_name text NOT NULL`; `post_id uuid NULL`; `properties jsonb NOT NULL DEFAULT '{}'::jsonb`; `occurred_at timestamptz NOT NULL`.

### `private.legacy_import_map`
`id uuid PK`; `source_name text NOT NULL`; `source_entity text NOT NULL`; `legacy_id text NOT NULL`; `target_entity text NOT NULL`; `target_id uuid NULL`; `status text NOT NULL`; `issue_detail jsonb NULL`; `created_at timestamptz NOT NULL`; `UNIQUE(source_name,source_entity,legacy_id)`.

---

# Appendix B — Constraint ownership classification

| Invariant | Enforcement owner |
|---|---|
| price positive/nullable by trade type | database CHECK |
| one favorite/user/post | PK/UNIQUE |
| one primary media/post | partial UNIQUE index |
| comment parent belongs same post | composite FK |
| report target consistency | database CHECK |
| estimate min <= max | database CHECK |
| model one-active rule | partial UNIQUE index |
| role active assignment uniqueness | partial UNIQUE index |
| owner/session identity | RLS + trusted function |
| class belongs post/profile school | composite FK if practical + trusted mutation validation |
| owner cannot self-verify | trusted function + tests |
| verifier assignment scope | trusted function/RLS helper |
| transaction owner matches post owner | trusted function |
| workflow status transition validity | trusted function |
| append history + audit atomicity | transaction/RPC |
| evidence file purpose matches domain | trusted function/storage policy |
| public privacy-safe seller fields | projection contract + grants/RLS |

