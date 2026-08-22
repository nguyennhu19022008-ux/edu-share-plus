import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/pages/ProfilePage.tsx', 'utf8');

test('ProfilePage loads saved posts and supports trusted unsave with reconciliation', () => {
  assert.match(source, /listMySavedPosts\s*\(/, 'saved posts must load through the trusted Phase 5G service');
  assert.match(source, /setPostSaved\s*\(/, 'unsave must mutate through the trusted favorite service');
  assert.match(source, /setPostSaved\s*\([^,]+,\s*false\s*\)/, 'profile removal must explicitly unsave the selected post');
  assert.match(source, /Bỏ lưu/, 'saved-post cards must expose an explicit unsave action');
  assert.match(source, /navigateLegacy\(['"]detail['"]\s*,\s*\{\s*id\s*:/, 'saved posts must navigate to real detail');
  assert.doesNotMatch(source, /Danh sách yêu thích chưa được hiển thị ở đây/, 'the old Phase 5G placeholder must be removed');
});

test('saved-post failure remains scoped and does not replace truthful profile state', () => {
  assert.match(source, /savedPostsError/, 'saved-post reads need an independent error state');
  assert.match(source, /savedPostsLoading/, 'saved-post reads need an independent loading state');
  assert.match(source, /setSavedPosts\s*\(/, 'saved-post results must be kept independently from profile data');
});
