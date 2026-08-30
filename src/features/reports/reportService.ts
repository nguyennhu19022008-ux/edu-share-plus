import { getSupabaseClient } from '../../lib/supabase/client';
import { parseSubmitReportResult, validateReportPayload } from './reportModel';
import type { SubmitReportPayload, SubmitReportResult } from './types';

export async function submitReport(payload: SubmitReportPayload): Promise<SubmitReportResult> {
  const validationError = validateReportPayload(payload);
  if (validationError) {
    throw new Error(validationError);
  }

  const client = getSupabaseClient();
  const { data, error } = await client.rpc('submit_moderation_report', {
    p_target_type: payload.targetType,
    p_target_id: payload.targetId,
    p_reason_code: payload.reasonCode,
    p_description: payload.description?.trim() || null,
  });

  if (error) {
    if (error.message.includes('EDU_SHARE_REPORT_TARGET_NOT_FOUND')) {
      throw new Error('Đối tượng cần báo cáo không tồn tại hoặc đã bị gỡ.');
    }
    if (error.message.includes('EDU_SHARE_REPORT_SELF_FORBIDDEN')) {
      throw new Error('Bạn không thể tự báo cáo chính mình.');
    }
    if (error.message.includes('EDU_SHARE_AUTH_REQUIRED')) {
      throw new Error('Bạn cần đăng nhập để gửi báo cáo.');
    }
    throw new Error(error.message || 'Không thể gửi báo cáo. Vui lòng thử lại sau.');
  }

  return parseSubmitReportResult(data);
}
