# TC-08 — Audit Service (`AUD`)

> SRS: [08_audit.md](../02_srs/08_audit.md) · Use case: [UC-AUD-01](../03_usecases/UC-07_realtime_audit_config.md)

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-AUD-INT-001 | Ghi audit khi tạo node | Bus chạy | ADMIN tạo node | — | Bản ghi `NODE_CREATED` có actor, entityId, `after`, `correlationId` | Integration | P1 | FR-AUD-001 |
| TC-AUD-INT-002 | Ghi diff khi sửa | Node tồn tại | Sửa tên node | — | `before.name` và `after.name` đúng; chỉ chứa trường thay đổi cần thiết | Integration | P1 | FR-AUD-003 |
| TC-AUD-INT-003 | Lọc trường nhạy cảm | Node có credential | Sửa credential | — | `before/after` hiển thị `"***"`, không có plaintext hay ciphertext | Security | P1 | FR-AUD-004 |
| TC-AUD-INT-004 | Ghi audit sự kiện bảo mật | — | Đăng nhập sai 5 lần | — | Có `LOGIN_FAILED` ×5 và `ACCOUNT_LOCKED` ×1 | Security | P1 | FR-AUD-002 |
| TC-AUD-INT-005 | Ghi truy cập credential | Worker quét node | Chạy một chu kỳ | — | Mỗi lần đọc credential có một `CREDENTIAL_ACCESSED` kèm `checkId` | Security | P1 | FR-AUD-002 |
| TC-AUD-INT-006 | Audit cho hành động xuất dữ liệu | OPERATOR xuất CSV metric | — | — | Có `METRICS_EXPORTED` | Integration | P3 | FR-AUD-001 |
| TC-AUD-INT-007 | Audit cho hành động hệ thống | Sự cố tự đóng | — | — | Bản ghi `INCIDENT_AUTO_RESOLVED` với actor `SYSTEM` | Integration | P2 | BR-AUD-005 |
| TC-AUD-INT-008 | Ghi theo lô | 500 event trong 1 giây | Publish liên tục | — | Ghi theo lô, không mất bản ghi, không dồn queue | Performance | P2 | SRS §9 |
| TC-AUD-INT-009 | Idempotent | — | Publish cùng event 3 lần | — | Chỉ một bản ghi audit | Reliability | P1 | NFR-AVL-003 |
| TC-AUD-INT-010 | Lỗi audit không ảnh hưởng nghiệp vụ | Dừng Audit service | Tạo node | — | Node vẫn tạo thành công; message chờ trong queue và được ghi khi Audit trở lại | Reliability | P1 | BR-AUD-003 |
| TC-AUD-INT-011 | Chuỗi băm liên tục | Có ≥ 50 bản ghi | Kiểm tra `Hash`/`PrevHash` | — | Chuỗi liên tục, không đứt | Security | P2 | FR-AUD-008 |
| TC-AUD-INT-012 | Phát hiện sửa đổi | Sửa trực tiếp một bản ghi bằng SQL (tài khoản khác) | `POST /audit-logs/verify` | — | Trả `isIntact=false` kèm `brokenAtId` | Security | P2 | FR-AUD-008 |
| TC-AUD-INT-013 | Quyền SQL chỉ ghi/đọc | Tài khoản service | Thử `UPDATE`/`DELETE` trên `AuditEntries` | — | Bị CSDL từ chối | Security | P1 | BR-AUD-001, NFR-SEC-012 |
| TC-AUD-INT-014 | Retention 365 ngày | Có dữ liệu 400 ngày | Chạy job dọn | — | Bản ghi > 365 ngày bị xóa theo partition; dữ liệu mới còn nguyên | Functional | P2 | FR-AUD-009 |
| TC-AUD-API-001 | Danh sách mặc định 7 ngày | ADMIN | `GET /audit-logs` | — | 200; chỉ dữ liệu 7 ngày gần nhất, mới nhất trước | Functional | P1 | FR-AUD-005 |
| TC-AUD-API-002 | Lọc theo hành động | — | `?action=NODE_DELETED` | — | Chỉ bản ghi đúng loại | Functional | P2 | FR-AUD-005 |
| TC-AUD-API-003 | Lọc theo người thực hiện | — | `?actorId=…` | — | Chỉ bản ghi của người đó | Functional | P2 | FR-AUD-005 |
| TC-AUD-API-004 | Tìm theo từ khóa | — | `?search=prod-web-01` | — | Kết quả khớp trong `summary` | Functional | P3 | FR-AUD-005 |
| TC-AUD-API-005 | Khoảng > 90 ngày | — | `?from=…&to=…` cách 120 ngày | — | 400 | Validation | P2 | SRS §6 |
| TC-AUD-API-006 | Chi tiết có diff | Có bản ghi sửa | `GET /audit-logs/{id}` | — | 200 với `before`/`after` | Functional | P1 | FR-AUD-006 |
| TC-AUD-API-007 | Dòng thời gian đối tượng | Node có 5 thao tác | `GET /audit-logs/entity/Node/{id}` | — | 5 bản ghi theo thứ tự thời gian | Functional | P2 | FR-AUD-010 |
| TC-AUD-API-008 | Truy vết theo correlationId | Một thao tác qua nhiều service | `?search={correlationId}` | — | Trả đủ các bản ghi cùng chuỗi | Integration | P2 | NFR-OBS-001 |
| TC-AUD-API-009 | Xuất CSV | ADMIN | `GET /audit-logs/export` | — | 200 CSV; tạo bản ghi `AUDIT_EXPORTED` | Functional | P3 | FR-AUD-007 |
| TC-AUD-API-010 | OPERATOR truy cập | OPERATOR | `GET /audit-logs` | — | 403 | Security | P1 | BR-AUD-002 |
| TC-AUD-API-011 | VIEWER truy cập | VIEWER | `GET /audit-logs` | — | 403 | Security | P1 | BR-AUD-002 |
| TC-AUD-API-012 | Ghi audit cho chính việc tra cứu | ADMIN | Tra cứu nhật ký | — | Có bản ghi cho hành động tra cứu/xuất | Security | P3 | BR-AUD-002 |
| TC-AUD-PERF-001 | Truy vấn 7 ngày với 1 triệu bản ghi | Dữ liệu lớn | k6 | — | p95 ≤ 400 ms | Performance | P2 | SRS §9 |
| TC-AUD-E2E-001 | Bảng nhật ký | ADMIN | Mở `/app/audit-logs` | — | Hiển thị thời gian (địa phương + tương đối), người thực hiện, hành động dạng badge, đối tượng, kết quả | UI/UX | P1 | FR-AUD-FE-001 |
| TC-AUD-E2E-002 | Bộ lọc lưu URL | — | Lọc rồi sao chép URL sang tab mới | — | Bộ lọc được khôi phục | UI/UX | P3 | FR-AUD-FE-002 |
| TC-AUD-E2E-003 | Xem diff | Có bản ghi sửa | Mở chi tiết | — | Hai cột trước/sau, tô sáng trường đổi, trường nhạy cảm hiện `***` | UI/UX | P1 | FR-AUD-FE-004 |
| TC-AUD-E2E-004 | Virtualization & phân trang | 10.000 bản ghi | Cuộn danh sách | — | DOM giữ số hàng nhỏ; không tải toàn bộ dữ liệu | Performance | P2 | FR-AUD-FE-003 |
| TC-AUD-E2E-005 | Không có mục menu với vai trò thấp | VIEWER | Xem sidebar | — | Không thấy “Nhật ký kiểm toán”; mở URL trực tiếp thì bị chặn | Security | P1 | FR-AUD-FE-006 |
| TC-AUD-E2E-006 | Không còn audit phía client | — | Kiểm tra `localStorage` | — | Không có khóa `soe_audit_logs` (đã bỏ cơ chế mock v1) | Regression | P2 | FR-AUD-FE-007 |
