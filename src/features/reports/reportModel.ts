import type { ReportReasonOption, SubmitReportPayload, SubmitReportResult } from './types';

export const REPORT_REASONS: ReportReasonOption[] = [
  { value: 'inappropriate_content', label: 'Nội dung phản cảm, không phù hợp môi trường học đường' },
  { value: 'scam', label: 'Lừa đảo, gian lận, không đúng sự thật' },
  { value: 'offensive', label: 'Xúc phạm, quấy rối, ngôn từ thiếu văn hóa' },
  { value: 'spam', label: 'Spam, quảng cáo, đăng bài trùng lặp' },
  { value: 'wrong_information', label: 'Thông tin đồ dùng/tài liệu sai lệch' },
  { value: 'other', label: 'Lý do khác' },
];

export function validateReportPayload(payload: SubmitReportPayload): string | null {
  if (!payload.targetType || !['post', 'comment', 'user'].includes(payload.targetType)) {
    return 'Loại đối tượng báo cáo không hợp lệ.';
  }

  if (!payload.targetId || typeof payload.targetId !== 'string' || !payload.targetId.trim()) {
    return 'Thiếu thông tin đối tượng cần báo cáo.';
  }

  if (!payload.reasonCode || typeof payload.reasonCode !== 'string' || !payload.reasonCode.trim()) {
    return 'Vui lòng chọn lý do báo cáo.';
  }

  if (payload.reasonCode.trim().length > 80) {
    return 'Mã lý do không được vượt quá 80 ký tự.';
  }

  if (payload.description && payload.description.trim().length > 3000) {
    return 'Mô tả chi tiết không được vượt quá 3000 ký tự.';
  }

  return null;
}

export function parseSubmitReportResult(raw: unknown): SubmitReportResult {
  if (!raw || typeof raw !== 'object') {
    throw new Error('EDU_SHARE_REPORT_RESPONSE_INVALID');
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id.trim()) {
    throw new Error('EDU_SHARE_REPORT_ID_INVALID');
  }

  if (typeof obj.targetType !== 'string' || !obj.targetType.trim()) {
    throw new Error('EDU_SHARE_REPORT_TARGET_TYPE_INVALID');
  }

  if (typeof obj.targetId !== 'string' || !obj.targetId.trim()) {
    throw new Error('EDU_SHARE_REPORT_TARGET_ID_INVALID');
  }

  if (typeof obj.status !== 'string' || !obj.status.trim()) {
    throw new Error('EDU_SHARE_REPORT_STATUS_INVALID');
  }

  if (typeof obj.createdAt !== 'string' || !obj.createdAt.trim()) {
    throw new Error('EDU_SHARE_REPORT_CREATED_AT_INVALID');
  }

  return {
    id: obj.id.trim(),
    targetType: obj.targetType.trim(),
    targetId: obj.targetId.trim(),
    status: obj.status.trim(),
    createdAt: obj.createdAt.trim(),
  };
}
