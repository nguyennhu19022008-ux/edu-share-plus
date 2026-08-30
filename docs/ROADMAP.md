# EDU SHARE+ Core V2 Roadmap

## Phase 5 — Operational Core

- **5A Foundation Stabilization — PASS** — local/hosted Auth security settings are aligned for the Free-tier baseline, automated unit/build and local Auth E2E gates pass, the exposed RLS helper is hardened, and advisors are reviewed.
- **5B Roster & Registration Trust Layer — PASS** — mandatory email confirmation, private school roster matching, atomic single-account claims, verified membership, school-scoped teacher review/roster administration, CSV teacher UI, hosted development migrations, unauthorized-path checks, and the full local release matrix are complete.
- **5C Marketplace Read — PASS** — approved verified students read real Supabase feed/detail data with school/network visibility, server-side filtering/sorting/pagination, owner privacy, unauthorized-read denial, hosted development migrations, advisor review, and no public media URL.
- **5D Profile Backend — PASS** — self profile/private reads use Supabase RLS, privacy writes use a narrow verified-student RPC, ProfilePage no longer fabricates profile/activity/saved/notification/image state, and password changes explicitly verify the current password through Supabase Auth before mutation.
- **5E Create/Edit/My Posts — PASS** — verified students create/edit/withdraw/complete their own listings through narrow trusted RPCs; owner list/detail reads use Supabase RLS and server pagination; every edit returns moderation to pending; completion is restricted to approved active listings; structured low-price-sale inputs are persisted without implementing an estimator.
- **5F Storage — PASS** — private post/profile/evidence buckets, reservation-first immutable uploads, Storage RLS, school-aware file metadata, max-five post media, private signed delivery, self-avatar persistence, cleanup/tombstone lifecycle, hosted migration audit, and the full 5A–5F release matrix are complete. CI now runs on the repository-scoped self-hosted Linux runner under the Free-tier-first policy.
- **5G Interactions + Contact — PASS** — live favorites boundary, two-level comments with author soft-delete, live saved posts on profile, and audited privacy-gated contact reveal.
- **5H Notifications + Reports — PASS** — live Supabase notifications query/read and trusted moderation report submission RPCs.
- **5I Teacher Post Moderation — PASS** — teacher post review/hide/comment-control and report resolution is atomic, school-scoped, audited, and not mock-backed.
- **5J Remove Runtime Mock** — PASS when no core production route depends on `createMockRepositories()`.

## Phase 6 — Verified outcomes and research features

- **6A Transactions**
- **6B Price Estimator V1**
- **6C Reputation V2**
- **6D Explainable Recommendation V1**

## Phase 7 — Quality and evaluation

Performance optimization, mobile UX refinement, and KHKT experimental evaluation follow once the operational Core V2 produces reliable real-world data.
