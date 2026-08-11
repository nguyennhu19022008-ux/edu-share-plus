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
