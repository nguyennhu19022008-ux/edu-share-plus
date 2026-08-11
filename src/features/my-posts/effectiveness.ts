import type { MyPost, PostEffectiveness } from './types';

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
