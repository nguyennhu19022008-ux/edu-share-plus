import type { MyPost } from './types';

/**
 * Dữ liệu mẫu chỉ dùng để kiểm tra UI/UX của trang "Bài đăng của tôi" ở Phase 1.
 * Không phải dữ liệu nghiên cứu, không phải dữ liệu người dùng thật và không được migrate.
 */
export const LOCAL_UI_MY_POSTS: MyPost[] = [
  {
    id:'OWN-001',
    title:'Máy tính Casio fx-570VN Plus còn sử dụng tốt',
    description:'Máy hoạt động bình thường, phím rõ và có nắp.',
    tradeType:'Bán giá rẻ', category:'Đồ điện tử nhỏ', className:'12A1', price:220000,
    status:'Đang mở', source:'Posts', hidden:false,
    date:'10/08/2026 15:42', dateTs:1786351320000,
    favoriteCount:18, contactViewCount:7, contactedCount:4, commentCount:5, reportCount:0,
    contactInfo:'Zalo 09xx xxx 321 (mẫu UI local)',
  },
  {
    id:'OWN-002',
    title:'Sách giáo khoa Vật lí 12 - bộ Kết nối tri thức',
    description:'Sách còn sạch, đủ trang, phù hợp học sinh lớp 12.',
    tradeType:'Cho tặng', category:'Sách giáo khoa', className:'12A1', price:0,
    status:'Chờ duyệt', source:'Posts', hidden:false,
    date:'10/08/2026 14:18', dateTs:1786346280000,
    favoriteCount:0, contactViewCount:0, contactedCount:0, commentCount:0, reportCount:0,
    contactInfo:'Liên hệ tại lớp 12A1 (mẫu UI local)', imageUrl:'/assets/local-ui-books.jpg',
  },
  {
    id:'OWN-003',
    title:'Bộ compa, thước và ê-ke dùng cho môn Toán',
    description:'Bộ dụng cụ còn đủ chi tiết, phù hợp học sinh THPT.',
    tradeType:'Trao đổi', category:'Dụng cụ học tập', className:'12A1', price:0,
    status:'Từ chối', source:'Posts', hidden:false,
    date:'09/08/2026 20:05', dateTs:1786280700000,
    rejectionReason:'Ảnh minh họa chưa đủ rõ. Vui lòng chụp lại sản phẩm thật và bổ sung tình trạng sử dụng.',
    contactInfo:'Zalo 09xx xxx 456 (mẫu UI local)',
    favoriteCount:0, contactViewCount:0, contactedCount:0, commentCount:0, reportCount:0,
  },
  {
    id:'OWN-004',
    title:'Cho mượn sách tham khảo Hóa học 11 trong học kỳ I',
    description:'Sách đã được cho mượn và bài đã hoàn tất.',
    tradeType:'Cho mượn', category:'Sách tham khảo', className:'12A1', price:0,
    status:'Đã xong', source:'Archive', hidden:false,
    date:'02/08/2026 09:20', dateTs:1785637200000, doneTs:1786171200000,
    favoriteCount:9, contactViewCount:6, contactedCount:6, commentCount:4, reportCount:0,
  },
  {
    id:'OWN-005',
    title:'Đồng phục thể dục nam size L còn mới',
    description:'Bài đã được chủ bài thu hồi khỏi sàn.',
    tradeType:'Bán giá rẻ', category:'Đồng phục', className:'12A1', price:65000,
    status:'Đã thu hồi', source:'Archive', hidden:false,
    date:'01/08/2026 16:35', dateTs:1785576900000, doneTs:1786086000000,
    favoriteCount:4, contactViewCount:2, contactedCount:2, commentCount:1, reportCount:0,
  },
  {
    id:'OWN-006',
    title:'Tặng bộ vở ô ly còn mới, chưa sử dụng',
    description:'Gồm 5 quyển vở mới, ưu tiên học sinh thực sự cần.',
    tradeType:'Cho tặng', category:'Vở', className:'12A1', price:0,
    status:'Đang mở', source:'Posts', hidden:true,
    date:'08/08/2026 18:05', dateTs:1786183500000,
    favoriteCount:3, contactViewCount:1, contactedCount:1, commentCount:0, reportCount:0,
  },
  {
    id:'OWN-007',
    title:'Bút highlight 6 màu - đổi lấy giấy note',
    description:'Bút đã dùng ít, màu còn rõ, muốn đổi lấy giấy note.',
    tradeType:'Trao đổi', category:'Bút', className:'12A1', price:0,
    status:'Đang mở', source:'Posts', hidden:false,
    date:'08/08/2026 11:30', dateTs:1786159800000,
    favoriteCount:6, contactViewCount:5, contactedCount:5, commentCount:3, reportCount:0,
  },
  {
    id:'OWN-008',
    title:'Bán giá rẻ balo học sinh màu đen',
    description:'Balo còn chắc chắn, khóa kéo hoạt động bình thường.',
    tradeType:'Bán giá rẻ', category:'Khác', className:'12A1', price:95000,
    status:'Chờ duyệt', source:'Posts', hidden:false,
    date:'07/08/2026 17:10', dateTs:1786097400000,
    favoriteCount:0, contactViewCount:0, contactedCount:0, commentCount:0, reportCount:0,
  },
];
