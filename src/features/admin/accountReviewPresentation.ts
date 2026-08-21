const ROSTER_MATCH_REASON_LABELS: Record<string, string> = {
  school_roster_match: 'Thông tin đã khớp duy nhất với roster của trường.',
  roster_not_found: 'Không tìm thấy học sinh khớp trong roster đang áp dụng.',
  roster_ambiguous: 'Có nhiều học sinh cùng lớp và số điện thoại; cần giáo viên đối chiếu thủ công.',
  roster_already_claimed: 'Dòng roster phù hợp đã được liên kết với một tài khoản khác; cần kiểm tra trước khi duyệt.',
  roster_disabled_manual_review: 'Trường đang tắt xác minh tự động bằng roster; tài khoản cần giáo viên duyệt thủ công.',
};

export function formatRosterMatchReason(reason: string | null | undefined): string {
  const normalized = String(reason ?? '').trim();
  if (!normalized) return 'Chưa có kết quả đối chiếu roster.';
  return ROSTER_MATCH_REASON_LABELS[normalized]
    ?? 'Cần giáo viên đối chiếu thông tin với roster của trường.';
}
