export type OwnerTradeType = 'lend' | 'give' | 'exchange' | 'low_price_sale';
export type OwnerModerationStatus = 'pending' | 'approved' | 'rejected';
export type OwnerLifecycleStatus = 'active' | 'completed' | 'withdrawn';
export type OwnerVisibilityScope = 'inherit' | 'school' | 'network';
export type OwnerContactMethod = 'phone' | 'email';
export type OwnerConditionGrade = 'like_new' | 'good' | 'fair' | 'well_used';

export type OwnerPostCreateInput = {
  categoryId:string;
  title:string;
  description:string;
  tradeType:OwnerTradeType;
  salePrice?:number | null;
  visibilityScope:OwnerVisibilityScope;
  preferredContactMethod:OwnerContactMethod;
  originalPurchasePrice?:number | null;
  originalPriceIsEstimate?:boolean | null;
  purchaseDate?:string | null;
  conditionGrade?:OwnerConditionGrade | null;
  brand?:string | null;
  model?:string | null;
};

export type OwnerPostEditInput = OwnerPostCreateInput & {
  postId:string;
};

export type OwnerPostListQuery = {
  keyword?:string;
  moderationStatus?:'' | OwnerModerationStatus;
  lifecycleStatus?:'' | OwnerLifecycleStatus;
  sort?:'newest' | 'oldest' | 'price_asc' | 'price_desc';
  page:number;
  pageSize:number;
};

export type OwnerPostView = {
  id:string;
  title:string;
  description:string;
  tradeType:OwnerTradeType;
  tradeLabel:string;
  salePrice:number | null;
  salePriceLabel:string;
  moderationStatus:OwnerModerationStatus;
  moderationLabel:string;
  lifecycleStatus:OwnerLifecycleStatus;
  lifecycleLabel:string;
  visibilityScope:OwnerVisibilityScope;
  preferredContactMethod:OwnerContactMethod;
  originalPurchasePrice:number | null;
  originalPriceIsEstimate:boolean | null;
  purchaseDate:string | null;
  conditionGrade:OwnerConditionGrade | null;
  conditionLabel:string;
  brand:string | null;
  model:string | null;
  isHidden:boolean;
  commentsEnabled:boolean;
  createdAt:string;
  createdAtLabel:string;
  updatedAt:string;
  updatedAtLabel:string;
  publishedAt:string | null;
  completedAt:string | null;
  withdrawnAt:string | null;
  categoryId:string;
  categoryName:string;
  classId:string | null;
  className:string;
};

export type OwnerPostHistoryItem = {
  id:string;
  dimension:string;
  oldValue:string | null;
  newValue:string;
  reason:string | null;
  createdAt:string;
};

export type OwnerPostDetail = {
  post:OwnerPostView;
  rejectionReason:string | null;
  history:OwnerPostHistoryItem[];
};

export type OwnerPostListResult = {
  items:OwnerPostView[];
  totalCount:number;
  page:number;
  pageSize:number;
  totalPages:number;
};

export type OwnerWriteResponse = {
  id:string;
  moderationStatus:OwnerModerationStatus;
  lifecycleStatus:OwnerLifecycleStatus;
  visibilityScope:OwnerVisibilityScope;
  updatedAt:string;
};

const TRADE_LABELS:Record<OwnerTradeType, string> = {
  lend:'Cho mượn',
  give:'Cho tặng',
  exchange:'Trao đổi',
  low_price_sale:'Bán giá rẻ',
};

const MODERATION_LABELS:Record<OwnerModerationStatus, string> = {
  pending:'Chờ duyệt',
  approved:'Đã duyệt',
  rejected:'Từ chối',
};

const LIFECYCLE_LABELS:Record<OwnerLifecycleStatus, string> = {
  active:'Đang hoạt động',
  completed:'Đã hoàn tất',
  withdrawn:'Đã thu hồi',
};

const CONDITION_LABELS:Record<OwnerConditionGrade, string> = {
  like_new:'Như mới',
  good:'Tốt',
  fair:'Khá',
  well_used:'Đã sử dụng nhiều',
};

function invalid():never {
  throw new Error('OWNER_POST_RESPONSE_INVALID');
}

function isRecord(value:unknown):value is Record<string, unknown> {
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

function nullablePositiveInteger(value:unknown):number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) invalid();
  return value;
}

function booleanValue(value:unknown):boolean {
  if (typeof value !== 'boolean') invalid();
  return value;
}

function nullableBoolean(value:unknown):boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'boolean') invalid();
  return value;
}

function enumValue<T extends string>(value:unknown, allowed:readonly T[]):T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid();
  return value as T;
}

function timestampValue(value:unknown):string {
  const raw = stringValue(value);
  if (!Number.isFinite(Date.parse(raw))) invalid();
  return raw;
}

function nullableTimestamp(value:unknown):string | null {
  if (value === null || value === undefined) return null;
  return timestampValue(value);
}

function nullableDate(value:unknown):string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid();
  if (!Number.isFinite(Date.parse(`${value}T00:00:00Z`))) invalid();
  return value;
}

function formatVietnamTimestamp(value:string):string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid();
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone:'Asia/Ho_Chi_Minh',
    day:'2-digit',
    month:'2-digit',
    year:'numeric',
    hour:'2-digit',
    minute:'2-digit',
    hourCycle:'h23',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

function formatMoney(value:number | null):string {
  if (value === null) return 'Miễn phí / thỏa thuận';
  return new Intl.NumberFormat('vi-VN', {
    style:'currency',
    currency:'VND',
    maximumFractionDigits:0,
  }).format(value);
}

export function parseOwnerPostRow(raw:unknown):OwnerPostView {
  if (!isRecord(raw)) invalid();

  const tradeType = enumValue(raw.trade_type, ['lend', 'give', 'exchange', 'low_price_sale'] as const);
  const moderationStatus = enumValue(raw.moderation_status, ['pending', 'approved', 'rejected'] as const);
  const lifecycleStatus = enumValue(raw.lifecycle_status, ['active', 'completed', 'withdrawn'] as const);
  const visibilityScope = enumValue(raw.visibility_scope, ['inherit', 'school', 'network'] as const);
  const preferredContactMethod = enumValue(raw.preferred_contact_method, ['phone', 'email'] as const);
  const conditionGrade = raw.condition_grade === null || raw.condition_grade === undefined
    ? null
    : enumValue(raw.condition_grade, ['like_new', 'good', 'fair', 'well_used'] as const);

  if (!isRecord(raw.category)) invalid();
  const categoryId = stringValue(raw.category.id);
  const categoryName = stringValue(raw.category.name);

  let classId:string | null = null;
  let className = 'Toàn trường';
  if (raw.class !== null && raw.class !== undefined) {
    if (!isRecord(raw.class)) invalid();
    classId = stringValue(raw.class.id);
    className = stringValue(raw.class.label);
  }

  const salePrice = nullablePositiveInteger(raw.sale_price);
  const createdAt = timestampValue(raw.created_at);
  const updatedAt = timestampValue(raw.updated_at);

  return {
    id:stringValue(raw.id),
    title:stringValue(raw.title),
    description:stringValue(raw.description),
    tradeType,
    tradeLabel:TRADE_LABELS[tradeType],
    salePrice,
    salePriceLabel:formatMoney(salePrice),
    moderationStatus,
    moderationLabel:MODERATION_LABELS[moderationStatus],
    lifecycleStatus,
    lifecycleLabel:LIFECYCLE_LABELS[lifecycleStatus],
    visibilityScope,
    preferredContactMethod,
    originalPurchasePrice:nullablePositiveInteger(raw.original_purchase_price),
    originalPriceIsEstimate:nullableBoolean(raw.original_price_is_estimate),
    purchaseDate:nullableDate(raw.purchase_date),
    conditionGrade,
    conditionLabel:conditionGrade ? CONDITION_LABELS[conditionGrade] : 'Không áp dụng',
    brand:nullableString(raw.brand),
    model:nullableString(raw.model),
    isHidden:booleanValue(raw.is_hidden),
    commentsEnabled:booleanValue(raw.comments_enabled),
    createdAt,
    createdAtLabel:formatVietnamTimestamp(createdAt),
    updatedAt,
    updatedAtLabel:formatVietnamTimestamp(updatedAt),
    publishedAt:nullableTimestamp(raw.published_at),
    completedAt:nullableTimestamp(raw.completed_at),
    withdrawnAt:nullableTimestamp(raw.withdrawn_at),
    categoryId,
    categoryName,
    classId,
    className,
  };
}

function trimToNull(value:string | null | undefined):string | null {
  const trimmed = value?.trim() || '';
  return trimmed || null;
}

export function buildOwnerPostMutationArgs(input:OwnerPostCreateInput) {
  const isSale = input.tradeType === 'low_price_sale';
  return {
    p_category_id:input.categoryId,
    p_title:input.title.trim(),
    p_description:input.description.trim(),
    p_trade_type:input.tradeType,
    p_sale_price:isSale ? input.salePrice ?? null : null,
    p_visibility_scope:input.visibilityScope,
    p_preferred_contact_method:input.preferredContactMethod,
    p_original_purchase_price:isSale ? input.originalPurchasePrice ?? null : null,
    p_original_price_is_estimate:isSale ? input.originalPriceIsEstimate ?? null : null,
    p_purchase_date:isSale ? input.purchaseDate ?? null : null,
    p_condition_grade:isSale ? input.conditionGrade ?? null : null,
    p_brand:isSale ? trimToNull(input.brand) : null,
    p_model:isSale ? trimToNull(input.model) : null,
  };
}

export function parseOwnerWriteResponse(raw:unknown):OwnerWriteResponse {
  if (!isRecord(raw)) invalid();
  return {
    id:stringValue(raw.id),
    moderationStatus:enumValue(raw.moderationStatus, ['pending', 'approved', 'rejected'] as const),
    lifecycleStatus:enumValue(raw.lifecycleStatus, ['active', 'completed', 'withdrawn'] as const),
    visibilityScope:enumValue(raw.visibilityScope, ['inherit', 'school', 'network'] as const),
    updatedAt:timestampValue(raw.updatedAt),
  };
}
