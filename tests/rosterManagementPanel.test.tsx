import assert from 'node:assert/strict';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { RosterManagementPanelView } from '../src/features/admin/components/RosterManagementPanel';

test('renders school-scoped CSV preview, batch activation and active roster state', () => {
  const html = renderToStaticMarkup(
    <RosterManagementPanelView
      schoolName="THPT Nguyễn Du"
      academicYear="2026-2027"
      sourceFilename="roster.csv"
      preview={{
        academicYear: '2026-2027',
        sourceFilename: 'roster.csv',
        canImport: true,
        totalDataRows: 2,
        validRows: 2,
        invalidRows: 0,
        skippedBlankRows: 0,
        errors: [],
        previewRows: [
          { full_name: 'Nguyễn Văn A', class_name: '12A1', phone: '0900100001' },
          { full_name: 'Trần Thị B', class_name: '11A2', phone: '0900100002' },
        ],
      }}
      batches={[
        {
          id: 'batch-1',
          schoolId: 'school-1',
          academicYear: '2026-2027',
          sourceFilename: 'roster.csv',
          status: 'previewed',
          totalRows: 2,
          validRows: 2,
          invalidRows: 0,
          importedBy: 'teacher-1',
          createdAt: '2026-08-21T03:00:00Z',
          activatedAt: null,
          archivedAt: null,
        },
      ]}
      activeRoster={[
        {
          id: 'row-1',
          batchId: 'batch-old',
          schoolId: 'school-1',
          classId: 'class-1',
          academicYear: '2025-2026',
          fullName: 'Lê Văn C',
          className: '12A3',
          phoneNormalized: '0900100003',
          claimStatus: 'claimed',
          claimedUserId: 'user-1',
          claimedAt: '2026-08-20T03:00:00Z',
        },
      ]}
      keyword=""
      claimStatus=""
      loading={false}
      busyAction=""
      error=""
      notice=""
      onAcademicYearChange={() => {}}
      onFileChange={() => {}}
      onImport={() => {}}
      onActivate={() => {}}
      onRefresh={() => {}}
      onKeywordChange={() => {}}
      onClaimStatusChange={() => {}}
    />,
  );

  assert.match(html, /THPT Nguyễn Du/);
  assert.match(html, /2 học sinh hợp lệ/);
  assert.match(html, /roster\.csv/);
  assert.match(html, /Kích hoạt/);
  assert.match(html, /Lê Văn C/);
  assert.match(html, /Đã liên kết tài khoản/);
});
