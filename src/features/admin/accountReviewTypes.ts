export type AccountReviewDecision = 'approved' | 'rejected' | 'needs_information';

export type AccountReviewQueueItem = {
  reviewId: string;
  userId: string;
  fullName: string;
  contactEmail: string | null;
  phone: string | null;
  studentReferenceCode: string | null;
  schoolId: string;
  schoolName: string;
  classNameClaim: string | null;
  reviewStatus: 'pending' | 'needs_information';
  submittedAt: string;
  currentReason: string | null;
  rosterMatchReason: string | null;
  submissionSnapshot: Record<string, unknown>;
};
