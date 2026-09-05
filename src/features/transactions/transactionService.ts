import { getSupabaseClient } from '../../lib/supabase/client';
import type {
  CompleteTransactionInput,
  CompleteTransactionResult,
  SchoolImpactSummary,
  TransactionRecord,
} from './transactionTypes';

export async function completePostTransaction(
  input: CompleteTransactionInput
): Promise<CompleteTransactionResult> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Bạn cần đăng nhập để hoàn tất giao dịch.');
  }

  const { data, error } = await supabase.rpc('complete_post_transaction', {
    p_post_id: input.postId,
    p_requester_id: input.requesterId || null,
    p_rating: input.rating || null,
    p_feedback: input.feedback || null,
  });

  if (error) {
    throw new Error(error.message || 'Không thể hoàn tất giao dịch lúc này.');
  }

  const res = data as Record<string, unknown>;
  return {
    transactionId: String(res.transaction_id || ''),
    postId: String(res.post_id || input.postId),
    financialSaved: Number(res.financial_saved) || 0,
    wasteReducedKg: Number(res.waste_reduced_kg) || 0,
    status: String(res.status || 'completed'),
  };
}

export async function getSchoolImpactSummary(schoolId?: string | null): Promise<SchoolImpactSummary> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_school_impact_summary', {
    p_school_id: schoolId || null,
  });

  if (error) {
    // Fallback: query counts from posts table directly
    const { count: completedCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('lifecycle_status', 'completed');

    const { count: activeCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('moderation_status', 'approved')
      .eq('lifecycle_status', 'active');

    const txCount = completedCount || 0;
    return {
      schoolId: schoolId || null,
      completedTransactions: txCount,
      financialSaved: txCount * 50000,
      wasteReducedKg: Number((txCount * 0.45).toFixed(2)),
      activePosts: activeCount || 0,
    };
  }

  const res = data as any;
  return {
    schoolId: res.school_id || schoolId || null,
    completedTransactions: Number(res.completed_transactions) || 0,
    financialSaved: Number(res.financial_saved) || 0,
    wasteReducedKg: Number(res.waste_reduced_kg) || 0,
    activePosts: Number(res.active_posts) || 0,
  };
}

export async function listMyTransactions(): Promise<TransactionRecord[]> {
  const supabase = getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(`owner_id.eq.${user.id},requester_id.eq.${user.id}`)
    .order('completed_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    id: row.id,
    postId: row.post_id,
    ownerId: row.owner_id,
    requesterId: row.requester_id,
    schoolId: row.school_id,
    tradeType: row.trade_type,
    salePrice: Number(row.sale_price) || 0,
    financialSaved: Number(row.financial_saved) || 0,
    wasteReducedKg: Number(row.waste_reduced_kg) || 0,
    status: row.status,
    rating: row.rating,
    feedbackNote: row.feedback_note,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }));
}
