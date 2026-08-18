import { getSupabaseClient } from '../../lib/supabase/client';
import type {
  AccountReviewDecision,
  AccountReviewQueueItem,
} from './accountReviewTypes';

type ReviewQueueRpcRow = {
  review_id: string;
  user_id: string;
  full_name: string;
  contact_email: string | null;
  phone: string | null;
  student_reference_code: string | null;
  school_id: string;
  school_name: string;
  class_name_claim: string | null;
  review_status: 'pending' | 'needs_information';
  submitted_at: string;
  current_reason: string | null;
  submission_snapshot: Record<string, unknown> | null;
};

function normalizeRpcError(message:string):string {
  if (message.includes('EDU_SHARE_AUTH_REQUIRED')) {
    return 'Phiên giáo viên không hợp lệ hoặc đã hết hạn.';
  }
  if (message.includes('EDU_SHARE_STAFF_ACCESS_REQUIRED')) {
    return 'Tài khoản hiện tại không có quyền đọc hàng chờ xác minh học sinh.';
  }
  if (message.includes('EDU_SHARE_STAFF_ACCOUNT_NOT_APPROVED')) {
    return 'Tài khoản giáo viên chưa được phê duyệt để xử lý hàng chờ.';
  }
  if (message.includes('EDU_SHARE_REVIEW_FORBIDDEN')) {
    return 'Bạn không có quyền xử lý học sinh này hoặc học sinh thuộc ngoài phạm vi trường của bạn.';
  }
  if (message.includes('EDU_SHARE_OPEN_REVIEW_NOT_FOUND')) {
    return 'Yêu cầu này không còn ở trạng thái chờ xử lý. Hãy làm mới hàng chờ.';
  }
  if (message.includes('EDU_SHARE_ACCOUNT_NOT_PENDING_REVIEW')) {
    return 'Tài khoản này không còn ở trạng thái chờ giáo viên duyệt.';
  }
  if (message.includes('EDU_SHARE_REVIEW_REASON_REQUIRED')) {
    return 'Cần nhập lý do khi từ chối hoặc yêu cầu bổ sung thông tin.';
  }
  return message || 'Không thể thực hiện thao tác xét duyệt tài khoản.';
}

export async function listAccountReviewQueue():Promise<AccountReviewQueueItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_account_review_queue');

  if (error) throw new Error(normalizeRpcError(error.message));

  return ((data ?? []) as ReviewQueueRpcRow[]).map((row) => ({
    reviewId: String(row.review_id),
    userId: String(row.user_id),
    fullName: String(row.full_name ?? ''),
    contactEmail: row.contact_email ? String(row.contact_email) : null,
    phone: row.phone ? String(row.phone) : null,
    studentReferenceCode: row.student_reference_code ? String(row.student_reference_code) : null,
    schoolId: String(row.school_id),
    schoolName: String(row.school_name ?? ''),
    classNameClaim: row.class_name_claim ? String(row.class_name_claim) : null,
    reviewStatus: row.review_status,
    submittedAt: String(row.submitted_at),
    currentReason: row.current_reason ? String(row.current_reason) : null,
    submissionSnapshot:
      row.submission_snapshot && typeof row.submission_snapshot === 'object'
        ? row.submission_snapshot
        : {},
  }));
}

export async function reviewStudentAccount(
  userId:string,
  decision:AccountReviewDecision,
  reason:string|null = null,
):Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('review_student_account', {
    p_user_id:userId,
    p_decision:decision,
    p_reason:reason,
  });

  if (error) throw new Error(normalizeRpcError(error.message));
}
