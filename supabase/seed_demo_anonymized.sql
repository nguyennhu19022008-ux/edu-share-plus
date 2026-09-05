-- EDU SHARE+ / SYNTHETIC DEMO SEED DATA
-- Chứa dữ liệu mẫu giả lập hoàn toàn (100% synthetic/anonymized)
-- Dùng cho môi trường DEV, DEMO và đánh giá giám khảo, KHÔNG CHỨA PII THỰC TẾ.

-- 1. Đảm bảo có trường học mẫu
insert into public.schools (code, name, is_active)
values ('THPT_DEMO', 'Trường THPT Mẫu Demo', true)
on conflict (code) do update set is_active = true;

-- Ghi chú: Để tạo tài khoản người dùng test, vui lòng sử dụng luồng Đăng ký chuẩn của ứng dụng
-- với email định dạng student.demo@school.edu.vn hoặc teacher.demo@school.edu.vn.
