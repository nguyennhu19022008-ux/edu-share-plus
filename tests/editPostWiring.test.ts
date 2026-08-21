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

test('EditPostPage uses structured sale/contact/visibility fields and defers media to Phase 5F', () => {
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
  assert.match(source, /Phase 5F/);
  assert.doesNotMatch(source, /URL\.createObjectURL|type=["']file["']/);
  assert.match(source, /navigateLegacy\(['"]myDetail['"],\s*\{\s*id\s*:\s*result\.id\s*\}\)/);
});
