# 07 — Test Cases: Nhật ký hoạt động (Audit Log)

Phân hệ Nhật ký hoạt động tự động ghi lại toàn bộ các hành động thay đổi dữ liệu nhạy cảm của người dùng (tạo/sửa/xóa Node, giải quyết/xác nhận sự cố, bật/tắt kênh cảnh báo) nhằm phục vụ công tác giám sát bảo mật, truy vết lỗi và đáp ứng các tiêu chuẩn tuân thủ hệ thống.

---

## 1. Backend Test Cases (AOP Aspect, DB Records & Audit API)

| ID | Test Scenario | Prerequisites | Steps | Test Data | Expected Result | Type | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-AUDIT-BE-01** | Tự động ghi log khi thêm Node mới qua Spring AOP | Tài khoản Admin thực hiện thêm Node | Gọi API `POST /api/nodes` để thêm mới một Node | Dữ liệu Node hợp lệ | - AOP Aspect `AuditAspect` bắt được sự kiện thành công.<br>- Thêm mới một bản ghi vào bảng `Audit_Logs`. <br>- Trường thông tin lưu đúng: `action = "CREATE"`, `entity_type = "NODE"`, `entity_id = id_vừa_tạo`, `old_value = null`, `new_value` chứa chuỗi JSON thông tin Node, `ip_address` lấy đúng IP client. | Functional / Security | `N/A` |
| **TC-AUDIT-BE-02** | Tự động ghi log khi cập nhật Node | Admin cập nhật thông tin Node | Gọi API `PUT /api/nodes/{id}` | N/A | - Thêm một bản ghi vào bảng `Audit_Logs`.<br>- Thông tin: `action = "UPDATE"`. Cột `old_value` lưu chuỗi JSON cũ trước khi sửa. Cột `new_value` lưu chuỗi JSON mới sau khi sửa để đối chiếu. | Functional / Security | `N/A` |
| **TC-AUDIT-BE-03** | Tự động ghi log khi xóa Node | Admin xóa Node | Gọi API `DELETE /api/nodes/{id}` | N/A | - Bản ghi audit được tạo: `action = "DELETE"`. Cột `old_value` lưu thông tin Node trước khi bị xóa hoàn toàn khỏi DB. Cột `new_value = null`. | Functional / Security | `N/A` |
| **TC-AUDIT-BE-04** | Tự động ghi log khi Resolve sự cố | Admin giải quyết sự cố | Gọi API `PUT /api/incidents/{id}/resolve` | N/A | - Bản ghi audit được tạo: `action = "RESOLVE"`, `entity_type = "INCIDENT"`. `old_value` lưu status OPEN, `new_value` lưu status RESOLVED kèm ghi chú. | Functional / Security | `N/A` |
| **TC-AUDIT-BE-05** | API lấy danh sách Audit Logs | Tài khoản Admin đã đăng nhập | Gửi request `GET /api/audit-logs` | Header:<br>`Authorization: Bearer <admin_token>` | - Trả về `HTTP 200 OK` cùng phân trang danh sách log hoạt động (JSON). | Functional | `N/A` |
| **TC-AUDIT-BE-06** | Bộ lọc tại API Audit Logs | Danh sách audit log trong DB đa dạng | Gửi request `GET /api/audit-logs?action=DELETE&entityType=NODE` | Query params | - Trả về danh sách chỉ chứa các hoạt động Xóa Node. | Functional | `N/A` |
| **TC-AUDIT-BE-07** | Chặn Viewer truy cập API Audit Logs | Tài khoản Viewer đã đăng nhập | Gửi request `GET /api/audit-logs` | Header:<br>`Authorization: Bearer <viewer_token>` | - Trả về `HTTP 403 Forbidden`. | Security | `N/A` |

---

## 2. Frontend Test Cases (UI Views, JSON Diff Dialog & Filters)

| ID | Test Scenario | Prerequisites | Steps | Test Data | Expected Result | Type | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-AUDIT-FE-01** | Hiển thị giao diện Audit Logs | Admin truy cập `/app/audit-logs` | Xem giao diện bảng danh sách nhật ký | N/A | - Bảng nhật ký hiển thị các cột: Thời gian, Người thực hiện (badge màu), Hành động (badge màu riêng biệt), Đối tượng tác động, ID đối tượng, IP Address.<br>- Dữ liệu được sắp xếp mới nhất ở đầu hàng. Phân trang hiển thị 20 dòng/trang. | Functional / UI | `Pass` |
| **TC-AUDIT-FE-02** | Màu sắc Badge hành động | Bảng nhật ký đang hiển thị | Xem cột Hành động | N/A | - Phân biệt màu sắc trực quan: `CREATE` màu xanh lá, `UPDATE` màu xanh dương, `DELETE` màu đỏ, `RESOLVE` màu tím, `ACKNOWLEDGE` màu vàng, `TOGGLE` màu cam. | UI/UX | `Pass` |
| **TC-AUDIT-FE-03** | Lọc và tìm kiếm Audit Logs | Danh sách audit log đang hiển thị | 1. Chọn lọc Action = `DELETE`<br>2. Nhập tìm kiếm username | Tìm kiếm: `admin` | - Danh sách hiển thị đúng các bản ghi log có hành động xóa được thực hiện bởi tài khoản `admin`. | Functional / UI | `Pass` |
| **TC-AUDIT-FE-04** | Hiển thị Dialog chi tiết so sánh giá trị (JSON Diff) | Người dùng click chọn một dòng audit log hành động `UPDATE` | Click vào hàng log số #501 | N/A | - Modal chi tiết "Chi tiết Audit Log #501" hiển thị.<br>- Giao diện hiển thị 2 khung so sánh rõ ràng: Khung bên trái (Trước - `old_value`) và Khung bên phải (Sau - `new_value`) ở định dạng code JSON dễ đọc. | UI/UX / Functional | `Pass` |
| **TC-AUDIT-FE-05** | Hiển thị Dialog chi tiết đối với hành động CREATE | Người dùng click chọn một dòng audit log hành động `CREATE` | Click vào hàng log số #503 | N/A | - Modal hiển thị chi tiết.<br>- Vì là hành động tạo mới, khung `old_value` ghi nhận rỗng (`null`) hoặc ẩn đi. Chỉ hiển thị khung `new_value` chứa thông tin được tạo. | UI/UX | `Pass` |
| **TC-AUDIT-FE-06** | Hiển thị Dialog chi tiết đối với hành động DELETE | Người dùng click chọn một dòng audit log hành động `DELETE` | Click vào hàng log xóa Node | N/A | - Modal hiển thị chi tiết.<br>- Khung `new_value` ghi nhận rỗng (`null`). Chỉ hiển thị khung `old_value` chứa thông tin trước khi xóa. | UI/UX | `Pass` |
| **TC-AUDIT-FE-07** | Tích hợp hàm `logAudit()` tự động (Mock Phase) | Người dùng đăng nhập quyền ADMIN | Thực hiện một hành động (như Sửa Node) và quay lại trang Audit Logs | Sửa tên Node | - Hệ thống tự động gọi hàm `logAudit()` trong Context.<br>- Log mới lập tức xuất hiện ở đầu bảng trang `/app/audit-logs` với thông tin chi tiết. | Functional / Simulator | `Pass` |
