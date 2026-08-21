import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProfilePasswordChange } from '../src/features/profile/profilePasswordModel';

test('requires the current password before any password change request', () => {
  assert.equal(
    validateProfilePasswordChange('', 'StrongPass8', 'StrongPass8'),
    'Vui lòng nhập mật khẩu hiện tại trước khi đổi mật khẩu.',
  );
});

test('rejects mismatched password confirmation before a network mutation', () => {
  assert.equal(
    validateProfilePasswordChange('OldPass8', 'StrongPass8', 'StrongPass9'),
    'Mật khẩu mới nhập lại chưa khớp.',
  );
});

test('reuses the shared strong-password rules from the recovery flow', () => {
  assert.equal(
    validateProfilePasswordChange('OldPass8', 'weak1234', 'weak1234'),
    'Mật khẩu mới phải có ít nhất 1 chữ hoa.',
  );
  assert.equal(
    validateProfilePasswordChange('OldPass8', 'StrongPass8', 'StrongPass8'),
    null,
  );
});
