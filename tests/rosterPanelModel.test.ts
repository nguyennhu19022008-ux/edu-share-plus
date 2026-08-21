import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildRosterImportPreview,
  filterActiveRoster,
} from '../src/features/admin/rosterPanelModel';
import type { ActiveRosterRow } from '../src/features/admin/rosterService';

test('blocks import when CSV has validation errors and reports preview counts', () => {
  const preview = buildRosterImportPreview({
    academicYear: '2026-2027',
    sourceFilename: 'students.csv',
    parsed: {
      rows: [
        { full_name: 'Nguyễn Văn A', class_name: '12A1', phone: '0900100001' },
      ],
      errors: [
        {
          code: 'required_field_missing',
          message: 'Dòng 3 thiếu trường bắt buộc.',
          rowNumber: 3,
          fields: ['phone'],
        },
      ],
      totalDataRows: 2,
      skippedBlankRows: 1,
    },
  });

  assert.equal(preview.canImport, false);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.invalidRows, 1);
  assert.equal(preview.totalDataRows, 2);
  assert.equal(preview.skippedBlankRows, 1);
  assert.equal(preview.errors.length, 1);
});

test('allows import only when metadata is present and every parsed row is valid', () => {
  const preview = buildRosterImportPreview({
    academicYear: '2026-2027',
    sourceFilename: 'students.csv',
    parsed: {
      rows: [
        { full_name: 'Trần Thị B', class_name: '11A2', phone: '0900100002' },
      ],
      errors: [],
      totalDataRows: 1,
      skippedBlankRows: 0,
    },
  });

  assert.equal(preview.canImport, true);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.invalidRows, 0);
  assert.deepEqual(preview.previewRows, [
    { full_name: 'Trần Thị B', class_name: '11A2', phone: '0900100002' },
  ]);
});

test('filters active roster by accent-insensitive name, class, phone and claim status', () => {
  const rows: ActiveRosterRow[] = [
    {
      id: '1',
      batchId: 'b1',
      schoolId: 's1',
      classId: 'c1',
      academicYear: '2026-2027',
      fullName: 'Nguyễn Văn Ánh',
      className: '12A1',
      phoneNormalized: '0900100001',
      claimStatus: 'claimed',
      claimedUserId: 'u1',
      claimedAt: '2026-08-21T00:00:00Z',
    },
    {
      id: '2',
      batchId: 'b1',
      schoolId: 's1',
      classId: 'c2',
      academicYear: '2026-2027',
      fullName: 'Trần Thị Bình',
      className: '11A2',
      phoneNormalized: '0900100002',
      claimStatus: 'unclaimed',
      claimedUserId: null,
      claimedAt: null,
    },
  ];

  assert.deepEqual(filterActiveRoster(rows, { keyword: 'anh' }).map((row) => row.id), ['1']);
  assert.deepEqual(filterActiveRoster(rows, { keyword: '11a2' }).map((row) => row.id), ['2']);
  assert.deepEqual(filterActiveRoster(rows, { keyword: '100001' }).map((row) => row.id), ['1']);
  assert.deepEqual(filterActiveRoster(rows, { claimStatus: 'unclaimed' }).map((row) => row.id), ['2']);
});
