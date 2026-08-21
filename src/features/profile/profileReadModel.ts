import type { ProfilePrivacy, StudentProfileView } from './types';

type AuthUserInput = {
  email?: unknown;
  created_at?: unknown;
  last_sign_in_at?: unknown;
};

type ProfileRowInput = {
  full_name?: unknown;
  class_id?: unknown;
  avatar_file_id?: unknown;
  show_name?: unknown;
  show_class?: unknown;
  reputation_score_cache?: unknown;
  reputation_label_cache?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type PrivateProfileRowInput = {
  contact_email?: unknown;
  phone?: unknown;
  show_email?: unknown;
  show_phone?: unknown;
  face_file_id?: unknown;
  updated_at?: unknown;
};

export type StudentProfileViewInput = {
  authUser: AuthUserInput;
  profile: ProfileRowInput;
  privateProfile: PrivateProfileRowInput;
  classLabel: string | null;
};

function invalidProfileResponse(): never {
  throw new Error('PROFILE_RESPONSE_INVALID');
}

function requireBoolean(value: unknown): boolean {
  if (typeof value !== 'boolean') invalidProfileResponse();
  return value;
}

function requireString(value: unknown): string {
  if (typeof value !== 'string') invalidProfileResponse();
  return value;
}

function optionalString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return requireString(value);
}

function requireFiniteNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalidProfileResponse();
  return value;
}

function formatVietnamTimestamp(value: unknown, fallback: string): string {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') invalidProfileResponse();

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalidProfileResponse();

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone:'Asia/Ho_Chi_Minh',
    day:'2-digit',
    month:'2-digit',
    year:'numeric',
    hour:'2-digit',
    minute:'2-digit',
    hourCycle:'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

function maskPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 5) return '••••';
  return `${digits.slice(0, 2)}•• ••• ${digits.slice(-3)}`;
}

export function parseProfilePrivacyResponse(value: unknown): ProfilePrivacy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    invalidProfileResponse();
  }

  const row = value as Record<string, unknown>;
  return {
    showName:requireBoolean(row.showName),
    showClass:requireBoolean(row.showClass),
    showEmail:requireBoolean(row.showEmail),
    showPhone:requireBoolean(row.showPhone),
  };
}

export function parseStudentProfileView(input: StudentProfileViewInput): StudentProfileView {
  if (!input || typeof input !== 'object') invalidProfileResponse();

  const email = optionalString(input.authUser.email);
  const name = requireString(input.profile.full_name);
  const phone = optionalString(input.privateProfile.phone);
  const className = input.classLabel === null ? 'Chưa cập nhật' : requireString(input.classLabel);
  const reputationLabel = requireString(input.profile.reputation_label_cache);

  return {
    email,
    name,
    className,
    phone,
    phoneMasked:maskPhone(phone),
    avatarUrl:'',
    faceUrl:'',
    createdAt:formatVietnamTimestamp(input.authUser.created_at ?? input.profile.created_at, 'Chưa có dữ liệu'),
    lastLogin:formatVietnamTimestamp(input.authUser.last_sign_in_at, 'Chưa có dữ liệu'),
    updatedAt:formatVietnamTimestamp(
      input.profile.updated_at ?? input.privateProfile.updated_at,
      'Chưa có dữ liệu',
    ),
    passwordStatus:'Được quản lý bởi Supabase Auth',
    privacy:{
      showName:requireBoolean(input.profile.show_name),
      showClass:requireBoolean(input.profile.show_class),
      showEmail:requireBoolean(input.privateProfile.show_email),
      showPhone:requireBoolean(input.privateProfile.show_phone),
    },
    reputation:{
      score:requireFiniteNumber(input.profile.reputation_score_cache),
      label:reputationLabel,
    },
  };
}
