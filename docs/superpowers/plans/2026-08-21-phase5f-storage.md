# Phase 5F Private Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real private Supabase Storage for post images and self avatar, with reservation-first uploads, trusted binding, RLS-controlled reads/deletes, short-lived signed URLs, and no public media URLs.

**Architecture:** `file_objects` becomes the reservation/binding authority. Trusted RPCs derive the caller from `auth.uid()` and server-side Student context; Storage `INSERT/SELECT/DELETE` policies consult file metadata and the existing post visibility boundary. Frontend code uses one focused media service to reserve → upload (`upsert:false`) → finalize → bind, and generates short-lived signed URLs only after RLS authorizes the caller.

**Tech Stack:** PostgreSQL 17, Supabase Storage/RLS, supabase-js 2.112.x, React 19, TypeScript 5.8, Vite 7, Node 22 CI, Node built-in test runner + existing esbuild test bundling.

**Spec:** `docs/superpowers/specs/2026-08-21-phase5f-storage-design.md`

## Global Constraints

- Supabase Free Plan first; Core cannot depend on paid image transformations.
- Buckets `post-media`, `profile-media`, and `private-evidence` are private.
- Post image: JPEG/PNG/WebP only, <= 5 MiB, max five bound files per post.
- Avatar: JPEG/PNG/WebP only, <= 3 MiB.
- Evidence bucket: JPEG/PNG/WebP/PDF, <= 20 MiB; no evidence UI is opened in 5F.
- No public URLs, no browser service-role/secret key, no `upsert:true`, no Storage object overwrite.
- No face/biometric workflow and no HEIC conversion dependency in 5F.
- All existing Phase 5A–5E CI matrices remain release gates.

---

### Task 1: Storage schema, buckets, trusted reservation/binding RPCs and RLS

**Files:**
- Create: `supabase/migrations/<hosted-version>_private_storage_backend.sql`
- Create: `tests/storageBackendContract.test.ts`
- Create: `tests/storageBackend.e2e.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

**Interfaces:**
- Produces RPC `reserve_my_file(p_purpose text, p_mime_type text, p_size_bytes bigint, p_post_id uuid default null) returns jsonb`.
- Produces RPC `finalize_my_file(p_file_id uuid) returns jsonb`.
- Produces RPC `bind_my_post_media(p_post_id uuid, p_file_id uuid, p_sort_order integer, p_is_primary boolean, p_alt_text text) returns jsonb`.
- Produces RPC `remove_my_post_media(p_post_id uuid, p_file_id uuid) returns jsonb`.
- Produces RPC `set_my_avatar(p_file_id uuid) returns jsonb`.
- Produces RPC `mark_my_file_deleted(p_file_id uuid) returns jsonb`.
- `reserve_my_file` response shape: `{ id, bucket, path, purpose, mimeType, sizeBytes }`.
- `finalize_my_file` response shape: `{ id, bindingStatus:'uploaded', bucket, path }`.
- `bind_my_post_media` response shape: `{ postId, fileId, sortOrder, isPrimary }`.
- `remove_my_post_media` response shape: `{ fileId, bucket, path, bindingStatus:'orphaned' }`.
- `set_my_avatar` response shape: `{ fileId, bucket, path, previousAvatar:null|{ fileId,bucket,path } }`.

- [ ] **Step 1: Write the RED source contract test**

Create `tests/storageBackendContract.test.ts` that locates the one migration filename ending `_private_storage_backend.sql`, reads it, and asserts:

```ts
for (const bucket of ['post-media','profile-media','private-evidence']) {
  assert.match(source, new RegExp(bucket));
}
for (const fn of [
  'reserve_my_file','finalize_my_file','bind_my_post_media',
  'remove_my_post_media','set_my_avatar','mark_my_file_deleted',
]) {
  assert.match(source, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`, 'i'));
}
assert.match(source, /security\s+definer/gi);
assert.match(source, /set\s+search_path\s*=\s*''/gi);
assert.match(source, /storage\.objects/);
assert.doesNotMatch(source, /getPublicUrl|public\s*=\s*true/i);
```

- [ ] **Step 2: Run unit CI and verify RED**

Expected first failure: `Phase 5F storage migration must exist`.

- [ ] **Step 3: Implement the migration minimally**

Migration requirements:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-media','post-media',false,5242880,array['image/jpeg','image/png','image/webp']),
  ('profile-media','profile-media',false,3145728,array['image/jpeg','image/png','image/webp']),
  ('private-evidence','private-evidence',false,20971520,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
```

Add `file_objects.school_id`, `binding_status`, `uploaded_at`, `bound_at`; backfill existing rows only if any exist using owner profile school; reject unresolved rows rather than silently assigning a school. Replace `file_objects_storage_path_unique` with `unique(bucket, storage_path)`. Add exact purpose/bucket/size/MIME checks from the spec.

All six public RPCs must be `SECURITY DEFINER SET search_path=''`, revoke PUBLIC/anon EXECUTE and grant authenticated only. Every RPC starts with `auth.uid()` and `get_current_student_context()` except `mark_my_file_deleted`, which still verifies caller ownership and object absence.

Storage policies:

```sql
create policy storage_insert_reserved_student
on storage.objects for insert to authenticated
with check (
  exists (
    select 1 from public.file_objects f
    where f.owner_id = (select auth.uid())
      and f.bucket = storage.objects.bucket_id
      and f.storage_path = storage.objects.name
      and f.binding_status = 'reserved'
      and f.deleted_at is null
  )
);
```

Do not create Storage UPDATE policy. SELECT/DELETE policies must implement the spec exactly.

- [ ] **Step 4: Write clean-local E2E acceptance matrix**

`tests/storageBackend.e2e.mjs` must create verified Student A, verified Student B, pending Student, teacher, and posts covering approved-visible, own-pending and wrong-owner cases. Use the normal Supabase client for upload/download/remove.

Assertions include:

```js
assert.equal(reservedUpload.error, null);
assert.ok(arbitraryPathUpload.error);
assert.ok(overwriteAttempt.error);
assert.equal(finalized.bindingStatus, 'uploaded');
assert.ok(sixthBind.error);
assert.ok(crossOwnerBind.error);
assert.ok(invisibleReaderDownload.error);
assert.equal(visibleReaderDownload.error, null);
assert.equal(ownerPendingDownload.error, null);
assert.ok(crossUserAvatarDownload.error);
assert.ok(boundDelete.error);
```

For physical deletion: unbind first, call Storage `.remove([path])`, then `mark_my_file_deleted(fileId)` and assert metadata is tombstoned.

- [ ] **Step 5: Add the E2E to GitHub Actions**

In `.github/workflows/ci.yml`, append after Phase 5E matrices:

```yaml
- name: Phase 5F private storage matrix
  run: node tests/storageBackend.e2e.mjs
```

Add the source contract test to `test:unit` and cleanup list in `package.json` using the established esbuild/node-test pattern.

- [ ] **Step 6: Run full clean-local CI and verify GREEN**

Required: `verify` success and `local-auth-e2e` success through the new Phase 5F matrix.

- [ ] **Step 7: Commit**

Commit message: `feat: add private storage trust boundary`.

---

### Task 2: Media validation/model and Supabase media service

**Files:**
- Create: `src/features/storage/mediaModel.ts`
- Create: `src/features/storage/mediaService.ts`
- Create: `tests/mediaModel.test.ts`
- Create: `tests/mediaServiceWiring.test.ts`
- Modify: `package.json`

**Interfaces:**

`mediaModel.ts` produces:

```ts
export type MediaPurpose = 'post_media' | 'avatar';
export type ReservedMedia = { id:string; bucket:string; path:string; purpose:MediaPurpose; mimeType:string; sizeBytes:number };
export type SignedMedia = { fileId:string; bucket:string; path:string; altText:string | null; sortOrder:number; isPrimary:boolean; signedUrl:string };
export function validatePostMediaFiles(files:readonly Pick<File,'name'|'type'|'size'>[], existingCount?:number):string | null;
export function validateAvatarFile(file:Pick<File,'name'|'type'|'size'>):string | null;
export function extensionForMime(mime:string):'jpg'|'png'|'webp';
```

`mediaService.ts` produces:

```ts
export async function uploadPostMedia(postId:string, files:readonly File[]):Promise<{ attached:SignedMedia[]; failed:Array<{name:string;message:string}> }>;
export async function listPostMedia(postId:string):Promise<SignedMedia[]>;
export async function removeMyPostMedia(postId:string, media:SignedMedia):Promise<void>;
export async function uploadMyAvatar(file:File):Promise<string>;
export async function getMyAvatarSignedUrl(avatarFileId:string | null):Promise<string>;
```

- [ ] **Step 1: RED model tests**

Test exact limits and MIME set:

```ts
assert.equal(validatePostMediaFiles([jpeg5MiB]), null);
assert.match(validatePostMediaFiles([jpegOver5MiB])!, /5 MiB/);
assert.match(validatePostMediaFiles(sixImages)!, /5 ảnh/);
assert.match(validatePostMediaFiles([heic])!, /JPEG|PNG|WebP/);
assert.equal(validateAvatarFile(png3MiB), null);
assert.match(validateAvatarFile(pngOver3MiB)!, /3 MiB/);
```

- [ ] **Step 2: GREEN `mediaModel.ts`**

Use constants `POST_MEDIA_MAX_BYTES=5*1024*1024`, `AVATAR_MAX_BYTES=3*1024*1024`, and a frozen MIME map. No dependency is added.

- [ ] **Step 3: RED service wiring test**

Read `mediaService.ts` source and require:

- RPC names from Task 1
- `.storage.from(`
- `.upload(` with `upsert:false`
- `.createSignedUrl(`
- `.remove(`
- no `getPublicUrl`
- no service key env reads

- [ ] **Step 4: GREEN `mediaService.ts`**

Implement one helper `reserveUploadFinalize(...)` that calls reserve RPC, uploads exact returned path with `{ upsert:false, contentType:file.type }`, then finalizes. On upload/finalize failure, attempt cleanup only for the caller's reserved/uploaded object; never fake success.

`listPostMedia` queries `post_media` joined to `file_objects` ordered by `sort_order`, then creates signed URLs for 300 seconds. Missing URL for one file skips that file and does not invent a URL.

- [ ] **Step 5: Run unit/build and commit**

Commit message: `feat: add private media client service`.

---

### Task 3: Add/Edit Post image persistence

**Files:**
- Modify: `src/pages/AddPostPage.tsx`
- Modify: `src/pages/EditPostPage.tsx`
- Create/Modify: `tests/addPostWiring.test.ts`
- Create/Modify: `tests/editPostWiring.test.ts`

**Interfaces:**
- Consumes `uploadPostMedia`, `listPostMedia`, `removeMyPostMedia`, `validatePostMediaFiles`.

- [ ] **Step 1: RED wiring tests**

Add Post contract must require `type="file"`, `accept="image/jpeg,image/png,image/webp"`, `multiple`, `uploadPostMedia(result.id, ...)`, and must not contain `URL.createObjectURL` as persistence logic.

Edit Post contract must require existing media load, five-image limit, `uploadPostMedia(post.id, ...)`, `removeMyPostMedia(post.id, ...)`, and no Storage overwrite.

- [ ] **Step 2: GREEN Add Post**

Keep selected files in component state. Validate before create. After `createMyPost` succeeds, call `uploadPostMedia(result.id, files)`. If some files fail, show a warning that the post exists but N images were not attached, then navigate to owner detail.

- [ ] **Step 3: GREEN Edit Post**

Load existing media with `listPostMedia(postId)` beside owner post/options. Render signed thumbnails. Disable new selection when `existing + selected > 5`. Remove uses `removeMyPostMedia` and refreshes media state. Saving text still uses Phase 5E `updateMyPost`; newly selected media is uploaded after that RPC succeeds.

- [ ] **Step 4: Run unit/build + clean local storage matrix**

- [ ] **Step 5: Commit**

Commit message: `feat: persist owner post images privately`.

---

### Task 4: Private media delivery on owner and marketplace detail

**Files:**
- Modify: `src/pages/MyDetailPage.tsx`
- Modify: `src/pages/DetailPage.tsx`
- Modify/Create: `tests/ownerPagesWiring.test.ts`
- Modify/Create: `tests/marketplaceDetailWiring.test.ts`

**Interfaces:**
- Consumes `listPostMedia(postId):Promise<SignedMedia[]>`.

- [ ] **Step 1: RED detail wiring tests**

Require both detail pages to call `listPostMedia` and render signed media. Assert source does not contain `getPublicUrl` or hard-coded Storage URLs.

- [ ] **Step 2: GREEN My Detail**

Load media with owner detail. Replace Phase 5F placeholder with a gallery. If no media, keep truthful empty state. Signed URL failures show unavailable state without failing the whole post detail.

- [ ] **Step 3: GREEN Marketplace Detail**

After `getMarketplacePost` succeeds, call `listPostMedia(post.id)`. RLS decides if the caller can obtain/read each object. Replace the `post.hasImage` placeholder with the private gallery.

Do not modify local favorite/comment/contact/report behavior here; those remain 5G/5H.

- [ ] **Step 4: Run unit/build + 5C/5F E2E regressions and commit**

Commit message: `feat: serve post media through private storage`.

---

### Task 5: Self avatar persistence and signed display

**Files:**
- Modify: `src/features/profile/profileService.ts`
- Modify: `src/features/profile/profileReadModel.ts`
- Modify: `src/pages/ProfilePage.tsx`
- Modify: `src/features/profile/components/ProfileSections.tsx` if avatar rendering needs a focused component change
- Modify/Create: `tests/profileReadModel.test.ts`
- Modify/Create: `tests/profileServiceWiring.test.ts`
- Modify/Create: `tests/profilePageWiring.test.ts`

**Interfaces:**
- Consumes `uploadMyAvatar(file)` and `getMyAvatarSignedUrl(avatarFileId)`.
- `getMyProfile()` continues returning `StudentProfileView`, now with a transient `avatarUrl` populated after signed URL generation; `faceUrl` remains empty.

- [ ] **Step 1: RED profile tests**

Require avatar file validation/upload, private signed URL resolution, and no face upload. Assert `getPublicUrl` and object URL persistence are absent.

- [ ] **Step 2: GREEN profile service/model**

Keep strict row mapping for `avatar_file_id`. After mapping the profile, resolve `avatarUrl` through `getMyAvatarSignedUrl`. Signed URL failure yields empty avatar URL while preserving the rest of the profile.

- [ ] **Step 3: GREEN ProfilePage**

Replace the Phase 5F placeholder with current avatar, JPEG/PNG/WebP input, validation state, and an upload button. On success, reload profile. Keep face/identity image disabled with explicit Core V2 copy.

- [ ] **Step 4: Run unit/build + Phase 5D/5F E2E regressions and commit**

Commit message: `feat: add private self avatar storage`.

---

### Task 6: Phase 5F release gate, hosted deployment and documentation

**Files:**
- Modify: `docs/00_CURRENT_PROJECT_STATUS.md`
- Modify: `docs/ROADMAP.md`
- Modify: PR body

- [ ] **Step 1: Full clean-local exact-head verification**

Require both GitHub Actions jobs green with:

- unit tests
- production build
- Auth E2E
- Phase 5B matrix
- Phase 5C matrix
- Phase 5D matrix
- Phase 5E write/read matrices
- Phase 5F private Storage matrix

- [ ] **Step 2: Self-review PR diff**

Review migration, Storage policies, RPCs, service, Add/Edit, both detail pages, Profile, CI. Block hosted deployment for any Critical/Important issue.

- [ ] **Step 3: Apply migration to hosted development**

Use Supabase migration tooling, never raw DDL execution. If hosted assigns a different timestamp/version, rename the repository migration byte-for-byte to match hosted history, update any source contract that points to the old filename, and rerun exact-head CI.

- [ ] **Step 4: Hosted audit**

Read-only SQL must prove:

- three buckets exist, private, exact limits/MIME restrictions
- all storage RPCs are `SECURITY DEFINER` with fixed search path
- PUBLIC/anon EXECUTE denied; authenticated intentional
- no Storage UPDATE policy for authenticated
- `file_objects` RLS enabled and binding constraints present
- arbitrary direct table mutation is not granted

- [ ] **Step 5: Advisors**

Run Security and Performance Advisors. Document intentional trusted-RPC warnings and existing performance follow-ups. Do not change policy/index design without concrete evidence.

- [ ] **Step 6: Documentation**

Mark 5E integrated into `main`, mark 5F PASS only after all gates, and set next checkpoint to **5G Interactions + Contact**.

- [ ] **Step 7: Final exact-head CI and PR readiness**

Only after fresh final CI success, mark the 5F PR Ready for Review. Merge remains a separate integration decision unless the project owner has explicitly approved it.
