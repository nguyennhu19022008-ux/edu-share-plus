import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSubmitReportResult, validateReportPayload } from '../src/features/reports/reportModel';

test('validateReportPayload accepts valid report payloads', () => {
  const err = validateReportPayload({
    targetType: 'post',
    targetId: '8ea2fc79-7b3b-4861-9c86-cb8211ad6aa4',
    reasonCode: 'inappropriate_content',
    description: 'Bài viết chứa nội dung sai quy định.',
  });
  assert.equal(err, null);
});

test('validateReportPayload validates missing or invalid arguments', () => {
  assert.ok(validateReportPayload({ targetType: 'invalid' as any, targetId: '1', reasonCode: 'r' }));
  assert.ok(validateReportPayload({ targetType: 'post', targetId: '', reasonCode: 'r' }));
  assert.ok(validateReportPayload({ targetType: 'post', targetId: '1', reasonCode: '' }));
  assert.ok(validateReportPayload({ targetType: 'post', targetId: '1', reasonCode: 'a'.repeat(81) }));
  assert.ok(validateReportPayload({ targetType: 'post', targetId: '1', reasonCode: 'r', description: 'a'.repeat(3001) }));
});

test('parseSubmitReportResult parses valid RPC responses and rejects invalid', () => {
  const valid = {
    id: 'f9411dc8-531e-450e-be40-7e3ecae98f24',
    targetType: 'post',
    targetId: '8ea2fc79-7b3b-4861-9c86-cb8211ad6aa4',
    status: 'open',
    createdAt: '2026-08-30T10:00:00Z',
  };

  const parsed = parseSubmitReportResult(valid);
  assert.equal(parsed.id, valid.id);
  assert.equal(parsed.status, 'open');

  assert.throws(() => parseSubmitReportResult(null), /EDU_SHARE_REPORT_RESPONSE_INVALID/);
  assert.throws(() => parseSubmitReportResult({}), /EDU_SHARE_REPORT_ID_INVALID/);
});
