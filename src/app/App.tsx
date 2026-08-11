import { useEffect, useState } from 'react';
import { getCurrentPage, type LegacyPage } from './legacyRouter';
import LandingPage from '../pages/LandingPage';
import StudentLoginPage from '../pages/auth/StudentLoginPage';
import StudentRegisterPage from '../pages/auth/StudentRegisterPage';
import TeacherLoginPage from '../pages/auth/TeacherLoginPage';
import LegacyPageStub from '../pages/LegacyPageStub';
import MarketplacePage from '../pages/MarketplacePage';
import DetailPage from '../pages/DetailPage';
import AddPostPage from '../pages/AddPostPage';
import MyPostsPage from '../pages/MyPostsPage';
import MyDetailPage from '../pages/MyDetailPage';
import EditPostPage from '../pages/EditPostPage';
import ProfilePage from '../pages/ProfilePage';
import AdminPage from '../pages/AdminPage';

const TITLES: Record<LegacyPage, string> = {
  landing: 'Edu Share+ | Sàn trao đổi đồ dùng học tập',
  loginStudent: 'Đăng nhập học sinh | Edu Share+',
  registerStudent: 'Tạo tài khoản học sinh | Edu Share+',
  loginGV: 'Đăng nhập giáo viên | Edu Share+',
  index: 'Chợ đồ dùng học tập | Edu Share+',
  add: 'Đăng bài mới | Edu Share+',
  editPost: 'Chỉnh sửa bài đăng | Edu Share+',
  detail: 'Chi tiết bài đăng | Edu Share+',
  myPosts: 'Bài đăng của tôi | Edu Share+',
  myDetail: 'Chi tiết bài của tôi | Edu Share+',
  profile: 'Hồ sơ cá nhân | Edu Share+',
  admin: 'Quản trị Edu Share+ | Giáo viên',
};

type LegacyRouteState = {
  page: LegacyPage;
  routeKey: string;
};

function getRouteState(): LegacyRouteState {
  return {
    page: getCurrentPage(),
    // Bao gồm query string để các route cùng page nhưng khác id được render lại.
    // Ví dụ: ?page=detail&id=UI-001 -> ?page=detail&id=UI-002.
    routeKey: `${window.location.pathname}${window.location.search}`,
  };
}

export default function App() {
  const [route, setRoute] = useState<LegacyRouteState>(() => getRouteState());

  useEffect(() => {
    const sync = () => setRoute(getRouteState());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  useEffect(() => {
    document.title = TITLES[route.page];
  }, [route.page]);

  switch (route.page) {
    case 'landing': return <LandingPage key={route.routeKey} />;
    case 'loginStudent': return <StudentLoginPage key={route.routeKey} />;
    case 'registerStudent': return <StudentRegisterPage key={route.routeKey} />;
    case 'loginGV': return <TeacherLoginPage key={route.routeKey} />;
    case 'index': return <MarketplacePage key={route.routeKey} />;
    case 'detail': return <DetailPage key={route.routeKey} />;
    case 'add': return <AddPostPage key={route.routeKey} />;
    case 'myPosts': return <MyPostsPage key={route.routeKey} />;
    case 'myDetail': return <MyDetailPage key={route.routeKey} />;
    case 'editPost': return <EditPostPage key={route.routeKey} />;
    case 'profile': return <ProfilePage key={route.routeKey} />;
    case 'admin': return <AdminPage key={route.routeKey} />;
    default: return <LegacyPageStub key={route.routeKey} page={route.page} />;
  }
}
