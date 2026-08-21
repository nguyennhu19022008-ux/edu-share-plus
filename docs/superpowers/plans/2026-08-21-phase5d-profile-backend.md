# Phase 5D — Profile Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ProfilePage account/profile/privacy/password simulation with truthful Supabase-backed self-profile reads, a narrow trusted privacy write, and real Auth password change while keeping Storage, favorites and notifications deferred to their scheduled phases.

**Architecture:** Safe self-profile reads use direct Supabase SELECTs protected by existing RLS. Privacy mutation uses one authenticated SECURITY DEFINER RPC that derives the actor from `auth.uid()`, reuses `get_current_student_context()` as the verified-student trust gate, and updates only the four privacy flags. Password change uses Supabase Auth `updateUser({ password, currentPassword })`. ProfilePage no longer reads `ProfileRepository`; Storage-dependent image UI and interaction-dependent saved/notification UI are explicitly deferred rather than showing fabricated data.

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

- [ ] **Step 1: Write RED integration assertions in `tests/profileBackend.e2e.mjs`.** Seed two verified students in different schools plus one teacher. Assert the RPC does not exist yet. The final matrix must also prove: anonymous cannot call it; a verified student can update only their own four privacy flags; the other student's flags do not change; teacher identity is denied by the Student trust gate; direct authenticated UPDATE on `profiles`/`profile_private` is unavailable.
- [ ] **Step 2: Add migration `profile_privacy_backend`.** Drop `profiles_update_privacy_self` and `profile_private_update_privacy_self`; explicitly revoke table UPDATE from PUBLIC/anon/authenticated; create `update_my_profile_privacy` as `SECURITY DEFINER SET search_path=''`.
- [ ] **Step 3: Inside the RPC, derive `v_actor_id := auth.uid()`.** Reject null actor with `EDU_SHARE_AUTH_REQUIRED`. Execute `perform public.get_current_student_context()` so only approved + verified active Student identities pass. Reject any null boolean parameter with `EDU_SHARE_PROFILE_PRIVACY_INVALID`.
- [ ] **Step 4: Update exact columns only.** `profiles`: `show_name`, `show_class`, `updated_at=now()`. `profile_private`: `show_email`, `show_phone`, `updated_at=now()`. Never accept user ID, school ID, name, phone, email, status, role, file ID, or timestamps from client input.
- [ ] **Step 5: Harden EXECUTE.** `revoke all ... from public, anon; grant execute ... to authenticated;` and add a function comment describing the verified-student self-only contract.
- [ ] **Step 6: Run the clean local E2E matrix and previous 5A/5B/5C regression suites.** Expected: profile privacy authorization tests PASS and all previous trust/marketplace tests remain PASS.
- [ ] **Step 7: Commit:** `security: add trusted profile privacy update`.

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

- [ ] **Step 1: Write RED unit tests in `tests/profileReadModel.test.ts`.** Cover Vietnamese datetime formatting, phone masking, private email/phone mapping, class-label fallback, exact privacy flags, persisted reputation cache, and malformed server data rejection. Assert no activity/reputation-detail values are invented.
- [ ] **Step 2: Add `StudentProfileView` to `src/features/profile/types.ts`.** Keep legacy/local types for still-deferred repository consumers, but ProfilePage/components move to the truthful remote view type.
- [ ] **Step 3: Implement pure mapping in `profileReadModel.ts`.** Input is the Auth user plus the current user's `profiles`, `profile_private`, and optional class row. `avatarUrl` and `faceUrl` remain empty strings until Phase 5F because file IDs are not public URLs.
- [ ] **Step 4: Implement `getMyProfile()` in `profileService.ts`.** Call `supabase.auth.getUser()`, then direct self SELECTs from `profiles` and `profile_private`; if `class_id` is non-null, load the matching `school_classes.label`. RLS is the authorization boundary. Treat missing self rows as errors rather than falling back to mock data.
- [ ] **Step 5: Implement `updateMyProfilePrivacy()`.** Call `update_my_profile_privacy` with the four flags and strictly parse the returned JSON.
- [ ] **Step 6: Normalize service errors into Vietnamese user-facing messages without leaking SQL internals.** Preserve explicit EDU_SHARE codes where needed for debugging only through generic mapped messages.
- [ ] **Step 7: Add the unit test command to `package.json`; run unit suite and production build.** Expected: PASS.
- [ ] **Step 8: Commit:** `feat: add Supabase profile service`.

### Task 3: Replace ProfilePage mock profile path and remove fake header fallback

- [ ] **Step 1: Write RED wiring assertions in `tests/profilePageWiring.test.ts`.** Require `ProfilePage` to call `getMyProfile` and `updateMyProfilePrivacy`; forbid `useDataAccess`, `profileRepository`, `getBundle`, `updateImages`, `recordPasswordChanged`, and mock-derived activity rendering.
- [ ] **Step 2: Refactor `ProfileSections.tsx` to accept `StudentProfileView`.** Sidebar shows name/class/email and persisted reputation cache only. Remove the six mock activity counters and reputation-detail calculations from the real profile view.
- [ ] **Step 3: Replace `ProfilePage` initialization with async Supabase loading.** States: loading, loaded, retryable error. Ignore stale/cancelled responses on unmount. No local fallback is permitted for primary profile data.
- [ ] **Step 4: Make privacy save async and server-authoritative.** Disable the submit button while saving; update UI state only from the RPC response; show success/error state.
- [ ] **Step 5: Replace avatar/face upload form with a truthful Phase-5F deferred card.** Do not create object URLs and do not imply any image was uploaded or persisted.
- [ ] **Step 6: Replace saved-post and notification mock sections with explicit deferred cards for Phase 5G and 5H.** Do not render fake saved posts or fake notifications.
- [ ] **Step 7: Refactor `StudentHeader` to stop importing `useDataAccess`.** Resolve identity from Auth/session (or explicit `user` prop) and default notifications to an empty array until the real Phase-5H source exists. This removes fake notification badges globally.
- [ ] **Step 8: Run wiring test, unit suite and production build.** Expected: PASS.
- [ ] **Step 9: Commit:** `refactor: load profile from Supabase`.

### Task 4: Real current-password change from ProfilePage

**Interface:**

```ts
export async function changeMyPassword(input:{
  currentPassword:string;
  newPassword:string;
}):Promise<void>;
```

- [ ] **Step 1: Reuse `validateNewPassword()` from the existing password recovery service.** The profile form must enforce the same minimum: at least 8 characters, one lowercase letter, one uppercase letter, and one digit.
- [ ] **Step 2: Add unit/wiring assertions that ProfilePage no longer performs a local password simulation and calls `changeMyPassword`.** Ensure mismatched confirmation is rejected before network mutation.
- [ ] **Step 3: Implement `changeMyPassword()` in `profileService.ts` with `supabase.auth.updateUser({ password:newPassword, currentPassword })`.** This uses current Supabase JS support for current-password verification and requires no service role/SMTP.
- [ ] **Step 4: Normalize incorrect-current-password, weak-password, expired-session and rate-limit errors to safe Vietnamese copy.** Do not expose tokens or Auth internals.
- [ ] **Step 5: On success, clear form fields and show a real success message.** Do not create a fake notification; Phase 5H owns notification persistence.
- [ ] **Step 6: Unit suite and production build PASS.**
- [ ] **Step 7: Commit:** `feat: change profile password through Supabase Auth`.

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
password change uses Supabase Auth currentPassword path
Phase 5A Auth E2E still pass
Phase 5B trust/roster E2E still pass
Phase 5C marketplace E2E still pass
browser secret scan pass
unit tests pass
production build pass
```

- [ ] **Step 1: Wire `tests/profileBackend.e2e.mjs` into the local Supabase CI job after the Phase 5C matrix.** Increase timeout only if the measured clean replay requires it.
- [ ] **Step 2: Run final clean-local CI.** Do not apply hosted DDL until every 5A–5D local gate is green.
- [ ] **Step 3: Apply the profile migration to hosted development with `Supabase.apply_migration`.** If hosted records a different generated version than the repo filename, rename the repo migration byte-for-byte to the hosted version and rerun clean-local CI to prove replay is unchanged.
- [ ] **Step 4: Hosted audit.** Verify policies/grants, `prosecdef`, `proconfig`, PUBLIC/anon/authenticated EXECUTE, and an anon RLS query returning zero profile/private rows. Verify authenticated direct UPDATE remains unavailable.
- [ ] **Step 5: Run Security Advisor and Performance Advisor.** Record authenticated SECURITY DEFINER notice for the trusted privacy RPC as intentional. Leaked Password Protection remains an accepted Free-Plan limitation. Do not delete indexes from development-time `unused_index` notices alone.
- [ ] **Step 6: Update `docs/00_CURRENT_PROJECT_STATUS.md` and `docs/ROADMAP.md`.** Mark Phase 5C integrated into `main`, Phase 5D PASS only after all gates, and set next checkpoint to Phase 5E — Create/Edit/My Posts.
- [ ] **Step 7: Open a draft PR to `main`, self-review the full diff, then mark ready only after final PR-head CI succeeds.** Merge remains a separate release action.
- [ ] **Step 8: Final commit when all evidence is green:** `docs: mark Phase 5D profile backend pass`.

## Self-review

- **Spec coverage:** own profile/private read, privacy flags, no public contact data, trusted write boundary, no Storage leakage, no service-role browser code, Free-tier operation, clean replay, unauthorized checks and advisor review are covered.
- **Scope boundary:** images stay 5F; saved/favorites/contact stay 5G; notifications stay 5H; post writes stay 5E; reputation algorithm stays Phase 6.
- **Truthfulness:** ProfilePage no longer displays mock activity, saved items, notifications, image persistence or password mutation as though they were real backend state.
- **Type consistency:** `StudentProfileView`, `getMyProfile`, `updateMyProfilePrivacy`, and `changeMyPassword` are defined once and reused by the page/tests.
- **Placeholder scan:** implementation behavior, authorization rules, interfaces and release gates are explicit; no task depends on undefined permission behavior.
