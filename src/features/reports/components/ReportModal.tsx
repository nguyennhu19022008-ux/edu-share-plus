import React, { useState } from 'react';
import { REPORT_REASONS } from '../reportModel';
import { submitReport } from '../reportService';
import type { ReportReasonCode, ReportTargetType } from '../types';

interface ReportModalProps {
  isOpen: boolean;
  targetType: ReportTargetType;
  targetId: string;
  targetTitle?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  targetType,
  targetId,
  targetTitle,
  onClose,
  onSuccess,
}) => {
  const [reasonCode, setReasonCode] = useState<ReportReasonCode>('inappropriate_content');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const targetLabel =
    targetType === 'post' ? 'bài đăng' : targetType === 'comment' ? 'bình luận' : 'người dùng';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    try {
      await submitReport({
        targetType,
        targetId,
        reasonCode,
        description,
      });
      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Đã có lỗi xảy ra.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubmitted(false);
    setErrorMsg(null);
    setDescription('');
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
      <div className="modal-content report-modal">
        <div className="modal-header">
          <h3 id="report-modal-title">Báo cáo {targetLabel} vi phạm</h3>
          <button className="close-btn" type="button" onClick={handleClose} disabled={submitting}>
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="modal-body report-success-body">
            <div className="alert success">
              Cảm ơn bạn đã gửi báo cáo. Ban quản trị và giáo viên nhà trường sẽ xem xét nội dung này trong thời gian sớm nhất.
            </div>
            <div className="modal-actions">
              <button className="btn primary" type="button" onClick={handleClose}>
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {targetTitle && (
                <div className="report-target-summary">
                  <small>Đối tượng:</small> <strong>{targetTitle}</strong>
                </div>
              )}

              {errorMsg && <div className="alert error">{errorMsg}</div>}

              <div className="form-group">
                <label htmlFor="report-reason-select">Lý do báo cáo *</label>
                <select
                  id="report-reason-select"
                  className="form-control"
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value as ReportReasonCode)}
                  disabled={submitting}
                  required
                >
                  {REPORT_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="report-description">Mô tả chi tiết (không bắt buộc)</label>
                <textarea
                  id="report-description"
                  className="form-control"
                  rows={3}
                  placeholder="Cung cấp thêm bằng chứng hoặc chi tiết vi phạm để hỗ trợ kiểm duyệt..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  maxLength={3000}
                />
                <small className="form-note">{description.length}/3000 ký tự</small>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn gray" type="button" onClick={handleClose} disabled={submitting}>
                Hủy
              </button>
              <button className="btn danger" type="submit" disabled={submitting}>
                {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
