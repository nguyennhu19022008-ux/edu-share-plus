export type ReportTargetType = 'post' | 'comment' | 'user';

export type ReportReasonCode =
  | 'inappropriate_content'
  | 'scam'
  | 'offensive'
  | 'spam'
  | 'wrong_information'
  | 'other';

export interface ReportReasonOption {
  value: ReportReasonCode;
  label: string;
}

export interface SubmitReportPayload {
  targetType: ReportTargetType;
  targetId: string;
  reasonCode: string;
  description?: string;
}

export interface SubmitReportResult {
  id: string;
  targetType: string;
  targetId: string;
  status: string;
  createdAt: string;
}
