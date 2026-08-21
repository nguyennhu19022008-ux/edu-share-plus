import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRosterMatchReason } from '../src/features/admin/accountReviewPresentation';

test('formats staff-only roster workflow reasons for teachers', () => {
  assert.equal(formatRosterMatchReason('roster_not_found'), 'Không tìm thấy học sinh khớp trong roster đang áp dụng.');
  assert.equal(formatRosterMatchReason('roster_ambiguous'), 'Có nhiều học sinh cùng lớp và số điện thoại; cần giáo viên đối chiếu thủ công.');
  assert.equal(formatRosterMatchReason('roster_already_claimed'), 'Dòng roster phù hợp đã được liên kết với một tài khoản khác; cần kiểm tra trước khi duyệt.');
  assert.equal(formatRosterMatchReason('roster_disabled_manual_review'), 'Trường đang tắt xác minh tự động bằng roster; tài khoản cần giáo viên duyệt thủ công.');
});

test('uses a safe generic label for unknown non-empty reason without exposing implementation codes', () => {
  assert.equal(formatRosterMatchReason('future_reason_code'), 'Cần giáo viên đối chiếu thông tin với roster của trường.');
  assert.equal(formatRosterMatchReason(null), 'Chưa có kết quả đối chiếu roster.');
});
