import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const servicePath = 'src/features/storage/mediaService.ts';

test('media service uses the trusted private Storage workflow without public URLs or browser secrets', () => {
  assert.ok(existsSync(servicePath), 'Phase 5F media service must exist');
  const source = readFileSync(servicePath, 'utf8');

  for (const rpc of [
    'reserve_my_file',
    'finalize_my_file',
    'bind_my_post_media',
    'remove_my_post_media',
    'set_my_avatar',
    'mark_my_file_deleted',
  ]) {
    assert.match(source, new RegExp(`['\"]${rpc}['\"]`), `media service must use ${rpc}`);
  }

  assert.match(source, /\.storage\.from\s*\(/, 'media service must use the authenticated Supabase Storage client');
  assert.match(source, /\.upload\s*\(/, 'media service must upload through Supabase Storage');
  assert.match(source, /upsert\s*:\s*false/, 'media uploads must never overwrite an existing object');
  assert.match(source, /\.createSignedUrl\s*\(/, 'private media delivery must use short-lived signed URLs');
  assert.match(source, /createSignedUrl\s*\([^,]+,\s*300\s*\)/s, 'signed URL lifetime must be five minutes');
  assert.match(source, /\.remove\s*\(/, 'cleanup must use the Storage API instead of SQL mutation');

  assert.doesNotMatch(source, /getPublicUrl/i, 'private media service must not generate public URLs');
  assert.doesNotMatch(source, /SERVICE_ROLE|service[_-]?role|SUPABASE_SERVICE|sb_secret_/i, 'browser media service must not read or embed service-role/secret credentials');
});

test('media service exposes post media and self-avatar operations through focused helpers', () => {
  assert.ok(existsSync(servicePath), 'Phase 5F media service must exist');
  const source = readFileSync(servicePath, 'utf8');

  for (const exportedFunction of [
    'uploadPostMedia',
    'listPostMedia',
    'removeMyPostMedia',
    'uploadMyAvatar',
    'getMyAvatarSignedUrl',
  ]) {
    assert.match(
      source,
      new RegExp(`export\\s+async\\s+function\\s+${exportedFunction}\\b`),
      `media service must export ${exportedFunction}`,
    );
  }
});
