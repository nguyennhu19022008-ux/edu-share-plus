# Phase 5G Interactions + Contact Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace marketplace favorite, comment/reply, and contact-reveal mocks with live Supabase-backed flows that enforce the existing verified-Student marketplace boundary, preserve privacy, and produce auditable contact access without duplicating PII.

**Architecture:** Use a hybrid boundary. Favorites remain direct authenticated table operations under tightened RLS, while comments, saved-post projection, contact reveal, and owner interaction history use narrow trusted RPCs with fixed `search_path=''`. Frontend code lives in a focused `features/interactions` module and `DetailPage`, `ProfilePage`, and `MyDetailPage` consume only parsed service responses.

**Tech Stack:** PostgreSQL 17, Supabase Auth/PostgREST/RLS, `@supabase/supabase-js` 2.112.x, React 19, TypeScript 5.8, Vite 7, Node 22, Node built-in test runner, esbuild-based unit bundling, local Supabase CLI 2.113.x, repository-scoped self-hosted GitHub Actions runner.

**Spec:** `docs/superpowers/specs/2026-08-22-phase5g-interactions-contact-design.md`

## Global Constraints

- Reuse `private.is_marketplace_eligible()` and `private.can_read_marketplace_post(...)`; do not create a parallel Student trust or marketplace visibility model.
- Every marketplace interaction that exposes or creates content requires approved + active + not hidden and current marketplace visibility.
- Favorites are private to the saving user; no student-facing endpoint returns who favorited a post.
- Owners cannot favorite their own posts.
- Comments support root + one reply level only; reply-to-reply normalizes to the root.
- Comment body is immutable after creation; author delete is soft-delete only.
- Student comment identity is projected with current `show_name` / `show_class`; ordinary student reads never require direct joins to another user's profile rows.
- Contact reveal returns exactly the post's selected `email` or `phone`, only when the corresponding current privacy flag allows it; there is no fallback to the alternate channel.
- Contact audit stores the method but never stores the revealed email/phone value.
- For the same requester + post, event creation is deduplicated for 15 minutes, while every reveal click re-checks current authorization and privacy. If the post's selected contact method changes during an existing dedupe window, fail closed until the prior 15-minute window expires rather than reveal a new method without a matching audit row.
- Revealed PII exists only in page memory; never persist it to URL, browser storage, post rows, audit rows, analytics, or logs.
- Notifications/reports remain Phase 5H; staff moderation writes remain Phase 5I; complete mock removal remains Phase 5J.
- No hosted development migration is applied until the clean local 5A–5G matrix is green.
- All trusted public RPCs revoke PUBLIC/anon EXECUTE, intentionally grant authenticated only, derive actor identity from `auth.uid()`, and use `SECURITY DEFINER SET search_path=''` when elevated access is required.

---

### Task 1: Favorites backend boundary and saved-post projection

**Files:**
- Create: `tests/favoritesBackend.e2e.mjs`
- Create: `supabase/migrations/20260822152000_phase5g_favorites.sql`
- Modify: `src/features/marketplace/marketplaceReadModel.ts`
- Test: `tests/marketplaceReadModel.test.ts`

**Interfaces:**
- Consumes: `private.is_marketplace_eligible()`, `private.can_read_marketplace_post(uuid,text)`, existing `public.favorites`, `public.get_marketplace_post(uuid)`.
- Produces RPC `public.list_my_saved_posts(p_limit integer default 20, p_offset integer default 0) returns jsonb`.
- Extends `get_marketplace_post` response with top-level booleans `viewerSaved` and `viewerOwnsPost`.
- `list_my_saved_posts` response: `{ items:[{ id,title,tradeType,categoryName,price,publishedAt,createdAt,favoriteCount }], totalCount, limit, offset }`.

- [ ] **Step 1: Write the failing favorites E2E matrix**

Create identities using the same local-test pattern as `tests/storageBackend.e2e.mjs`: verified owner, verified same-school reader, verified other-school reader, pending/unverified Student, and teacher. Create approved/active posts with `school` and `network` visibility through trusted owner RPCs, then approve them with test-admin SQL.

Core RED assertions:

```js
const selfFavorite = await owner.client.from('favorites').insert({ user_id:owner.userId, post_id:postId });
assert.ok(selfFavorite.error, 'owner must not favorite own post');

const save = await reader.client.from('favorites').insert({ user_id:reader.userId, post_id:postId });
assert.equal(save.error, null, save.error?.message ?? 'save must succeed');

const duplicate = await reader.client.from('favorites').insert({ user_id:reader.userId, post_id:postId });
assert.ok(duplicate.error, 'PK must prevent duplicate favorite row');

const saved = await reader.client.rpc('list_my_saved_posts', { p_limit:20, p_offset:0 });
assert.equal(saved.error, null);
assert.equal(saved.data.items[0].id, postId);
```

For cross-user DELETE, assert the request cannot remove the row rather than requiring PostgREST to return an error:

```js
await otherReader.client.from('favorites').delete().eq('user_id', reader.userId).eq('post_id', postId);
assert.equal(sqlValue(`select count(*)::text from public.favorites where user_id='${reader.userId}'::uuid and post_id='${postId}'::uuid;`), '1');
```

Also assert: pending/teacher/out-of-scope reader cannot save; reader B cannot SELECT reader A's favorite; hidden/completed/withdrawn/rejected posts cannot be newly saved; a previously saved row remains stored but disappears from `list_my_saved_posts` when the post becomes non-readable.

- [ ] **Step 2: Run the favorites E2E before migration and verify RED**

After local Supabase is started and env credentials are exported:

```bash
node tests/favoritesBackend.e2e.mjs
```

Expected: FAIL because owner self-favorite is still allowed by the old policy and/or `list_my_saved_posts` does not exist.

- [ ] **Step 3: Implement the favorites migration**

In `20260822152000_phase5g_favorites.sql`:

```sql
drop policy if exists favorites_insert_self_approved on public.favorites;
create policy favorites_insert_self_marketplace
on public.favorites
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (select private.is_marketplace_eligible())
  and exists (
    select 1
    from public.posts p
    where p.id = favorites.post_id
      and p.owner_id <> (select auth.uid())
      and p.moderation_status = 'approved'
      and p.lifecycle_status = 'active'
      and p.is_hidden = false
      and (select private.can_read_marketplace_post(p.school_id, p.visibility_scope))
  )
);
```

Keep self-only SELECT/DELETE policies. Do not grant UPDATE on `favorites`.

Implement `list_my_saved_posts` as `STABLE SECURITY DEFINER SET search_path=''`. Derive `v_actor_id := auth.uid()`, require marketplace eligibility, constrain `f.user_id = v_actor_id`, join favorites -> currently visible posts/categories, require approved/active/not-hidden and `can_read_marketplace_post`, paginate with `limit 1..50` and `offset >= 0`, and return backend-derived favorite counts. Revoke PUBLIC/anon EXECUTE; grant authenticated.

Update `get_marketplace_post` to capture the visible post owner in `v_owner_id` and return:

```sql
'viewerSaved', exists (
  select 1 from public.favorites f
  where f.user_id = (select auth.uid()) and f.post_id = p_post_id
),
'viewerOwnsPost', v_owner_id = (select auth.uid())
```

Do not expose raw owner UUID as part of this addition.

- [ ] **Step 4: Extend the marketplace detail parser contract**

```ts
export type MarketplaceDetailResponse = {
  post:MarketplaceReadPost;
  similarPosts:MarketplaceReadPost[];
  commentsEnabled:boolean;
  viewerSaved:boolean;
  viewerOwnsPost:boolean;
};
```

Require both booleans in `parseMarketplaceDetailResponse`; malformed/missing values throw `MARKETPLACE_RESPONSE_INVALID`.

- [ ] **Step 5: Run favorites + marketplace parser tests and verify GREEN**

```bash
node tests/favoritesBackend.e2e.mjs
npm run test:unit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/favoritesBackend.e2e.mjs supabase/migrations/20260822152000_phase5g_favorites.sql src/features/marketplace/marketplaceReadModel.ts tests/marketplaceReadModel.test.ts
git commit -m "feat: enforce live favorites boundary"
```

---

### Task 2: Comments trusted RPCs, two-level threading, and soft-delete projection

**Files:**
- Create: `tests/commentsBackend.e2e.mjs`
- Create: `supabase/migrations/20260822152100_phase5g_comments.sql`

**Interfaces:**
- Produces RPC `public.create_my_comment(p_post_id uuid, p_body text, p_reply_to_comment_id uuid default null) returns jsonb`.
- Produces RPC `public.delete_my_comment(p_comment_id uuid) returns jsonb`.
- Produces RPC `public.list_post_comments(p_post_id uuid) returns jsonb`.
- `create_my_comment` returns `{ id, postId, parentId, createdAt }`.
- `delete_my_comment` returns `{ id, deletedAt, alreadyDeleted }`.
- `list_post_comments` returns `{ items:[{ id,parentId,body,isDeleted,authorName,authorClassName,createdAt,canDelete }], totalCount }` ordered by `created_at asc, id asc`; the client groups rows by `parentId`.

- [ ] **Step 1: Write RED comments E2E**

Build on the identity/post setup pattern from Task 1. Assert:

```js
const root = await reader.client.rpc('create_my_comment', {
  p_post_id:postId,
  p_body:'  Bình luận gốc hợp lệ  ',
  p_reply_to_comment_id:null,
});
assert.equal(root.error, null);

const reply = await owner.client.rpc('create_my_comment', {
  p_post_id:postId,
  p_body:'Phản hồi hợp lệ',
  p_reply_to_comment_id:root.data.id,
});
assert.equal(reply.error, null);

const replyToReply = await reader.client.rpc('create_my_comment', {
  p_post_id:postId,
  p_body:'Phản hồi vào phản hồi',
  p_reply_to_comment_id:reply.data.id,
});
assert.equal(replyToReply.error, null);
assert.equal(replyToReply.data.parentId, root.data.id, 'third level must normalize to root');
```

Also assert: blank and 2001-char bodies fail; comments-disabled post fails; invisible/hidden/completed/rejected post fails; cross-post reply target fails; reply to deleted/removed target fails; direct authenticated INSERT/UPDATE/DELETE on comments is denied; no comment-edit RPC exists; non-author delete fails; author delete is idempotent and row remains; deleted root with visible replies is returned as tombstone with `body:null`; deleted root without visible replies disappears; student author identity respects current `show_name/show_class`.

- [ ] **Step 2: Run comments E2E before migration and verify RED**

```bash
node tests/commentsBackend.e2e.mjs
```

Expected: FAIL because the RPCs do not exist and direct INSERT is still granted.

- [ ] **Step 3: Implement comments security reset**

```sql
revoke insert, update, delete on table public.comments from public, anon, authenticated;
drop policy if exists comments_insert_self_approved on public.comments;
drop policy if exists comments_read_visible_public on public.comments;
drop policy if exists comments_read_own on public.comments;
```

Keep authenticated SELECT grant because existing staff moderation reads use `comments_read_staff_scope`; after the drops above, `comments_read_staff_scope` is the only authenticated raw-comment SELECT policy. Ordinary Students therefore receive no raw comment rows and use `list_post_comments` instead.

- [ ] **Step 4: Implement `create_my_comment`**

```sql
v_actor_id := (select auth.uid());
if v_actor_id is null or not (select private.is_marketplace_eligible()) then
  raise exception using message='EDU_SHARE_MARKETPLACE_ACCESS_DENIED';
end if;

select p.* into v_post
from public.posts p
where p.id = p_post_id
  and p.moderation_status='approved'
  and p.lifecycle_status='active'
  and p.is_hidden=false
  and p.comments_enabled=true
  and (select private.can_read_marketplace_post(p.school_id,p.visibility_scope));
```

Trim body with `btrim`; enforce 1..2000. If `p_reply_to_comment_id` is supplied, load the target on the same post, require `visibility_status='visible'` and `deleted_at is null`; if target already has `parent_comment_id`, use that root ID. Insert only server-controlled `author_id`, `visibility_status='visible'`, timestamps/defaults.

- [ ] **Step 5: Implement soft delete and student projection**

`delete_my_comment` locks the row, requires `author_id = auth.uid()`, sets `deleted_at=now()` if null, and never changes `body`.

`list_post_comments` first checks current marketplace post visibility, then projects:

```sql
case when c.deleted_at is not null then null else c.body end as body,
case when p.show_name then p.full_name else 'Học sinh EDU SHARE+' end as author_name,
case when p.show_class then sc.label else null end as author_class_name,
(c.author_id = (select auth.uid()) and c.deleted_at is null) as can_delete
```

Return `visibility_status='visible'` non-deleted roots/replies plus deleted roots only when at least one visible non-deleted reply remains. Do not return deleted replies to ordinary users because replies cannot have children under the two-level contract. Order returned flat rows by `created_at asc, id asc`.

- [ ] **Step 6: Lock down RPC execution and verify GREEN**

Each RPC is `SECURITY DEFINER SET search_path=''`, fully qualifies relations, revokes PUBLIC/anon EXECUTE, and grants authenticated only.

```bash
node tests/commentsBackend.e2e.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/commentsBackend.e2e.mjs supabase/migrations/20260822152100_phase5g_comments.sql
git commit -m "feat: add trusted marketplace comments"
```

---

### Task 3: Audited contact reveal, owner aggregate, and 15-minute race-safe dedupe

**Files:**
- Create: `tests/contactBackend.e2e.mjs`
- Create: `supabase/migrations/20260822152200_phase5g_contact.sql`

**Interfaces:**
- Produces RPC `public.reveal_post_contact(p_post_id uuid) returns jsonb`.
- Produces RPC `public.list_my_post_contact_events(p_post_id uuid, p_limit integer default 20) returns jsonb`.
- Reveal response: `{ method:'email'|'phone', value:string, eventId:string, eventCreatedAt:string, eventReused:boolean }`.
- Owner history response: `{ items:[{ id,requesterName,requesterClassName,revealedMethod,createdAt }], totalCount, favoriteCount }`.

- [ ] **Step 1: Write RED contact E2E**

Create an owner with both contact fields and explicit privacy toggles, plus eligible/ineligible viewers. Define exact audit-count helper:

```js
function contactEventCount(postId, requesterId) {
  return sqlValue(`
    select count(*)::text
    from public.contact_events
    where post_id='${postId}'::uuid
      and requester_id='${requesterId}'::uuid;
  `);
}
```

Assert normal reveal + sequential dedupe:

```js
const reveal = await reader.client.rpc('reveal_post_contact', { p_post_id:postId });
assert.equal(reveal.error, null);
assert.equal(reveal.data.method, 'email');
assert.equal(reveal.data.value, owner.email);
assert.equal(contactEventCount(postId, reader.userId), '1');

const second = await reader.client.rpc('reveal_post_contact', { p_post_id:postId });
assert.equal(second.error, null);
assert.equal(second.data.eventReused, true);
assert.equal(contactEventCount(postId, reader.userId), '1');
```

Assert race safety with five concurrent valid clicks:

```js
const concurrent = await Promise.all(
  Array.from({ length:5 }, () => reader.client.rpc('reveal_post_contact', { p_post_id:postId })),
);
assert.equal(concurrent.every((result) => result.error === null), true);
assert.equal(contactEventCount(postId, reader.userId), '1');
```

Flip `show_email=false` with test-admin SQL and assert another reveal inside the same window fails despite the existing event; verify no phone fallback. Restore email privacy, backdate the existing event by 16 minutes, reveal again, and assert count becomes `2` and `eventReused=false`.

For selected-method change inside an active dedupe window: create a fresh recent email event, update the post's selected method to `phone` in test-admin SQL while keeping the post otherwise visible, and assert reveal fails with `EDU_SHARE_CONTACT_METHOD_CHANGED_DURING_DEDUPE` rather than revealing phone without a matching audit event. Backdate the prior event past 15 minutes and assert phone reveal then succeeds with a new `revealed_method='phone'` event.

Also cover owner self-reveal, out-of-scope viewer, pending/teacher, hidden/completed/withdrawn/rejected post, and direct browser SELECT/INSERT/UPDATE/DELETE against `contact_events` denied after migration. Assert `contact_events` contains `revealed_method` but no contact-value column. Owner history must show requester identity according to current `show_name/show_class`, contain no requester PII, and return the true aggregate `favoriteCount` without returning favorite user IDs.

- [ ] **Step 2: Run contact E2E before migration and verify RED**

```bash
node tests/contactBackend.e2e.mjs
```

Expected: FAIL because `revealed_method` and reveal/history RPCs do not exist.

- [ ] **Step 3: Extend audit schema without duplicating PII**

```sql
alter table public.contact_events
  add column revealed_method text;
alter table public.contact_events
  add constraint contact_events_revealed_method_check
  check (revealed_method is null or revealed_method in ('email','phone'));
```

Future 5G RPC-created rows always provide non-null method. Do not add email/phone/contact-value columns.

```sql
revoke select, insert, update, delete on public.contact_events from public, anon, authenticated;
drop policy if exists contact_events_read_requester on public.contact_events;
drop policy if exists contact_events_read_post_owner on public.contact_events;
```

- [ ] **Step 4: Implement race-safe `reveal_post_contact`**

Check actor/marketplace/post visibility first, reject `p.owner_id = auth.uid()`, then load only the selected owner contact field + privacy flag. Validate current method/value before dedupe reuse.

```sql
perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(v_requester_id::text || ':' || p_post_id::text, 0)
);
```

After the lock:

```sql
select ce.id, ce.created_at, ce.revealed_method
into v_event_id, v_event_created_at, v_recent_method
from public.contact_events ce
where ce.post_id = p_post_id
  and ce.requester_id = v_requester_id
  and ce.created_at >= now() - interval '15 minutes'
order by ce.created_at desc, ce.id desc
limit 1;
```

If recent method equals current method, reuse audit metadata and return the newly revalidated current contact value with `eventReused=true`. If recent method differs, raise `EDU_SHARE_CONTACT_METHOD_CHANGED_DURING_DEDUPE` and reveal nothing. If no recent event exists, insert `event_type='view_contact'`, `revealed_method=v_method`, return `eventReused=false`.

- [ ] **Step 5: Implement owner history + favorite aggregate projection**

`list_my_post_contact_events` requires `(select private.is_marketplace_eligible())` and verifies `posts.owner_id = auth.uid()`. Limit is 1..50. Return only events with non-null `revealed_method`. Join requester `profiles` and class label; mask current identity with `show_name/show_class`. Return only event ID, masked name/class, method, timestamp, `totalCount`, plus `favoriteCount = count(*) from public.favorites where post_id=p_post_id`. Never join requester `profile_private`; never return favorite user IDs.

- [ ] **Step 6: Verify contact matrix GREEN**

```bash
node tests/contactBackend.e2e.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tests/contactBackend.e2e.mjs supabase/migrations/20260822152200_phase5g_contact.sql
git commit -m "feat: add audited contact reveal"
```

- [ ] **Step 8: Open the Phase 5G draft PR**

Open `phase/5g-interactions-contact` -> `main` as a draft after all three backend matrices are locally green. The PR body records the approved scope and states that hosted migrations have not yet been applied. From this point onward, frontend/CI commits receive pull-request CI coverage in addition to local verification.

---

### Task 4: Strict frontend interaction model and parsers

**Files:**
- Create: `src/features/interactions/interactionModel.ts`
- Create: `tests/interactionModel.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces:

```ts
export type CommentView = {
  id:string;
  parentId:string|null;
  body:string|null;
  isDeleted:boolean;
  authorName:string;
  authorClassName:string|null;
  createdAt:string;
  canDelete:boolean;
};

export type CommentMutationResult = {
  id:string;
  postId:string;
  parentId:string|null;
  createdAt:string;
};

export type CommentDeleteResult = {
  id:string;
  deletedAt:string;
  alreadyDeleted:boolean;
};

export type ContactRevealView = {
  method:'email'|'phone';
  value:string;
  eventId:string;
  eventCreatedAt:string;
  eventReused:boolean;
};

export type OwnerContactEventView = {
  id:string;
  requesterName:string;
  requesterClassName:string|null;
  revealedMethod:'email'|'phone';
  createdAt:string;
};

export type OwnerContactHistory = {
  items:OwnerContactEventView[];
  totalCount:number;
  favoriteCount:number;
};

export type SavedPostView = {
  id:string;
  title:string;
  tradeType:'lend'|'give'|'exchange'|'low_price_sale';
  categoryName:string;
  price:number|null;
  publishedAt:string|null;
  createdAt:string;
  favoriteCount:number;
};

export type SavedPostList = {
  items:SavedPostView[];
  totalCount:number;
  limit:number;
  offset:number;
};
```

- Produces parsers:
  - `parseCommentListResponse(raw:unknown):CommentView[]`
  - `parseCommentMutationResponse(raw:unknown):CommentMutationResult`
  - `parseCommentDeleteResponse(raw:unknown):CommentDeleteResult`
  - `parseContactRevealResponse(raw:unknown):ContactRevealView`
  - `parseOwnerContactHistoryResponse(raw:unknown):OwnerContactHistory`
  - `parseSavedPostListResponse(raw:unknown):SavedPostList`

- [ ] **Step 1: Write parser tests first**

```ts
assert.deepEqual(parseContactRevealResponse({
  method:'email', value:'student@example.test', eventId:'00000000-0000-0000-0000-000000000001',
  eventCreatedAt:'2026-08-22T08:00:00Z', eventReused:false,
}), {
  method:'email', value:'student@example.test', eventId:'00000000-0000-0000-0000-000000000001',
  eventCreatedAt:'2026-08-22T08:00:00Z', eventReused:false,
});

assert.throws(() => parseContactRevealResponse({ method:'email', value:'x', eventId:'bad' }), /INTERACTION_RESPONSE_INVALID/);
assert.throws(() => parseCommentListResponse({ items:[{ id:'x', body:42 }] }), /INTERACTION_RESPONSE_INVALID/);
```

Test deleted comment contract (`body:null`, `isDeleted:true`), nullable class, booleans, UUID-shaped IDs, safe integer counts, valid timestamps, enum values, nullable saved-post price/publish time, owner history `favoriteCount`, and malformed payload fail-closed behavior.

- [ ] **Step 2: Run parser test and verify RED**

Add:

```json
"test:interaction-model": "esbuild tests/interactionModel.test.ts --bundle --platform=node --format=esm --outfile=.interaction-model-test.mjs && node --test .interaction-model-test.mjs; status=$?; node -e \"require('node:fs').rmSync('.interaction-model-test.mjs',{force:true})\"; exit $status"
```

Run `npm run test:interaction-model`; expected FAIL because module is missing.

- [ ] **Step 3: Implement strict parsers**

Use small helpers (`isRecord`, UUID/string/null parser, boolean parser, timestamp parser, safe non-negative integer parser, enum parser). `invalid()` throws exactly `INTERACTION_RESPONSE_INVALID`. Do not silently coerce values. `parseCommentListResponse` validates `{items,totalCount}` but returns the validated `items` array because DetailPage does not display a separate comment total in 5G.

- [ ] **Step 4: Run and verify GREEN**

```bash
npm run test:interaction-model
```

- [ ] **Step 5: Commit**

```bash
git add src/features/interactions/interactionModel.ts tests/interactionModel.test.ts package.json
git commit -m "test: define interaction response contracts"
```

---

### Task 5: Supabase interaction service with safe error mapping

**Files:**
- Create: `src/features/interactions/interactionService.ts`
- Create: `tests/interactionServiceWiring.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `setPostSaved(postId:string, saved:boolean):Promise<void>`.
- Produces `listMySavedPosts(limit?:number, offset?:number):Promise<SavedPostList>`.
- Produces `listPostComments(postId:string):Promise<CommentView[]>`.
- Produces `createMyComment(postId:string, body:string, replyToCommentId?:string|null):Promise<CommentMutationResult>`.
- Produces `deleteMyComment(commentId:string):Promise<CommentDeleteResult>`.
- Produces `revealPostContact(postId:string):Promise<ContactRevealView>`.
- Produces `listMyPostContactEvents(postId:string, limit?:number):Promise<OwnerContactHistory>`.

- [ ] **Step 1: Write service wiring RED test**

```ts
assert.match(source, /\.from\(['"]favorites['"]\)/);
assert.match(source, /\.rpc\(['"]list_my_saved_posts['"]/);
assert.match(source, /\.rpc\(['"]list_post_comments['"]/);
assert.match(source, /\.rpc\(['"]create_my_comment['"]/);
assert.match(source, /\.rpc\(['"]delete_my_comment['"]/);
assert.match(source, /\.rpc\(['"]reveal_post_contact['"]/);
assert.match(source, /\.rpc\(['"]list_my_post_contact_events['"]/);
assert.doesNotMatch(source, /profile_private|service_role|localStorage|sessionStorage|getPublicUrl/);
```

- [ ] **Step 2: Run and verify RED**

Add `test:interaction-service-wiring` with the repository's esbuild/node-test cleanup pattern. Expected FAIL because the service file is missing.

- [ ] **Step 3: Implement service**

`setPostSaved` obtains current auth user ID via `supabase.auth.getUser()`. Save uses `favorites.insert({user_id:user.id,post_id})`; treat Postgres duplicate key code `23505` as idempotent success. Unsave uses `.delete().eq('user_id',user.id).eq('post_id',postId)`.

All RPC functions trim required IDs, pass exact parameter names from Tasks 1–3, and parse responses before returning. Map backend errors to concise Vietnamese messages without echoing raw PII or backend detail. Contact mapping includes `EDU_SHARE_CONTACT_METHOD_CHANGED_DURING_DEDUPE` -> a cooldown message and never logs response `data` or the contact value.

- [ ] **Step 4: Run service wiring + model tests GREEN**

```bash
npm run test:interaction-model
npm run test:interaction-service-wiring
```

- [ ] **Step 5: Commit**

```bash
git add src/features/interactions/interactionService.ts tests/interactionServiceWiring.test.ts package.json
git commit -m "feat: add Supabase interaction service"
```

---

### Task 6: Replace DetailPage local favorite/comment/contact mocks

**Files:**
- Modify: `src/pages/DetailPage.tsx`
- Create: `tests/interactionsDetailWiring.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes `MarketplaceDetailResponse.viewerSaved`, `viewerOwnsPost`.
- Consumes `setPostSaved`, `listPostComments`, `createMyComment`, `deleteMyComment`, `revealPostContact`.

- [ ] **Step 1: Write DetailPage wiring RED test**

```ts
assert.match(source, /setPostSaved\s*\(/);
assert.match(source, /listPostComments\s*\(/);
assert.match(source, /createMyComment\s*\(/);
assert.match(source, /deleteMyComment\s*\(/);
assert.match(source, /revealPostContact\s*\(/);
assert.doesNotMatch(source, /LOCAL_UI_COMMENTS|profile\.setPostSaved|profile\.isPostSaved|mô phỏng local.*liên hệ/si);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.match(source, /Phase 5H/);
```

- [ ] **Step 2: Run and verify RED**

Add `test:interactions-detail-wiring`; expected FAIL against current local mocks.

- [ ] **Step 3: Implement initial interaction load state**

Remove `useDataAccess()` from DetailPage. When marketplace detail becomes ready, set `saved = detail.viewerSaved`, `viewerOwnsPost = detail.viewerOwnsPost`, `favoriteCount = detail.post.favoriteCount`, and load comments through `listPostComments(post.id)`. Keep signed-media flow unchanged.

Use separate `interactionError`, `favoriteBusy`, `commentBusy`, `deletingCommentId`, `contactBusy`, and `revealedContact:null|ContactRevealView` state.

- [ ] **Step 4: Implement optimistic favorite with backend reconciliation**

Capture old saved/count, update optimistically, call `setPostSaved`, and rollback on failure. On success call `getMarketplacePost(post.id)` once and replace `saved` + `favoriteCount` from its `viewerSaved` and `post.favoriteCount`. Hide the save action when `viewerOwnsPost=true`.

- [ ] **Step 5: Implement real comments UI**

Submit calls `createMyComment`; pending disables submit. On success clear input and refresh `listPostComments`. Reply passes clicked comment ID to backend. Show delete only when `comment.canDelete`; confirm, call `deleteMyComment`, refresh. Render `body ?? 'Bình luận đã được tác giả xóa'`. Keep report-comment deferred to Phase 5H.

- [ ] **Step 6: Implement explicit contact reveal**

Call `revealPostContact` only on click. Store result only in React state. Render exactly one method/value and an audit notice. Do not prefetch, persist, place in URL, or fallback to the alternate method after failure.

- [ ] **Step 7: Run tests/build GREEN**

```bash
npm run test:interactions-detail-wiring
npm run test:run
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/pages/DetailPage.tsx tests/interactionsDetailWiring.test.ts package.json
git commit -m "feat: connect marketplace detail interactions"
```

---

### Task 7: Replace Profile saved-post placeholder with live backend data

**Files:**
- Modify: `src/pages/ProfilePage.tsx`
- Create: `tests/profileSavedPostsWiring.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes `listMySavedPosts()` and `setPostSaved()`.
- Uses existing `navigateLegacy('detail',{id})`.

- [ ] **Step 1: Write Profile saved-post RED test**

```ts
assert.match(source, /listMySavedPosts\s*\(/);
assert.match(source, /setPostSaved\s*\(/);
assert.doesNotMatch(source, /Danh sách yêu thích chưa được hiển thị ở đây/);
```

- [ ] **Step 2: Run and verify RED**

Add `test:profile-saved-posts-wiring`; expected FAIL because Profile still shows the Phase 5G placeholder.

- [ ] **Step 3: Implement saved-post loading and removal**

Load saved posts alongside profile data with independent loading/error state so favorite-list failure does not erase truthful profile data. Render title, trade label mapped from four DB enums, category, formatted VND price or `Miễn phí / thỏa thuận`, published/created date, detail navigation, and unsave button. On unsave success remove item then re-fetch `listMySavedPosts` for server reconciliation.

Do not display hidden/non-readable saved posts because the RPC filters current visibility. Do not use favorite rows as an authorization bypass.

- [ ] **Step 4: Run tests/build GREEN**

```bash
npm run test:profile-saved-posts-wiring
npm run test:run
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/ProfilePage.tsx tests/profileSavedPostsWiring.test.ts package.json
git commit -m "feat: show live saved posts in profile"
```

---

### Task 8: Add owner favorite count and contact-reveal history to MyDetailPage

**Files:**
- Modify: `src/pages/MyDetailPage.tsx`
- Create: `tests/ownerContactHistoryWiring.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes `listMyPostContactEvents(postId,20):Promise<OwnerContactHistory>` where response includes `favoriteCount`.
- Does not consume requester contact PII or favorite-user identities.

- [ ] **Step 1: Write MyDetail RED wiring test**

```ts
assert.match(source, /listMyPostContactEvents\s*\(/);
assert.match(source, /Hoạt động liên hệ/);
assert.match(source, /favoriteCount/);
assert.doesNotMatch(source, /Lượt lưu, yêu cầu liên hệ, bình luận và báo cáo sẽ được nối ở Phase 5G\/5H/);
assert.doesNotMatch(source, /contact_email|profile_private/);
```

- [ ] **Step 2: Run and verify RED**

Add `test:owner-contact-history-wiring`; expected FAIL against current placeholder.

- [ ] **Step 3: Load owner interaction history independently**

When `postId` is present, call `listMyPostContactEvents(postId,20)` in parallel with existing owner detail/media reads. Interaction-history failure shows a scoped message and never blocks owner post detail.

- [ ] **Step 4: Render truthful aggregates and audited history**

Render `favoriteCount` as aggregate only; do not display who favorited. Render contact `totalCount` and recent rows with masked requester name, optional class, Vietnamese timestamp, and `Email` / `Số điện thoại` from `revealedMethod`. Do not display requester contact values. Keep report/notification metrics deferred to 5H and do not invent them.

- [ ] **Step 5: Run tests/build GREEN**

```bash
npm run test:owner-contact-history-wiring
npm run test:run
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/MyDetailPage.tsx tests/ownerContactHistoryWiring.test.ts package.json
git commit -m "feat: show owner interaction audit"
```

---

### Task 9: CI integration, no-mock contracts, and complete local release matrix

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`
- Create: `tests/interactionsPageWiring.test.ts`

**Interfaces:**
- Adds CI step `Phase 5G interactions/contact matrix` after Phase 5F.
- Extends `npm run test:run` with all non-E2E Phase 5G parser/wiring tests.

- [ ] **Step 1: Add final source-level no-mock contract**

```ts
assert.doesNotMatch(detail, /LOCAL_UI_COMMENTS|mô phỏng local.*liên hệ|profile\.setPostSaved/si);
assert.doesNotMatch(profile, /Danh sách yêu thích chưa được hiển thị ở đây/);
assert.doesNotMatch(myDetail, /yêu cầu liên hệ.*Phase 5G/i);
assert.match(detail, /Báo cáo.*Phase 5H|Phase 5H.*Báo cáo/si);
```

Scan literal source text under `src/features/interactions` and fail if it contains `service_role`, `SUPABASE_SERVICE_ROLE`, `localStorage`, `sessionStorage`, or `profile_private`.

- [ ] **Step 2: Wire scripts**

Add `test:interactions-page-wiring` and include `test:interaction-model`, `test:interaction-service-wiring`, `test:interactions-detail-wiring`, `test:profile-saved-posts-wiring`, `test:owner-contact-history-wiring`, and `test:interactions-page-wiring` in `test:run`. E2E scripts remain outside `test:run` because they require local Supabase credentials.

- [ ] **Step 3: Add CI matrix step**

Immediately after `Phase 5F private storage matrix`:

```yaml
      - name: Phase 5G interactions/contact matrix
        run: |
          node tests/favoritesBackend.e2e.mjs
          node tests/commentsBackend.e2e.mjs
          node tests/contactBackend.e2e.mjs
```

Do not change same-repo self-hosted PR condition, concurrency, cleanup, Node version, or local credential export.

- [ ] **Step 4: Run full local verification**

```bash
npm run test:run
npm run build
node tests/localAuthConfirmation.e2e.mjs
node scripts/test-roster-registration-trust.mjs
node tests/marketplaceRead.e2e.mjs
node tests/profileBackend.e2e.mjs
node tests/ownerPostWrite.e2e.mjs
node tests/ownerPostRead.e2e.mjs
node tests/storageBackend.e2e.mjs
node tests/favoritesBackend.e2e.mjs
node tests/commentsBackend.e2e.mjs
node tests/contactBackend.e2e.mjs
```

Expected: all PASS on a clean local Supabase migration replay.

- [ ] **Step 5: Commit CI integration**

```bash
git add .github/workflows/ci.yml package.json tests/interactionsPageWiring.test.ts
git commit -m "ci: add Phase 5G interaction matrix"
```

---

### Task 10: Hosted-development rollout, audit, docs, and exact-head gate

**Files:**
- Modify: `docs/00_CURRENT_PROJECT_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Rename after hosted application only when hosted-assigned migration versions differ: the three Phase 5G migration files, preserving SQL bytes exactly.

**Interfaces:**
- Hosted project: development project `brnshmzflawffaysyyvx`.
- PASS means exact final PR HEAD has green `verify` and `local-auth-e2e` jobs with the 5G matrix included.

- [ ] **Step 1: Refresh the existing draft PR body and verify implementation-head CI**

Update the draft PR with completed local backend/frontend evidence and explicit note that hosted migrations are still pending. Both self-hosted jobs must complete successfully on the exact implementation HEAD before hosted mutation. Do not proceed from a failing, cancelled, queued, or older SHA.

- [ ] **Step 2: Apply the three reviewed migrations to hosted development only**

Apply in order: favorites, comments, contact. Use migration DDL actions, never ad-hoc DDL via raw SQL. If hosted tooling assigns different timestamps, rename repository files to those exact versions without changing SQL bytes, then commit alignment.

- [ ] **Step 3: Audit hosted schema and permissions**

Record evidence that:

```text
favorites: authenticated SELECT/INSERT/DELETE only; no UPDATE; self-only select/delete; insert uses marketplace eligibility + visibility + no self-favorite
comments: browser INSERT/UPDATE/DELETE absent; only staff raw SELECT policy remains; student visible-content reads use RPC
contact_events: browser SELECT/INSERT/UPDATE/DELETE absent; revealed_method constraint exists; no contact-value column exists
RPCs: list_my_saved_posts, create_my_comment, delete_my_comment, list_post_comments, reveal_post_contact, list_my_post_contact_events exist
RPC EXECUTE: anon false, authenticated true where intended
SECURITY DEFINER RPCs: fixed search_path=''
notifications/reports/moderation grants: unchanged by 5G
```

Run Supabase Security Advisor and Performance Advisor. Classify trusted authenticated SECURITY DEFINER warnings as intentional only after verifying internal auth checks + fixed search path. Do not add/drop indexes merely to silence performance hints without query-plan evidence.

- [ ] **Step 4: Update project docs truthfully**

`docs/00_CURRENT_PROJECT_STATUS.md` corrects stale 5F wording to integrated/PASS and marks Phase 5G PASS only after hosted audit + full matrix. Runtime architecture says favorites/comments/contact are real, while reports/notifications/moderation remain later phases. Next checkpoint becomes 5H.

`docs/ROADMAP.md` changes the 5G line to `**5G Interactions + Contact — PASS**` with a concise summary of live favorites, two-level comments/soft-delete, and audited privacy-gated contact reveal.

- [ ] **Step 5: Run final exact-head CI after docs/migration-history alignment**

Push final docs/alignment commit and require a fresh PR CI run on that exact SHA. Verify both jobs and individual steps, including `Phase 5G interactions/contact matrix`.

- [ ] **Step 6: Final verification before PASS/merge claim**

```text
unit tests PASS
production build PASS
Phase 5A Auth E2E PASS
Phase 5B trust/roster matrix PASS
Phase 5C marketplace matrix PASS
Phase 5D profile matrix PASS
Phase 5E owner write/read matrices PASS
Phase 5F storage matrix PASS
Phase 5G favorites matrix PASS
Phase 5G comments matrix PASS
Phase 5G contact matrix PASS
owner self-favorite denied
cross-user favorite access denied
comment spoof/edit/direct mutation denied
reply depth normalized to 2 levels
soft-deleted body hidden from ordinary projection
contact privacy change rechecked on every reveal
15-minute contact audit dedupe race-safe
method change during dedupe fails closed rather than creating an unaudited reveal
contact PII absent from audit rows/browser persistence
owner sees aggregate favorite count but never favorite identities
owner contact history contains masked requester identity only
reports/notifications/moderation permissions not widened
hosted migrations aligned with repository
Security/Performance advisors reviewed
exact final PR HEAD CI PASS
```

Only after this checklist is satisfied should the PR be marked ready and merged.
