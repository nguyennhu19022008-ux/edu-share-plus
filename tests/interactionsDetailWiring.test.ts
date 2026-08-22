import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/pages/DetailPage.tsx', 'utf8');

test('DetailPage uses the live Phase 5G interaction service', () => {
  assert.match(source, /setPostSaved\s*\(/);
  assert.match(source, /listPostComments\s*\(/);
  assert.match(source, /createMyComment\s*\(/);
  assert.match(source, /deleteMyComment\s*\(/);
  assert.match(source, /revealPostContact\s*\(/);
});

test('DetailPage removes local favorite, comment and contact simulation', () => {
  assert.doesNotMatch(source, /LOCAL_UI_COMMENTS|profile\.setPostSaved|profile\.isPostSaved|profile\.wasPostInitiallySaved/);
  assert.doesNotMatch(source, /mô phỏng local[^\n]*liên hệ|liên hệ[^\n]*mô phỏng local/si);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /useDataAccess\s*\(/);
});

test('DetailPage keeps reports deferred while making audited contact explicit', () => {
  assert.match(source, /Phase 5H/);
  assert.match(source, /được ghi nhận|ghi nhận.*truy cập|audit/i);
  assert.match(source, /revealedContact/);
  assert.match(source, /viewerOwnsPost/);
});

test('DetailPage preserves private signed media delivery', () => {
  assert.match(source, /listPostMedia\s*\(/);
  assert.match(source, /item\.signedUrl/);
  assert.doesNotMatch(source, /getPublicUrl|URL\.createObjectURL/);
});
