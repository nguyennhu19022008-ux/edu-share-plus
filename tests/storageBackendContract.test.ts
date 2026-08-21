import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const migrationDir = 'supabase/migrations';
const migrationName = existsSync(migrationDir)
  ? readdirSync(migrationDir).find((name) => name.endsWith('_private_storage_backend.sql'))
  : undefined;

test('Phase 5F migration defines private buckets and narrow trusted storage RPCs', () => {
  assert.ok(migrationName, 'Phase 5F storage migration must exist');
  const source = readFileSync(`${migrationDir}/${migrationName}`, 'utf8');

  for (const bucket of ['post-media', 'profile-media', 'private-evidence']) {
    assert.match(source, new RegExp(bucket), `migration must configure ${bucket}`);
  }

  for (const column of ['school_id', 'binding_status', 'uploaded_at', 'bound_at']) {
    assert.match(source, new RegExp(`\\b${column}\\b`), `migration must define file_objects.${column}`);
  }

  for (const fn of [
    'reserve_my_file',
    'finalize_my_file',
    'bind_my_post_media',
    'remove_my_post_media',
    'set_my_avatar',
    'mark_my_file_deleted',
  ]) {
    assert.match(
      source,
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`, 'i'),
      `${fn} must be a public trusted RPC`,
    );
  }

  assert.match(source, /security\s+definer/gi, 'trusted storage RPCs must use SECURITY DEFINER');
  assert.match(source, /set\s+search_path\s*=\s*''/gi, 'trusted storage RPCs must fix search_path');
  assert.match(source, /storage\.objects/i, 'migration must define Storage object access policies');
  assert.match(source, /upsert/i, 'migration comments or policy rationale must explicitly forbid overwrite/upsert semantics');
  assert.doesNotMatch(source, /public\s*=\s*true/i, 'application Storage buckets must not be public');
  assert.doesNotMatch(source, /getPublicUrl/i, 'migration must not rely on public URL delivery');
});
