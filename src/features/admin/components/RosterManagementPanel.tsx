import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { getCurrentStaffContext } from '../../auth/staff/staffAuthService';
import { parseRosterCsv, type RosterCsvParseResult } from '../rosterCsv';
import {
  buildRosterImportPreview,
  filterActiveRoster,
  type RosterImportPreview,
} from '../rosterPanelModel';
import {
  activateStudentRosterBatch,
  importStudentRoster,
  listActiveStudentRoster,
  listStudentRosterBatches,
  type ActiveRosterRow,
  type RosterImportBatch,
} from '../rosterService';

export type RosterManagementPanelViewProps = {
  schoolName: string;
  academicYear: string;
  sourceFilename: string;
  preview: RosterImportPreview | null;
  batches: RosterImportBatch[];
  activeRoster: ActiveRosterRow[];
  keyword: string;
  claimStatus: '' | ActiveRosterRow['claimStatus'];
  loading: boolean;
  busyAction: string;
  error: string;
  notice: string;
  onAcademicYearChange: (value: string) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onImport: () => void;
  onActivate: (batch: RosterImportBatch) => void;
  onRefresh: () => void;
  onKeywordChange: (value: string) => void;
  onClaimStatusChange: (value: '' | ActiveRosterRow['claimStatus']) => void;
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function batchStatusLabel(status: RosterImportBatch['status']): string {
  if (status === 'active') return 'Đang áp dụng';
  if (status === 'archived') return 'Đã lưu trữ';
  if (status === 'failed') return 'Lỗi';
  return 'Đã nhập, chờ kích hoạt';
}

function currentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() >= 6 ? year : year - 1;
  return `${start}-${start + 1}`;
}

export function RosterManagementPanelView({
  schoolName,
  academicYear,
  sourceFilename,
  preview,
  batches,
  activeRoster,
  keyword,
  claimStatus,
  loading,
  busyAction,
  error,
  notice,
  onAcademicYearChange,
  onFileChange,
  onImport,
  onActivate,
  onRefresh,
  onKeywordChange,
  onClaimStatusChange,
}: RosterManagementPanelViewProps) {
  return (
    <section className="admin-moderation-card roster-management-panel" aria-label="Quản lý danh sách học sinh tin cậy">
      <div className="admin-moderation-header">
        <div className="admin-moderation-title-row">
          <div>
            <h2>Danh sách học sinh tin cậy</h2>
            <p>Nhập CSV, kiểm tra trước khi ghi, kích hoạt theo năm học và theo dõi trạng thái liên kết tài khoản.</p>
          </div>
          <div className="admin-moderation-actions">
            <span className="roster-school-chip">{schoolName || 'Chưa xác định trường'}</span>
            <button className="admin-outline-button compact" type="button" disabled={loading || Boolean(busyAction)} onClick={onRefresh}>
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-content roster-panel-content">
        {error ? <div className="checkpoint-state roster-panel-state">{error}</div> : null}
        {notice ? <div className="checkpoint-state admin-local-state is-ok roster-panel-state">{notice}</div> : null}

        <div className="roster-import-grid">
          <label className="roster-field">
            <span>Năm học</span>
            <input
              value={academicYear}
              onChange={(event) => onAcademicYearChange(event.target.value)}
              placeholder="2026-2027"
              disabled={Boolean(busyAction)}
            />
          </label>
          <label className="roster-field roster-file-field">
            <span>Tệp CSV</span>
            <input type="file" accept=".csv,text/csv" onChange={onFileChange} disabled={Boolean(busyAction)} />
            {sourceFilename ? <small>{sourceFilename}</small> : <small>Cột bắt buộc: Họ và tên, Lớp, Số điện thoại.</small>}
          </label>
          <div className="roster-import-action">
            <button
              className="admin-primary-button compact"
              type="button"
              disabled={!preview?.canImport || Boolean(busyAction) || Boolean(error)}
              onClick={onImport}
            >
              {busyAction === 'import' ? 'Đang nhập...' : 'Nhập danh sách'}
            </button>
          </div>
        </div>

        {preview ? (
          <div className="roster-preview-block">
            <div className="roster-summary-strip">
              <strong>{preview.validRows} học sinh hợp lệ</strong>
              <span>{preview.invalidRows} dòng lỗi</span>
              <span>{preview.skippedBlankRows} dòng trống bỏ qua</span>
            </div>

            {preview.errors.length ? (
              <div className="checkpoint-state roster-panel-state">
                <strong>CSV chưa thể nhập.</strong>
                <ul>
                  {preview.errors.slice(0, 8).map((item, index) => (
                    <li key={`${item.code}-${item.rowNumber ?? index}`}>{item.message}</li>
                  ))}
                </ul>
                {preview.errors.length > 8 ? <small>Còn {preview.errors.length - 8} lỗi khác.</small> : null}
              </div>
            ) : null}

            {preview.previewRows.length ? (
              <div className="admin-table-scroll roster-preview-table">
                <table className="admin-review-table">
                  <thead>
                    <tr><th>Họ và tên</th><th>Lớp</th><th>Số điện thoại</th></tr>
                  </thead>
                  <tbody>
                    {preview.previewRows.map((row, index) => (
                      <tr key={`${row.full_name}-${row.class_name}-${row.phone}-${index}`}>
                        <td><strong>{row.full_name}</strong></td>
                        <td><span className="admin-class-chip">{row.class_name}</span></td>
                        <td>{row.phone}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="roster-section-heading">
          <div><h3>Lịch sử phiên nhập</h3><p>Mỗi trường chỉ có một batch active; batch cũ được lưu trữ thay vì xóa.</p></div>
        </div>

        {loading && !batches.length ? (
          <div className="state admin-empty-state">Đang tải lịch sử roster...</div>
        ) : batches.length ? (
          <div className="admin-table-scroll">
            <table className="admin-review-table">
              <thead>
                <tr><th>Năm học</th><th>Tệp nguồn</th><th>Học sinh</th><th>Trạng thái</th><th>Kích hoạt</th><th>Thao tác</th></tr>
              </thead>
              <tbody>
                {batches.map((batch) => {
                  const activating = busyAction === `activate:${batch.id}`;
                  const canActivate = batch.status !== 'active' && batch.status !== 'failed';
                  return (
                    <tr key={batch.id}>
                      <td><strong>{batch.academicYear}</strong></td>
                      <td>{batch.sourceFilename}</td>
                      <td>{batch.validRows}/{batch.totalRows}</td>
                      <td><span className="admin-status-pill"><i />{batchStatusLabel(batch.status)}</span></td>
                      <td>{formatDate(batch.activatedAt)}</td>
                      <td className="admin-action-cell">
                        {canActivate ? (
                          <button className="admin-table-primary" type="button" disabled={Boolean(busyAction)} onClick={() => onActivate(batch)}>
                            {activating ? 'Đang kích hoạt...' : 'Kích hoạt'}
                          </button>
                        ) : <span>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state admin-empty-state">Chưa có phiên nhập roster nào cho trường này.</div>
        )}

        <div className="roster-section-heading roster-active-heading">
          <div><h3>Roster đang áp dụng</h3><p>Tìm theo họ tên, lớp hoặc số điện thoại. Trạng thái claim chỉ phản ánh liên kết tài khoản EDU SHARE+.</p></div>
          <div className="roster-filter-row">
            <input
              type="search"
              value={keyword}
              onChange={(event) => onKeywordChange(event.target.value)}
              placeholder="Tìm học sinh, lớp, số điện thoại..."
              aria-label="Tìm trong roster đang áp dụng"
            />
            <select
              value={claimStatus}
              onChange={(event) => onClaimStatusChange(event.target.value as '' | ActiveRosterRow['claimStatus'])}
              aria-label="Lọc trạng thái liên kết tài khoản"
            >
              <option value="">Tất cả liên kết</option>
              <option value="claimed">Đã liên kết tài khoản</option>
              <option value="unclaimed">Chưa liên kết</option>
            </select>
          </div>
        </div>

        {loading && !activeRoster.length ? (
          <div className="state admin-empty-state">Đang tải roster active...</div>
        ) : activeRoster.length ? (
          <div className="admin-table-scroll">
            <table className="admin-review-table">
              <thead>
                <tr><th>Học sinh</th><th>Lớp</th><th>Năm học</th><th>Số điện thoại</th><th>Liên kết tài khoản</th><th>Liên kết lúc</th></tr>
              </thead>
              <tbody>
                {activeRoster.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.fullName}</strong></td>
                    <td><span className="admin-class-chip">{row.className}</span></td>
                    <td>{row.academicYear}</td>
                    <td>{row.phoneNormalized}</td>
                    <td>{row.claimStatus === 'claimed' ? 'Đã liên kết tài khoản' : 'Chưa liên kết'}</td>
                    <td>{formatDate(row.claimedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state admin-empty-state">Không có học sinh phù hợp trong roster active.</div>
        )}
      </div>
    </section>
  );
}

export default function RosterManagementPanel() {
  const [schoolId, setSchoolId] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [academicYear, setAcademicYear] = useState(currentAcademicYear);
  const [sourceFilename, setSourceFilename] = useState('');
  const [parsedCsv, setParsedCsv] = useState<RosterCsvParseResult | null>(null);
  const [batches, setBatches] = useState<RosterImportBatch[]>([]);
  const [activeRoster, setActiveRoster] = useState<ActiveRosterRow[]>([]);
  const [keyword, setKeyword] = useState('');
  const [claimStatus, setClaimStatus] = useState<'' | ActiveRosterRow['claimStatus']>('');
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const preview = useMemo(
    () => parsedCsv
      ? buildRosterImportPreview({ academicYear, sourceFilename, parsed: parsedCsv })
      : null,
    [academicYear, parsedCsv, sourceFilename],
  );

  const filteredRoster = useMemo(
    () => filterActiveRoster(activeRoster, { keyword, claimStatus }),
    [activeRoster, claimStatus, keyword],
  );

  async function refreshSchoolRoster(targetSchoolId = schoolId) {
    if (!targetSchoolId) return;
    setLoading(true);
    setError('');
    try {
      const [nextBatches, nextRoster] = await Promise.all([
        listStudentRosterBatches(targetSchoolId),
        listActiveStudentRoster(targetSchoolId),
      ]);
      setBatches(nextBatches);
      setActiveRoster(nextRoster);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được roster của trường hiện tại.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError('');
      try {
        const context = await getCurrentStaffContext();
        if (cancelled) return;

        if (!context.schoolId) {
          setSchoolName(context.schoolName || 'Quản trị viên hệ thống');
          setError('Tài khoản Admin toàn mạng cần chọn trường trước khi quản lý roster. School selector sẽ được triển khai ở bước quản trị đa trường; hệ thống không tự đoán tenant.');
          setLoading(false);
          return;
        }

        setSchoolId(context.schoolId);
        setSchoolName(context.schoolName || 'Trường hiện tại');
        await refreshSchoolRoster(context.schoolId);
      } catch (scopeError) {
        if (cancelled) return;
        setError(scopeError instanceof Error ? scopeError.message : 'Không xác định được phạm vi trường của giáo viên.');
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // Scope is resolved once per mounted staff session. Explicit refresh handles data changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setNotice('');
    setError('');

    if (!file) {
      setSourceFilename('');
      setParsedCsv(null);
      return;
    }

    if (!file.name.toLocaleLowerCase('vi').endsWith('.csv')) {
      setSourceFilename(file.name);
      setParsedCsv(null);
      setError('Vui lòng chọn tệp CSV (.csv).');
      return;
    }

    try {
      const text = await file.text();
      setSourceFilename(file.name);
      setParsedCsv(parseRosterCsv(text));
    } catch {
      setSourceFilename(file.name);
      setParsedCsv(null);
      setError('Không thể đọc tệp CSV đã chọn.');
    }
  }

  async function handleImport() {
    if (!schoolId || !preview?.canImport || !parsedCsv) return;

    setBusyAction('import');
    setError('');
    setNotice('');
    try {
      const result = await importStudentRoster({
        schoolId,
        academicYear: preview.academicYear,
        sourceFilename: preview.sourceFilename,
        rows: parsedCsv.rows,
      });
      setNotice(`Đã nhập ${result.validRows} học sinh vào batch ${result.academicYear}. Hãy kiểm tra lịch sử và kích hoạt batch khi sẵn sàng.`);
      await refreshSchoolRoster(schoolId);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Không thể nhập roster.');
    } finally {
      setBusyAction('');
    }
  }

  async function handleActivate(batch: RosterImportBatch) {
    if (!schoolId || busyAction) return;
    if (!window.confirm(`Kích hoạt roster ${batch.academicYear} từ “${batch.sourceFilename}”? Batch active hiện tại của trường sẽ được lưu trữ.`)) return;

    setBusyAction(`activate:${batch.id}`);
    setError('');
    setNotice('');
    try {
      await activateStudentRosterBatch(batch.id);
      setNotice(`Đã kích hoạt roster ${batch.academicYear}. Batch active trước đó đã được lưu trữ.`);
      await refreshSchoolRoster(schoolId);
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : 'Không thể kích hoạt roster.');
    } finally {
      setBusyAction('');
    }
  }

  return (
    <RosterManagementPanelView
      schoolName={schoolName}
      academicYear={academicYear}
      sourceFilename={sourceFilename}
      preview={preview}
      batches={batches}
      activeRoster={filteredRoster}
      keyword={keyword}
      claimStatus={claimStatus}
      loading={loading}
      busyAction={busyAction}
      error={error}
      notice={notice}
      onAcademicYearChange={setAcademicYear}
      onFileChange={(event) => { void handleFileChange(event); }}
      onImport={() => { void handleImport(); }}
      onActivate={(batch) => { void handleActivate(batch); }}
      onRefresh={() => { void refreshSchoolRoster(); }}
      onKeywordChange={setKeyword}
      onClaimStatusChange={setClaimStatus}
    />
  );
}
