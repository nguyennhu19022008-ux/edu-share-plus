import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
} from 'react';
import type { LegacyPage } from '../legacyRouter';

export type LegacyRouteDefinition = {
  page: LegacyPage;
  title: string;
  bodyClass: string;
  component: LazyExoticComponent<ComponentType>;
};

export const ROUTE_REGISTRY: Record<LegacyPage, LegacyRouteDefinition> = {
  landing: {
    page: 'landing',
    title: 'Edu Share+ | Sàn trao đổi đồ dùng học tập',
    bodyClass: 'landing-body landing-v2-body ecommerce-body',
    component: lazy(() => import('../../pages/LandingPage')),
  },
  loginStudent: {
    page: 'loginStudent',
    title: 'Đăng nhập học sinh | Edu Share+',
    bodyClass: 'auth-ecommerce-body',
    component: lazy(() => import('../../pages/auth/StudentLoginPage')),
  },
  registerStudent: {
    page: 'registerStudent',
    title: 'Tạo tài khoản học sinh | Edu Share+',
    bodyClass: 'auth-ecommerce-body',
    component: lazy(() => import('../../pages/auth/StudentRegisterPage')),
  },
  loginGV: {
    page: 'loginGV',
    title: 'Đăng nhập giáo viên | Edu Share+',
    bodyClass: 'auth-ecommerce-body',
    component: lazy(() => import('../../pages/auth/TeacherLoginPage')),
  },
  forgotPassword: {
    page: 'forgotPassword',
    title: 'Khôi phục mật khẩu | Edu Share+',
    bodyClass: 'auth-ecommerce-body',
    component: lazy(() => import('../../pages/auth/ForgotPasswordPage')),
  },
  updatePassword: {
    page: 'updatePassword',
    title: 'Tạo mật khẩu mới | Edu Share+',
    bodyClass: 'auth-ecommerce-body',
    component: lazy(() => import('../../pages/auth/UpdatePasswordPage')),
  },
  index: {
    page: 'index',
    title: 'Chợ đồ dùng học tập | Edu Share+',
    bodyClass: 'ecommerce-body',
    component: lazy(() => import('../../pages/MarketplacePage')),
  },
  add: {
    page: 'add',
    title: 'Đăng bài mới | Edu Share+',
    bodyClass: 'ecommerce-body',
    component: lazy(() => import('../../pages/AddPostPage')),
  },
  editPost: {
    page: 'editPost',
    title: 'Chỉnh sửa bài đăng | Edu Share+',
    bodyClass: 'ecommerce-body',
    component: lazy(() => import('../../pages/EditPostPage')),
  },
  detail: {
    page: 'detail',
    title: 'Chi tiết bài đăng | Edu Share+',
    bodyClass: 'ecommerce-body',
    component: lazy(() => import('../../pages/DetailPage')),
  },
  myPosts: {
    page: 'myPosts',
    title: 'Bài đăng của tôi | Edu Share+',
    bodyClass: 'ecommerce-body',
    component: lazy(() => import('../../pages/MyPostsPage')),
  },
  myDetail: {
    page: 'myDetail',
    title: 'Chi tiết bài của tôi | Edu Share+',
    bodyClass: 'ecommerce-body',
    component: lazy(() => import('../../pages/MyDetailPage')),
  },
  profile: {
    page: 'profile',
    title: 'Hồ sơ cá nhân | Edu Share+',
    bodyClass: 'ecommerce-body',
    component: lazy(() => import('../../pages/ProfilePage')),
  },
  admin: {
    page: 'admin',
    title: 'Quản trị Edu Share+ | Giáo viên',
    bodyClass: 'ecommerce-body admin-redesign-body',
    component: lazy(() => import('../../pages/AdminPage')),
  },
};

export const ROUTE_BODY_CLASSES = [
  'landing-body',
  'landing-v2-body',
  'ecommerce-body',
  'auth-ecommerce-body',
  'admin-redesign-body',
  'checkpoint-stub-body',
] as const;

export function getRouteDefinition(page: LegacyPage): LegacyRouteDefinition {
  return ROUTE_REGISTRY[page];
}
