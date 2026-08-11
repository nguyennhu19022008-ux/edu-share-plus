import { LOCAL_UI_SAMPLE_POSTS } from '../marketplace/mockPosts';
import { getOwnerPosts } from '../my-posts/localOwnerStore';
import type { NotificationLocal, ProfileBundleLocal, ProfilePrivacy, ProfileReputation, SavedPostLocal, StudentProfileLocal } from './types';

/**
 * Phase 1 only: controlled in-memory profile data.
 * This is NOT a research dataset, NOT migrated user data and NOT real authentication data.
 * A full browser refresh resets these samples.
 */
const INITIAL_SAVED_POSTS: SavedPostLocal[] = [
  { id:'UI-014', title:'Cho mượn máy tính Casio fx-580VN X trong 1 tháng', tradeType:'Cho mượn', category:'Đồ điện tử nhỏ', savedAt:'10/08/2026 16:55' },
  { id:'UI-006', title:'Tặng bộ vở ô ly còn mới, chưa sử dụng', tradeType:'Cho tặng', category:'Vở', savedAt:'10/08/2026 15:18' },
  { id:'UI-010', title:'Sách bài tập Toán 12 còn khoảng 90% mới', tradeType:'Bán giá rẻ', category:'Sách tham khảo', savedAt:'09/08/2026 20:10' },
];

const initialSavedIds = new Set(INITIAL_SAVED_POSTS.map((item) => item.id));
let savedPosts: SavedPostLocal[] = INITIAL_SAVED_POSTS.map((item) => ({ ...item }));

let notifications: NotificationLocal[] = [
  { id:'N-001', title:'Bài đăng đã được duyệt', message:'Bài “Máy tính Casio fx-570VN Plus còn sử dụng tốt” đang hiển thị trên sàn.', date:'10/08/2026 16:05', read:false },
  { id:'N-002', title:'Có người xem thông tin liên hệ', message:'Một học sinh đã bấm Xem liên hệ ở bài đăng của bạn.', date:'10/08/2026 15:51', read:false },
  { id:'N-003', title:'Nhắc cập nhật bài đăng', message:'Bạn nên cập nhật hoặc thu hồi những bài không còn nhu cầu trao đổi.', date:'09/08/2026 18:20', read:true },
];

let profileBase: Omit<StudentProfileLocal, 'reputation' | 'activity'> = {
  email:'local-ui@edushare.test',
  name:'Học sinh',
  className:'12A1',
  phone:'09xx xxx 321',
  phoneMasked:'09•• ••• 321',
  avatarUrl:'',
  faceUrl:'',
  createdAt:'01/08/2026 08:00',
  lastLogin:'11/08/2026 09:30',
  updatedAt:'10/08/2026 18:10',
  passwordStatus:'Đã thiết lập',
  privacy:{ showName:true, showClass:true, showEmail:false, showPhone:false },
};

function reputationLabel(score:number):string {
  if (score >= 9) return 'Rất uy tín';
  if (score >= 7) return 'Uy tín tốt';
  if (score >= 5) return 'Bình thường';
  if (score >= 3) return 'Cần theo dõi';
  return 'Rủi ro';
}

function computeReputation():ProfileReputation {
  const posts = getOwnerPosts();
  const done = posts.filter((post) => post.status === 'Đã xong').length;
  const rejected = posts.filter((post) => post.status === 'Từ chối').length;
  const reports = posts.reduce((sum, post) => sum + Number(post.reportCount || 0), 0);
  const comments = posts.reduce((sum, post) => sum + Number(post.commentCount || 0), 0);
  const saves = posts.reduce((sum, post) => sum + Number(post.favoriteCount || 0), 0);
  let score = 5 + Math.min(done, 5) * 0.8 + Math.min(saves, 10) * 0.08 + Math.min(comments, 10) * 0.05 - Math.min(reports, 5) * 0.8 - Math.min(rejected, 5) * 0.4;
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  return { score, label:reputationLabel(score), detail:{ posts:posts.length, done, reports, rejected, comments, saves } };
}

function buildProfile():StudentProfileLocal {
  const posts = getOwnerPosts();
  return {
    ...profileBase,
    privacy:{ ...profileBase.privacy },
    reputation:computeReputation(),
    activity:{
      posts:posts.length,
      open:posts.filter((post) => post.status === 'Đang mở').length,
      pending:posts.filter((post) => post.status === 'Chờ duyệt').length,
      done:posts.filter((post) => post.status === 'Đã xong').length,
      withdrawn:posts.filter((post) => post.status === 'Đã thu hồi').length,
      savedPosts:savedPosts.length,
      comments:4,
      contactViews:3,
    },
  };
}

export function getProfileBundleLocal():ProfileBundleLocal {
  return {
    profile:buildProfile(),
    savedPosts:savedPosts.map((item) => ({ ...item })),
    notifications:notifications.map((item) => ({ ...item })),
  };
}

export function getSavedPostIdsLocal():Set<string> {
  return new Set(savedPosts.map((item) => item.id));
}

export function isPostSavedLocal(postId:string):boolean {
  return savedPosts.some((item) => item.id === postId);
}

export function wasPostInitiallySavedLocal(postId:string):boolean {
  return initialSavedIds.has(postId);
}

export function setPostSavedLocal(postId:string, saved:boolean):SavedPostLocal[] {
  const exists = savedPosts.some((item) => item.id === postId);
  if (saved && !exists) {
    const post = LOCAL_UI_SAMPLE_POSTS.find((item) => item.id === postId);
    if (post) {
      savedPosts = [{
        id:post.id,
        title:post.title,
        tradeType:post.tradeType,
        category:post.category,
        savedAt:'Vừa xong • phiên local',
      }, ...savedPosts];
    }
  } else if (!saved && exists) {
    savedPosts = savedPosts.filter((item) => item.id !== postId);
  }
  return savedPosts.map((item) => ({ ...item }));
}

export function togglePostSavedLocal(postId:string):boolean {
  const next = !isPostSavedLocal(postId);
  setPostSavedLocal(postId, next);
  return next;
}

export function updatePrivacyLocal(next:ProfilePrivacy):StudentProfileLocal {
  profileBase = { ...profileBase, privacy:{ ...next }, updatedAt:'Vừa cập nhật trong phiên local' };
  return buildProfile();
}

export function updateProfileImagesLocal(images:{ avatarUrl:string; faceUrl:string }):StudentProfileLocal {
  profileBase = {
    ...profileBase,
    avatarUrl:images.avatarUrl || profileBase.avatarUrl,
    faceUrl:images.faceUrl || profileBase.faceUrl,
    updatedAt:'Vừa cập nhật trong phiên local',
  };
  return buildProfile();
}

export function markAllNotificationsReadLocal():NotificationLocal[] {
  notifications = notifications.map((item) => ({ ...item, read:true }));
  return notifications.map((item) => ({ ...item }));
}

export function recordPasswordChangedLocal():StudentProfileLocal {
  profileBase = { ...profileBase, passwordStatus:'Đã thiết lập', updatedAt:'Vừa cập nhật trong phiên local' };
  notifications = [
    { id:`N-${Date.now()}`, title:'Mật khẩu đã được thay đổi', message:'Mật khẩu tài khoản Edu Share+ vừa được cập nhật trong mô phỏng local Phase 1.', date:'Vừa xong', read:false },
    ...notifications,
  ];
  return buildProfile();
}
