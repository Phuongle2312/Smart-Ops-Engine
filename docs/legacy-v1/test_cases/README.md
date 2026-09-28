# Smart Ops Engine — Tài liệu Hướng dẫn & Tổng quan Test Cases

Tài liệu này tổng hợp và cấu trúc toàn bộ các kịch bản kiểm thử (Test Cases) của hệ thống **Smart Ops Engine** nhằm phục vụ cho công tác đảm bảo chất lượng phần mềm (QA/QC) và kiểm tra tính đúng đắn trước khi bàn giao hệ thống.

---

## 1. Cấu trúc thư mục Test Cases

Các test case được chia nhỏ và tổ chức theo từng phân hệ chức năng tương ứng với tài liệu SRS để thuận tiện cho việc đọc, theo dõi và cập nhật:

- **[01_auth_test_cases.md](01_auth_test_cases.md)**: Xác thực người dùng qua JWT, lưu trữ token, phân quyền Menu/API (RBAC), rate-limiting login.
- **[02_node_management_test_cases.md](02_node_management_test_cases.md)**: Các thao tác CRUD Node, mã hóa mật khẩu/SSH Key bằng AES trong DB, UI Modal Thêm/Sửa/Xóa.
- **[03_health_check_scheduler_test_cases.md](03_health_check_scheduler_test_cases.md)**: Quét Disk/CPU/RAM định kỳ, SSH Command execution & timeout, MXBean local scan, logic xử lý vượt ngưỡng.
- **[04_incident_management_test_cases.md](04_incident_management_test_cases.md)**: Ghi nhận sự cố, xử lý sự cố (Acknowledge/Resolve), chống trùng lặp sự cố (Dedup) và các bộ lọc sự cố trên UI.
- **[05_alert_notifications_test_cases.md](05_alert_notifications_test_cases.md)**: Gửi email SMTP thông báo khẩn cấp & báo cáo hằng ngày, Webhook ký HMAC, toast notification (`react-hot-toast`).
- **[06_websocket_realtime_test_cases.md](06_websocket_realtime_test_cases.md)**: Push sự kiện WebSocket STOMP Broker, WebSocket connection status indicator, cơ chế polling dự phòng khi offline.
- **[07_audit_log_test_cases.md](07_audit_log_test_cases.md)**: Ghi nhật ký tự động qua Spring AOP Aspect, xem danh sách log, giao diện so sánh giá trị JSON Diff.
- **[08_metrics_history_test_cases.md](08_metrics_history_test_cases.md)**: Lưu trữ lịch sử chỉ số, API lấy metrics theo dải thời gian (`24h`, `7d`, `30d`), biểu đồ LineChart, cleanup job tự động.
- **[09_system_config_test_cases.md](09_system_config_test_cases.md)**: Cấu hình `application.properties` ghi đè bằng Biến môi trường, cấu hình bảo mật Production (HTTPS, ddl-auto validate).

---

## 2. Quy ước bảng kịch bản kiểm thử (Test Case Template)

Mỗi kịch bản kiểm thử được biểu diễn dưới dạng bảng Markdown chi tiết với các cột:

| ID | Test Scenario | Prerequisites | Steps | Test Data | Expected Result | Type | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |

### Ý nghĩa các cột:
1. **ID**: Mã định danh duy nhất của test case. Quy ước: `TC-[Phần_hệ]-[BE/FE]-[Số_thứ_tự]`
   * *Ví dụ*: `TC-AUTH-BE-01` là test case Backend số 1 của phân hệ Auth.
2. **Test Scenario**: Kịch bản kiểm thử cụ thể (mô tả ngắn gọn mục đích kiểm thử).
3. **Prerequisites**: Các điều kiện cần có trước khi thực hiện test (ví dụ: người dùng đăng nhập với quyền ADMIN, database có sẵn 5 node active).
4. **Steps**: Các bước thao tác thủ công hoặc gửi request API.
5. **Test Data**: Các giá trị đầu vào cụ thể (username, password, IP, port, JSON payload).
6. **Expected Result**: Kết quả mong đợi sau khi thực hiện các bước (thay đổi trên UI, dữ liệu lưu trong DB, mã HTTP trả về, v.v.).
7. **Type**: Loại kiểm thử:
   * **Functional**: Kiểm thử luồng nghiệp vụ thông thường.
   * **Validation**: Kiểm thử ràng buộc dữ liệu đầu vào.
   * **Security**: Kiểm thử bảo mật (mã hóa, phân quyền, JWT, brute-force).
   * **Integration**: Kiểm thử sự phối hợp giữa FE và BE.
   * **Performance/Reliability**: Kiểm thử hiệu năng, độ trễ, timeout, cleanup job.
8. **Status**: Trạng thái thực thi hiện tại của test case trong chu kỳ test:
   * `Untested` (Chưa test) | `Pass` (Đạt) | `Fail` (Lỗi) | `Blocked` (Bị nghẽn do lỗi khác) | `N/A` (Chưa áp dụng do tính năng chưa triển khai).

---

## 3. Hướng dẫn thực hiện Kiểm thử

### Kiểm thử Backend (API / Logic / Database)
- **Công cụ khuyến nghị**: Postman, Insomnia, curl hoặc viết test suite tự động với JUnit/Spring Boot Test.
- **Kiểm tra Database**: Sử dụng SQL Server Management Studio (SSMS) hoặc DBeaver kết nối vào database `smart_ops_engine` để kiểm tra các thay đổi ở các bảng `Nodes`, `Incident_Logs`, `Audit_Logs`, `Node_Metrics`, `Users`.
- **Kiểm tra Email**: Sử dụng hòm thư test hoặc cấu hình SMTP server ảo (như Maildev, Mailtrap) để kiểm tra các email thông báo mà không làm phiền hệ thống thật.

### Kiểm thử Frontend (UI / UX / Client State)
- **Kiểm tra Trạng thái Mock**: Hệ thống hiện có chế độ chạy dữ liệu giả lập (Mock Phase). Có thể chuyển đổi qua lại giữa API thật và Mock để kiểm tra giao diện trước.
- **Trình duyệt khuyến nghị**: Google Chrome, Mozilla Firefox (sử dụng DevTools F12 -> tab Console, Network và Application để theo dõi JWT, cookies và lỗi gọi API).
- **Kiểm tra Phân quyền**: Đăng nhập bằng tài khoản `admin` (ROLE_ADMIN) và tài khoản `viewer` (ROLE_VIEWER) để đối chiếu sự khác biệt trên giao diện (ví dụ: tài khoản `viewer` không được thấy nút "Thêm Node", "Xóa Node", "Resolve").
