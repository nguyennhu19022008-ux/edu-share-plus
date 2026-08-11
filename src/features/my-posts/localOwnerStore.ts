import { LOCAL_UI_MY_POSTS } from './mockMyPosts';
import type { MyPost } from './types';

/**
 * Phase 1 only: in-memory store shared by owner pages during one SPA session.
 * Refreshing the browser resets everything to controlled UI samples.
 * No research/user data is persisted here.
 */
let ownerPosts: MyPost[] = LOCAL_UI_MY_POSTS.map((item) => ({ ...item }));

export function getOwnerPosts(): MyPost[] {
  return ownerPosts.map((item) => ({ ...item }));
}

export function getOwnerPost(id: string): MyPost | undefined {
  const found = ownerPosts.find((item) => item.id === id);
  return found ? { ...found } : undefined;
}

export function replaceOwnerPost(nextPost: MyPost): MyPost {
  ownerPosts = ownerPosts.map((item) => item.id === nextPost.id ? { ...nextPost } : item);
  return { ...nextPost };
}

export function updateOwnerPost(id: string, updater: (post: MyPost) => MyPost): MyPost | undefined {
  let updated: MyPost | undefined;
  ownerPosts = ownerPosts.map((item) => {
    if (item.id !== id) return item;
    updated = updater({ ...item });
    return { ...updated };
  });
  return updated ? { ...updated } : undefined;
}

export function insertOwnerPost(post: MyPost): MyPost {
  ownerPosts = [{ ...post }, ...ownerPosts];
  return { ...post };
}

export function duplicateOwnerPost(source: MyPost): MyPost {
  const duplicate: MyPost = {
    ...source,
    id:`LOCAL-COPY-${Date.now()}`,
    title:`Bản sao - ${source.title}`.slice(0, 140),
    status:'Chờ duyệt',
    source:'Posts',
    hidden:false,
    date:'Vừa tạo trong phiên local',
    dateTs:Date.now(),
    doneTs:undefined,
    rejectionReason:'',
    favoriteCount:0,
    contactViewCount:0,
    contactedCount:0,
    commentCount:0,
    reportCount:0,
  };
  return insertOwnerPost(duplicate);
}
