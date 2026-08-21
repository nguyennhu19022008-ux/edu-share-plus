# Phase 5F — Storage Design

## Status

Approved Core V2 architecture, materialized for implementation on `phase/5f-storage-core` after Phase 5E was integrated into `main`.

## Goal

Make post images and student avatars real, private Supabase Storage assets with RLS-enforced upload/read/delete behavior, explicit application metadata, atomic binding to posts/profiles, and truthful cleanup/error handling. Establish the private evidence bucket boundary without opening an evidence UI before its owning phase.

## Non-goals

- No public Storage bucket or permanent public URL.
- No service-role/secret key in browser code.
- No face/biometric verification flow. `profile_private.face_file_id` remains unused in Core V2.
- No report/evidence UI; evidence workflows remain closed until their owning phase.
- No HEIC/RAW/TIFF/SVG object storage. If a future client converts HEIC, only the resulting JPEG/PNG/WebP object may be stored.
- No image AI, moderation model, CDN optimization service, transaction proof, or price-estimator work.
- No Storage upsert/overwrite path.

## Selected approach

Use Supabase Storage directly from the authenticated browser client, protected by `storage.objects` RLS. Application metadata and binding remain separate in `public.file_objects` and `public.post_media`, and mutations of those application tables happen only through narrow trusted RPCs.

This approach is preferred over an Edge Function/service-role upload proxy because it:

1. keeps Core V2 functional on the Supabase Free Plan;
2. preserves user-JWT identity at the Storage RLS boundary;
3. avoids a backend secret in the browser;
4. matches the existing trusted-RPC architecture for multi-row application state;
5. lets small images use standard uploads while retaining private access.

## Bucket contract

All buckets are private.

| Bucket | Purpose | Max object size | Allowed stored MIME types | Browser upload in 5F |
| --- | --- | ---: | --- | --- |
| `post-media` | images attached to owner posts | 5 MiB | `image/jpeg`, `image/png`, `image/webp` | verified Student owner only |
| `profile-media` | avatar images | 3 MiB | `image/jpeg`, `image/png`, `image/webp` | verified Student self only |
| `private-evidence` | later verification/report evidence | 20 MiB | `image/jpeg`, `image/png`, `image/webp`, `application/pdf` | closed in 5F |

The project-level Storage limit remains 50 MiB, which is within the current Supabase Free Plan maximum. Per-bucket limits are stricter than the global limit.

Local `supabase/config.toml` must declare the same bucket names, privacy, MIME restrictions and size limits used by hosted development.

## Object path contract

Only generated UUID object names are used. User-provided file names are never used as Storage paths.

- Post image: `<user_uuid>/<post_uuid>/<object_uuid>.<ext>`
- Avatar: `<user_uuid>/avatar/<object_uuid>.<ext>`
- Future evidence: path reserved for the later owning workflow; 5F does not grant browser upload.

`<ext>` must match the accepted stored MIME type (`jpg`, `png`, `webp`).

The client always calls Storage upload with `upsert: false`. A replacement gets a new UUID path.

## Existing application metadata

`public.file_objects` already stores owner, bucket, path, purpose, visibility, MIME, byte size, dimensions and soft-delete time. `public.post_media` already binds a file to a post and supports order/primary metadata. `profiles.avatar_file_id` already references `file_objects`.

5F extends `file_objects` with:

- `school_id uuid` — school snapshot for authorization/audit;
- `binding_status text not null default 'staged'` with `staged | bound | orphaned | deleted`;
- `bound_at timestamptz`;
- uniqueness changed from global `storage_path` to `(bucket, storage_path)`;
- integrity constraints tying `deleted_at`, `bound_at`, purpose, bucket and visibility to lifecycle state.

New 5F rows are always owner-scoped and school-scoped. Existing development rows, if any, must not be silently trusted; the migration must be replay-safe and avoid inventing ownership/school data.

## File lifecycle

### Upload

1. Client validates file count, MIME and size before network I/O.
2. Client creates a fresh UUID path.
3. Browser uploads directly to the private bucket with the current user JWT and `upsert:false`.
4. Client calls `register_my_uploaded_file(...)`.
5. The RPC queries `storage.objects` read-only, verifies the object exists, verifies Storage `owner_id` matches `auth.uid()`, derives MIME/size from Storage metadata, validates path/bucket/purpose, derives school from the verified Student context, and inserts a `staged` `file_objects` row.
6. Client binds the staged file through the purpose-specific RPC.

A failed application registration/bind must trigger best-effort Storage removal. The application never claims an image is persisted merely because a browser preview existed.

### Binding post media

`bind_my_post_media(post_id, file_id, sort_order, is_primary, alt_text)`:

- requires the verified Student trust gate;
- requires an active post owned by `auth.uid()` and in the same school context;
- requires a staged, non-deleted `post-media` / `post_media` file owned by the caller;
- requires the path post UUID segment to equal `post_id`;
- enforces maximum 5 bound files per post;
- inserts `post_media` and marks the file `bound` in one transaction;
- preserves at most one primary image.

Removing media is a two-step safe cleanup:

1. `unbind_my_post_media(post_id, file_id)` removes the application binding and marks the file `orphaned`, returning its bucket/path.
2. Browser calls Storage `remove` for that exact object.
3. `finalize_my_file_delete(file_id)` is allowed only when the object no longer exists and marks metadata `deleted` with `deleted_at`.

If Storage removal fails, the object remains private and metadata remains `orphaned`; the UI reports cleanup pending rather than lying that deletion completed.

### Avatar binding

`set_my_avatar_file(file_id)`:

- verified Student self only;
- staged file must be `profile-media` / `avatar` and owned by caller;
- updates `profiles.avatar_file_id` and marks the new file bound atomically;
- previous avatar metadata becomes `orphaned` and its bucket/path is returned for best-effort Storage deletion.

`remove_my_avatar()` clears the avatar reference and marks the previous file orphaned, then the same Storage-delete/finalize sequence applies.

## Storage RLS

### INSERT

`post-media` inserts are allowed only when:

- caller is authenticated and marketplace-eligible/verified Student;
- path segment 1 equals `auth.uid()`;
- path segment 2 parses as a post UUID;
- that post is active and owned by `auth.uid()`;
- bucket is exactly `post-media`.

`profile-media` inserts are allowed only when:

- caller is a verified Student;
- segment 1 equals `auth.uid()`;
- segment 2 equals `avatar`;
- bucket is exactly `profile-media`.

`private-evidence` gets no browser INSERT policy in 5F.

### SELECT / signed URL eligibility

Private object reads require authenticated RLS.

- Any caller may read their own Storage object while it is owned by their JWT, including a newly uploaded staged object.
- Bound post media is readable when the caller owns the post or the parent post satisfies the same Core V2 marketplace visibility rule used by Phase 5C.
- Avatar media is self-readable in 5F. Cross-user avatar exposure is not introduced implicitly.
- Evidence is not browser-readable in 5F.

A private `SECURITY DEFINER` helper with fixed `search_path` may encapsulate the multi-table read decision. Browser roles do not receive direct application-table write privileges as a side effect.

### DELETE

A user may remove a Storage object only when Storage `owner_id` matches `auth.uid()` and either:

- no `file_objects` row exists yet (cleanup after failed registration), or
- the caller owns the matching file metadata and its binding state is `staged` or `orphaned`.

No UPDATE policy is added to `storage.objects`; Storage upsert/move/overwrite is not part of Core V2.

## Private media delivery

`<img>` tags cannot attach a bearer token themselves, so UI rendering uses short-lived signed URLs generated only after Storage SELECT RLS authorizes the current user. Default signed URL lifetime is 5 minutes.

The service exposes media metadata separately from signed URLs. Expired URLs are regenerated on reload/retry; permanent URLs are never persisted in application tables.

For feed performance, Phase 5F may return the primary bound media bucket/path in the existing marketplace read RPC response so the client can sign only the visible page's primary images. Detail/owner detail may return all bound media paths up to the 5-image cap. No browser-wide object listing is required.

## Client-side file validation

Stored image input accepts only JPEG, PNG and WebP. Raw HEIC/HEIF, TIFF, RAW and SVG are rejected unless a future client conversion step first creates an accepted output Blob.

Post image limits:

- max 5 bound images per post;
- max 5 MiB each.

Avatar limit:

- one bound current avatar;
- max 3 MiB.

The server/bucket remains authoritative even when the browser validates first.

## UI integration

### Add Post

- Restore a real file picker for up to 5 accepted images.
- Show local previews only as previews, clearly distinct from persisted state.
- Create the post first to obtain the server post UUID, then upload/bind selected images under that UUID.
- If post creation succeeds but an image fails, the post remains valid without that image. UI reports partial media failure and allows later correction from Edit Post.

### Edit Post

- Load real bound media for the owner post.
- Allow adding images up to the 5-file cap and removing bound images while the post lifecycle is `active`.
- Media changes do not silently mutate moderation fields. Content edit behavior from 5E remains unchanged.

### Marketplace Detail and My Detail

- Replace the Phase 5F placeholder with real signed media URLs.
- My Detail can read owner media in all owner-visible lifecycle states.
- Marketplace Detail receives media only for a currently visible marketplace post.
- Missing/expired media falls back to truthful UI state rather than fake URLs.

### Profile

- Add real avatar upload/remove on the student profile.
- Persist through `profile-media` + `file_objects` + `profiles.avatar_file_id`.
- Face/identity image upload remains absent.

## Error handling

Client-facing errors are safe Vietnamese messages; raw SQL/storage internals are not displayed.

Required distinct states:

- unsupported file type;
- file too large;
- too many post images;
- upload denied by RLS;
- upload succeeded but registration/binding failed;
- cleanup pending because object deletion failed;
- media not visible/not found;
- signed URL expired/generation failed.

Partial failure must not cause application state to claim a file is bound when only the object upload succeeded.

## Testing and release gates

### Unit/source contracts

- file validation/path generation;
- `upsert:false` upload wiring;
- no public URL use;
- Add/Edit/Profile/Detail wiring uses Storage service, not mock/object URL persistence;
- max-five and avatar single-current contracts.

### Clean local Supabase E2E

Prove at minimum:

- three private buckets exist with exact size/MIME restrictions;
- anonymous upload/read/delete denied;
- pending/unverified Student upload denied;
- verified Student can upload only to their own allowed path;
- wrong-user/wrong-post path upload denied;
- direct `file_objects` / `post_media` browser mutations remain denied;
- registration derives Storage metadata and caller school/owner rather than trusting client values;
- post media bind cap of five is enforced;
- wrong-owner bind/unbind denied;
- marketplace-eligible viewer can sign/read bound media only when parent post is visible;
- viewer cannot read hidden/pending/wrong-scope post media;
- owner can read their own media;
- avatar is self-only in 5F;
- unbind/orphan → Storage remove → metadata finalize succeeds;
- evidence bucket remains browser-closed;
- Phase 5A–5E regression matrices stay green.

### Hosted development gate

Only after exact-head clean-local CI is green:

- apply DDL migration through migration tooling;
- create/align hosted bucket rows and restrictions through the same reviewed migration/config contract;
- query hosted bucket/policy/RPC metadata;
- run Security Advisor and Performance Advisor;
- do not add/drop indexes merely to silence development-only advisor notices;
- update project status/roadmap and run final exact-head CI.

## Free-tier treatment

The design stays below Supabase Free Plan's current 50 MB global maximum: 5 MiB post images, 3 MiB avatar, 20 MiB evidence. Standard upload is appropriate for the 3/5 MiB image paths; evidence can use resumable upload later if a future 6–20 MiB UI needs it.

No paid-only Storage feature is a Core 5F release requirement.

## Definition of Done

Phase 5F is PASS only when private buckets, Storage RLS, application metadata registration/binding, post image upload/read/remove, avatar upload/read/remove, cleanup semantics, clean-local unauthorized-path tests, hosted audit/advisors, documentation, unit tests and production build are all verified on the final PR head.
