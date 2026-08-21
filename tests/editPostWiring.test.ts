import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/pages/EditPostPage.tsx', 'utf8');

test('EditPostPage loads the signed-in owners post and live reference options', () => {
  assert.match(source, /getMyPost/);
  assert.match(source, /loadOwnerPostReferenceOptions/);
  assert.doesNotMatch(source, /useDataAccess|ownerPosts|ownerDetail/);
  assert.match(source, /post\.lifecycleStatus\s*===\s*['"]active['"]/);
  assert.match(source, /rejectionReason/);
});

test('EditPostPage updates only through the trusted service and keeps moderation reset explicit', () => {
  assert.match(source, /updateMyPost/);
  assert.match(source, /chờ giáo viên duyệt lại/i);
  assert.match(source, /approved/);
  assert.match(source, /pending/);
  assert.doesNotMatch(source, /contactInfo|\.replace\(/);
});

test('EditPostPage loads, validates, uploads and removes private post media through the media service', () => {
  for (const symbol of ['listPostMedia', 'validatePostMediaFiles', 'uploadPostMedia', 'removeMyPostMedia']) {
    assert.match(source, new RegExp(symbol));
  }
  assert.match(source, /type=["']file["']/);
  assert.match(source, /accept=["']image\/jpeg,image\/png,image\/webp["']/);
  assert.match(source, /\bmultiple\b/);
  assert.match(source, /validatePostMediaFiles\s*\([^,]+,\s*media\.length\s*\)/s);
  assert.match(source, /uploadPostMedia\s*\(\s*post\.id\s*,\s*selectedFiles\s*\)/);
  assert.match(source, /removeMyPostMedia\s*\(\s*post\.id\s*,/);
  assert.doesNotMatch(source, /URL\.createObjectURL|getPublicUrl|\.storage\.from\s*\(|upsert\s*:/);
});

test('EditPostPage keeps structured sale/contact/visibility fields and routes with the server id', () => {
  for (const field of [
    'categoryId',
    'visibilityScope',
    'preferredContactMethod',
    'salePrice',
    'originalPurchasePrice',
    'originalPriceIsEstimate',
    'purchaseDate',
    'conditionGrade',
    'brand',
    'model',
  ]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /navigateLegacy\(['"]myDetail['"],\s*\{\s*id\s*:\s*result\.id\s*\}\)/);
});
