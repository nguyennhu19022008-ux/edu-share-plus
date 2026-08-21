import type { MarketPost, MarketSort, TradeType } from './types';

export type MarketplaceQuery = {
  keyword:string;
  tradeType:'' | TradeType;
  categoryId:string;
  classId:string;
  sort:MarketSort;
  page:number;
  pageSize:number;
};

export type MarketplaceFacetClass = { id:string; label:string };
export type MarketplaceFacetCategory = { id:string; code:string; name:string };
export type MarketplaceStats = { totalOpen:number; free:number; sale:number; hasImage:number };

export type MarketplaceReadResponse = {
  items:MarketPost[];
  totalCount:number;
  page:number;
  pageSize:number;
  totalPages:number;
  stats:MarketplaceStats;
  classes:MarketplaceFacetClass[];
  categories:MarketplaceFacetCategory[];
};

export type MarketplaceDetailResponse = {
  post:MarketPost;
  similarPosts:MarketPost[];
  commentsEnabled:boolean;
};

const UI_TO_DB_TRADE: Record<TradeType, string> = {
  'Cho mượn':'lend',
  'Cho tặng':'give',
  'Trao đổi':'exchange',
  'Bán giá rẻ':'low_price_sale',
};

const DB_TO_UI_TRADE: Record<string, TradeType> = {
  lend:'Cho mượn',
  give:'Cho tặng',
  exchange:'Trao đổi',
  low_price_sale:'Bán giá rẻ',
};

function invalid(): never {
  throw new Error('MARKETPLACE_RESPONSE_INVALID');
}

function isRecord(value:unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value:unknown):string {
  if (typeof value !== 'string' || value.length === 0) invalid();
  return value;
}

function nullableString(value:unknown):string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') invalid();
  return value;
}

function numberValue(value:unknown):number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid();
  return value;
}

function nonNegativeInteger(value:unknown):number {
  const number = numberValue(value);
  if (!Number.isInteger(number) || number < 0) invalid();
  return number;
}

function booleanValue(value:unknown):boolean {
  if (typeof value !== 'boolean') invalid();
  return value;
}

function formatVietnamDateTime(iso:string):{ label:string; timestamp:number } {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) invalid();
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone:'Asia/Ho_Chi_Minh',
    day:'2-digit', month:'2-digit', year:'numeric',
    hour:'2-digit', minute:'2-digit', hourCycle:'h23',
  }).formatToParts(new Date(timestamp));
  const pick = (type:Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  const day = pick('day'), month = pick('month'), year = pick('year'), hour = pick('hour'), minute = pick('minute');
  if (!day || !month || !year || !hour || !minute) invalid();
  return { label:`${day}/${month}/${year} ${hour}:${minute}`, timestamp };
}

function mapPost(raw:unknown):MarketPost {
  if (!isRecord(raw)) invalid();
  const tradeType = DB_TO_UI_TRADE[stringValue(raw.tradeType)];
  if (!tradeType) invalid();

  const createdAt = stringValue(raw.createdAt);
  const displayAt = nullableString(raw.publishedAt) || createdAt;
  const date = formatVietnamDateTime(displayAt);
  const priceRaw = raw.price;
  if (priceRaw !== null && priceRaw !== undefined && (typeof priceRaw !== 'number' || !Number.isFinite(priceRaw))) invalid();

  return {
    id:stringValue(raw.id),
    title:stringValue(raw.title),
    description:stringValue(raw.description),
    name:stringValue(raw.ownerName),
    className:nullableString(raw.className) || 'Không công khai',
    tradeType,
    category:stringValue(raw.categoryName),
    price:priceRaw === null || priceRaw === undefined ? 0 : priceRaw,
    date:date.label,
    dateTs:date.timestamp,
    hasImage:booleanValue(raw.hasImage),
    favoriteCount:nonNegativeInteger(raw.favoriteCount),
    ownerReputationScore:numberValue(raw.ownerReputationScore),
    ownerReputationLabel:stringValue(raw.ownerReputationLabel),
  };
}

function mapClasses(raw:unknown):MarketplaceFacetClass[] {
  if (!Array.isArray(raw)) invalid();
  return raw.map((item) => {
    if (!isRecord(item)) invalid();
    return { id:stringValue(item.id), label:stringValue(item.label) };
  });
}

function mapCategories(raw:unknown):MarketplaceFacetCategory[] {
  if (!Array.isArray(raw)) invalid();
  return raw.map((item) => {
    if (!isRecord(item)) invalid();
    return { id:stringValue(item.id), code:stringValue(item.code), name:stringValue(item.name) };
  });
}

function mapStats(raw:unknown):MarketplaceStats {
  if (!isRecord(raw)) invalid();
  return {
    totalOpen:nonNegativeInteger(raw.totalOpen),
    free:nonNegativeInteger(raw.free),
    sale:nonNegativeInteger(raw.sale),
    hasImage:nonNegativeInteger(raw.hasImage),
  };
}

export function buildMarketplaceRpcArgs(query:MarketplaceQuery) {
  return {
    p_keyword:query.keyword.trim() || null,
    p_trade_type:query.tradeType ? UI_TO_DB_TRADE[query.tradeType] : null,
    p_category_id:query.categoryId || null,
    p_class_id:query.classId || null,
    p_sort:query.sort,
    p_page:query.page,
    p_page_size:query.pageSize,
  };
}

export function parseMarketplaceReadResponse(raw:unknown):MarketplaceReadResponse {
  if (!isRecord(raw) || !Array.isArray(raw.items)) invalid();
  return {
    items:raw.items.map(mapPost),
    totalCount:nonNegativeInteger(raw.totalCount),
    page:nonNegativeInteger(raw.page),
    pageSize:nonNegativeInteger(raw.pageSize),
    totalPages:nonNegativeInteger(raw.totalPages),
    stats:mapStats(raw.stats),
    classes:mapClasses(raw.classes),
    categories:mapCategories(raw.categories),
  };
}

export function parseMarketplaceDetailResponse(raw:unknown):MarketplaceDetailResponse {
  if (!isRecord(raw) || !isRecord(raw.post) || !Array.isArray(raw.similarPosts)) invalid();
  return {
    post:mapPost(raw.post),
    similarPosts:raw.similarPosts.map(mapPost),
    commentsEnabled:raw.post.commentsEnabled === undefined ? true : booleanValue(raw.post.commentsEnabled),
  };
}
