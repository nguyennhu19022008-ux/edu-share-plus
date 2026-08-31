import { type FormEvent, useEffect, useState } from 'react';
import {
  assignSchoolStaff,
  listSchoolStaff,
  revokeSchoolStaff,
} from '../staffManagementService';
import type { StaffMember, StaffRoleCode } from '../staffManagementTypes';

export function StaffManagementPanel() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const [inputEmail, setInputEmail] = useState('');
  const [inputRole, setInputRole] = useState<'teacher_moderator' | 'school_admin'>('teacher_moderator');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const items = await listSchoolStaff();
      setStaff(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể tải danh sách cán bộ trường.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (submitting || !inputEmail.trim()) return;

    setSubmitting(true);
    setError('');
    setNotice('');

    try {
      const result = await assignSchoolStaff({
        email: inputEmail.trim(),
        roleCode: inputRole,
      });

      setNotice(result.message);
      setInputEmail('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi khi cấp quyền.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(member: StaffMember) {
    if (revokingId) return;
    const confirmMsg = `Bạn có chắc chắn muốn thu hồi quyền “${member.roleName}” của ${member.fullName} (${member.email})?`;
    if (!window.confirm(confirmMsg)) return;

    setRevokingId(member.userId);
    setError('');
    setNotice('');

    try {
      const result = await revokeSchoolStaff(member.userId, member.roleCode);
      setNotice(result.message);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể thu hồi quyền.');
    } finally {
      setRevokingId(null);
    }
  }

  function roleBadgeClass(roleCode: StaffRoleCode) {
    if (roleCode === 'system_admin') return 'badge reject';
    if (roleCode === 'school_admin') return 'badge open';
    return 'badge pending';
  }

  return (
    <section className="roster-management-panel" style={{ display: 'grid', gap: '20px' }}>
      <div className="card" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>➕ Cấp quyền Giáo viên / Quản trị viên mới</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Nhập email tài khoản giáo viên để cấp quyền kiểm duyệt ngay lập tức (không cần chạy lệnh SQL).
            </p>
          </div>
        </div>

        {notice ? <div className="state ok" role="status" style={{ marginBottom: '16px' }}>{notice}</div> : null}
        {error ? <div className="state error" role="alert" style={{ marginBottom: '16px' }}>{error}</div> : null}

        <form onSubmit={handleAssign} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'grid', gap: '6px', flex: '1 1 260px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Email giáo viên / cán bộ</span>
            <input
              type="email"
              required
              placeholder="Ví dụ: giaovien@truong.edu.vn"
              value={inputEmail}
              onChange={(e) => setInputEmail(e.target.value)}
              style={{ height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label style={{ display: 'grid', gap: '6px', flex: '1 1 220px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>Vai trò phân quyền</span>
            <select
              value={inputRole}
              onChange={(e) => setInputRole(e.target.value as any)}
              style={{ height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            >
              <option value="teacher_moderator">👨‍🏫 Giáo viên kiểm duyệt (teacher_moderator)</option>
              <option value="school_admin">🛡️ Quản trị viên trường (school_admin)</option>
            </select>
          </label>

          <button
            type="submit"
            className="btn primary"
            disabled={submitting || !inputEmail.trim()}
            style={{ height: '40px', padding: '0 20px', fontWeight: 700 }}
          >
            {submitting ? 'Đang cấp quyền…' : 'Cấp quyền ngay'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>📋 Danh sách Cán bộ & Giáo viên của trường</h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Danh sách các thầy cô đang có quyền duyệt bài, xác minh danh tính học sinh và xử lý báo cáo vi phạm.
            </p>
          </div>
          <button type="button" className="btn gray" onClick={() => void loadData()} disabled={loading}>
            {loading ? 'Đang tải…' : '🔄 Làm mới'}
          </button>
        </div>

        {loading ? (
          <div className="state">Đang tải danh sách cán bộ…</div>
        ) : staff.length === 0 ? (
          <div className="state">Chưa có giáo viên nào được phân quyền trong trường. Hãy cấp quyền ở form trên.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-review-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '12px' }}>Họ và tên</th>
                  <th style={{ padding: '12px' }}>Email</th>
                  <th style={{ padding: '12px' }}>Vai trò</th>
                  <th style={{ padding: '12px' }}>Ngày cấp quyền</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={`${member.userId}-${member.roleCode}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>{member.fullName}</td>
                    <td style={{ padding: '12px', color: '#475569' }}>{member.email || '—'}</td>
                    <td style={{ padding: '12px' }}>
                      <span className={roleBadgeClass(member.roleCode)}>
                        {member.roleName}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '12px', color: '#64748b' }}>
                      {member.assignedAt ? new Date(member.assignedAt).toLocaleDateString('vi-VN') : 'Mặc định'}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn danger"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        disabled={revokingId === member.userId}
                        onClick={() => void handleRevoke(member)}
                      >
                        {revokingId === member.userId ? 'Đang thu hồi…' : 'Thu hồi'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
