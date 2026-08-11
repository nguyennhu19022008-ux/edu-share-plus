import type { MyPost } from './types';
import type { OwnerDetailBundle } from './detailTypes';
export type { OwnerContactLog, OwnerDetailBundle, OwnerTimelineItem } from './detailTypes';

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
