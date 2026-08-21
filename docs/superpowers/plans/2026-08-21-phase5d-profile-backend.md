# Phase 5D — Profile Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ProfilePage account/profile/privacy/password simulation with truthful Supabase-backed self-profile reads, a narrow trusted privacy write, and real Auth password change while keeping Storage, favorites and notifications deferred to their scheduled phases.

**Architecture:** Safe self-profile reads use direct Supabase SELECTs protected by existing RLS. Privacy mutation uses one authenticated SECURITY DEFINER RPC that derives the actor from `auth.uid()`, reuses `get_current_student_context()` as the verified-student trust gate, and updates only the four privacy flags. Password change explicitly verifies the authenticated user's current password with `signInWithPassword()` and only then calls `updateUser({ password })`; it does not depend on a hosted-only current-password toggle. ProfilePage no longer reads `ProfileRepository`; Storage-dependent image UI and interaction-dependent saved/notification UI are explicitly deferred rather than showing fabricated data.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Node >=20.19, Supabase JS 2.112.x, Supabase CLI 2.113.x, PostgreSQL 17, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-21-edu-share-plus-core-platform-v2-design.md`

## Global Constraints

- Core remains Free-tier-first.
- Protected student access requires a valid Auth session, confirmed email, `account_status='approved'`, verified current-school membership, active Student role in the profile school, and active school.
- Safe scoped reads may use direct SELECT under RLS; sensitive/material writes use narrow trusted RPCs.
- `profile_private.contact_email` and `profile_private.phone` remain private self/staff data and must not become ordinary public marketplace fields.
- `show_email`/`show_phone` are privacy policy flags only; actual contact reveal remains Phase 5G.
- No public Storage URL is introduced; avatar/face upload remains Phase 5F.
- Saved posts/favorites remain Phase 5G. Notifications remain Phase 5H.
- Phase 6 reputation/ranking algorithms are not implemented. Phase 5D may display the existing persisted reputation cache only.
- No profile activity metric may be fabricated from mock posts/favorites/comments/contact events.
- No service-role key or Supabase secret may enter `src/`.
- SECURITY DEFINER functions use `set search_path = ''` and grant EXECUTE only to intended roles.
- Schema changes must replay from a clean local Supabase database before hosted development migration.

---

## File map

### Add
- `supabase/migrations/<generated>_profile_privacy_backend.sql`
- `tests/profileBackend.e2e.mjs`
- `src/features/profile/profileReadModel.ts`
- `src/features/profile/profileService.ts`
- `tests/profileReadModel.test.ts`
- `tests/profilePageWiring.test.ts`

### Modify
- `src/features/profile/types.ts`
- `src/features/profile/components/ProfileSections.tsx`
- `src/components/student/StudentHeader.tsx`
- `src/pages/ProfilePage.tsx`
- `package.json`
- `.github/workflows/ci.yml`
- `docs/00_CURRENT_PROJECT_STATUS.md`
- `docs/ROADMAP.md`

---

### Task 1: Narrow trusted privacy-write boundary

**Produces:**

```sql
public.update_my_profile_privacy(
  p_show_name boolean,
  p_show_class boolean,
  p_show_email boolean,
  p_show_phone boolean
) returns jsonb
```

Returned JSON:

```ts
{
  showName: boolean;
  showClass: boolean;
  showEmail: boolean;
  showPhone: boolean;
}
```

- [x] **Step 1: Write RED integration assertions in `tests/profileBackend.e2e.mjs`.** Seed two verified students in different schools plus one teacher. The final matrix proves: anonymous cannot call the RPC; a verified student can update only their own four privacy flags; the other student's flags do not change; teacher identity is denied by the Student trust gate; direct authenticated UPDATE on `profiles`/`profile_private` is unavailable.
- [x] **Step 2: Add migration `profile_privacy_backend`.** Drop `profiles_update_privacy_self` and `profile_private_update_privacy_self`; explicitly revoke table UPDATE from PUBLIC/anon/authenticated; create `update_my_profile_privacy` as `SECURITY DEFINER SET search_path=''`.
- [x] **Step 3: Inside the RPC, derive `v_actor_id := auth.uid()`.** Reject null actor with `EDU_SHARE_AUTH_REQUIRED`. Execute `perform public.get_current_student_context()` so only approved + verified active Student identities pass. Reject any null boolean parameter with `EDU_SHARE_PROFILE_PRIVACY_INVALID`.
- [x] **Step 4: Update exact columns only.** `profiles`: `show_name`, `show_class`, `updated_at=now()`. `profile_private`: `show_email`, `show_phone`, `updated_at=now()`. Never accept user ID, school ID, name, phone, email, status, role, file ID, or timestamps from client input.
- [x] **Step 5: Harden EXECUTE.** `revoke all ... from public, anon; grant execute ... to authenticated;` and add a function comment describing the verified-student self-only contract.
- [x] **Step 6: Run the clean local E2E matrix and previous 5A/5B/5C regression suites.** Profile privacy authorization tests and previous trust/marketplace tests PASS.
- [x] **Step 7: Commit:** trusted profile privacy update landed on the Phase 5D branch.

### Task 2: Real self-profile read model and service

**Interfaces:**

```ts
export interface StudentProfileView {
  email:string;
  name:string;
  className:string;
  phone:string;
  phoneMasked:string;
  avatarUrl:string;
  faceUrl:string;
  createdAt:string;
  lastLogin:string;
  updatedAt:string;
  passwordStatus:string;
  privacy:ProfilePrivacy;
  reputation:{ score:number; label:string };
}

export async function getMyProfile():Promise<StudentProfileView>;
export async function updateMyProfilePrivacy(next:ProfilePrivacy):Promise<ProfilePrivacy>;
```

- [x] **Step 1: Write RED unit tests in `tests/profileReadModel.test.ts`.** Cover Vietnamese datetime formatting, phone masking, private email/phone mapping, class-label fallback, exact privacy flags, persisted reputation cache, and malformed server data rejection. Assert no activity/reputation-detail values are invented.
- [x] **Step 2: Add `StudentProfileView` to `src/features/profile/types.ts`.** Keep legacy/local types for still-deferred repository consumers, but ProfilePage/components move to the truthful remote view type.
- [x] **Step 3: Implement pure mapping in `profileReadModel.ts`.** Input is the Auth user plus the current user's `profiles`, `profile_private`, and optional class row. `avatarUrl` and `faceUrl` remain empty strings until Phase 5F because file IDs are not public URLs.
- [x] **Step 4: Implement `getMyProfile()` in `profileService.ts`.** Call `supabase.auth.getUser()`, then direct self SELECTs from `profiles` and `profile_private`; if `class_id` is non-null, load the matching `school_classes.label`. RLS is the authorization boundary. Missing self rows are errors rather than mock fallbacks.
- [x] **Step 5: Implement `updateMyProfilePrivacy()`.** Call `update_my_profile_privacy` with the four flags and strictly parse the returned JSON.
- [x] **Step 6: Normalize service errors into Vietnamese user-facing messages without leaking SQL internals.**
- [x] **Step 7: Add unit tests to the package test gate; unit suite and production build PASS.**
- [x] **Step 8: Commit:** Supabase profile service landed on the Phase 5D branch.

### Task 3: Replace ProfilePage mock profile path and remove fake header fallback

- [x] **Step 1: Write RED wiring assertions in `tests/profilePageWiring.test.ts`.** Require `ProfilePage` to call `getMyProfile` and `updateMyProfilePrivacy`; forbid `useDataAccess`, `profileRepository`, `getBundle`, `updateImages`, `recordPasswordChanged`, and mock-derived activity rendering.
- [x] **Step 2: Refactor `ProfileSections.tsx` to accept `StudentProfileView`.** Sidebar shows name/class/email and persisted reputation cache only. Remove mock activity counters and reputation-detail calculations from the real profile view.
- [x] **Step 3: Replace `ProfilePage` initialization with async Supabase loading.** States: loading, loaded, retryable error. Ignore stale/cancelled responses on unmount. No local fallback is permitted for primary profile data.
- [x] **Step 4: Make privacy save async and server-authoritative.** Disable submit while saving; update UI state only from the RPC response; show success/error state.
- [x] **Step 5: Replace avatar/face upload form with a truthful Phase-5F deferred card.** No object URLs or fake persistence.
- [x] **Step 6: Replace saved-post and notification mock sections with explicit deferred cards for Phase 5G and 5H.**
- [x] **Step 7: Refactor `StudentHeader` to stop importing `useDataAccess`.** Identity comes from Auth/session or explicit prop; notifications default empty until Phase 5H.
- [x] **Step 8: Wiring tests, unit suite and production build PASS.**
- [x] **Step 9: Commit:** ProfilePage now loads primary profile state from Supabase.

### Task 4: Real current-password change from ProfilePage

**Interface:**

```ts
export async function changeMyPassword(input:{
  currentPassword:string;
  newPassword:string;
}):Promise<void>;
```

- [x] **Step 1: Reuse `validateNewPassword()` from the existing password recovery service.** The profile form enforces at least 8 characters, one lowercase letter, one uppercase letter, and one digit.
- [x] **Step 2: Add unit/wiring assertions that ProfilePage no longer performs a local password simulation and calls `changeMyPassword`.** Mismatched confirmation is rejected before network mutation.
- [x] **Step 3: Implement explicit current-password verification.** `changeMyPassword()` resolves the authenticated user with `auth.getUser()`, verifies `input.currentPassword` by calling `auth.signInWithPassword({ email:user.email, password:input.currentPassword })`, and only after successful verification calls `auth.updateUser({ password:input.newPassword })`. This works on the Free-tier baseline without service role, SMTP, or a hosted-only enforcement toggle.
- [x] **Step 4: Normalize incorrect-current-password, weak-password, expired-session and rate-limit errors to safe Vietnamese copy.**
- [x] **Step 5: On success, clear form fields and show a real success message.** No fake notification is created; Phase 5H owns notification persistence.
- [x] **Step 6: Unit suite and production build PASS.**
- [x] **Step 7: Integration matrix proves wrong password verification fails, correct verification succeeds, the old password stops authenticating after change, and the new password authenticates.**

### Task 5: Full Phase 5D release gate

Required matrix:

```text
anonymous profiles/profile_private rows not readable
student reads only own profiles/profile_private row
student cannot read another student's private row
verified student privacy RPC allowed
privacy RPC cannot mutate another user
teacher identity denied privacy self RPC
browser has no direct UPDATE grant on profiles/profile_private
privacy RPC PUBLIC/anon EXECUTE denied
privacy RPC authenticated EXECUTE intentional
privacy RPC SECURITY DEFINER + search_path=''
ProfilePage primary data uses Supabase, not ProfileRepository
ProfilePage shows no fabricated activity/reputation-detail values
profile image persistence remains unavailable until 5F
saved/favorite profile data remains unavailable until 5G
notifications remain unavailable until 5H
password change explicitly verifies current password with signInWithPassword before updateUser
Phase 5A Auth E2E still pass
Phase 5B trust/roster E2E still pass
Phase 5C marketplace E2E still pass
browser secret scan pass
unit tests pass
production build pass
```

- [x] **Step 1: Wire `tests/profileBackend.e2e.mjs` into the local Supabase CI job after the Phase 5C matrix.**
- [x] **Step 2: Run final clean-local CI before hosted DDL.** Every 5A–5D local gate passed.
- [x] **Step 3: Apply the profile migration to hosted development with `Supabase.apply_migration`.** Hosted recorded `20260821095817_profile_privacy_backend`; the repo filename was aligned byte-for-byte and clean replay passed again.
- [x] **Step 4: Hosted audit.** Policies/grants, `prosecdef`, `proconfig`, PUBLIC/anon/authenticated EXECUTE, RLS and direct UPDATE privileges were verified.
- [x] **Step 5: Run Security Advisor and Performance Advisor.** Authenticated SECURITY DEFINER notice for the trusted privacy RPC is intentional. Leaked Password Protection remains an accepted Free-Plan limitation. Development-time index/policy advisories remain evidence for later query-plan work.
- [x] **Step 6: Update `docs/00_CURRENT_PROJECT_STATUS.md` and `docs/ROADMAP.md`.** Phase 5C is integrated into `main`, Phase 5D is PASS, and the next checkpoint is Phase 5E — Create/Edit/My Posts.
- [x] **Step 7: Draft PR #4 is self-reviewed and becomes ready only after final PR-head CI succeeds.** Merge remains a separate release action.
- [x] **Step 8: Final release documentation commit is on the Phase 5D branch.**

## Self-review

- **Spec coverage:** own profile/private read, privacy flags, no public contact data, trusted write boundary, no Storage leakage, no service-role browser code, Free-tier operation, clean replay, unauthorized checks and advisor review are covered.
- **Scope boundary:** images stay 5F; saved/favorites/contact stay 5G; notifications stay 5H; post writes stay 5E; reputation algorithm stays Phase 6.
- **Truthfulness:** ProfilePage no longer displays mock activity, saved items, notifications, image persistence or password mutation as though they were real backend state.
- **Password safety:** current-password verification is explicit and portable across the local/free-tier baseline rather than relying on a project-level enforcement toggle unavailable in the local CLI contract.
- **Type consistency:** `StudentProfileView`, `getMyProfile`, `updateMyProfilePrivacy`, and `changeMyPassword` are defined once and reused by the page/tests.
- **Placeholder scan:** implementation behavior, authorization rules, interfaces and release gates are explicit; no task depends on undefined permission behavior.
