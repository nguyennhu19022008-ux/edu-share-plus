-- EDU SHARE+ / PHASE 4B.1
-- Allowed School Reference Seed
-- DEVELOPMENT Supabase project only.
--
-- Source: user-approved school list for registration.
-- This migration seeds SCHOOL reference data only.
-- It does NOT migrate old student accounts, passwords, sessions, or research users.
-- school_classes intentionally remains empty until a verified class list is available.

insert into public.schools (code, name, is_active)
values
  ('THPT_NGUYEN_DU',       'THPT Nguyễn Du', true),
  ('THPT_NGUYEN_TRAI',     'THPT Nguyễn Trãi', true),
  ('THPT_TRAN_PHU',         'THPT Trần Phú', true),
  ('THPT_NGO_QUYEN',        'THPT Ngô Quyền', true),
  ('THPT_NGUYEN_VAN_CU',    'THPT Nguyễn Văn Cừ', true),
  ('PTDTNT_TINH',           'PT Dân tộc Nội trú Tỉnh', true)
on conflict (code) do update
set
  name = excluded.name,
  is_active = excluded.is_active;