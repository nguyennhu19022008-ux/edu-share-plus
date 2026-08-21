import type { Session } from '@supabase/supabase-js';

export type StudentAccountStatus = 'pending_review' | 'approved' | 'rejected' | 'suspended';
export type StudentMembershipStatus = 'verified' | 'needs_revalidation' | 'revoked';
export type StudentMembershipVerificationMethod =
  | 'school_roster_match'
  | 'teacher_manual_review';

export type StudentSessionProfile = {
  userId: string;
  fullName: string;
  accountStatus: StudentAccountStatus;
  schoolId: string;
  classId: string | null;
  schoolMembershipStatus: StudentMembershipStatus;
  membershipVerificationMethod: StudentMembershipVerificationMethod;
  membershipVerifiedAt: string;
};

export type StudentAuthSnapshot = {
  session: Session | null;
  profile: StudentSessionProfile | null;
  authReady: boolean;
  profileLoading: boolean;
  profileError: string;
};
