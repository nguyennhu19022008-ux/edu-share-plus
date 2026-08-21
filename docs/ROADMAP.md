# EDU SHARE+ Core V2 Roadmap

## Phase 5 — Operational Core

- **5A Foundation Stabilization — PASS** — local/hosted Auth security settings are aligned for the Free-tier baseline, automated unit/build and local Auth E2E gates pass, the exposed RLS helper is hardened, and advisors are reviewed.
- **5B Roster & Registration Trust Layer — PASS** — mandatory email confirmation, private school roster matching, atomic single-account claims, verified membership, school-scoped teacher review/roster administration, CSV teacher UI, hosted development migrations, unauthorized-path checks, and the full local release matrix are complete.
- **5C Marketplace Read — PASS** — approved verified students read real Supabase feed/detail data with school/network visibility, server-side filtering/sorting/pagination, owner privacy, unauthorized-read denial, hosted development migrations, advisor review, and no public media URL.
- **5D Profile Backend — PASS** — self profile/private reads use Supabase RLS, privacy writes use a narrow verified-student RPC, ProfilePage no longer fabricates profile/activity/saved/notification/image state, and password changes explicitly verify the current password through Supabase Auth before mutation.
- **5E Create/Edit/My Posts — PASS** — verified students create/edit/withdraw/complete their own listings through narrow trusted RPCs; owner list/detail reads use Supabase RLS and server pagination; every edit returns moderation to pending; completion is restricted to approved active listings; structured low-price-sale inputs are persisted without implementing an estimator; media/interactions remain truthfully deferred.
- **5F Storage** — PASS when private post/profile/evidence buckets, Storage RLS, file metadata, binding, and cleanup rules operate end-to-end.
- **5G Interactions + Contact** — PASS when favorites, comments/replies, and audited contact reveal use the live backend.
- **5H Notifications + Reports** — PASS when notifications and reports are live, narrow-permission workflows with school-based routing.
- **5I Teacher Post Moderation** — PASS when teacher post review/hide/comment-control is atomic, school-scoped, audited, and not mock-backed.
- **5J Remove Runtime Mock** — PASS when no core production route depends on `createMockRepositories()`.

## Phase 6 — Verified outcomes and research features

- **6A Transactions**
- **6B Price Estimator V1**
- **6C Reputation V2**
- **6D Explainable Recommendation V1**

## Phase 7 — Quality and evaluation

Performance optimization, mobile UX refinement, and KHKT experimental evaluation follow once the operational Core V2 produces reliable real-world data.
