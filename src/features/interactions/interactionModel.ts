export type CommentView = {
  id:string;
  parentId:string | null;
  body:string | null;
  isDeleted:boolean;
  authorName:string;
  authorClassName:string | null;
  createdAt:string;
  canDelete:boolean;
};

export type CommentMutationResult = {
  id:string;
  postId:string;
  parentId:string | null;
  createdAt:string;
};

export type CommentDeleteResult = {
  id:string;
  deletedAt:string;
  alreadyDeleted:boolean;
};

export type ContactRevealView = {
  method:'email' | 'phone';
  value:string;
  eventId:string;
  eventCreatedAt:string;
  eventReused:boolean;
};

export type OwnerContactEventView = {
  id:string;
  requesterName:string;
  requesterClassName:string | null;
  revealedMethod:'email' | 'phone';
  createdAt:string;
};

export type OwnerContactHistory = {
  items:OwnerContactEventView[];
  totalCount:number;
  favoriteCount:number;
};

export type SavedPostView = {
  id:string;
  title:string;
  tradeType:'lend' | 'give' | 'exchange' | 'low_price_sale';
  categoryName:string;
  price:number | null;
  publishedAt:string | null;
  createdAt:string;
  favoriteCount:number;
};

export type SavedPostList = {
  items:SavedPostView[];
  totalCount:number;
  limit:number;
  offset:number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid():never {
  throw new Error('INTERACTION_RESPONSE_INVALID');
}

function isRecord(value:unknown):value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value:unknown):string {
  if (typeof value !== 'string' || value.trim().length === 0) invalid();
  return value;
}

function uuidValue(value:unknown):string {
  const raw = nonEmptyString(value);
  if (!UUID_RE.test(raw)) invalid();
  return raw;
}

function nullableUuid(value:unknown):string | null {
  if (value === null) return null;
  return uuidValue(value);
}

function nullableString(value:unknown):string | null {
  if (value === null) return null;
  return nonEmptyString(value);
}

function booleanValue(value:unknown):boolean {
  if (typeof value !== 'boolean') invalid();
  return value;
}

function timestampValue(value:unknown):string {
  const raw = nonEmptyString(value);
  if (!Number.isFinite(Date.parse(raw))) invalid();
  return raw;
}

function nullableTimestamp(value:unknown):string | null {
  if (value === null) return null;
  return timestampValue(value);
}

function nonNegativeInteger(value:unknown):number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}

function positiveBoundedInteger(value:unknown, max:number):number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > max) invalid();
  return value;
}

function nullableMoney(value:unknown):number | null {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid();
  return value;
}

function enumValue<T extends string>(value:unknown, allowed:readonly T[]):T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid();
  return value as T;
}

function parseComment(raw:unknown):CommentView {
  if (!isRecord(raw)) invalid();
  const isDeleted = booleanValue(raw.isDeleted);
  let body:string | null;
  if (isDeleted) {
    if (raw.body !== null) invalid();
    body = null;
  } else {
    body = nonEmptyString(raw.body);
  }

  return {
    id:uuidValue(raw.id),
    parentId:nullableUuid(raw.parentId),
    body,
    isDeleted,
    authorName:nonEmptyString(raw.authorName),
    authorClassName:nullableString(raw.authorClassName),
    createdAt:timestampValue(raw.createdAt),
    canDelete:booleanValue(raw.canDelete),
  };
}

export function parseCommentListResponse(raw:unknown):CommentView[] {
  if (!isRecord(raw) || !Array.isArray(raw.items)) invalid();
  nonNegativeInteger(raw.totalCount);
  return raw.items.map(parseComment);
}

export function parseCommentMutationResponse(raw:unknown):CommentMutationResult {
  if (!isRecord(raw)) invalid();
  return {
    id:uuidValue(raw.id),
    postId:uuidValue(raw.postId),
    parentId:nullableUuid(raw.parentId),
    createdAt:timestampValue(raw.createdAt),
  };
}

export function parseCommentDeleteResponse(raw:unknown):CommentDeleteResult {
  if (!isRecord(raw)) invalid();
  return {
    id:uuidValue(raw.id),
    deletedAt:timestampValue(raw.deletedAt),
    alreadyDeleted:booleanValue(raw.alreadyDeleted),
  };
}

export function parseContactRevealResponse(raw:unknown):ContactRevealView {
  if (!isRecord(raw)) invalid();
  return {
    method:enumValue(raw.method, ['email', 'phone'] as const),
    value:nonEmptyString(raw.value),
    eventId:uuidValue(raw.eventId),
    eventCreatedAt:timestampValue(raw.eventCreatedAt),
    eventReused:booleanValue(raw.eventReused),
  };
}

function parseOwnerContactEvent(raw:unknown):OwnerContactEventView {
  if (!isRecord(raw)) invalid();
  return {
    id:uuidValue(raw.id),
    requesterName:nonEmptyString(raw.requesterName),
    requesterClassName:nullableString(raw.requesterClassName),
    revealedMethod:enumValue(raw.revealedMethod, ['email', 'phone'] as const),
    createdAt:timestampValue(raw.createdAt),
  };
}

export function parseOwnerContactHistoryResponse(raw:unknown):OwnerContactHistory {
  if (!isRecord(raw) || !Array.isArray(raw.items)) invalid();
  return {
    items:raw.items.map(parseOwnerContactEvent),
    totalCount:nonNegativeInteger(raw.totalCount),
    favoriteCount:nonNegativeInteger(raw.favoriteCount),
  };
}

function parseSavedPost(raw:unknown):SavedPostView {
  if (!isRecord(raw)) invalid();
  return {
    id:uuidValue(raw.id),
    title:nonEmptyString(raw.title),
    tradeType:enumValue(raw.tradeType, ['lend', 'give', 'exchange', 'low_price_sale'] as const),
    categoryName:nonEmptyString(raw.categoryName),
    price:nullableMoney(raw.price),
    publishedAt:nullableTimestamp(raw.publishedAt),
    createdAt:timestampValue(raw.createdAt),
    favoriteCount:nonNegativeInteger(raw.favoriteCount),
  };
}

export function parseSavedPostListResponse(raw:unknown):SavedPostList {
  if (!isRecord(raw) || !Array.isArray(raw.items)) invalid();
  return {
    items:raw.items.map(parseSavedPost),
    totalCount:nonNegativeInteger(raw.totalCount),
    limit:positiveBoundedInteger(raw.limit, 50),
    offset:nonNegativeInteger(raw.offset),
  };
}
