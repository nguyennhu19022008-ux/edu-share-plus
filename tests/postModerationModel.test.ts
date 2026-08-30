import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseStaffPostQueueItem,
  parseStaffPostsQueueResult,
  parseStaffReportQueueItem,
  parseStaffReportsQueueResult,
} from '../src/features/admin/postModerationModel';

test('parseStaffPostQueueItem parses valid post moderation item', () => {
  const raw = {
    id: 'f9411dc8-531e-450e-be40-7e3ecae98f24',
    title: 'Sách giáo khoa Toán 12',
    description: 'Sách mới 99%',
    tradeType: 'give',
    category: 'Sách giáo khoa',
    className: '12A1',
    ownerName: 'Nguyễn Văn A',
    ownerEmail: 'a@school.edu.vn',
    price: 0,
    moderationStatus: 'pending',
    lifecycleStatus: 'active',
    isHidden: false,
    commentsEnabled: true,
    rejectionReason: null,
    createdAt: '2026-08-30T10:00:00Z',
    publishedAt: null,
    reportCount: 0,
    favoriteCount: 2,
  };

  const parsed = parseStaffPostQueueItem(raw);
  assert.equal(parsed.id, raw.id);
  assert.equal(parsed.title, raw.title);
  assert.equal(parsed.moderationStatus, 'pending');
  assert.equal(parsed.favoriteCount, 2);
});

test('parseStaffPostsQueueResult parses post list and totalCount', () => {
  const result = parseStaffPostsQueueResult({
    items: [
      {
        id: '1',
        title: 'Vở ghi bài',
        price: 5000,
        moderationStatus: 'approved',
      },
    ],
    totalCount: 1,
    limit: 20,
    offset: 0,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.totalCount, 1);
  assert.equal(result.items[0].title, 'Vở ghi bài');
});

test('parseStaffReportQueueItem parses report queue item', () => {
  const raw = {
    id: 'r-1',
    targetType: 'post',
    targetId: 'p-1',
    targetTitle: 'Bài đăng vi phạm',
    reasonCode: 'scam',
    description: 'Nội dung lừa đảo',
    status: 'open',
    resolutionNote: null,
    reporterName: 'Trần Thị B',
    createdAt: '2026-08-30T11:00:00Z',
    resolvedAt: null,
  };

  const parsed = parseStaffReportQueueItem(raw);
  assert.equal(parsed.id, 'r-1');
  assert.equal(parsed.reasonCode, 'scam');
  assert.equal(parsed.status, 'open');
});

test('parseStaffReportsQueueResult parses reports list', () => {
  const result = parseStaffReportsQueueResult({
    items: [
      {
        id: 'r-1',
        targetType: 'comment',
        targetId: 'c-1',
        status: 'resolved',
      },
    ],
    totalCount: 1,
    limit: 20,
    offset: 0,
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].status, 'resolved');
});
