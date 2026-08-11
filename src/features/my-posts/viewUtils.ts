import type { MyPost, MyPostStatus, PostEffectiveness } from './types';

export const MY_POST_STATUS_TABS: Array<{ value:'' | MyPostStatus; label:string }> = [
  { value:'', label:'Tất cả' },
  { value:'Đang mở', label:'Đang giao dịch' },
  { value:'Chờ duyệt', label:'Chờ duyệt' },
  { value:'Từ chối', label:'Từ chối' },
  { value:'Đã xong', label:'Hoàn tất' },
  { value:'Đã thu hồi', label:'Thu hồi' },
];

export function normalizeMyPostText(value:string):string {
  return value.trim().toLocaleLowerCase('vi');
}

export function formatMyPostMoney(value:number):string {
  return value > 0 ? `${value.toLocaleString('vi-VN')} đ` : 'Miễn phí / Cho tặng';
}

export function myPostStatusLabel(status:MyPostStatus):string {
  const labels:Record<MyPostStatus,string> = {
    'Đang mở':'Đang giao dịch',
    'Chờ duyệt':'Chờ giáo viên duyệt',
    'Từ chối':'Từ chối',
    'Đã xong':'Đã hoàn tất',
    'Đã thu hồi':'Đã thu hồi',
  };
  return labels[status];
}

export function myPostStatusBadgeClass(status:MyPostStatus):string {
  if (status === 'Đang mở') return 'badge open';
  if (status === 'Chờ duyệt') return 'badge pending';
  if (status === 'Đã xong') return 'badge done';
  return 'badge reject';
}

export function myPostStatusCardClass(status:MyPostStatus):string {
  const map:Record<MyPostStatus,string> = {
    'Đang mở':'open',
    'Chờ duyệt':'pending',
    'Từ chối':'rejected',
    'Đã xong':'done',
    'Đã thu hồi':'withdrawn',
  };
  return map[status];
}

export function doneButtonText(type:MyPost['tradeType']):string {
  const map:Record<MyPost['tradeType'],string> = {
    'Cho mượn':'Đã cho mượn',
    'Cho tặng':'Đã tặng',
    'Trao đổi':'Đã trao đổi',
    'Bán giá rẻ':'Đã bán',
  };
  return map[type];
}

export function getPostEffectiveness(post:MyPost):PostEffectiveness {
  const saves = Number(post.favoriteCount || 0);
  const contacts = Number(post.contactViewCount || 0);
  const comments = Number(post.commentCount || 0);

  if (post.status === 'Chờ duyệt') return { level:'pending', label:'Đang chờ duyệt', message:'Bài chưa công khai nên chưa có dữ liệu tương tác.' };
  if (post.status === 'Từ chối') return { level:'warning', label:'Cần chỉnh sửa', message:'Bài cần được sửa theo góp ý của giáo viên rồi gửi duyệt lại.' };
  if (post.status === 'Đã xong') return { level:'done', label:'Đã hoàn tất', message:'Bài đã hoàn tất giao dịch và được lưu trong lịch sử.' };
  if (post.status === 'Đã thu hồi') return { level:'muted', label:'Đã thu hồi', message:'Bài đã được chủ bài thu hồi và không còn hiển thị công khai.' };
  if (post.hidden) return { level:'muted', label:'Đang tạm ẩn', message:'Bài đang tạm ẩn nên người khác không thể xem trên trang chủ.' };
  if (saves >= 5 || contacts >= 5 || comments >= 3) return { level:'good', label:'Tương tác tốt', message:'Bài có nhiều lượt lưu/xem liên hệ/bình luận.' };
  if (saves > 0 || contacts > 0 || comments > 0) return { level:'normal', label:'Có tương tác', message:'Bài đã bắt đầu có người quan tâm.' };
  return { level:'low', label:'Chưa có tương tác', message:'Bài chưa có lượt lưu, xem liên hệ hoặc bình luận.' };
}
