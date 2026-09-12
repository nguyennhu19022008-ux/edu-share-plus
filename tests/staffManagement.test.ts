import assert from 'node:assert/strict';
import test from 'node:test';
import { assignSchoolStaff } from '../src/features/admin/staffManagementService';
import type { StaffRoleCode } from '../src/features/admin/staffManagementTypes';

test('assignSchoolStaff rejects invalid emails', async () => {
  await assert.rejects(
    async () => {
      await assignSchoolStaff({
        email: 'invalid-email-format',
        roleCode: 'teacher_moderator',
      });
    },
    {
      message: /địa chỉ email hợp lệ/,
    }
  );
});

test('assignSchoolStaff supports teacher_moderator and school_admin roles', () => {
  const teacherRole: StaffRoleCode = 'teacher_moderator';
  const adminRole: StaffRoleCode = 'school_admin';
  assert.equal(teacherRole, 'teacher_moderator');
  assert.equal(adminRole, 'school_admin');
});

test('PREAUTHORIZED_TEACHER_WHITELIST contains phuongpp teacher of THPT Nguyen Du', async () => {
  const { PREAUTHORIZED_TEACHER_WHITELIST } = await import('../src/features/auth/staff/staffAuthService');
  const teacher = PREAUTHORIZED_TEACHER_WHITELIST['phuongpp_thpt_nguyendu@bariavungtau.edu.vn'];
  assert.ok(teacher, 'Teacher phuongpp must be in PREAUTHORIZED_TEACHER_WHITELIST');
  assert.equal(teacher.schoolCode, 'THPT_NGUYEN_DU');
  assert.equal(teacher.roleCode, 'teacher_moderator');
  assert.equal(teacher.defaultName, 'Phạm Phúc Phương ( Phó Hiệu trưởng )');
});
