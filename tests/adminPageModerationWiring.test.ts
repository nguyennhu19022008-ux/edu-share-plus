import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminPageSource = readFileSync('src/pages/AdminPage.tsx', 'utf8');

test('AdminPage consumes real post moderation and reports services without mock admin', () => {
  assert.doesNotMatch(adminPageSource, /useDataAccess/, 'AdminPage must not import useDataAccess');
  assert.doesNotMatch(adminPageSource, /admin\.listPosts/, 'AdminPage must not call mock admin.listPosts');
  assert.doesNotMatch(adminPageSource, /admin\.updatePost/, 'AdminPage must not call mock admin.updatePost');

  assert.match(adminPageSource, /listStaffPostsQueue\s*\(/, 'AdminPage must load posts through listStaffPostsQueue()');
  assert.match(adminPageSource, /moderatePost\s*\(/, 'AdminPage must execute moderation actions through moderatePost()');
  assert.match(adminPageSource, /listStaffReportsQueue\s*\(/, 'AdminPage must load reports through listStaffReportsQueue()');
  assert.match(adminPageSource, /resolveModerationReport\s*\(/, 'AdminPage must resolve reports through resolveModerationReport()');
});
