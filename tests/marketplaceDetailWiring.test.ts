import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/pages/DetailPage.tsx', 'utf8');

test('DetailPage reads the requested post through the trusted Supabase detail service', () => {
  assert.match(source, /getMarketplacePost\s*\(/, 'DetailPage must call getMarketplacePost()');
  assert.doesNotMatch(source, /marketplace\.listPosts\s*\(/, 'DetailPage must not derive detail from the mock marketplace list');
});

test('DetailPage delivers marketplace media only through private signed URLs', () => {
  assert.match(source, /listPostMedia\s*\(/, 'DetailPage must load private post media through the media service');
  assert.match(source, /media\.map\s*\(/, 'DetailPage must render the returned private media collection');
  assert.match(source, /item\.signedUrl/, 'DetailPage must render service-produced signed URLs');
  assert.doesNotMatch(source, /getPublicUrl|URL\.createObjectURL|\.storage\.from\s*\(/, 'DetailPage must not bypass the private media service');
  assert.doesNotMatch(source, /Ảnh private sẽ được nối ở Phase 5F/, 'Phase 5F media must no longer be a placeholder');
});
