export type StaffRoleCode = 'teacher_moderator' | 'admin';

export type StaffContext = {
  userId: string;
  fullName: string;
  accountStatus: 'approved';
  roleCode: StaffRoleCode;
  schoolId: string | null;
  schoolName: string | null;
};

export type ExistingStaffSessionState =
  | {
      kind: 'none';
      sessionExists: false;
      context: null;
      message: '';
    }
  | {
      kind: 'staff';
      sessionExists: true;
      context: StaffContext;
      message: '';
    }
  | {
      kind: 'non_staff';
      sessionExists: true;
      context: null;
      message: string;
    };
