# Phase 5B — Roster & Registration Trust Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make student registration trustworthy by combining mandatory email confirmation with a private school roster, atomic roster claims, automatic approval for unique matches, and school-scoped teacher review for all other cases.

**Architecture:** Registration claims are snapshotted into a private table at Auth signup and are never used directly as authorization. After email confirmation, a trusted database trigger compares the private claim against the currently active school roster; a unique unclaimed match atomically verifies school membership and approves the account, while no/ambiguous/already-claimed cases create the existing teacher review workflow. Roster data and claims stay in the `private` schema; the browser reaches them only through narrow school-scoped SECURITY DEFINER RPCs.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Supabase JS 2.112.x, Supabase CLI 2.113.x, PostgreSQL 17, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-21-edu-share-plus-core-platform-v2-design.md`

## Global Constraints

- Core functionality must remain usable on the Supabase Free Plan; paid-only features are optional hardening/scale upgrades.
- Email verification is mandatory for every student registration.
- `raw_user_meta_data` is untrusted input and must never directly authorize a user.
- One roster entry may have at most one active account claim; one user may have at most one active roster claim.
- Automatic roster matching uses current school + normalized class + normalized phone. Entered name is not authorization evidence.
- A unique roster match replaces the profile display name/class with the school roster's canonical values.
- No roster list or match-existence API is exposed to anonymous users or ordinary students.
- Teacher authority is always school-scoped. Network admin may act across schools.
- Roster/claim operations are auditable and use `auth.uid()` as the actor identity.
- No service-role or secret key may appear in Vite/browser code.
- Existing Phase-4 account review RPC remains the manual-review foundation and must stay backward-compatible for the current teacher UI.
- Phase 5B must not implement Marketplace Read, Storage buckets, transactions, price estimation, reputation, or recommendation.
- All schema changes are versioned migrations and must replay successfully from a clean local Supabase database.
- Every SECURITY DEFINER function uses `set search_path = ''`, validates identity/school scope internally, and has minimum EXECUTE grants.
- The Phase 5A CI gates (`verify` and local Auth E2E) must remain green throughout 5B.

---

## File map

### Files to add

- `docs/superpowers/specs/2026-08-21-edu-share-plus-core-platform-v2-design.md`
- `docs/superpowers/plans/2026-08-21-phase5b-roster-registration-trust-layer.md`
- `supabase/migrations/<generated>_roster_registration_trust_layer.sql`
- `scripts/test-roster-registration-trust.mjs`
- `src/features/admin/rosterTypes.ts`
- `src/features/admin/rosterService.ts`
- `src/features/admin/rosterCsv.ts`
- `src/features/admin/rosterCsv.test.ts`

### Files to modify

- `src/features/auth/registration/registrationService.ts`
- student session/profile context files
- `src/features/admin/accountReviewTypes.ts`
- `src/features/admin/accountReviewService.ts`
- focused admin components
- `.github/workflows/ci.yml`
- `docs/00_CURRENT_PROJECT_STATUS.md`
- `docs/ROADMAP.md`

---

### Task 1: Materialize approved architecture and Phase 5B plan

- [ ] Create `phase/5b-roster-registration-trust` from current `main`.
- [ ] Add approved Core V2 architecture spec verbatim.
- [ ] Add this plan.
- [ ] Run existing CI without product/schema changes.
- [ ] Commit as `docs: add Core V2 spec and Phase 5B plan`.

### Task 2: Add membership state and private roster schema

**Migration outputs:**
- `profiles.school_membership_status`
- `profiles.membership_verification_method`
- `profiles.membership_verified_at`
- `schools.registration_enabled`
- `schools.roster_verification_enabled`
- `private.student_registration_claims`
- `private.roster_import_batches`
- `private.student_roster`
- `private.student_roster_claims`
- `private.normalize_class_claim(text)`
- `private.normalize_vn_phone(text)`

- [ ] Add failing schema assertions to local 5B integration test.
- [ ] Add profile membership columns/checks; allowed membership values are `verified | needs_revalidation | revoked`; verification methods are `school_roster_match | teacher_manual_review | null`.
- [ ] Add `schools.registration_enabled boolean not null default true` and `schools.roster_verification_enabled boolean not null default true`.
- [ ] Add server-side Vietnamese phone canonicalization (`+84...`/`84...` -> leading-zero 10 digit; malformed -> `EDU_SHARE_PHONE_INVALID`).
- [ ] Add class normalization (trim/lower/remove separators).
- [ ] Create `private.student_registration_claims` keyed by Auth user.
- [ ] Create roster import batches and unique partial index allowing at most one active batch per school.
- [ ] Create roster rows with canonical `class_id`, normalized class/phone, indexes for match lookup.
- [ ] Create historical/current roster claims with partial unique indexes: one active claim per roster entry, one active claim per user.
- [ ] Revoke all browser privileges on new private objects.
- [ ] Clean local migration replay must pass.

### Task 3: Snapshot student registration claims and discriminate signup

- [ ] Frontend adds `registration_intent: 'student_v2'`.
- [ ] Non-student Auth users do not get EDU SHARE+ student profile/role rows.
- [ ] Student provisioning validates active+registration-enabled school, required class/phone/name/email.
- [ ] Provisioning snapshots normalized claims into private registration table.
- [ ] Account remains `pending_review` + `needs_revalidation` at signup.
- [ ] Raw metadata remains untrusted and does not directly authorize.
- [ ] Existing Phase 5A local email confirmation E2E updated and remains green.

### Task 4: Atomic verification after email confirmation

Four required outcomes:

```text
unique active unclaimed match -> approved + verified + canonical roster name/class
no match -> pending_review + review reason roster_not_found
ambiguous -> pending_review + review reason roster_ambiguous
already actively claimed -> pending_review + review reason roster_already_claimed
```

- [ ] Replace queue-only email-confirm trigger with trusted verification trigger.
- [ ] Match only current school active batch + normalized class + normalized phone.
- [ ] Never match on entered name.
- [ ] Atomically insert active roster claim; uniqueness conflict routes to manual review.
- [ ] Successful auto-match updates profile identity/membership, creates approved account-review history, notification, and audit record.
- [ ] Manual path creates exactly one open review and never reveals roster existence to signup client.
- [ ] Race/double-claim E2E proves second account cannot take same roster row.

### Task 5: School-scoped roster management RPCs

RPCs:

```text
import_student_roster(p_school_id, p_academic_year, p_source_filename, p_rows)
activate_student_roster_batch(p_batch_id)
list_student_roster_batches(p_school_id)
list_active_student_roster(p_school_id)
```

- [ ] Anonymous and students denied.
- [ ] School A teacher denied on School B.
- [ ] Same-school teacher and global admin allowed.
- [ ] Import max 5000 rows, validates `full_name/class_name/phone` server-side.
- [ ] Invalid import returns row errors and writes nothing.
- [ ] Valid import creates/upserts `school_classes`, previewed batch, roster rows, audit.
- [ ] Activation archives previous active batch and activates target atomically.
- [ ] Activation does not revoke existing accounts in 5B.
- [ ] List RPCs expose only school-administration fields.

### Task 6: Integrate membership into manual review and student context

- [ ] `review_student_account(... approved ...)` also sets `school_membership_status=verified`, `membership_verification_method=teacher_manual_review`, `membership_verified_at=now()`.
- [ ] Rejected/needs_information do not verify membership.
- [ ] Audit before/after includes membership.
- [ ] Account queue adds `roster_match_reason`.
- [ ] Student context adds membership status/method/time.
- [ ] Protected student access requires both `account_status=approved` and `school_membership_status=verified`.
- [ ] Regression tests cover approved-but-needs_revalidation denial.

### Task 7: Minimal teacher roster UI

- [ ] Add dependency-free CSV parser with RFC-4180 quoting support.
- [ ] Unit test BOM, quoted commas, CRLF/LF, required headers, blank/duplicate rows.
- [ ] Teacher panel supports academic year, CSV select, validation preview, import, batch list, activation, active roster search.
- [ ] UI never queries private schema directly.
- [ ] Account review cards show staff-facing roster reason.
- [ ] Existing Approve/Reject/Needs information controls remain.
- [ ] Production build and tests pass.

Direct XLSX parsing is deferred as a non-security UI enhancement so Core remains dependency-light/free-tier-first. Backend import contract already accepts parsed JSON rows and needs no schema redesign for future XLSX support.

### Task 8: Full 5B release gate

Required integration matrix:

```text
non-student Auth user not provisioned as student
student signup validates school/class/phone
unconfirmed student cannot sign in
unique roster match auto-approves after confirmation
canonical roster name/class applied
auto-approved membership verified + school_roster_match
no match -> pending review
ambiguous -> pending review
double claim blocked
manual approval -> verified + teacher_manual_review
teacher cross-school roster access denied
student/anon roster RPC access denied
one active roster batch per school
clean migration replay
Phase 5A unit/Auth E2E still pass
production build pass
```

- [ ] Add 5B integration script to GitHub Actions local Supabase job.
- [ ] Apply hosted dev migration only after clean local replay + tests pass.
- [ ] Re-run Security Advisor and document intentional authenticated SECURITY DEFINER warnings.
- [ ] Verify no browser direct privilege on private roster/claim tables.
- [ ] Mark 5B PASS only on final green PR HEAD.
- [ ] Open PR to `main`; merge only after final CI success.
- [ ] Next checkpoint becomes 5C Marketplace Read.

## Self-review

Spec coverage: mandatory email verification, private roster, school/class/phone matching, canonical roster identity, atomic single active claim, manual teacher fallback, separate membership state, school-scoped staff authority, audit, and operational CSV import are covered.

Placeholder scan: no implementation task depends on an undefined authorization concept. Migration timestamp is generated by Supabase CLI.

Type consistency: membership values are exactly `verified | needs_revalidation | revoked`; verification methods are exactly `school_roster_match | teacher_manual_review`.
