import { getSupabaseClient } from '../../lib/supabase/client';
import type {
  AssignStaffInput,
  AssignStaffResult,
  RevokeStaffResult,
  StaffMember,
} from './staffManagementTypes';

export async function listSchoolStaff(schoolId?: string | null): Promise<StaffMember[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_school_staff', {
    p_school_id: schoolId || null,
  });

  if (error) {
    // Fallback: query user_roles table directly
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id, assigned_at, roles(code, name), profiles(full_name, status)')
      .order('assigned_at', { ascending: false });

    if (roleError || !roleData) return [];

    return roleData.map((row: any) => ({
      userId: row.user_id,
      email: '',
      fullName: row.profiles?.full_name || 'Cán bộ trường',
      roleCode: row.roles?.code || 'teacher_moderator',
      roleName: row.roles?.name || 'Giáo viên kiểm duyệt',
      assignedAt: row.assigned_at,
      status: row.profiles?.status || 'active',
    }));
  }

  return (data || []).map((row: any) => ({
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    roleCode: row.role_code,
    roleName: row.role_name,
    assignedAt: row.assigned_at,
    status: row.status,
  }));
}

export async function assignSchoolStaff(input: AssignStaffInput): Promise<AssignStaffResult> {
  const supabase = getSupabaseClient();
  const cleanEmail = input.email.trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Vui lòng nhập địa chỉ email hợp lệ.');
  }

  const { data, error } = await supabase.rpc('assign_school_staff', {
    p_email: cleanEmail,
    p_role_code: input.roleCode,
    p_school_id: input.schoolId || null,
  });

  if (error) {
    throw new Error(`Không thể cấp quyền: ${error.message}`);
  }

  const res = data as any;
  return {
    success: true,
    isPreauthorized: res.is_preauthorized,
    userId: res.user_id,
    email: res.email,
    roleCode: res.role_code,
    roleName: res.role_name,
    message: res.message,
  };
}

export async function revokeSchoolStaff(
  userId: string,
  roleCode: string,
  schoolId?: string | null
): Promise<RevokeStaffResult> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('revoke_school_staff', {
    p_user_id: userId,
    p_role_code: roleCode,
    p_school_id: schoolId || null,
  });

  if (error) {
    throw new Error(`Không thể thu hồi quyền: ${error.message}`);
  }

  const res = data as any;
  return {
    success: true,
    userId: res.user_id,
    roleCode: res.role_code,
    message: res.message || 'Đã thu hồi quyền thành công.',
  };
}
