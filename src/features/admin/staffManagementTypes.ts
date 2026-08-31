export type StaffRoleCode = 'teacher_moderator' | 'school_admin' | 'system_admin';

export interface StaffMember {
  userId: string;
  email: string;
  fullName: string;
  roleCode: StaffRoleCode;
  roleName: string;
  assignedAt: string;
  status: string;
}

export interface AssignStaffInput {
  email: string;
  roleCode: 'teacher_moderator' | 'school_admin';
  schoolId?: string | null;
}

export interface AssignStaffResult {
  success: boolean;
  isPreauthorized?: boolean;
  userId?: string;
  email: string;
  roleCode: string;
  roleName: string;
  message: string;
}

export interface RevokeStaffResult {
  success: boolean;
  userId: string;
  roleCode: string;
  message: string;
}
