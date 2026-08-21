import { getSupabaseClient } from '../../lib/supabase/client';
import type { RosterCsvRow } from './rosterCsv';

export type RosterBatchStatus = 'previewed' | 'active' | 'archived' | 'failed';

export type RosterImportBatch = {
  id: string;
  schoolId: string;
  academicYear: string;
  sourceFilename: string;
  status: RosterBatchStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedBy: string;
  createdAt: string;
  activatedAt: string | null;
  archivedAt: string | null;
};

export type ActiveRosterRow = {
  id: string;
  batchId: string;
  schoolId: string;
  classId: string;
  academicYear: string;
  fullName: string;
  className: string;
  phoneNormalized: string;
  claimStatus: 'claimed' | 'unclaimed';
  claimedUserId: string | null;
  claimedAt: string | null;
};

export type RosterImportResult = {
  batchId: string;
  schoolId: string;
  academicYear: string;
  sourceFilename: string;
  status: RosterBatchStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
};

type BatchRpcRow = {
  id: string;
  school_id: string;
  academic_year: string;
  source_filename: string;
  status: RosterBatchStatus;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  imported_by: string;
  created_at: string;
  activated_at: string | null;
  archived_at: string | null;
};

type ActiveRosterRpcRow = {
  id: string;
  batch_id: string;
  school_id: string;
  class_id: string;
  academic_year: string;
  full_name: string;
  class_name: string;
  phone_normalized: string;
  claim_status: 'claimed' | 'unclaimed';
  claimed_user_id: string | null;
  claimed_at: string | null;
};

function normalizeRosterError(message: string, details?: string | null): string {
  if (message.includes('EDU_SHARE_AUTH_REQUIRED')) {
    return 'Phiên giáo viên không hợp lệ hoặc đã hết hạn.';
  }
  if (message.includes('EDU_SHARE_ROSTER_MANAGEMENT_FORBIDDEN')) {
    return 'Bạn không có quyền quản lý danh sách học sinh của trường này.';
  }
  if (message.includes('EDU_SHARE_ROSTER_IMPORT_TOO_LARGE')) {
    return 'Mỗi lần nhập tối đa 5.000 học sinh.';
  }
  if (message.includes('EDU_SHARE_ROSTER_IMPORT_INVALID')) {
    return `Danh sách CSV chưa hợp lệ.${details ? ` Chi tiết: ${details}` : ''}`;
  }
  if (message.includes('EDU_SHARE_ROSTER_BATCH_NOT_FOUND')) {
    return 'Không tìm thấy phiên nhập danh sách học sinh.';
  }
  if (message.includes('EDU_SHARE_ROSTER_BATCH_NOT_ACTIVATABLE')) {
    return 'Phiên nhập này không thể được kích hoạt.';
  }
  if (message.includes('EDU_SHARE_ACADEMIC_YEAR_INVALID')) {
    return 'Năm học không hợp lệ.';
  }
  return message || 'Không thể xử lý danh sách học sinh lúc này.';
}

function mapBatch(row: BatchRpcRow): RosterImportBatch {
  return {
    id: String(row.id),
    schoolId: String(row.school_id),
    academicYear: String(row.academic_year),
    sourceFilename: String(row.source_filename),
    status: row.status,
    totalRows: Number(row.total_rows || 0),
    validRows: Number(row.valid_rows || 0),
    invalidRows: Number(row.invalid_rows || 0),
    importedBy: String(row.imported_by),
    createdAt: String(row.created_at),
    activatedAt: row.activated_at ? String(row.activated_at) : null,
    archivedAt: row.archived_at ? String(row.archived_at) : null,
  };
}

export async function importStudentRoster(input: {
  schoolId: string;
  academicYear: string;
  sourceFilename: string;
  rows: RosterCsvRow[];
}): Promise<RosterImportResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('import_student_roster', {
    p_school_id: input.schoolId,
    p_academic_year: input.academicYear,
    p_source_filename: input.sourceFilename,
    p_rows: input.rows,
  });

  if (error) throw new Error(normalizeRosterError(error.message, error.details));
  if (!data || typeof data !== 'object') {
    throw new Error('Không nhận được kết quả nhập danh sách học sinh hợp lệ.');
  }

  const result = data as Record<string, unknown>;
  return {
    batchId: String(result.batch_id ?? ''),
    schoolId: String(result.school_id ?? input.schoolId),
    academicYear: String(result.academic_year ?? input.academicYear),
    sourceFilename: String(result.source_filename ?? input.sourceFilename),
    status: String(result.status ?? 'previewed') as RosterBatchStatus,
    totalRows: Number(result.total_rows ?? input.rows.length),
    validRows: Number(result.valid_rows ?? input.rows.length),
    invalidRows: Number(result.invalid_rows ?? 0),
  };
}

export async function activateStudentRosterBatch(batchId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('activate_student_roster_batch', {
    p_batch_id: batchId,
  });

  if (error) throw new Error(normalizeRosterError(error.message, error.details));
}

export async function listStudentRosterBatches(schoolId: string): Promise<RosterImportBatch[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_student_roster_batches', {
    p_school_id: schoolId,
  });

  if (error) throw new Error(normalizeRosterError(error.message, error.details));
  return ((data ?? []) as BatchRpcRow[]).map(mapBatch);
}

export async function listActiveStudentRoster(schoolId: string): Promise<ActiveRosterRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_active_student_roster', {
    p_school_id: schoolId,
  });

  if (error) throw new Error(normalizeRosterError(error.message, error.details));

  return ((data ?? []) as ActiveRosterRpcRow[]).map((row) => ({
    id: String(row.id),
    batchId: String(row.batch_id),
    schoolId: String(row.school_id),
    classId: String(row.class_id),
    academicYear: String(row.academic_year),
    fullName: String(row.full_name ?? ''),
    className: String(row.class_name ?? ''),
    phoneNormalized: String(row.phone_normalized ?? ''),
    claimStatus: row.claim_status,
    claimedUserId: row.claimed_user_id ? String(row.claimed_user_id) : null,
    claimedAt: row.claimed_at ? String(row.claimed_at) : null,
  }));
}
