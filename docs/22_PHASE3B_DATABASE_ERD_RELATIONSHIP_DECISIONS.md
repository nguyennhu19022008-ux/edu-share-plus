# Checkpoint 3B — Database ERD + Relationship Decisions

## Status

**Candidate for project-owner acceptance. No database has been created.**

Checkpoint 3B converts the 3A entity audit into a concrete target ERD and relationship contract. The canonical ERD is `docs/06_DATABASE_ERD.md`.

---

## 1. Decisions finalized in 3B

### Decision 1 — One normalized post, not `Posts + Archive`

A post remains one `posts` record throughout its lifecycle. Historical terminal state is represented by lifecycle fields/history rather than moving the row to a second table.

### Decision 2 — Four post state dimensions are not collapsed

Current post state is represented through independent concepts:

- moderation status;
- lifecycle status;
- hidden/visible flag;
- comments enabled/disabled flag.

`post_status_history` stores append-oriented changes across these dimensions.

### Decision 3 — Legacy display labels are projections

The frozen UI can continue to show:

- Chờ duyệt
- Đang mở
- Từ chối
- Đã xong
- Đã thu hồi

without forcing PostgreSQL to use one overloaded status column.

### Decision 4 — Account identity is separate from student profile data

Auth credentials stay in the Auth provider. `profiles` references the Auth UUID. Private contact/student review data is isolated in `profile_private` rather than being included in ordinary public profile payloads.

### Decision 5 — Roles are scoped assignments

`roles + user_roles` supports Student, Teacher/Moderator, Verification Staff and Admin. A role assignment may be school-scoped; a teacher is not automatically a global admin.

### Decision 6 — Product verification is a request/result workflow

A post can have many verification requests over time. A request can have multiple result revisions. Raw verification evidence is private by default.

No request row represents `not_requested`; verification state is not stored in post moderation status.

### Decision 7 — Transaction is explicit evidence of an exchange

`transactions` is independent from `posts.lifecycle_status`.

Therefore a legacy post marked `Đã xong`, especially by `AUTO_OLD_POSTS_TO_DONE_2026_05`, does not automatically prove a completed transaction.

### Decision 8 — Reports and cases are different

A report can be reviewed/resolved without creating a case. A report may optionally escalate to one case. Cases can also originate independently.

### Decision 9 — Price estimates preserve lineage

Each estimate stores:

- model version;
- full input snapshot;
- min/max output;
- confidence;
- explanation;
- exact reference rows through `price_estimate_references`.

The seller-entered price remains separate.

### Decision 10 — Reputation is a versioned ledger

The existing UI reputation score is preserved as a cache/projection. Future scoring evidence lives in versioned `reputation_events`, not editable profile fields alone.

### Decision 11 — Files use object storage with database metadata

`file_objects` stores path/ownership/type/metadata only. Bytes do not live in PostgreSQL. Post, verification and case evidence tables reference file records.

### Decision 12 — Audit/analytics/migration internals are private-domain data

`private.audit_logs`, `private.analytics_events` and `private.legacy_import_map` are intentionally separated from browser-facing business tables.

---

## 2. Relationship decisions that prevent future ambiguity

| Question | 3B decision |
|---|---|
| Can one student own many posts? | Yes |
| Can one post contain many images? | Yes |
| Can a post be hidden while still `Đang mở` internally? | Yes; visibility is independent |
| Can a rejected post be edited and resubmitted? | Yes; lifecycle stays active, moderation returns to pending |
| Can a post have many verification checks over time? | Yes |
| Can a verification result be overwritten? | No; revisions are appended |
| Can a post have more than one real transaction? | Yes at schema level; feature rules may constrain active transactions by trade type |
| Does `Đã xong` prove a transaction? | No |
| Does every report create a dispute? | No |
| Can a case exist without a transaction? | Yes |
| Can a case reference a verification request? | Yes |
| Can a price estimate exist before a post is created? | Yes; `post_id` may be null |
| Can one estimate cite multiple reference observations? | Yes, N:M lineage |
| Are private evidence files public post media? | No |
| Is the current reputation score the only source of truth? | No; it becomes a cache over an event/model ledger |

---

## 3. Critical invariants carried into 3C

The SQL/constraint design must enforce or trusted-server-enforce at least:

1. sale price only exists for `low_price_sale`;
2. favorite uniqueness per user/post;
3. comment reply parent belongs to the same post;
4. report has exactly one valid target;
5. students cannot grant themselves staff roles;
6. post owner cannot self-verify a product;
7. verification result revisions cannot silently overwrite history;
8. `estimated_min <= estimated_max`;
9. user-owned writes derive identity from authenticated UUID, not request email;
10. material moderator/verification/case actions generate audit history;
11. public marketplace payload cannot expose `profile_private`, raw evidence or internal notes;
12. legacy auto-completed posts are not converted into completed transactions by default.

---

## 4. Database views are compatibility adapters, not a new UI

The normalized model will not be sent directly to every React page. Later database implementation should expose repository-friendly projections such as:

```text
marketplace_posts_v
post_detail_v
owner_posts_v
owner_post_detail_v
moderation_queue_v
post_current_verification_v
```

This keeps the Phase 1 UI and Phase 2 repository interfaces stable while backend storage becomes normalized.

---

## 5. 3B does not authorize implementation yet

Checkpoint 3B does not:

- create a Supabase project;
- create tables;
- write migration SQL;
- create RLS policies;
- connect frontend to a backend;
- upload files;
- migrate accounts or posts;
- create production data;
- deploy anything.

The next design checkpoint should translate this ERD into a physical PostgreSQL/RLS blueprint before any live database is created.

---

## 6. Proposed next checkpoint

**3C — PostgreSQL Schema Contract + Constraints + Index/RLS Blueprint**

3C should specify:

- exact SQL types/enums/domains;
- PK/FK and `ON DELETE` behavior;
- CHECK/UNIQUE constraints;
- required indexes;
- RLS policy inventory by table/action;
- security-invoker/public projections vs private schema access;
- trusted functions/RPC boundaries;
- migration ordering;
- implementation waves.

Even in 3C, SQL can remain design-only until the project owner explicitly approves creation of the actual Supabase project/database.
