import { getOwnerDetailSample, type OwnerDetailBundle, type OwnerTimelineItem } from './mockMyPostDetail';
import type { MyPost } from './types';

/**
 * Phase 1 only: keeps owner-detail interaction state consistent while navigating
 * between My Posts, My Detail and Edit Post during one SPA session.
 */
const detailStore = new Map<string, OwnerDetailBundle>();

function cloneBundle(bundle:OwnerDetailBundle):OwnerDetailBundle {
  return {
    favorites:bundle.favorites.map((item) => ({ ...item })),
    contacts:bundle.contacts.map((item) => ({ ...item })),
    comments:bundle.comments.map((item) => ({ ...item })),
    timeline:bundle.timeline.map((item) => ({ ...item })),
  };
}

export function getOwnerDetailLocal(post:MyPost):OwnerDetailBundle {
  const existing = detailStore.get(post.id);
  if (existing) return cloneBundle(existing);
  const initial = getOwnerDetailSample(post);
  detailStore.set(post.id, cloneBundle(initial));
  return cloneBundle(initial);
}

export function updateOwnerDetailLocal(post:MyPost, updater:(bundle:OwnerDetailBundle)=>OwnerDetailBundle):OwnerDetailBundle {
  const current = getOwnerDetailLocal(post);
  const next = updater(cloneBundle(current));
  detailStore.set(post.id, cloneBundle(next));
  return cloneBundle(next);
}

export function prependOwnerTimelineLocal(post:MyPost, item:Omit<OwnerTimelineItem, 'id'> & { id?:string }):OwnerDetailBundle {
  return updateOwnerDetailLocal(post, (current) => ({
    ...current,
    timeline:[{ ...item, id:item.id || `TL-${Date.now()}-${Math.random().toString(36).slice(2,7)}` }, ...current.timeline],
  }));
}
