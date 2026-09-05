import { getSupabaseClient } from '../../lib/supabase/client';
import {
  parseStaffPostsQueueResult,
  parseStaffReportsQueueResult,
} from './postModerationModel';
import type {
  ModerationAction,
  StaffPostQueueItem,
  StaffPostsQueueResult,
  StaffReportQueueItem,
  StaffReportsQueueResult,
} from './postModerationTypes';

export async function listStaffPostsQueue(params?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<StaffPostsQueueResult> {
  const client = getSupabaseClient();
  const limit = params?.limit ?? 2000;
  const offset = params?.offset ?? 0;

  try {
    const makeQuery = () => {
      let query = client
        .from('posts')
        .select(
          `
          id,
          title,
          description,
          trade_type,
          sale_price,
          moderation_status,
          lifecycle_status,
          is_hidden,
          comments_enabled,
          created_at,
          published_at,
          school_id,
          category:categories!posts_category_fk(id, name),
          profile:profiles!posts_owner_fk(user_id, full_name),
          class:school_classes!posts_class_scope_fk(id, label)
        `
        )
        .order('created_at', { ascending: false });

      if (params?.status) {
        query = query.eq('moderation_status', params.status);
      }

      if (params?.search) {
        query = query.ilike('title', `%${params.search}%`);
      }

      return query;
    };

    // Parallel fetch batches to surpass PostgREST 1000 limit instantly
    const [batch1, batch2] = await Promise.all([
      makeQuery().range(0, 999),
      makeQuery().range(1000, 1999),
    ]);

    if (batch1.error) {
      throw new Error(batch1.error.message || 'Không thể tải danh sách bài đăng.');
    }

    const allRows = [...(batch1.data || []), ...(batch2.data || [])];

    const items: StaffPostQueueItem[] = allRows.map((row: any) => ({
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      tradeType: row.trade_type || 'give',
      category: row.category?.name || null,
      className: row.class?.label || null,
      ownerName: row.profile?.full_name || 'Học sinh',
      ownerEmail: null,
      price: Number(row.sale_price ?? 0) || 0,
      moderationStatus: (['pending', 'approved', 'rejected'].includes(row.moderation_status)
        ? row.moderation_status
        : 'approved') as StaffPostQueueItem['moderationStatus'],
      lifecycleStatus: row.lifecycle_status || 'active',
      isHidden: Boolean(row.is_hidden),
      commentsEnabled: row.comments_enabled !== false,
      rejectionReason: null,
      createdAt: row.created_at || new Date().toISOString(),
      publishedAt: row.published_at || null,
      reportCount: 0,
      favoriteCount: 0,
    }));

    return {
      items,
      totalCount: items.length,
      limit,
      offset,
    };
  } catch (directErr) {
    throw new Error(directErr instanceof Error ? directErr.message : 'Không thể tải hàng chờ kiểm duyệt bài đăng.');
  }
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
    throw new Error(error.message || 'Không thể thực hiện kiểm duyệt bài viết lúc này.');
  }

  return (
    (data as { postId: string; action: string; moderatedAt: string }) || {
      postId: postId.trim(),
      action,
      moderatedAt: new Date().toISOString(),
    }
  );
}

export async function listStaffReportsQueue(params?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<StaffReportsQueueResult> {
  const client = getSupabaseClient();
  const limit = params?.limit ?? 50;
  const offset = params?.offset ?? 0;

  try {
    const { data, error } = await client.rpc('list_staff_reports_queue', {
      p_status: params?.status?.trim() || null,
      p_limit: limit,
      p_offset: offset,
    });

    if (!error && data) {
      return parseStaffReportsQueueResult(data);
    }
  } catch {
    // Fallback to direct query
  }

  try {
    let query = client
      .from('reports')
      .select('id, target_type, post_id, comment_id, reason_code, description, status, created_at, reporter_id')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    const items: StaffReportQueueItem[] = (data || []).map((row: any) => ({
      id: row.id,
      targetType: row.target_type === 'comment' ? 'comment' : 'post',
      targetId: row.post_id || row.comment_id || row.id,
      targetTitle: 'Bài đăng vi phạm',
      reporterName: 'Học sinh',
      reasonCode: row.reason_code || 'other',
      description: row.description || '',
      status: row.status || 'open',
      resolutionNote: row.resolution_note || null,
      createdAt: row.created_at || new Date().toISOString(),
      resolvedAt: row.resolved_at || null,
    }));

    return {
      items,
      totalCount: items.length,
      limit,
      offset,
    };
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : 'Không thể tải danh sách báo cáo vi phạm.');
  }
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
