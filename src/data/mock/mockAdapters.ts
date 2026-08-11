import type { DataAccessRepositories } from '../contracts/repositories';
import { getAdminDashboardSummaryLocal, getAdminPostLocal, getAdminPostsLocal, resetAdminPostsLocal, updateAdminPostLocal, approveAllPendingLocal } from '../../features/admin/localAdminStore';
import { LOCAL_UI_SAMPLE_POSTS } from '../../features/marketplace/mockPosts';
import { getOwnerDetailLocal, prependOwnerTimelineLocal, updateOwnerDetailLocal } from '../../features/my-posts/localOwnerDetailStore';
import { duplicateOwnerPost, getOwnerPost, getOwnerPosts, insertOwnerPost, replaceOwnerPost, updateOwnerPost } from '../../features/my-posts/localOwnerStore';
import { getProfileBundleLocal, getSavedPostIdsLocal, isPostSavedLocal, markAllNotificationsReadLocal, recordPasswordChangedLocal, setPostSavedLocal, togglePostSavedLocal, updatePrivacyLocal, updateProfileImagesLocal, wasPostInitiallySavedLocal } from '../../features/profile/localProfileStore';

/**
 * Composition of the existing controlled Phase-1 in-memory data into the new
 * provider-neutral repository contracts. No research data or backend calls are
 * introduced here.
 */
export function createMockRepositories():DataAccessRepositories {
  return {
    marketplace:{
      listPosts:() => LOCAL_UI_SAMPLE_POSTS.map((post)=>({ ...post })),
    },
    ownerPosts:{
      list:getOwnerPosts,
      getById:getOwnerPost,
      replace:replaceOwnerPost,
      update:updateOwnerPost,
      insert:insertOwnerPost,
      duplicate:duplicateOwnerPost,
    },
    ownerDetail:{
      get:getOwnerDetailLocal,
      update:updateOwnerDetailLocal,
      prependTimeline:prependOwnerTimelineLocal,
    },
    profile:{
      getBundle:getProfileBundleLocal,
      getSavedPostIds:getSavedPostIdsLocal,
      isPostSaved:isPostSavedLocal,
      wasPostInitiallySaved:wasPostInitiallySavedLocal,
      setPostSaved:setPostSavedLocal,
      togglePostSaved:togglePostSavedLocal,
      updatePrivacy:updatePrivacyLocal,
      updateImages:updateProfileImagesLocal,
      markAllNotificationsRead:markAllNotificationsReadLocal,
      recordPasswordChanged:recordPasswordChangedLocal,
    },
    admin:{
      listPosts:getAdminPostsLocal,
      resetPosts:resetAdminPostsLocal,
      updatePost:updateAdminPostLocal,
      approveAllPending:approveAllPendingLocal,
      getPostById:getAdminPostLocal,
      getDashboardSummary:getAdminDashboardSummaryLocal,
    },
  };
}
