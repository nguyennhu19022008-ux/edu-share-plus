import { getSupabaseClient } from '../../lib/supabase/client';
import {
  buildMarketplaceRpcArgs,
  parseMarketplaceDetailResponse,
  parseMarketplaceReadResponse,
  type MarketplaceDetailResponse,
  type MarketplaceQuery,
  type MarketplaceReadResponse,
} from './marketplaceReadModel';

function marketplaceError(error:{ message?:string; code?:string } | null) {
  const code = error?.code ? ` (${error.code})` : '';
  return new Error(`Không thể tải dữ liệu chợ học tập${code}: ${error?.message || 'Lỗi không xác định.'}`);
}

export async function listMarketplacePosts(query:MarketplaceQuery):Promise<MarketplaceReadResponse> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_marketplace_posts', buildMarketplaceRpcArgs(query));
  if (error) throw marketplaceError(error);
  return parseMarketplaceReadResponse(data);
}

export async function getMarketplacePost(postId:string):Promise<MarketplaceDetailResponse> {
  const normalizedId = postId.trim();
  if (!normalizedId) throw new Error('MARKETPLACE_POST_ID_REQUIRED');
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_marketplace_post', { p_post_id:normalizedId });
  if (error) throw marketplaceError(error);
  return parseMarketplaceDetailResponse(data);
}
