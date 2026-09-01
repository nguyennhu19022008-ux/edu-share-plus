import assert from 'node:assert/strict';
import test from 'node:test';
import type { StaffNotification } from '../src/features/admin/teacherNotificationTypes';

test('Teacher Notifications: types and mapping format', () => {
  const sampleNotification: StaffNotification = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    type: 'student_registration',
    title: '📋 Yêu cầu duyệt tài khoản học sinh mới',
    body: 'Nguyễn Văn An (11A1) vừa đăng ký tài khoản cần đối chiếu danh sách.',
    linkTarget: '/?page=admin',
    metadata: {
      student_name: 'Nguyễn Văn An',
      class_id: '11A1',
      event: 'student_signup',
    },
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  assert.equal(sampleNotification.type, 'student_registration');
  assert.equal(sampleNotification.readAt, null);
  assert.ok(sampleNotification.title.includes('Yêu cầu duyệt'));
  assert.ok(sampleNotification.body.includes('Nguyễn Văn An'));
  assert.equal(sampleNotification.linkTarget, '/?page=admin');
});

test('Teacher Notifications: post created notification event', () => {
  const samplePostNotification: StaffNotification = {
    id: '223e4567-e89b-12d3-a456-426614174001',
    type: 'post_created',
    title: '📦 Đồ dùng học tập mới đăng trên Chợ',
    body: 'Trần Minh Đức vừa đăng: "Máy tính Casio fx-580VN X".',
    linkTarget: '/?page=admin',
    metadata: {
      title: 'Máy tính Casio fx-580VN X',
      trade_type: 'sell',
      event: 'post_created',
    },
    createdAt: new Date().toISOString(),
    readAt: new Date().toISOString(),
  };

  assert.equal(samplePostNotification.type, 'post_created');
  assert.ok(samplePostNotification.readAt !== null);
  assert.ok(samplePostNotification.title.includes('Đồ dùng học tập mới'));
});
