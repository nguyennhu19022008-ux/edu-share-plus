# Checkpoint 3D — Database Test Matrix

Status: **offline test design only; no database exists yet.**

The later live/local test harness must use isolated fixtures for at least these actors:

- Guest / anon
- Student A — approved, School A
- Student B — approved, School A
- Student C — approved, School B
- Pending Student — School A
- Teacher A — teacher_moderator, School A
- Teacher B — teacher_moderator, School B
- Verification Staff A — School A / assigned request
- Admin — global admin role

## A. Schema/integrity tests

| ID | Test | Expected |
|---|---|---|
| INT-001 | Non-sale post with non-null price | rejected by CHECK |
| INT-002 | Low-price sale with null/zero price | rejected |
| INT-003 | Completed post without completed_at | rejected |
| INT-004 | Withdrawn post without withdrawn_at | rejected |
| INT-005 | Two primary media rows for one post | second insert rejected |
| INT-006 | Reply parent from another post | rejected by composite FK |
| INT-007 | Duplicate favorite user/post | rejected by PK |
| INT-008 | Report with 0 targets | rejected |
| INT-009 | Report with >1 target | rejected |
| INT-010 | User self-report target | rejected |
| INT-011 | Duplicate verification revision number | rejected |
| INT-012 | Verification revision supersedes another request | rejected |
| INT-013 | Verification evidence result from another request | rejected |
| INT-014 | Transaction owner == counterparty | rejected |
| INT-015 | Non-sale transaction with agreed_price | rejected |
| INT-016 | Non-general case without operational context | rejected |
| INT-017 | Resolved/dismissed case without resolution/timestamp | rejected |
| INT-018 | Price estimate min > max | rejected |
| INT-019 | Two active price models | rejected by partial unique index |
| INT-020 | Two active reputation models | rejected |
| INT-021 | Active role assignment duplicate | rejected |
| INT-022 | File >20 MiB metadata | rejected |
| INT-023 | Public face/evidence file | rejected |
| INT-024 | PDF marked as avatar/post_media | rejected |
| INT-025 | Profile class from another school | rejected by composite FK |

## B. RLS / authorization tests

| ID | Actor | Operation | Expected |
|---|---|---|---|
| RLS-001 | Guest | SELECT approved active visible post | allow |
| RLS-002 | Guest | SELECT pending/rejected/hidden post | deny/no row |
| RLS-003 | Guest | SELECT profiles/profile_private | deny |
| RLS-004 | Student A | SELECT own pending/rejected post | allow |
| RLS-005 | Student B | SELECT Student A pending post | deny |
| RLS-006 | Student A | INSERT favorite with user_id=Student B | deny |
| RLS-007 | Student A | favorite hidden/rejected other post | deny |
| RLS-008 | Student A | INSERT visible comment on allowed post | allow |
| RLS-009 | Student A | INSERT comment with author_id=Student B | deny |
| RLS-010 | Pending Student | INSERT favorite/comment | deny |
| RLS-011 | Student A | UPDATE post moderation_status directly | denied by grant/policy absence |
| RLS-012 | Student A | INSERT moderation_action | denied |
| RLS-013 | Student A | INSERT audit log | denied |
| RLS-014 | Student A | SELECT own notification | allow |
| RLS-015 | Student A | UPDATE another user's notification | deny |
| RLS-016 | Teacher A | view/moderate School A queue | allow read; mutation only trusted RPC later |
| RLS-017 | Teacher A | view School B private moderation data | deny |
| RLS-018 | Teacher A | read School A student private profile for account review | allow |
| RLS-019 | Verification Staff assigned | read assigned verification request/result/evidence | allow |
| RLS-020 | Verification Staff unassigned | read unrelated verification evidence | deny |
| RLS-021 | Seller | read related verification request/result | allow |
| RLS-022 | Seller | read raw internal verification evidence not uploaded by self | deny |
| RLS-023 | Transaction participant | read own transaction/events | allow |
| RLS-024 | Unrelated student | read transaction | deny |
| RLS-025 | Case participant | read participant-visible update | allow |
| RLS-026 | Case participant | read staff_only update | deny |
| RLS-027 | Teacher B | handle School A case | deny |
| RLS-028 | Admin | privileged read according to explicit policies | allow |
| RLS-029 | Any browser role | SELECT private.audit_logs directly | deny |
| RLS-030 | Any browser role | INSERT private.analytics_events directly | deny |
| RLS-031 | Student A | self-assign teacher/admin role | denied by missing table mutation grant/policy |
| RLS-032 | Student A | modify another user's profile | deny |
| RLS-033 | Student A | read another user's profile_private | deny |
| RLS-034 | Guest | read restricted/private file metadata | deny |
| RLS-035 | Student A | alter notification title/body using UPDATE | denied by column grant |

## C. Trusted-workflow tests required before frontend connection

These cannot be declared PASS from 3D because the business RPCs are not created yet.

- AUTH-001 profile initialization derives `auth.uid()`, never a client-supplied owner UUID.
- POST-001 submit post forces `pending` moderation.
- POST-002 owner edit cannot modify owner/school/moderation/audit fields.
- POST-003 rejected resubmit atomically clears rejection projection and appends history.
- MOD-001 moderation updates post + history + action + notification + audit atomically.
- VER-001 seller verification request validates seller is owner.
- VER-002 buyer request rejects post owner as buyer requester.
- VER-003 assignment rejects unauthorized/self-verification.
- VER-004 result revision + request status + audit are atomic.
- TX-001 create transaction derives post owner and rejects legacy auto-complete as transaction evidence.
- CASE-001 case creation inserts participants/history atomically.
- PRICE-001 estimate uses exactly one active model and only eligible references.
- PRICE-002 estimate persists immutable input/output/reference lineage.
- ROLE-001 role mutation cannot be invoked by ordinary student.
- AUDIT-001 privileged workflows append audit records with actor/action/entity/timestamp.

## D. Performance test plan

Use realistic seeded non-research fixtures only; never use fabricated benchmarks as KHKT evidence.

1. Marketplace public feed at 1k / 10k / 100k posts.
2. Category/trade/class filters with `EXPLAIN (ANALYZE, BUFFERS)`.
3. `search_tsv @@ websearch_to_tsquery('simple', ...)` query.
4. Owner dashboard state query.
5. Notification unread query.
6. Moderation report queues.
7. Verification assignee queue.
8. Case assignee/status queue.
9. RLS-on vs equivalent controlled test query.
10. Index write overhead after representative inserts/updates.

Required recorded values later: planning/execution time, rows, buffers, chosen index, query count, API latency and payload size.
