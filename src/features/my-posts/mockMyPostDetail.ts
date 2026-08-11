import type { MyPost, PostEffectiveness } from './types';

export interface OwnerFavoriteLog {
  id: string;
  name: string;
  className: string;
  emailMasked: string;
  date: string;
}

export interface OwnerContactLog {
  id: string;
  requesterName: string;
  requesterClass: string;
  requesterEmailMasked: string;
  date: string;
  contacted: boolean;
  contactedAt?: string;
  note?: string;
}

export interface OwnerCommentLog {
  id: string;
  name: string;
  className: string;
  emailMasked: string;
  date: string;
  content: string;
}

export interface OwnerTimelineItem {
  id: string;
  type: 'post' | 'contact' | 'comment' | 'report' | 'handled';
  title: string;
  description: string;
  date: string;
}

export interface OwnerDetailBundle {
  favorites: OwnerFavoriteLog[];
  contacts: OwnerContactLog[];
  comments: OwnerCommentLog[];
  timeline: OwnerTimelineItem[];
}

/**
 * Controlled UI-only interaction samples for Phase 1.
 * These records are synthetic and are never presented as research evidence.
 */
const DETAIL_SAMPLES: Record<string, OwnerDetailBundle> = {
  'OWN-001': {
    favorites: [
      { id:'F-1', name:'Nguyễn Minh Anh', className:'11A2', emailMasked:'m***@student.test', date:'10/08/2026 17:05' },
      { id:'F-2', name:'Trần Gia Huy', className:'12A3', emailMasked:'g***@student.test', date:'10/08/2026 16:48' },
      { id:'F-3', name:'Lê Hoàng Nam', className:'10A1', emailMasked:'h***@student.test', date:'10/08/2026 16:20' },
    ],
    contacts: [
      { id:'C-1', requesterName:'Nguyễn Minh Anh', requesterClass:'11A2', requesterEmailMasked:'m***@student.test', date:'10/08/2026 17:08', contacted:true, contactedAt:'10/08/2026 17:20', note:'Đã nhắn lại qua Zalo' },
      { id:'C-2', requesterName:'Trần Gia Huy', requesterClass:'12A3', requesterEmailMasked:'g***@student.test', date:'10/08/2026 16:52', contacted:false },
      { id:'C-3', requesterName:'Phạm Thu Hà', requesterClass:'11A4', requesterEmailMasked:'t***@student.test', date:'10/08/2026 16:10', contacted:false },
    ],
    comments: [
      { id:'CM-1', name:'Nguyễn Minh Anh', className:'11A2', emailMasked:'m***@student.test', date:'10/08/2026 17:06', content:'Máy còn nắp và phím bấm có bị liệt không ạ?' },
      { id:'CM-2', name:'Trần Gia Huy', className:'12A3', emailMasked:'g***@student.test', date:'10/08/2026 16:50', content:'Bạn có thể giao ở trường vào giờ ra chơi không?' },
    ],
    timeline: [
      { id:'T-1', type:'post', title:'Bài được duyệt', description:'Bài chuyển sang trạng thái đang giao dịch.', date:'10/08/2026 15:55' },
      { id:'T-2', type:'comment', title:'Có bình luận mới', description:'Một học sinh hỏi thêm về tình trạng sản phẩm.', date:'10/08/2026 16:50' },
      { id:'T-3', type:'contact', title:'Có lượt xem liên hệ', description:'Một học sinh đã mở thông tin liên hệ của bài.', date:'10/08/2026 16:52' },
      { id:'T-4', type:'handled', title:'Đã phản hồi người quan tâm', description:'Chủ bài đánh dấu đã liên hệ lại.', date:'10/08/2026 17:20' },
    ],
  },
  'OWN-003': {
    favorites: [], contacts: [], comments: [],
    timeline: [
      { id:'T-31', type:'post', title:'Bài được gửi duyệt', description:'Bài ở trạng thái chờ giáo viên kiểm tra.', date:'09/08/2026 20:05' },
      { id:'T-32', type:'report', title:'Giáo viên yêu cầu chỉnh sửa', description:'Ảnh minh họa chưa đủ rõ và cần bổ sung tình trạng sử dụng.', date:'09/08/2026 20:25' },
    ],
  },
};

export function getOwnerDetailSample(post: MyPost): OwnerDetailBundle {
  const found = DETAIL_SAMPLES[post.id];
  if (found) {
    return {
      favorites: found.favorites.map((item) => ({ ...item })),
      contacts: found.contacts.map((item) => ({ ...item })),
      comments: found.comments.map((item) => ({ ...item })),
      timeline: found.timeline.map((item) => ({ ...item })),
    };
  }
  return {
    favorites: [],
    contacts: [],
    comments: [],
    timeline: [
      { id:`T-${post.id}`, type:'post', title:'Bài được tạo', description:`Bài hiện ở trạng thái ${post.status}.`, date:post.date },
    ],
  };
}

export function buildOwnerEffectiveness(post: MyPost): PostEffectiveness & { tips?: string[] } {
  if (post.status === 'Chờ duyệt') return { level:'pending', label:'Đang chờ duyệt', message:'Bài chưa công khai nên chưa có dữ liệu tương tác.', tips:['Kiểm tra lại mô tả và ảnh trước khi giáo viên duyệt.'] };
  if (post.status === 'Từ chối') return { level:'warning', label:'Cần chỉnh sửa', message:'Bài cần được sửa theo góp ý của giáo viên rồi gửi duyệt lại.', tips:['Đọc kỹ lý do từ chối.', 'Cập nhật ảnh/mô tả đúng với sản phẩm thực tế.'] };
  if (post.status === 'Đã xong') return { level:'done', label:'Đã hoàn tất', message:'Bài đã hoàn tất và được lưu trong lịch sử.' };
  if (post.status === 'Đã thu hồi') return { level:'muted', label:'Đã thu hồi', message:'Bài không còn hiển thị công khai.' };
  if (post.hidden) return { level:'muted', label:'Đang tạm ẩn', message:'Bài đang tạm ẩn nên người khác không thể xem trên trang chủ.' };
  if (post.favoriteCount >= 5 || post.contactViewCount >= 5 || post.commentCount >= 3) return { level:'good', label:'Tương tác tốt', message:'Bài có nhiều lượt lưu, xem liên hệ hoặc bình luận.', tips:['Phản hồi người quan tâm sớm để tăng khả năng trao đổi thành công.'] };
  if (post.favoriteCount > 0 || post.contactViewCount > 0 || post.commentCount > 0) return { level:'normal', label:'Có tương tác', message:'Bài đã bắt đầu có người quan tâm.' };
  return { level:'low', label:'Chưa có tương tác', message:'Bài chưa có lượt lưu, xem liên hệ hoặc bình luận.', tips:['Bổ sung mô tả rõ ràng và ảnh thật nếu cần.'] };
}
