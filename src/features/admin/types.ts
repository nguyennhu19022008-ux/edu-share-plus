export type AdminPostStatus = 'Chờ duyệt' | 'Đang mở' | 'Từ chối' | 'Đã xong' | 'Đã thu hồi';
export type AdminPostSource = 'Posts' | 'Archive';
export type CommentStatus = 'Mở' | 'Tắt';

export type AdminPost = {
  id:string;
  title:string;
  description:string;
  tradeType:'Cho mượn' | 'Cho tặng' | 'Trao đổi' | 'Bán giá rẻ';
  category:string;
  className:string;
  name:string;
  email:string;
  emailMasked:string;
  contactInfo:string;
  price:number;
  date:string;
  dateTs:number;
  doneAt?:string;
  status:AdminPostStatus;
  source:AdminPostSource;
  hidden:boolean;
  commentStatus:CommentStatus;
  commentCount:number;
  reportCount:number;
  rejectionReason?:string;
  imageUrl?:string;
  favoriteCount:number;
  contactCount:number;
  viewCount:number;
};

export type AdminPostPatch = Partial<Pick<AdminPost,
  'status' | 'hidden' | 'commentStatus' | 'rejectionReason'
>>;

export type AdminDashboardSummary = {
  totalPosts:number;
  done:number;
  pending:number;
  reports:number;
  approvalRate:number;
  completionRate:number;
  reportRate:number;
  topCategories:Array<{name:string;count:number}>;
  topClasses:Array<{name:string;count:number}>;
  financialSaved:number;
  wasteReducedKg:number;
  updatedAt:string;
};
