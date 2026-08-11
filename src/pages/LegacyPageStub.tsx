import { navigateLegacy, type LegacyPage } from '../app/legacyRouter';

const LABELS: Record<Exclude<LegacyPage, 'landing' | 'loginStudent' | 'registerStudent' | 'loginGV'>, string> = {
  index: 'Chợ đồ dùng học tập',
  add: 'Đăng bài mới',
  editPost: 'Chỉnh sửa bài đăng',
  detail: 'Chi tiết bài đăng',
  myPosts: 'Bài đăng của tôi',
  myDetail: 'Chi tiết bài đăng của tôi',
  profile: 'Hồ sơ cá nhân',
  admin: 'Quản trị Edu Share+',
};

type StubPage = keyof typeof LABELS;

export default function LegacyPageStub({ page }: { page: LegacyPage }) {
  const safePage = page as StubPage;
  return (
    <main className="checkpoint-stub">
      <div className="checkpoint-stub-brand">Edu Share<span>+</span></div>
      <h1>{LABELS[safePage] ?? 'Edu Share+'}</h1>
      <p>Route này đã được bảo toàn trong shell local và sẽ được port nguyên giao diện/logic ở checkpoint tiếp theo của Phase 1.</p>
      <button className="btn primary" type="button" onClick={() => navigateLegacy('landing')}>Về Landing</button>
    </main>
  );
}
