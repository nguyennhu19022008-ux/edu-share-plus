# Checkpoint 3A — Database Requirements + Entity Audit

## Status

**Candidate for project-owner acceptance.**

Phase 2 is treated as **PASS & FROZEN**. Checkpoint 3A is a documentation/schema-requirements checkpoint only. It does **not** create a Supabase project, database tables, SQL migrations, RLS policies, storage buckets, authentication users, or production data.

The frozen Phase 1 UI/UX/legacy routes remain the compatibility contract.

---

## 1. Objective

Define what the future PostgreSQL data model must represent before drawing the ERD or writing SQL.

The database must support two simultaneously important goals:

1. preserve the current EDU SHARE+ behavior and user flows;
2. support the approved new capabilities: secure authentication/authorization, product verification, price estimation, dispute/support management, auditability, scalable storage, and research-oriented behavioral analytics.

The database must **not** be a 1:1 copy of the Google Sheets workbook.

---

## 2. Sources audited

### 2.1 Legacy operational workbook

The source workbook contains these operational sheets:

| Legacy sheet | Approx. non-empty data rows in audited snapshot | Meaning | 3A disposition |
|---|---:|---|---|
| `Posts` | 1,061 | Active/legacy post records | Candidate migration source after dry run only |
| `Archive` | 40 | Historical completed posts | Merge conceptually into normalized post lifecycle; no separate production archive table required by default |
| `Students` | 892 | Legacy accounts/profile/auth fields | **Do not migrate authentication accounts/passwords** |
| `Comments` | 23 | Comments/replies | Historical/reference unless identities can be safely mapped later |
| `Favorites` | 1 | Saved-post relation | Historical/reference unless identities can be mapped later |
| `ContactLogs` | 11 | Contact-information view/handled events | Historical/reference unless identities can be mapped later |
| `Reports` | 4 | Post reports | Historical/reference; new report model must be normalized |
| `CommentReports` | 0 | Comment reports | Map to unified report capability in new model |
| `Notifications` | 1,030 | Internal notifications | Do not bulk-migrate stale operational notifications by default |
| `AuditLog` | 68 | Legacy privileged/action history | Preserve as historical evidence if required; new audit log starts clean |
| `PostStats` | 1,082 | Aggregated interaction counters | Treat primarily as derived/cache data, not authoritative transactional records |
| `StatsSummary` | 21 | Aggregated platform statistics | Research/historical evidence; do not use as live source of truth |
| `PendingJobs` | 9 | Legacy background jobs | **Do not migrate** |
| `DataIssues` | 0 | Legacy data-quality log | Replace with migration validation output / staging issues |

The prior project audit also identified approximately **1,053 post records with valid ID + title** within the Posts snapshot. The distinction between non-empty spreadsheet rows and validated candidate post records must be preserved in migration reporting.

### 2.2 Frozen Phase-2 frontend contracts

The current frontend requires data for:

- public marketplace posts;
- owner posts;
- owner detail/timeline;
- student profile/privacy/reputation/activity;
- favorites;
- notifications;
- teacher/admin moderation posts and dashboard summary.

Phase 3 must design database boundaries that can later implement the Phase-2 repository interfaces without allowing pages/components to depend on Supabase directly.

### 2.3 Approved future requirements

The new data model must additionally support:

- email verification and account approval;
- backend-enforced roles and permissions;
- product moderation independent from product verification;
- buyer-requested verification and seller-requested verification;
- verification results/evidence/history;
- versioned explainable price estimates;
- reports, support cases and disputes;
- transaction/exchange history distinct from post lifecycle state;
- scalable object-storage metadata;
- immutable/append-oriented audit history;
- operational analytics separated from research datasets.

---

## 3. Critical modeling decisions from the audit

### 3.1 User identity must not use email as the primary key

Legacy Sheets frequently use email as identity. The new system must use the authentication provider's stable UUID (`user_id`) for ownership and foreign keys.

Email remains a profile/auth attribute, not the relational identity key.

### 3.2 Legacy accounts are reference data, not migration targets

The new production Auth system starts with clean registrations.

Do not bulk-create accounts from `Students`, and do not migrate:

- legacy passwords;
- password-like values;
- sessions;
- tokens;
- test accounts;
- historical login state.

Legacy account data may be kept outside the new operational database for research evidence/audit where appropriate.

### 3.3 `Posts` and `Archive` should not become two permanent tables by default

The legacy workbook separates historical records into `Archive`. PostgreSQL can represent one post record with a lifecycle state and timestamps.

A separate archive table would duplicate schema and complicate relations. The default 3A recommendation is one `posts` domain with terminal lifecycle states/history.

This recommendation changes storage structure only; it does **not** change the user-facing labels or flow.

### 3.4 Moderation state and post lifecycle should be separable internally

Legacy UI presents labels such as:

- `Chờ duyệt`
- `Đang mở`
- `Từ chối`
- `Đã xong`
- `Đã thu hồi`

For a normalized database, these labels combine two concepts:

**Moderation:** pending / approved / rejected

**Lifecycle:** active / completed / withdrawn

3A recommends storing these concepts separately and deriving the legacy-compatible display state in the service/view-model layer.

Example:

```text
moderation_status = approved
lifecycle_status  = active
=> UI label: Đang mở
```

This preserves the frozen UI while preventing future verification/dispute logic from being forced into one overloaded status column.

### 3.5 `hidden` and comment availability remain independent flags/policies

The audit confirms that hiding a post is not equivalent to completing/rejecting it, and disabling comments is not a post status.

These must remain separate concepts.

### 3.6 Product verification is a separate workflow

A post can be:

```text
moderation = approved
verification = not_requested
```

or:

```text
moderation = approved
verification = verified
```

Verification must not be implemented as another moderation status.

### 3.7 `Đã xong` cannot be treated as verified transaction evidence

The legacy data contains a large set of posts marked completed by the automatic legacy process identified by metadata such as:

`AUTO_OLD_POSTS_TO_DONE_2026_05`

Therefore:

- post lifecycle completion != confirmed buyer/seller transaction;
- legacy auto-completed records must never automatically become `transactions`;
- a new explicit transaction/exchange record is required if the research/system later needs to claim a real completed exchange.

### 3.8 Aggregate counters are derived data

Fields such as favorite count, contact-view count, comment count and report count should normally be derived from authoritative interaction records or maintained as controlled aggregates/materialized summaries.

The new system must not make imported `PostStats` rows the sole source of truth.

---

## 4. Candidate data domains and entities

This is an **entity audit**, not the final ERD. Table names and cardinalities will be finalized in Checkpoint 3B.

### A. Identity, organization and access

Candidate entities:

- `profiles`
- `roles`
- `user_roles`
- `account_reviews`
- `schools` (recommended for scale readiness)
- `school_classes` / class reference (recommended, while preserving current UI labels)

Responsibilities:

- student profile and privacy preferences;
- school/class affiliation;
- account approval state;
- role assignment;
- teacher/moderator/admin/verification-staff capabilities.

Authentication credentials remain in the dedicated Auth provider, not in `profiles`.

### B. Marketplace catalog/content

Candidate entities:

- `posts`
- `categories`
- `post_media`
- `post_status_history` or equivalent event/history representation

Responsibilities:

- current post content;
- exchange/trade type;
- optional sale price;
- category;
- owner;
- moderation/lifecycle state;
- visibility/comment settings;
- media references;
- legacy migration identifiers where applicable.

### C. Marketplace interactions

Candidate entities:

- `favorites`
- `comments`
- `contact_events`
- `notifications`

Requirements:

- favorites unique per `(user, post)`;
- comments support replies through parent relation;
- comment visibility/moderation independent of post status;
- contact views and owner-handled state remain auditable;
- notification ownership/read state enforced per recipient.

### D. Moderation and safety

Candidate entities:

- `moderation_actions`
- `reports`
- optional `moderation_rules` / rule-version metadata if automatic moderation remains enabled

Requirements:

- teacher/moderator action history;
- approve/reject reason;
- hide/show;
- comment enable/disable;
- report target may include post/comment/user as approved later;
- automatic moderation decisions must be distinguishable from human decisions.

### E. Product verification

Candidate entities:

- `verification_requests`
- `verification_results`
- `verification_evidence`
- optional `verification_appointments` if scheduling becomes a real workflow

Must support both approved flows:

```text
Buyer requests verification
```

and:

```text
Seller proactively requests verification
```

Verification result must be versioned/historical rather than overwriting previous checks.

Minimum concepts:

- requester;
- post;
- request origin (buyer/seller);
- status;
- assigned verifier;
- inspection date;
- result (`verified`, `verified_with_note`, `failed`, etc.);
- scope checked;
- notes;
- evidence;
- expiry when applicable.

The UI badge must not imply school warranty.

### F. Transactions / exchanges

Candidate entity:

- `transactions`

Purpose:

Represent an actual exchange/loan/gift/sale outcome separately from the post's visibility/lifecycle.

Minimum concepts to evaluate in 3B:

- post;
- seller/owner;
- counterparty/buyer/recipient;
- trade type;
- agreed price if applicable;
- started/completed/cancelled timestamps;
- completion confirmation mechanism;
- linkage to verification/case if applicable.

This entity is important for credible future research analytics and Price Estimator evaluation.

### G. Support, case and dispute management

Candidate entities:

- `cases`
- `case_participants`
- `case_updates` / case history
- `case_evidence`

Potential report-to-case escalation should be supported without requiring every report to become a dispute.

Approved case statuses include the semantic equivalents of:

- Open
- Reviewing
- Waiting buyer
- Waiting seller
- Resolved
- Dismissed

Cases must retain handler/action history.

### H. Price Estimator

Candidate entities:

- `price_model_versions`
- `price_estimates`
- `price_reference_data`
- optional structured input/reference child entities if JSONB alone becomes too opaque

A stored estimate must include at minimum:

- post/resource reference if applicable;
- model version;
- input snapshot;
- reference-data provenance;
- estimated minimum;
- estimated maximum;
- confidence level;
- human-readable explanation;
- created timestamp.

The seller's final price remains independent from the estimate.

The model must later support evaluation against trustworthy outcome/reference data. Legacy auto-completed posts are not automatically trustworthy transaction-price labels.

### I. Storage metadata

Candidate concepts/entities:

- object metadata associated with `post_media`;
- verification evidence objects;
- case/dispute evidence objects;
- profile avatar;
- private face/identity-verification image where required.

Files themselves belong in object storage, not PostgreSQL/base64.

Database records must retain enough metadata to enforce ownership, privacy, cleanup and orphan detection.

### J. Audit and operational analytics

Candidate entities:

- `audit_logs`
- `analytics_events`
- optional aggregate/daily metric tables or materialized views

Audit log and analytics are different:

**Audit:** who performed a privileged or material state-changing action.

**Analytics:** behavioral/product events used for operational metrics and approved research analysis.

### K. Research-data boundary

Historical surveys and KHKT evidence are **not ordinary production entities**.

Default rule:

```text
Research historical data
        !=
New operational database
```

The operational database may store privacy-minimized analytics events needed to create later research extracts, but raw historical survey workbooks should not be imported merely because a database exists.

If research snapshots/exports are later recorded in the system, they must carry provenance/version/date definitions and must not overwrite historical evidence.

---

## 5. Legacy-to-new data classification

| Legacy data | Default classification | Reason |
|---|---|---|
| Student auth/password/session data | **DO NOT MIGRATE** | New Auth starts clean; avoids insecure/obsolete credentials |
| Student profile list | Historical/reference only by default | New users register again |
| Posts | **MAY MIGRATE AFTER AUDIT** | Useful history/content, but quality/ownership needs review |
| Archive posts | **MAY MIGRATE AFTER AUDIT** | Merge into normalized post history/lifecycle if retained |
| Categories/configuration | Candidate migration/config seed | Low identity dependency |
| Images | Candidate migration only with retained posts and asset audit | Must be optimized/rehosted safely |
| Comments | Historical/reference by default | Legacy identities may not map to new Auth users |
| Favorites | Historical/reference by default | Same identity mapping issue |
| ContactLogs | Historical/reference/research evidence by default | Contains user interaction identity data |
| Reports / CommentReports | Historical evidence by default | New safety system starts with clean operational cases |
| Notifications | Do not bulk-migrate | Stale operational messages should not reappear for new accounts |
| AuditLog | Historical audit evidence | New audit sequence starts independently |
| PostStats | Derived/historical | Counters should be rebuilt from authoritative new events |
| StatsSummary | Research/historical evidence | Not live operational truth |
| PendingJobs | **DO NOT MIGRATE** | Legacy runtime work queue |
| DataIssues | Migration tooling reference | Replace by explicit migration dry-run issue output |
| Survey datasets | **RESEARCH EVIDENCE ONLY** | Must remain distinct from operational DB |

---

## 6. Core database invariants required before SQL

### Identity

- Every operational user-owned record uses stable Auth UUIDs.
- Client-supplied email/name must never establish authorization.
- Roles are backend-enforced.

### Posts

- Every post has one owner.
- Sale price must follow trade-type rules.
- Hidden/visible state is independent from moderation/lifecycle.
- Comment availability is independent from moderation/lifecycle.
- Terminal lifecycle states cannot silently become transaction proof.

### Favorites

- At most one active favorite relation per `(user_id, post_id)`.

### Comments

- Reply parent must belong to the same post.
- Hidden/moderated comments remain auditable according to retention policy.

### Contact events

- Viewer/requester identity comes from Auth.
- Repeated views may be logged, while unique-view metrics are derived separately.
- Owner's “handled/contacted back” action must be distinguishable from the original contact-view event.

### Moderation

- Students cannot approve/reject their own posts.
- A moderation change stores actor, timestamp, previous/new state and reason where required.
- Automatic and human moderation are distinguishable.

### Verification

- Product owner cannot self-verify.
- Verification outcome stores verifier, scope, time, notes and evidence where applicable.
- Verification history is not silently overwritten.

### Price estimator

- Every estimate stores model version and input snapshot.
- Estimate does not overwrite seller-entered price.
- Confidence/explanation are persisted.

### Cases

- Case status transitions and handlers are auditable.
- Evidence access is restricted to authorized participants/staff.

### Audit

- Privileged/material changes create audit records.
- Audit records are not editable by ordinary users.

### Research/analytics

- Operational analytics does not silently redefine historical KHKT metrics.
- Research datasets are never fabricated from current production counts.

---

## 7. Time, identifier and provenance requirements

Recommended conventions for 3B:

- UUID primary keys for new operational entities;
- nullable `legacy_id` only where migration traceability is necessary;
- `timestamptz` for server timestamps;
- storage in UTC with Vietnamese local-time formatting in UI;
- `created_at` / `updated_at` consistently defined;
- actor/source metadata for automated actions;
- algorithm/rule version metadata for moderation and price estimation where relevant.

Legacy ID values must not be reused as Auth identities.

---

## 8. Query and performance requirements that shape the ERD

The schema must support indexed queries for the frozen UI without loading the whole dataset.

### Marketplace

Needs efficient filtering/order by combinations of:

- moderation/lifecycle visibility;
- hidden state;
- trade type;
- category;
- class/school scope;
- created date;
- price;
- textual search.

Pagination must be database-backed. Cursor/keyset pagination should be considered for large datasets.

### Owner dashboard

Needs indexed owner + status + date queries and fast aggregate counts.

### Admin moderation

Needs moderation status, report count/priority, date and school/class filters.

### Notifications

Needs recipient + unread + created date.

### Verification

Needs status + post + requester + assignee + created date.

### Cases

Needs status + assigned handler + participant + updated date.

### Analytics

Raw events must not become an unbounded table scanned for every dashboard request. Aggregation/materialization strategy will be designed later.

---

## 9. RLS / authorization requirements for 3B/3C

Database design must be compatible with backend-enforced policies such as:

### Guest

- read only public, approved, active, non-hidden marketplace content;
- see only profile fields explicitly permitted for public display.

### Student

- update own profile under allowed field rules;
- create own posts;
- edit own posts only under allowed workflow states;
- favorite/comment/contact/report as self;
- view own private notifications;
- request verification;
- create/access cases where participant.

### Teacher / Moderator

- moderation/account-review permissions according to assigned capability;
- no reliance on frontend role checks.

### Verification Staff

- access assigned verification requests/evidence and submit verification results;
- does not automatically receive full platform admin rights.

### Admin

- role/permission administration and broader operational access;
- privileged actions still audited.

The detailed matrix is maintained in `docs/05_PERMISSION_MATRIX.md`.

---

## 10. Data that must not be exposed to the public marketplace payload

At minimum, public marketplace queries must not leak:

- password/auth secrets;
- private student email unless privacy policy explicitly permits it;
- private phone/contact fields before authorized contact flow;
- face-verification image;
- internal moderation notes;
- verification evidence not approved for public display;
- case/dispute evidence;
- private audit details;
- service-role/server secrets.

Public post view-models should be deliberately projected rather than `select *` from ownership/profile tables.

---

## 11. Open design decisions for Checkpoint 3B

The following should be resolved while drawing the ERD rather than guessed in SQL:

1. **School/class normalization:** exact `schools` / `school_classes` structure while preserving current free-text-looking UI.
2. **Role model:** role table + user-role join versus a simpler constrained role model; recommendation is capability-friendly many-to-many because Teacher/Moderator/Verification Staff responsibilities may overlap.
3. **Post state representation:** exact moderation/lifecycle enums and legacy-display mapping.
4. **Explicit transaction confirmation:** whether one-side or two-side confirmation is required to count a real completed exchange.
5. **Unified reports:** exact target modeling for post/comment/user without weak referential integrity.
6. **Case escalation:** relationship between a report and one or more support/dispute cases.
7. **Verification scheduling:** whether appointment/schedule is an entity in v1 or represented by request timestamps/notes.
8. **Price input storage:** typed columns versus JSONB snapshot + selected indexed fields.
9. **Analytics event identity/privacy:** exact pseudonymization/retention policy and which events are necessary for research.
10. **Legacy post ownership:** how retained historical posts behave when the old owner has not re-registered.

No migration or SQL implementation should begin before these decisions are represented in the ERD/design document.

---

## 12. Exit criteria for Checkpoint 3A

3A is PASS when the project owner accepts that:

- legacy Sheets have been classified;
- old accounts are explicitly excluded from Auth migration;
- post lifecycle is distinguished from real transaction evidence;
- moderation is separate from product verification;
- candidate entities cover the frozen frontend and approved new workflows;
- operational data is separated from historical research evidence;
- RLS requirements are identified before schema implementation;
- no database/project has yet been created.

After 3A acceptance, proceed to **Checkpoint 3B — Database ERD + Relationship Decisions**.
