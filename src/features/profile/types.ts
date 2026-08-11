export interface ProfilePrivacy {
  showName: boolean;
  showClass: boolean;
  showEmail: boolean;
  showPhone: boolean;
}

export interface ReputationDetail {
  posts: number;
  done: number;
  reports: number;
  rejected: number;
  comments: number;
  saves: number;
}

export interface ProfileReputation {
  score: number;
  label: string;
  detail: ReputationDetail;
}

export interface ProfileActivity {
  posts: number;
  open: number;
  pending: number;
  done: number;
  withdrawn: number;
  savedPosts: number;
  comments: number;
  contactViews: number;
}

export interface StudentProfileLocal {
  email: string;
  name: string;
  className: string;
  phone: string;
  phoneMasked: string;
  avatarUrl: string;
  faceUrl: string;
  createdAt: string;
  lastLogin: string;
  updatedAt: string;
  passwordStatus: string;
  privacy: ProfilePrivacy;
  reputation: ProfileReputation;
  activity: ProfileActivity;
}

export interface SavedPostLocal {
  id: string;
  title: string;
  tradeType: string;
  category: string;
  savedAt: string;
}

export interface NotificationLocal {
  id: string;
  title: string;
  message: string;
  date: string;
  read: boolean;
}

export interface ProfileBundleLocal {
  profile: StudentProfileLocal;
  savedPosts: SavedPostLocal[];
  notifications: NotificationLocal[];
}
