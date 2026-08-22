# Phase 5G — Interactions + Audited Contact Reveal Design

Date: 2026-08-22
Branch: `phase/5g-interactions-contact`
Status: Design approved in chat; implementation not started

## 1. Goal

Phase 5G replaces the remaining local/mock interaction flows for marketplace favorites, comments/replies, and contact reveal with live Supabase-backed behavior while preserving the trust, privacy, marketplace visibility, and school-boundary rules established in earlier phases.

Phase 5G passes when:

- favorites are live and owner-scoped;
- comments/replies are live with two-level threads and author soft-delete;
- contact reveal is a trusted audited workflow that returns only the owner's selected contact channel when current privacy allows it;
- no fake counts or local mock state remain for those three flows;
- notifications/reports/moderation remain outside this phase.

## 2. Existing Baseline

The following tables already exist and remain the canonical storage:

- `public.favorites`
- `public.comments`
- `public.contact_events`
- `public.notifications`

`notifications` remains Phase 5H.

The marketplace already has trusted helpers and projections that must remain the single source of truth for access:

- `private.is_marketplace_eligible()`
- `private.can_read_marketplace_post(post_school_id, visibility_scope)`
- `public.get_marketplace_post(...)`
- `public.list_marketplace_posts(...)`

The existing marketplace read projection already derives `favoriteCount` from `public.favorites`.

The post owner already selects `preferred_contact_method` as either `email` or `phone`, and post creation/edit validation already ensures the selected contact value exists in `profile_private`.

## 3. Scope

### In scope

- Save and unsave marketplace posts.
- Read the current user's saved posts.
- Real favorite counts derived from backend rows.
- Create root comments.
- Create replies.
- Normalize replies into a maximum two-level thread.
- Soft-delete the current user's own comments.
- Read comment threads with privacy-masked author identity.
- Reveal exactly one owner contact channel through a trusted RPC.
- Audit contact reveals without storing the revealed PII value.
- Owner-facing per-post contact reveal history.
- Frontend integration in `DetailPage`, Profile saved-posts section, and `MyDetailPage`.
- Phase 5G local Supabase integration matrix and CI step.

### Explicitly out of scope

- Comment editing after submission.
- Arbitrarily deep nested comments.
- Comment/report moderation mutations.
- Reports backend integration.
- Notification generation or notification UI integration.
- Staff moderation writes.
- Full runtime mock removal outside the 5G surfaces.
- New recommendation/reputation scoring based on favorites.

These remain for later phases 5H, 5I, and 5J.

## 4. Architecture Decision

Use a hybrid boundary.

### Favorites: direct RLS-backed table operations

Favorites are a simple owner-scoped relation keyed by `(user_id, post_id)`. The browser may use direct `SELECT`, `INSERT`, and `DELETE` under tightened RLS.

### Comments: trusted RPC mutations + trusted read projection

The browser must not directly insert, update, or delete comment rows. Comment creation, reply normalization, and soft-delete require server-side invariants and therefore use narrow authenticated RPCs.

Comment reading uses a trusted projection so the browser never needs broad read access to other users' profile rows to render masked identity.

### Contact reveal: trusted RPC only

Contact reveal reads another user's private contact field and creates audit state. It must be implemented only through a `SECURITY DEFINER` RPC with fixed `search_path` and explicit authenticated execution.

## 5. Shared Trust and Visibility Boundary

Every 5G action that targets a marketplace post must reuse the existing marketplace eligibility and visibility logic rather than implementing an alternative trust model.

The caller must satisfy:

1. authenticated session;
2. confirmed email;
3. approved account;
4. verified school membership with verification metadata;
5. active Student role for the current school;
6. active source school;
7. current permission to read the target post under `private.can_read_marketplace_post(...)`;
8. target post is `approved`, `active`, and not hidden.

If any condition changes while a page is open, the next backend action must fail closed.

## 6. Favorites

### Rules

A user may save a post only when:

- `auth.uid() = favorites.user_id`;
- the caller is marketplace-eligible;
- the post is currently marketplace-readable to the caller;
- the post remains approved, active, and not hidden;
- the post owner is not the caller.

A user may delete only their own favorite rows.

A user may read only their own favorite rows.

No student-facing API may return the list of users who favorited a post.

### Owner self-favorite

The owner must not be allowed to favorite their own post. This prevents artificial engagement and keeps future analytics/reputation signals cleaner.

### Favorite counts

Favorite counts remain backend-derived from `public.favorites` through marketplace read projections. The frontend must not maintain a fake baseline count.

The detail UI may update optimistically for responsiveness, but on failure it must roll back and the backend remains authoritative.

### Saved-post list

The Profile saved-post section becomes a real Supabase-backed list.

A saved row does not grant continued marketplace access. If the post later becomes withdrawn, completed, hidden, rejected, or no longer visible under school/network scope, it must not be returned as a readable saved marketplace item.

The underlying favorite row may remain unless explicitly removed.

## 7. Comments and Replies

### Thread model

Threads are limited to two visible levels:

- root comment;
- replies to that root.

If the caller replies to an existing reply, the backend resolves that reply's root and stores the new reply under the root. No third-level nesting is created.

### Create RPC

A trusted RPC such as `public.create_my_comment(p_post_id, p_body, p_reply_to_comment_id default null)` must:

- derive the author from `auth.uid()`;
- verify current marketplace eligibility;
- verify current marketplace visibility for the post;
- verify the post is approved, active, not hidden;
- verify `comments_enabled = true`;
- trim and validate body length between 1 and 2000 characters;
- reject cross-post reply targets;
- reject deleted/removed reply targets for normal student interactions;
- normalize a reply-to-reply to the root comment;
- force student-created rows to start as `visibility_status = 'visible'` with no client-supplied timestamps or deletion fields.

The browser must not supply `author_id`, `visibility_status`, `deleted_at`, `created_at`, or `updated_at`.

### No comment editing

Phase 5G provides no API for changing comment body after submission.

This is intentional for auditability and moderation clarity.

### Soft-delete RPC

A trusted RPC such as `public.delete_my_comment(p_comment_id)` must:

- derive the caller from `auth.uid()`;
- permit only the original author;
- set `deleted_at` server-side;
- preserve the row;
- not repurpose the body into a new message;
- be idempotent or return a stable already-deleted result.

### Comment read projection

A trusted read RPC such as `public.list_post_comments(p_post_id)` must:

- enforce current marketplace eligibility and post visibility;
- return only the fields needed by the UI;
- apply `profiles.show_name` and `profiles.show_class` before returning author identity;
- never expose `profile_private`;
- not return original body content for soft-deleted comments to ordinary users.

If a deleted root has visible replies, the projection keeps a tombstone placeholder such as `Bình luận đã được tác giả xóa` so the thread structure remains understandable.

A deleted comment with no remaining visible replies may be omitted from the student projection.

### Staff behavior

Existing staff read scope may remain intact where already established, but Phase 5G does not add staff comment hide/remove mutation workflows. Those belong to Phase 5I.

## 8. Audited Contact Reveal

### User-visible behavior

The viewer does not receive private contact data when the detail page loads.

Only an explicit click on `Xem liên hệ` invokes the reveal RPC.

The reveal returns exactly one channel:

- `email`, if the post selected email and the owner currently has `show_email = true`;
- `phone`, if the post selected phone and the owner currently has `show_phone = true`.

The RPC must never return both channels.

If the selected channel is not currently permitted by privacy settings, the RPC fails closed. It must not silently fall back to the other channel.

The owner may not use this workflow to reveal their own contact information.

### Server-side checks

A trusted RPC such as `public.reveal_post_contact(p_post_id)` must:

- derive requester from `auth.uid()`;
- verify marketplace eligibility;
- verify the post is currently marketplace-readable;
- verify approved/active/not-hidden state;
- reject owner-as-requester;
- read the post's `preferred_contact_method`;
- read only the corresponding field and privacy toggle from `profile_private`;
- reject missing/blank or privacy-disabled contact values;
- insert or reuse an audit event according to the dedupe rule;
- return only `{ method, value }` plus non-sensitive audit metadata if needed by UI.

### Audit data

`contact_events` must be extended with a `revealed_method` field constrained to `email` or `phone`.

The table must not store the actual revealed email address or phone number.

This preserves historical meaning if a post owner later changes `preferred_contact_method` while avoiding PII duplication.

### Dedupe window

For the same `(requester_id, post_id)`, at most one new audit event is created within a 15-minute window.

Every reveal click still re-runs current eligibility, visibility, post-state, contact existence, and privacy checks.

The dedupe affects only event insertion. It must never allow a stale prior reveal event to bypass newly changed privacy settings.

After 15 minutes, a new valid reveal may create a new event.

### Client handling of PII

The revealed contact value lives only in page memory after a successful reveal.

The frontend must not place it in:

- URL/query parameters;
- `localStorage` or `sessionStorage`;
- mock repositories;
- post rows;
- contact event rows;
- analytics payloads;
- error logging.

Reloading or navigating away removes the revealed value from the UI state and requires a new reveal.

## 9. Owner Contact History

Phase 5G does not create a new standalone history page.

`MyDetailPage` gains an `Hoạt động liên hệ` section for the current owner's post.

A trusted owner read RPC returns recent reveal events only for posts owned by `auth.uid()`.

Each event may include:

- event timestamp;
- `revealed_method`;
- requester display name after applying the requester's current `show_name` setting;
- requester class label only when current `show_class` permits it.

The response must not include requester email or phone.

This satisfies the approved audit model in which a post owner can see who accessed their private contact channel and when, without exposing additional requester PII.

## 10. Frontend Integration

### `DetailPage`

Replace all local/mock behavior for:

- saved state;
- favorite count adjustment;
- local comments;
- local replies;
- local contact reveal.

The page loads:

- marketplace detail;
- current saved state;
- comment thread;
- signed media URLs.

Favorite mutations may be optimistic with rollback.

Comment submit and delete buttons disable while their request is pending.

Contact reveal is explicit and non-prefetched.

Report actions remain clearly labeled as Phase 5H/local until the report backend is implemented.

### Profile saved posts

Replace the Phase 5G placeholder with a live saved-post list.

Each visible item includes enough marketplace display fields for navigation and unsave action. Media preview may use the existing private signed-media workflow when available.

### `MyDetailPage`

Replace the placeholder about future contact activity with real owner contact reveal history and real favorite count where appropriate.

Do not display who favorited the post.

## 11. Error and Race Handling

The backend is authoritative for every mutation.

Required behavior includes:

- post withdrawn/hidden/completed while page is open -> next action fails and UI refreshes/reports current state;
- privacy disabled after page load -> next contact reveal fails;
- comments disabled after page load -> comment submit fails;
- duplicate favorite insert -> primary key and/or idempotent frontend flow prevents duplicate rows;
- duplicate comment submit -> frontend pending-state guard prevents accidental double-submit;
- malformed RPC payload -> frontend parser fails closed;
- no client-side fallback that broadens access after a backend authorization failure.

## 12. Database Security and Grants

### Favorites

Keep only the minimum authenticated table privileges required for self-service favorite operations.

Replace older eligibility-only policies with marketplace-eligibility + current marketplace-visibility checks and owner-self-favorite prevention.

### Comments

Revoke browser mutation privileges on `public.comments`.

Only trusted RPCs perform student comment writes.

Student-facing comment reads should prefer the trusted projection rather than broad profile joins in the browser.

### Contact events

Do not grant browser INSERT/UPDATE/DELETE on `public.contact_events`.

Contact-event creation remains internal to the reveal RPC.

Owner/requester raw-table SELECT should be removed if the new trusted read projections fully replace it, unless a concrete later requirement justifies keeping it.

### RPC requirements

Every public trusted 5G RPC must:

- use `SECURITY DEFINER` only where elevated access is required;
- use `SET search_path = ''`;
- fully qualify referenced objects;
- revoke execution from `public` and `anon`;
- grant execution only to `authenticated` when intended;
- derive actor identity from `auth.uid()`;
- enforce all sensitive authorization server-side.

Private helpers should remain inaccessible as general browser APIs.

## 13. Testing Strategy

Implementation follows RED -> GREEN -> REFACTOR.

A new local Supabase E2E matrix is added before backend implementation so the existing system first demonstrates the missing 5G contract.

### Favorites matrix

Must verify:

- eligible save succeeds;
- unsave succeeds;
- duplicate save does not create a second row;
- owner self-favorite is denied;
- one user cannot read/delete another user's favorite;
- unverified/pending/revoked users are denied;
- hidden/completed/withdrawn/rejected posts are denied;
- school/network visibility is enforced;
- backend favorite count changes correctly;
- saved-post listing never bypasses current marketplace visibility.

### Comments matrix

Must verify:

- create root succeeds;
- create reply succeeds;
- reply-to-reply normalizes to root;
- blank and >2000-character bodies fail;
- comments-disabled post fails;
- currently invisible post fails;
- caller cannot spoof author identity;
- author can soft-delete own comment;
- another user cannot delete it;
- row remains after soft-delete;
- original body is not returned to ordinary users after deletion;
- deleted root with visible replies returns a tombstone;
- no edit-comment API is exposed;
- name/class privacy masking is correct.

### Contact matrix

Must verify:

- eligible reveal returns exactly the selected permitted channel;
- email privacy off denies email reveal;
- phone privacy off denies phone reveal;
- no fallback to alternate channel;
- owner self-reveal is denied;
- out-of-scope viewer is denied;
- hidden/completed/withdrawn/rejected post is denied;
- browser cannot directly read another user's `profile_private`;
- audit row stores `revealed_method` but not contact value;
- repeated reveal inside 15 minutes re-checks privacy but dedupes audit insertion;
- reveal after the dedupe window may create a new event;
- owner history masks requester identity correctly and contains no requester PII.

### Regression/security matrix

Must verify:

- Phase 5C marketplace read remains green;
- Phase 5E owner post write/read remains green;
- Phase 5F private storage remains green;
- anon cannot execute 5G mutation/reveal RPCs;
- trusted RPCs have fixed search paths and intentional execute grants;
- browser has no direct comment/contact-event mutation privileges;
- Phase 5H/5I notification/report/moderation permissions are not accidentally widened.

### Frontend/unit tests

Must verify:

- malformed RPC responses fail closed;
- favorite optimistic UI rolls back on request failure;
- pending comment submission cannot duplicate locally;
- revealed PII is not persisted to browser storage or URL state;
- `LOCAL_UI_COMMENTS` and local favorite/contact simulation are removed from `DetailPage`;
- report UI remains clearly deferred to Phase 5H.

## 14. CI and Release Gate

The existing self-hosted CI local Supabase sequence remains intact.

Add a step after Phase 5F:

`Phase 5G interactions/contact matrix`

Phase 5G is not PASS until the exact PR HEAD has all of the following green:

1. unit tests;
2. production build;
3. local auth confirmation E2E;
4. Phase 5B integration matrix;
5. Phase 5C marketplace matrix;
6. Phase 5D profile matrix;
7. Phase 5E owner post write/read matrices;
8. Phase 5F storage matrix;
9. Phase 5G interactions/contact matrix.

Hosted development Supabase migration is applied only after the local exact-head gate passes.

After hosted migration:

- audit schema, constraints, RLS, grants, and functions;
- align repository migration timestamp/filename with hosted history if required;
- run one final exact-head CI;
- only then mark Phase 5G PASS and merge.

No experimental migration is applied to hosted development before the local gate.

## 15. Completion Criteria

Phase 5G is complete only when:

- favorites use live backend rows with no owner self-favorite;
- favorite counts are real backend counts;
- Profile shows real saved posts without bypassing marketplace visibility;
- comments and replies use live RPC-backed writes;
- reply depth is effectively limited to two levels;
- authors can soft-delete but cannot edit submitted comments;
- deleted comment bodies are not exposed to ordinary readers;
- contact reveal returns only one currently permitted owner contact channel;
- every valid reveal is auditable without duplicating PII;
- 15-minute audit dedupe does not weaken privacy re-checks;
- post owners can see masked requester identity and reveal time per post;
- no mock/local favorite, comment, or contact behavior remains on the student detail flow;
- reports, notifications, and moderation remain deferred to their planned phases;
- exact-head CI and hosted development audit both pass.
