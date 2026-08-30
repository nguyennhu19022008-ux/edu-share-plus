import assert from 'node:assert/strict';
import test from 'node:test';
import { formatNotificationDate, parseNotificationItem, parseNotificationListResult } from '../src/features/notifications/notificationModel';

test('parseNotificationItem validates valid notification payloads', () => {
  const row = {
    id: 'f9411dc8-531e-450e-be40-7e3ecae98f24',
    type: 'comment',
    title: 'Bình luận mới',
    body: 'Bạn có bình luận mới trên bài viết của bạn.',
    entityType: 'post',
    entityId: '8ea2fc79-7b3b-4861-9c86-cb8211ad6aa4',
    readAt: null,
    createdAt: '2026-08-30T10:00:00Z',
  };

  const parsed = parseNotificationItem(row);
  assert.equal(parsed.id, row.id);
  assert.equal(parsed.type, 'comment');
  assert.equal(parsed.title, 'Bình luận mới');
  assert.equal(parsed.body, 'Bạn có bình luận mới trên bài viết của bạn.');
  assert.equal(parsed.entityType, 'post');
  assert.equal(parsed.entityId, row.entityId);
  assert.equal(parsed.readAt, null);
  assert.equal(parsed.createdAt, row.createdAt);
});

test('parseNotificationItem strictly rejects malformed payloads', () => {
  assert.throws(() => parseNotificationItem(null), /EDU_SHARE_NOTIFICATION_ROW_INVALID/);
  assert.throws(() => parseNotificationItem({}), /EDU_SHARE_NOTIFICATION_ID_INVALID/);
  assert.throws(() => parseNotificationItem({ id: '1', type: '' }), /EDU_SHARE_NOTIFICATION_TYPE_INVALID/);
  assert.throws(() => parseNotificationItem({ id: '1', type: 't', title: null }), /EDU_SHARE_NOTIFICATION_TITLE_INVALID/);
});

test('parseNotificationListResult parses items and unread count truthfully', () => {
  const raw = {
    items: [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        type: 'system',
        title: 'Chào mừng',
        body: 'Tài khoản của bạn đã được phê duyệt.',
        entityType: null,
        entityId: null,
        readAt: null,
        createdAt: '2026-08-30T12:00:00Z',
      },
    ],
    unreadCount: 1,
    totalCount: 1,
    limit: 20,
    offset: 0,
  };

  const result = parseNotificationListResult(raw);
  assert.equal(result.items.length, 1);
  assert.equal(result.unreadCount, 1);
  assert.equal(result.totalCount, 1);
  assert.equal(result.items[0].title, 'Chào mừng');
});

test('formatNotificationDate formats valid ISO dates without crashing', () => {
  const formatted = formatNotificationDate('2026-08-30T10:00:00Z');
  assert.ok(typeof formatted === 'string' && formatted.length > 0);
});
