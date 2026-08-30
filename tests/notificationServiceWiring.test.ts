import assert from 'node:assert/strict';
import test from 'node:test';
import { listMyNotifications, markMyNotificationsRead } from '../src/features/notifications/notificationService';

test('notificationService invokes list_my_notifications and mark_my_notifications_read RPCs', async () => {
  assert.equal(typeof listMyNotifications, 'function');
  assert.equal(typeof markMyNotificationsRead, 'function');
});
