import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/pages/DetailPage.tsx', 'utf8');

test('DetailPage reads the requested post through the trusted Supabase detail service', () => {
  assert.match(source, /getMarketplacePost\s*\(/, 'DetailPage must call getMarketplacePost()');
  assert.doesNotMatch(source, /marketplace\.listPosts\s*\(/, 'DetailPage must not derive detail from the mock marketplace list');
});

test('DetailPage keeps Phase 5F media boundary explicit', () => {
  assert.doesNotMatch(source, /getPublicUrl\s*\(/, 'DetailPage must not expose a public Storage URL in Phase 5C');
});
