# Phase 5E — Create/Edit/My Posts Implementation Plan

**Goal:** Replace owner-post runtime mocks with truthful Supabase-backed create, edit, owner list/detail and lifecycle workflows while collecting the structured low-price-sale fields required for later Price Estimator work. Storage/media remains Phase 5F; favorites/comments/contact/reports remain later phases.

**Architecture:** Owner reads use authenticated SELECT under existing owner RLS. Material writes use narrow `SECURITY DEFINER SET search_path=''` RPCs. Every write derives the actor from `auth.uid()` and reuses `get_current_student_context()`; the client never supplies owner/school/class identity. Post edits always return moderation to `pending`. Students cannot mutate `is_hidden`, `comments_enabled`, moderation decisions, publish timestamps or staff history. Actual PII remains in `profile_private`; posts store only `preferred_contact_method` for the later Phase 5G contact workflow.

**Baseline:** `main` includes Phase 5A–5D. Phase 5D merged at `3a7dcfb866f53f4485fee4f2584303e57a549b95`.

## Global constraints

- Free-tier-first.
- Student write eligibility = authenticated + confirmed email + active Student role + approved account + verified membership + active school, via the canonical student context.
- All trusted RPCs revoke EXECUTE from PUBLIC/anon and explicitly grant only authenticated.
- `SECURITY DEFINER` functions use `set search_path=''` and fully qualified relations.
- Browser keeps SELECT-only access to `posts`; no direct INSERT/UPDATE/DELETE grants are introduced.
- `owner_id`, `school_id`, and `class_id` are server-derived. `class_id` may be null when the verified profile has no current class.
- Student cannot write moderation fields: `moderation_status`, `is_hidden`, `comments_enabled`, `published_at`.
- Student cannot widen school marketplace policy. `visibility_scope='network'` is rejected when the current school's `marketplace_scope='school'`.
- New posts are `moderation_status='pending'`, `lifecycle_status='active'`, `is_hidden=false`, `published_at=null`.
- Editing any active post, including an approved post, resets moderation to `pending`, clears `published_at`, and records history.
- Completed/withdrawn posts are immutable in Core V2. They may be duplicated through the normal create workflow, but not reopened in place.
- `lifecycle_status='completed'` means the listing is closed; it is NOT verified transaction evidence. Phase 6A owns transactions.
- Student cannot hard-delete a post.
- No media persistence/public Storage URL in 5E. Add/Edit pages must state that images arrive in 5F rather than pretending a local preview was saved.
- No fake favorite/comment/contact/report metrics in owner pages. Those remain deferred to 5G/5H.
- No service-role or secret material in `src/`.

## Schema additions

Add to `public.posts`:

```sql
preferred_contact_method text not null default 'email'
  check (preferred_contact_method in ('phone','email'));
original_purchase_price bigint;
original_price_is_estimate boolean;
purchase_date date;
condition_grade text;
brand text;
model text;
```

Low-price-sale contract:

```text
trade_type = low_price_sale
→ sale_price > 0
→ original_purchase_price > 0
→ original_price_is_estimate is explicit boolean
→ condition_grade ∈ like_new | good | fair | well_used
→ purchase_date optional and not in the future
→ brand/model optional
```

For non-sale trade types these estimator-input fields are null. The Phase 5E client may collect them only when `trade_type='low_price_sale'`.

## Task 1 — Trusted post-write foundation

**RED first:** add `tests/ownerPostWrite.e2e.mjs` and wire it into the local Supabase CI job after 5D. Before migration, assert the new columns/RPCs are missing.

Create migration `owner_post_write_backend` with:

```text
create_my_post(...)
update_my_post(p_post_id,...)
change_my_post_lifecycle(p_post_id, p_action)
```

`p_action` is limited to `complete|withdraw`.

Required tests:

- anon cannot execute any owner-write RPC;
- teacher identity is rejected by Student trust gate;
- pending/unverified Student is rejected;
- verified Student can create a post;
- owner/school/class are server-derived even if client input attempts are impossible because no such parameters exist;
- inactive/nonexistent category rejected;
- school-only tenant cannot create network visibility;
- low-price sale requires sale price + original price + condition + explicit estimate flag;
- non-sale post cannot retain sale-only estimator fields;
- preferred contact method requires the corresponding underlying `profile_private` contact value to exist;
- create writes moderation/lifecycle history with `actor_kind='user'`, `source='owner_action'`;
- student cannot directly INSERT/UPDATE/DELETE `posts`;
- student cannot update another user's post;
- edit of pending/rejected/approved active own post succeeds and returns moderation to pending;
- edit cannot mutate completed/withdrawn post;
- edit cannot set moderation/hidden/comments/published fields;
- complete sets lifecycle completed + completed_at and history;
- withdraw sets lifecycle withdrawn + withdrawn_at and history;
- completed/withdrawn cannot transition again;
- no hard delete.

## Task 2 — Truthful owner-post read model/service

Add a dedicated Supabase owner-post feature surface, separate from the legacy mock repository:

```text
src/features/my-posts/ownerPostModel.ts
src/features/my-posts/ownerPostService.ts
```

Define remote types for:

```text
OwnerPostView
OwnerPostDetail
OwnerPostCreateInput
OwnerPostEditInput
OwnerPostListQuery
OwnerPostListResult
```

Map database values to Vietnamese presentation labels without inventing metrics.

`listMyPosts(query)`:
- resolve Auth user;
- SELECT own `posts` under RLS;
- join active category/class label where available;
- filter moderation/lifecycle/keyword server-side;
- paginate with `range()` and exact count;
- no synchronous list-all fallback.

`getMyPost(id)`:
- SELECT exact own post under RLS;
- load latest owner-readable moderation rejection reason from `post_status_history`;
- return not-found for other user's post rather than leaking existence.

Reference options:
- load active categories from Supabase;
- derive current school policy/current class from trusted Student context;
- expose only legal visibility choices.

Service mutations call only the three trusted RPCs above.

Unit tests cover strict mapping, Vietnamese timestamps/money/status labels, structured price mapping, malformed payload rejection, and no fabricated interaction fields.

## Task 3 — AddPostPage uses Supabase

TDD wiring test requires:

- no `useDataAccess` / `ownerPosts.insert`;
- async reference-option load;
- async `createMyPost()` mutation;
- category submitted by UUID, not label;
- trade values map to DB enum values;
- contact field becomes `preferred_contact_method`, never arbitrary phone/Zalo/Facebook text;
- visibility scope selector respects school policy;
- low-price sale reveals: sale price, original purchase price, estimate checkbox, condition grade, optional purchase date/brand/model;
- image persistence area becomes an explicit Phase-5F deferred notice; no object URL is treated as stored media;
- on success route to `myDetail?id=<server uuid>`.

## Task 4 — EditPostPage uses Supabase

TDD wiring test requires:

- load `getMyPost(id)` asynchronously;
- no mock owner repository;
- only active posts editable;
- approved edit explains that the listing temporarily leaves marketplace and returns to pending moderation;
- rejected reason shown when available;
- submit uses `updateMyPost()` and server response;
- structured sale/contact/visibility fields use the same validation/model as Add;
- image section remains deferred to 5F;
- completed/withdrawn displays read-only state and cannot call update RPC.

## Task 5 — MyPostsPage / MyDetailPage use Supabase

Replace mock owner lists/details with remote state.

`MyPostsPage`:
- async paginated owner list;
- server-side moderation/lifecycle/keyword filtering;
- truthful dashboard counts based on backend queries/results;
- remove contact/comment/favorite sorting until those live backends arrive;
- remove owner hide/unhide action because `is_hidden` is a moderation field;
- lifecycle buttons call trusted complete/withdraw workflow;
- duplicate means fetch own post then call normal create RPC with a new pending post;
- identity header comes from Auth/session, not hard-coded `12A1` / `local-ui@...`.

`MyDetailPage`:
- async own detail load with loading/not-found/error/retry;
- show moderation + lifecycle status separately;
- show rejection reason/history when available;
- complete/withdraw through trusted RPC;
- edit only when lifecycle active;
- no owner hide/unhide;
- no fake effectiveness, favorites, contacts, comments or report metrics; render explicit deferred cards for 5G/5H where useful;
- no persisted image claim before 5F.

## Task 6 — Full Phase 5E release gate

Required final evidence:

```text
unit tests PASS
production build PASS
clean migration replay PASS
Phase 5A Auth E2E PASS
Phase 5B trust/roster matrix PASS
Phase 5C marketplace matrix PASS
Phase 5D profile matrix PASS
Phase 5E owner-write/read matrix PASS
anon/teacher/pending/unverified write paths denied
cross-user edit/detail denied
browser direct post INSERT/UPDATE/DELETE denied
student moderation-field mutation impossible
low-price-sale structured contract enforced in database/RPC
school visibility upper bound enforced
edit resets approved post to pending
complete/withdraw lifecycle transitions audited
no fake interaction/media persistence claims
source secret scan PASS
hosted migration applied only after clean local green
hosted grants/RPC/search_path/RLS audit PASS
Security Advisor reviewed
Performance Advisor reviewed without speculative index deletion
docs/status/roadmap updated
final PR-head CI PASS
```

After local green, apply migration to hosted development with `Supabase.apply_migration`; if hosted assigns a different migration timestamp, rename the repository migration byte-for-byte and rerun clean-local CI. Keep PR Draft until final release evidence is green. Merge remains a separate owner-approved action.

## Next checkpoint after PASS

**Phase 5F — Storage**: private post/profile/evidence buckets, media metadata/binding, image limits/conversion boundary and private delivery.
