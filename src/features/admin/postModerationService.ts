import { getSupabaseClient } from '../../lib/supabase/client';
import {
  parseStaffPostsQueueResult,
  parseStaffReportsQueueResult,
} from './postModerationModel';
import type {
  ModerationAction,
  StaffPostsQueueResult,
  StaffReportsQueueResult,
} from './postModerationTypes';

export async function listStaffPostsQueue(params?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<StaffPostsQueueResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('list_staff_posts_queue', {
    p_status: params?.status?.trim() || null,
    p_search: params?.search?.trim() || null,
    p_limit: params?.limit ?? 20,
    p_offset: params?.offset ?? 0,
  });

  if (error) {
    if (error.message.includes('schema cache') || error.message.includes('not find the function')) {
      console.warn('list_staff_posts_queue RPC not present yet on Supabase:', error.message);
      return { items: [], totalCount: 0, limit: params?.limit ?? 20, offset: params?.offset ?? 0 };
    }
    throw new Error(error.message || 'Không thể tải hàng chờ kiểm duyệt bài đăng.');
  }

  return parseStaffPostsQueueResult(data);
}

export async function moderatePost(
  postId: string,
  action: ModerationAction,
  reason?: string
): Promise<{ postId: string; action: string; moderatedAt: string }> {
  if (!postId || !postId.trim()) {
    throw new Error('Thiếu ID bài viết cần kiểm duyệt.');
  }

  if (action === 'reject' && (!reason || !reason.trim())) {
    throw new Error('Cần cung cấp lý do khi từ chối bài viết.');
  }

  const client = getSupabaseClient();
  const { data, error } = await client.rpc('moderate_post', {
    p_post_id: postId.trim(),
    p_action: action,
    p_reason: reason?.trim() || null,
  });

  if (error) {
    if (error.message.includes('EDU_SHARE_MODERATION_SCOPE_DENIED')) {
      throw new Error('Bạn không có quyền kiểm duyệt bài viết của trường khác.');
    }
    throw new Error(error.message || 'Không thể thực hiện thao tác kiểm duyệt.');
  }

  return data as { postId: string; action: string; moderatedAt: string };
}

export async function listStaffReportsQueue(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<StaffReportsQueueResult> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('list_staff_reports_queue', {
    p_status: params?.status?.trim() || null,
    p_limit: params?.limit ?? 20,
    p_offset: params?.offset ?? 0,
  });

  if (error) {
    if (error.message.includes('schema cache') || error.message.includes('not find the function')) {
      console.warn('list_staff_reports_queue RPC not present yet on Supabase:', error.message);
      return { items: [], totalCount: 0, limit: params?.limit ?? 20, offset: params?.offset ?? 0 };
    }
    throw new Error(error.message || 'Không thể tải danh sách báo cáo vi phạm.');
  }

  return parseStaffReportsQueueResult(data);
}

export async function resolveModerationReport(
  reportId: string,
  decision: 'resolved' | 'dismissed',
  note?: string
): Promise<{ reportId: string; status: string; resolvedAt: string }> {
  if (!reportId || !reportId.trim()) {
    throw new Error('Thiếu ID báo cáo cần xử lý.');
  }

  const client = getSupabaseClient();
  const { data, error } = await client.rpc('resolve_moderation_report', {
    p_report_id: reportId.trim(),
    p_decision: decision,
    p_resolution_note: note?.trim() || null,
  });

  if (error) {
    if (error.message.includes('EDU_SHARE_REPORT_SCOPE_DENIED')) {
      throw new Error('Bạn không có quyền xử lý báo cáo của trường khác.');
    }
    throw new Error(error.message || 'Không thể xử lý báo cáo vi phạm.');
  }

  return data as { reportId: string; status: string; resolvedAt: string };
}
