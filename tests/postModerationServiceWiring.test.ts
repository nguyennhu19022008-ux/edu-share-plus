import assert from 'node:assert/strict';
import test from 'node:test';
import {
  listStaffPostsQueue,
  listStaffReportsQueue,
  moderatePost,
  resolveModerationReport,
} from '../src/features/admin/postModerationService';

test('postModerationService defines expected moderation methods', () => {
  assert.equal(typeof listStaffPostsQueue, 'function');
  assert.equal(typeof moderatePost, 'function');
  assert.equal(typeof listStaffReportsQueue, 'function');
  assert.equal(typeof resolveModerationReport, 'function');
});

test('moderatePost requires rejection reason when rejecting', async () => {
  await assert.rejects(
    async () => {
      await moderatePost('p-1', 'reject', '');
    },
    /Cần cung cấp lý do khi từ chối bài viết/
  );
});
