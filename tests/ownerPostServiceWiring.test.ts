import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const servicePath = 'src/features/my-posts/ownerPostService.ts';

test('owner post service reads only the signed-in owners rows with server pagination/filtering', () => {
  const source = readFileSync(servicePath, 'utf8');
  assert.match(source, /auth\.getUser\s*\(/, 'owner reads must resolve the signed-in user');
  assert.match(source, /from\(['"]posts['"]\)/, 'owner reads must query public.posts under RLS');
  assert.match(source, /\.eq\(['"]owner_id['"],\s*user\.id\)/, 'owner list/detail query must scope to the current user');
  assert.match(source, /count\s*:\s*['"]exact['"]/, 'owner list must request exact server count');
  assert.match(source, /\.range\s*\(/, 'owner list must paginate server-side');
  assert.match(source, /\.order\(['"]created_at['"]/, 'owner list must sort on the server');
  assert.match(source, /\.textSearch\(['"]search_tsv['"]/, 'keyword filtering must use server-side full-text search');
  assert.match(source, /from\(['"]post_status_history['"]\)/, 'owner detail must load owner-readable moderation history');
  assert.doesNotMatch(source, /profileRepository|ownerPosts|getOwnerPosts|getOwnerPostDetail|useDataAccess/, 'service must not fall back to runtime mocks');
});

test('owner post service mutations use only trusted RPCs', () => {
  const source = readFileSync(servicePath, 'utf8');
  for (const rpc of ['create_my_post', 'update_my_post', 'change_my_post_lifecycle']) {
    assert.match(source, new RegExp(`rpc\\(['\"]${rpc}['\"]`), `${rpc} must be called through Supabase RPC`);
  }
  assert.doesNotMatch(source, /from\(['"]posts['"]\)[\s\S]*\.(insert|update|delete)\s*\(/, 'browser service must never mutate posts directly');
  assert.doesNotMatch(source, /service_role|auth\.admin/, 'browser owner-post service must not use admin/service-role APIs');
});

test('owner post reference options come from live Supabase sources', () => {
  const source = readFileSync(servicePath, 'utf8');
  assert.match(source, /from\(['"]categories['"]\)/, 'active categories must come from Supabase');
  assert.match(source, /get_current_student_context/, 'school/class identity must come from trusted student context');
  assert.match(source, /from\(['"]schools['"]\)/, 'school marketplace policy must come from Supabase');
  assert.match(source, /from\(['"]profile_private['"]\)/, 'available contact methods must reflect the users private profile data');
});
