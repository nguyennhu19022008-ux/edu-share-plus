import assert from 'node:assert/strict';
import test from 'node:test';
import { submitReport } from '../src/features/reports/reportService';

test('reportService defines submitReport function', () => {
  assert.equal(typeof submitReport, 'function');
});

test('submitReport validates payload locally before dispatching', async () => {
  await assert.rejects(
    async () => {
      await submitReport({
        targetType: 'invalid' as any,
        targetId: '123',
        reasonCode: 'scam',
      });
    },
    /Loại đối tượng báo cáo không hợp lệ/
  );
});
