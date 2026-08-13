import type { Session } from '@supabase/supabase-js';

export type StudentAccountStatus = 'pending_review' | 'approved' | 'rejected' | 'suspended';

export type StudentSessionProfile = {
  userId: string;
  fullName: string;
  accountStatus: StudentAccountStatus;
  schoolId: string;
  classId: string | null;
};

export type StudentAuthSnapshot = {
  session: Session | null;
  profile: StudentSessionProfile | null;
  authReady: boolean;
  profileLoading: boolean;
  profileError: string;
};
