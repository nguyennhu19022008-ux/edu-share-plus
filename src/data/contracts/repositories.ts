import type { AdminDashboardSummary, AdminPost, AdminPostPatch } from '../../features/admin/types';
import type { MarketPost } from '../../features/marketplace/types';
import type { OwnerDetailBundle, OwnerTimelineItem } from '../../features/my-posts/detailTypes';
import type { MyPost } from '../../features/my-posts/types';
import type { NotificationLocal, ProfileBundleLocal, ProfilePrivacy, SavedPostLocal, StudentProfileLocal } from '../../features/profile/types';

/**
 * Phase 2 repository contracts.
 *
 * The current mock adapters are synchronous on purpose so Checkpoint 2D does not
 * alter the already-approved UI timing/behavior. Remote transport (Supabase)
 * will be introduced behind feature services/hooks in later phases without
 * allowing pages/components to import provider-specific modules.
 */
export interface MarketplaceRepository {
  listPosts(): MarketPost[];
}

export interface OwnerPostsRepository {
  list(): MyPost[];
  getById(id:string): MyPost | undefined;
  replace(post:MyPost): MyPost;
  update(id:string, updater:(post:MyPost)=>MyPost): MyPost | undefined;
  insert(post:MyPost): MyPost;
  duplicate(source:MyPost): MyPost;
}

export interface OwnerDetailRepository {
  get(post:MyPost): OwnerDetailBundle;
  update(post:MyPost, updater:(bundle:OwnerDetailBundle)=>OwnerDetailBundle): OwnerDetailBundle;
  prependTimeline(post:MyPost, item:Omit<OwnerTimelineItem,'id'> & {id?:string}): OwnerDetailBundle;
}

export interface ProfileRepository {
  getBundle(): ProfileBundleLocal;
  getSavedPostIds(): Set<string>;
  isPostSaved(postId:string): boolean;
  wasPostInitiallySaved(postId:string): boolean;
  setPostSaved(postId:string, saved:boolean): SavedPostLocal[];
  togglePostSaved(postId:string): boolean;
  updatePrivacy(next:ProfilePrivacy): StudentProfileLocal;
  updateImages(images:{avatarUrl:string;faceUrl:string}): StudentProfileLocal;
  markAllNotificationsRead(): NotificationLocal[];
  recordPasswordChanged(): StudentProfileLocal;
}

export interface AdminRepository {
  listPosts(): AdminPost[];
  resetPosts(): AdminPost[];
  updatePost(id:string, patch:AdminPostPatch): AdminPost | null;
  approveAllPending(): number;
  getPostById(id:string): AdminPost | null;
  getDashboardSummary(): AdminDashboardSummary;
}

export interface DataAccessRepositories {
  marketplace: MarketplaceRepository;
  ownerPosts: OwnerPostsRepository;
  ownerDetail: OwnerDetailRepository;
  profile: ProfileRepository;
  admin: AdminRepository;
}
