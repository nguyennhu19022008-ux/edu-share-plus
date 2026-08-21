# Phase 5F — Private Storage Design

## Status

Approved implementation design for EDU SHARE+ Core V2 Phase 5F. This materializes the previously approved Storage decisions and the Free-tier-first constraints into a repository-tracked spec.

## Goal

Provide real private media persistence for post images and student avatars without public buckets, service-role credentials in the browser, paid image transformations, or fake media URLs. Storage must preserve the existing trust chain: confirmed Auth identity → approved Student → verified school membership → owner-scoped upload/binding → post/profile visibility rules.

## Platform constraints

- Supabase Free Plan first.
- All application buckets are private.
- No public URLs are stored or rendered.
- No Storage Image Transformations dependency; that feature is paid-plan functionality.
- Browser code uses the normal authenticated Supabase client only; no service-role or secret key.
- Storage object writes use `upsert:false`; paths are immutable UUID-based object names.
- Stored image formats are JPEG, PNG, or WebP. PDF is allowed only for private evidence.
- HEIC/HEIF may only be accepted when a client converter produces one of the stored image formats. Phase 5F will not add a new conversion dependency, so unconverted HEIC/HEIF is rejected with a clear message.
- No face/biometric verification is introduced in Core V2. Existing `face_private` schema fields remain dormant.

## Buckets

### `post-media`

- private
- maximum object size: 5 MiB
- allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- maximum five bound images per post
- path: `<owner_uuid>/<post_uuid>/<file_uuid>.<ext>`

### `profile-media`

- private
- maximum object size: 3 MiB
- allowed MIME types: `image/jpeg`, `image/png`, `image/webp`
- Phase 5F use: avatar only
- path: `<owner_uuid>/avatar/<file_uuid>.<ext>`

### `private-evidence`

- private
- maximum object size: 20 MiB
- allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`
- no new end-user evidence workflow is opened in 5F; bucket and policy boundary are prepared for later trusted workflows
- paths remain owner UUID based

## Metadata model

`public.file_objects` remains the application source of truth for logical files. Phase 5F adds:

- `school_id uuid not null`
- `binding_status text not null` with `reserved | uploaded | bound | orphaned | deleted`
- `bound_at timestamptz`
- `uploaded_at timestamptz`

The existing global `storage_path` uniqueness constraint is replaced with `unique(bucket, storage_path)` so Storage identity matches Supabase's bucket/path pair.

Purpose-to-bucket and size constraints are enforced in SQL:

- `avatar` → `profile-media`, max 3 MiB, image MIME only
- `post_media` → `post-media`, max 5 MiB, image MIME only
- `verification_evidence` / `case_evidence` → `private-evidence`, max 20 MiB, image or PDF
- `face_private` remains non-operational in 5F

`visibility='public'` is not used for application Storage objects in Core V2. Avatar and post media remain private assets whose read permission is evaluated at request time.

## Upload state machine

Uploads use a reservation-first workflow so a browser cannot invent an arbitrary Storage path.

1. Client validates selected file MIME/count/size for fast feedback.
2. Client calls a trusted `reserve_my_file(...)` RPC with purpose, MIME, size and optional post ID.
3. RPC derives `auth.uid()`, school and membership from trusted Student context, validates ownership/purpose, generates a file UUID/path, and inserts a `file_objects` row with `binding_status='reserved'`.
4. Storage RLS allows INSERT only when the exact bucket/path has a matching reserved `file_objects` row owned by `auth.uid()`.
5. Client uploads with `upsert:false`.
6. Client calls `finalize_my_file(file_id)`. The RPC checks the actual `storage.objects` row and verifies bucket/path/MIME/size against the reservation before setting `binding_status='uploaded'` and `uploaded_at`.
7. Client binds the uploaded file to a post or avatar through a narrow trusted RPC. Binding sets `binding_status='bound'` and `bound_at`.

A failed upload can be abandoned without weakening RLS. Unbound objects are removable only by the owner under Storage DELETE policy; metadata can be marked deleted only after the Storage object is absent.

## Post media binding

`bind_my_post_media(post_id, file_id, sort_order, is_primary, alt_text)`:

- authenticated verified Student only
- post must belong to caller and be `lifecycle_status='active'`
- file must belong to caller, purpose `post_media`, bucket `post-media`, status `uploaded`
- maximum five bound media rows per post
- no duplicate file binding
- at most one primary image
- if the first image is bound, it becomes primary regardless of a false client flag

`remove_my_post_media(post_id, file_id)`:

- owner-only active post
- removes `post_media` binding
- marks file `orphaned`
- if primary was removed, promotes the lowest remaining `sort_order` item
- physical Storage deletion is performed with the authenticated Storage API; the object is never deleted by directly mutating the `storage` schema

Editing media does not change post moderation status in 5F. Content-edit moderation behavior remains owned by Phase 5E; Phase 5I may later choose stricter media moderation rules.

## Avatar binding

`set_my_avatar(file_id)`:

- verified Student only
- file must be caller-owned, purpose `avatar`, bucket `profile-media`, status `uploaded`
- updates `profiles.avatar_file_id`
- marks new file `bound`
- returns prior avatar file metadata so the client can remove the superseded private object and then mark it deleted

Avatar reads in Phase 5F are self-only. Cross-user avatar publication is intentionally deferred until a concrete consumer and privacy rule require it.

## Storage RLS

### INSERT

Authenticated only. The object must match an existing reservation owned by the caller, with the same bucket/path and `binding_status='reserved'`. The owner must still pass the verified Student trust gate.

### SELECT

- `post-media`: owner can read media for own posts; other authenticated users can read only when the linked `post_media` row leads to a `posts` row visible to them under the existing post RLS rules. No anonymous reads.
- `profile-media`: caller can read their own avatar object only in 5F.
- `private-evidence`: no general browser SELECT policy in 5F.

### DELETE

Caller can delete only caller-owned objects that are `reserved`, `uploaded`, `orphaned`, or a superseded avatar explicitly returned by `set_my_avatar`. Bound active post media cannot be physically deleted until `remove_my_post_media` has removed the binding.

No UPDATE policy is granted on `storage.objects`, which prevents browser upsert/move/overwrite semantics.

## Signed delivery

Application services obtain short-lived signed URLs only after the caller is authorized by Storage RLS. Signed URLs are transient UI data and are never persisted in `posts`, `post_media`, `profiles`, or `file_objects`.

Post detail/list media services return logical media plus a signed URL with a short lifetime. If URL generation fails, UI shows a media-unavailable state without fabricating a fallback URL.

## Frontend integration

### Add Post

- select up to five JPEG/PNG/WebP images
- validate each <=5 MiB
- create the post first using Phase 5E trusted RPC
- reserve/upload/finalize/bind selected images sequentially or with bounded concurrency
- partial media failure does not roll back the already-created post; UI states that the post exists and identifies which images were not attached

### Edit Post

- load existing bound media
- allow adding images until the five-image maximum
- allow owner to remove an image using `remove_my_post_media` followed by Storage remove and metadata tombstone
- no image transformations or object overwrite

### My Detail / Marketplace Detail

- load logical media from Supabase
- create short-lived signed URLs through the authenticated Storage client
- render only available URLs
- never use `getPublicUrl`

### Profile

- replace Phase 5F placeholder with avatar picker and current avatar
- JPEG/PNG/WebP <=3 MiB
- reserve/upload/finalize/set avatar
- remove superseded avatar through authenticated Storage delete
- face image upload remains disabled

## Error handling

User-facing errors are safe Vietnamese messages. Raw bucket paths, SQL function details, policy names, or other users' identifiers are not exposed.

Important states are distinguished:

- unsupported file type
- file too large
- five-image limit reached
- reservation rejected because account trust changed
- upload failed before finalize
- finalize rejected because Storage metadata does not match reservation
- binding rejected because post is no longer owner-active
- signed URL unavailable

## Testing and release gates

### Unit/wiring

- bucket/purpose/size constants
- file validation
- no `getPublicUrl`
- no `upsert:true`
- Add/Edit/Profile use real media service, not object-URL persistence
- signed URL mapping rejects malformed metadata

### Clean local Supabase E2E

- buckets exist and are private with exact limits/MIME restrictions
- anonymous/pending/teacher/wrong-owner upload denied
- verified Student reservation accepted
- arbitrary path upload denied
- exact reserved path upload accepted
- overwrite/upsert path denied
- finalize checks actual object metadata
- post bind owner-only and max five enforced
- visible marketplace reader can read post media; invisible reader cannot
- owner can read own pending/rejected post media
- avatar self read/write works; cross-user profile-media read denied
- bound post object cannot be deleted until unbound
- remove/unbind/orphan/delete lifecycle works
- all Phase 5A–5E regression matrices remain green

### Hosted development

After exact-head clean-local green:

- apply repository migration through Supabase migration tooling
- align hosted migration version if required
- audit buckets, RLS, grants, functions, file constraints
- run Security Advisor and Performance Advisor
- do not change indexes/policies merely to silence advisory notices without evidence

## Out of scope

- public buckets
- CDN/image transformations
- HEIC conversion library
- video uploads
- face/biometric verification
- teacher evidence UI
- interaction/favorite/comment/contact media behavior
- post moderation writes
- background cleanup jobs requiring paid or always-on infrastructure
