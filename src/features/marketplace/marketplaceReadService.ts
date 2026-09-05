import { getSupabaseClient } from '../../lib/supabase/client';
import { ClientCache } from '../../lib/cache/clientCache';
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

const MARKETPLACE_CACHE_TTL_MS = 90 * 1000; // 90 seconds
const DETAIL_CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

export function invalidateMarketplaceCache(): void {
  ClientCache.invalidatePattern('mkt_');
}

export async function listMarketplacePosts(
  query: MarketplaceQuery,
  skipCache = false
): Promise<MarketplaceReadResponse> {
  const cacheKey = `mkt_list_${JSON.stringify(query)}`;

  if (skipCache) {
    ClientCache.invalidate(cacheKey);
  }

  return ClientCache.fetchWithSWR(
    cacheKey,
    async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('list_marketplace_posts', buildMarketplaceRpcArgs(query));
      if (error) throw marketplaceError(error);
      return parseMarketplaceReadResponse(data);
    },
    {
      ttlMs: MARKETPLACE_CACHE_TTL_MS,
      tier: 'session',
    }
  );
}

export async function getMarketplacePost(
  postId: string,
  skipCache = false
): Promise<MarketplaceDetailResponse> {
  const normalizedId = postId.trim();
  if (!normalizedId) throw new Error('MARKETPLACE_POST_ID_REQUIRED');

  const cacheKey = `mkt_detail_${normalizedId}`;

  if (skipCache) {
    ClientCache.invalidate(cacheKey);
  }

  return ClientCache.fetchWithSWR(
    cacheKey,
    async () => {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.rpc('get_marketplace_post', { p_post_id: normalizedId });
      if (error) throw marketplaceError(error);
      return parseMarketplaceDetailResponse(data);
    },
    {
      ttlMs: DETAIL_CACHE_TTL_MS,
      tier: 'session',
    }
  );
}
