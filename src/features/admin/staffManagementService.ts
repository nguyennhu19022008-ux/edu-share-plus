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

  if (!error && data && data.length > 0) {
    return data.map((row: any) => ({
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      roleCode: row.role_code,
      roleName: row.role_name,
      assignedAt: row.assigned_at,
      status: row.status,
    }));
  }

  // Fallback: query user_roles table and pre-authorized roster entries
  const { data: roleData } = await supabase
    .from('user_roles')
    .select('user_id, assigned_at, roles(code, name), profiles(full_name, status)')
    .order('assigned_at', { ascending: false });

  const { data: rosterData } = await supabase
    .from('roster_entries')
    .select('id, full_name, normalized_email, created_at, status')
    .eq('grade_level', 'staff')
    .order('created_at', { ascending: false });

  const list: StaffMember[] = [];

  if (roleData) {
    for (const row of roleData) {
      list.push({
        userId: row.user_id,
        email: '',
        fullName: (row.profiles as any)?.full_name || 'Cán bộ trường',
        roleCode: (row.roles as any)?.code || 'teacher_moderator',
        roleName: (row.roles as any)?.name || 'Giáo viên kiểm duyệt',
        assignedAt: row.assigned_at,
        status: (row.profiles as any)?.status || 'active',
      });
    }
  }

  if (rosterData) {
    for (const r of rosterData) {
      list.push({
        userId: 'pre-' + r.id,
        email: r.normalized_email || '',
        fullName: r.full_name || 'Giáo viên (Chờ đăng ký)',
        roleCode: 'teacher_moderator',
        roleName: 'Giáo viên (Đang chờ kích hoạt)',
        assignedAt: r.created_at,
        status: 'Chờ kích hoạt',
      });
    }
  }

  return list;
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
    if (error.message.includes('Could not find the function') || error.message.includes('schema cache')) {
      const { data: roleRow } = await supabase
        .from('roles')
        .select('id, name')
        .eq('code', input.roleCode)
        .single();

      const roleId = roleRow?.id;
      const roleName = roleRow?.name || (input.roleCode === 'school_admin' ? 'Quản trị viên trường' : 'Giáo viên kiểm duyệt');

      const { data: { user: caller } } = await supabase.auth.getUser();
      let schoolId = input.schoolId;
      if (!schoolId && caller) {
        const { data: callerProf } = await supabase.from('profiles').select('school_id').eq('user_id', caller.id).single();
        schoolId = callerProf?.school_id;
      }
      if (!schoolId) {
        const { data: firstSchool } = await supabase.from('schools').select('id').limit(1).single();
        schoolId = firstSchool?.id;
      }

      const { data: prof } = await supabase
        .from('profile_private')
        .select('user_id, contact_email')
        .ilike('contact_email', cleanEmail)
        .limit(1);

      const targetUserId = prof?.[0]?.user_id;

      if (targetUserId && roleId && schoolId) {
        await supabase
          .from('user_roles')
          .upsert({
            user_id: targetUserId,
            role_id: roleId,
            school_id: schoolId,
            assigned_at: new Date().toISOString(),
            assigned_by: caller?.id,
          });

        await supabase
          .from('profiles')
          .update({ school_id: schoolId, status: 'active', updated_at: new Date().toISOString() })
          .eq('user_id', targetUserId);

        return {
          success: true,
          isPreauthorized: false,
          userId: targetUserId,
          email: cleanEmail,
          roleCode: input.roleCode,
          roleName,
          message: `Đã cấp quyền ${roleName} cho tài khoản ${cleanEmail} thành công.`,
        };
      } else if (schoolId) {
        await supabase.from('roster_entries').insert({
          school_id: schoolId,
          full_name: `Giáo viên (${cleanEmail})`,
          identifier_hash: cleanEmail,
          normalized_email: cleanEmail,
          grade_level: 'staff',
          status: 'active',
        });

        return {
          success: true,
          isPreauthorized: true,
          email: cleanEmail,
          roleCode: input.roleCode,
          roleName,
          message: `Đã lưu danh sách chờ cấp quyền. Khi tài khoản ${cleanEmail} đăng ký, quyền sẽ được tự động kích hoạt.`,
        };
      }
    }
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
    if (error.message.includes('Could not find the function') || error.message.includes('schema cache')) {
      const { data: roleRow } = await supabase.from('roles').select('id').eq('code', roleCode).single();
      if (roleRow?.id) {
        await supabase.from('user_roles').delete().match({ user_id: userId, role_id: roleRow.id });
        return {
          success: true,
          userId,
          roleCode,
          message: 'Đã thu hồi vai trò thành công.',
        };
      }
    }
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
