import type { MarketplaceDetailResponse } from './marketplaceReadModel';

export type MarketplaceDetailLoadState =
  | { status:'loading' }
  | { status:'ready'; detail:MarketplaceDetailResponse }
  | { status:'notFound' }
  | { status:'error'; message:string };

export type MarketplaceDetailLoader = (postId:string) => Promise<MarketplaceDetailResponse>;

export function readRequestedMarketplacePostId(search:string):string | null {
  const value = new URLSearchParams(search).get('id')?.trim() || '';
  return value || null;
}

function isNotFoundError(error:unknown):boolean {
  if (!(error instanceof Error)) return false;
  return /EDU_SHARE_MARKETPLACE_POST_NOT_FOUND|MARKETPLACE_POST_NOT_FOUND|không tìm thấy|not found/i.test(error.message);
}

export async function loadMarketplaceDetail(
  postId:string,
  loader:MarketplaceDetailLoader,
):Promise<MarketplaceDetailLoadState> {
  const normalizedId = postId.trim();
  if (!normalizedId) return { status:'notFound' };

  try {
    const detail = await loader(normalizedId);
    return { status:'ready', detail };
  } catch (error) {
    if (isNotFoundError(error)) return { status:'notFound' };
    return {
      status:'error',
      message:'Không thể tải chi tiết bài đăng. Vui lòng thử lại.',
    };
  }
}
