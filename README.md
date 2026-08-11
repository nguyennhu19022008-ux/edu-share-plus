# EDU SHARE+ Rebuild — Phase 1 Local Frontend

Checkpoint hiện tại: **1H — Teacher/Admin Dashboard (`admin`)**.

## Chạy local

```bash
npm install
npm run dev
```

Các route chính:

- Landing: `http://localhost:5173/`
- Marketplace: `http://localhost:5173/?page=index`
- Đăng bài: `http://localhost:5173/?page=add`
- Bài của tôi: `http://localhost:5173/?page=myPosts`
- Chi tiết bài mẫu: `http://localhost:5173/?page=myDetail&id=OWN-001`
- Chỉnh sửa bài mẫu: `http://localhost:5173/?page=editPost&id=OWN-003`
- Hồ sơ: `http://localhost:5173/?page=profile`
- Giáo viên/Admin: `http://localhost:5173/?page=admin`

## Build check

```bash
npm run build
```

## Phạm vi 1H

Đã port từ `admin.html`, `Admin.gs`, `Analytics.gs` và `stylesAdmin` của source GAS cũ ở cấp UI/UX/flow:

- Topbar giáo viên và đăng xuất.
- 6 summary metrics.
- Thống kê nâng cao và xếp hạng danh mục/lớp.
- 4 chart panels.
- Danh sách bài kiểm duyệt.
- Tìm kiếm + lọc trạng thái + lọc lớp + sort.
- Pagination.
- Chỉnh status bài, bật/tắt hiển thị, bật/tắt bình luận.
- Bắt buộc nhập lý do khi từ chối.
- Detail moderation modal.
- Duyệt tất cả bài chờ.
- Kiểm tra trạng thái hệ thống local.
- Làm mới/đồng bộ thống kê local.

`Xuất báo cáo PDF` chưa tạo file thật vì Phase 1 chưa có backend/analytics runtime. Nút được giữ đúng vị trí và trả thông báo rõ ràng thay vì giả lập một PDF production.

Toàn bộ số liệu/bài đăng trong Admin 1H là **LOCAL_UI_SAMPLE**. Không dùng chúng làm số liệu nghiên cứu, không migrate chúng và không ghi vào backend.


## Checkpoint 1I — Phase 1 Integration Audit

This package integrates the Phase 1 local frontend baseline and fixes cross-screen local-state gaps without adding backend/database/storage behavior. See `docs/16_PHASE1_INTEGRATION_AUDIT.md`.
