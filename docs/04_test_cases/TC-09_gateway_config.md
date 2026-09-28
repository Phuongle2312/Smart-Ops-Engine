# TC-09 — Gateway & Cấu hình hệ thống (`GW`)

> SRS: [09_gateway_config.md](../02_srs/09_gateway_config.md) · Use case: [UC-GW-01, UC-GW-02](../03_usecases/UC-07_realtime_audit_config.md)
> Test bảo mật chuyên sâu nằm ở [security_tests.md](security_tests.md).

## 1. Định tuyến & hạ tầng

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-GW-API-001 | Định tuyến đúng service | Hệ thống chạy | Gọi `/api/v1/nodes`, `/api/v1/incidents`, `/api/v1/users` | — | Mỗi request tới đúng service, trả 200 | Functional | P1 | FR-GW-001 |
| TC-GW-API-002 | Route không khai báo | — | `GET /api/v1/khong-ton-tai` | — | 404, không lộ tên service nội bộ | Security | P1 | FR-GW-001 |
| TC-GW-API-003 | Endpoint nội bộ không lộ ra ngoài | — | `GET /api/v1/internal/...`, `/health/ready`, `/metrics` | — | 404 qua Gateway | Security | P1 | FR-GW-001 |
| TC-GW-API-004 | Correlation-id tự sinh | — | Gọi API không gửi header | — | Response có `X-Correlation-Id`; log service dùng cùng giá trị | Integration | P1 | FR-GW-005 |
| TC-GW-API-005 | Correlation-id do client cung cấp | — | Gửi `X-Correlation-Id: abc-123` | — | Giá trị được giữ nguyên xuyên suốt log các service | Integration | P2 | FR-GW-005 |
| TC-GW-API-006 | Giới hạn kích thước body | — | POST body 2 MB | — | 413 | Security | P1 | FR-GW-009 |
| TC-GW-API-007 | Service đích ngừng | Dừng Inventory | `GET /api/v1/nodes` | — | 503 chuẩn hóa, không stack trace; YARP loại đích lỗi khỏi vòng tải | Reliability | P1 | FR-GW-011, 014 |
| TC-GW-API-008 | Cân bằng tải | 2 replica Inventory | Gửi 100 request | — | Phân bổ tới cả hai replica | Performance | P2 | FR-GW-011 |
| TC-GW-API-009 | WebSocket passthrough | — | Mở kết nối `/hubs/monitoring` | — | Nâng cấp WebSocket thành công qua Gateway | Functional | P1 | FR-GW-010 |
| TC-GW-API-010 | Chi phí gateway | — | So sánh độ trễ gọi trực tiếp và qua gateway | — | Chênh lệch p95 ≤ 20 ms | Performance | P2 | SRS §8 |
| TC-GW-API-011 | Rolling update không rớt request | Đang có tải | Deploy phiên bản mới | — | 0 request lỗi trong quá trình cập nhật | Reliability | P1 | NFR-AVL-008 |

## 2. Xác thực, phân quyền & giới hạn

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-GW-SEC-001 | Thiếu token | — | `GET /api/v1/nodes` không header | — | 401 `ProblemDetails`, không lộ chi tiết | Security | P1 | FR-GW-002 |
| TC-GW-SEC-002 | Token sai chữ ký | — | Sửa 1 ký tự trong chữ ký | — | 401 | Security | P1 | FR-GW-002 |
| TC-GW-SEC-003 | Token `alg=none` | — | Gửi JWT không chữ ký | — | 401 | Security | P1 | NFR-SEC-005 |
| TC-GW-SEC-004 | Token HS256 ký bằng public key | — | Tạo token HS256 | — | 401 (chỉ chấp nhận RS256) | Security | P1 | NFR-SEC-005 |
| TC-GW-SEC-005 | Token hết hạn | Token quá 15 phút | Gọi API | — | 401 | Security | P1 | FR-GW-002 |
| TC-GW-SEC-006 | Sai `aud`/`iss` | Token của hệ thống khác | Gọi API | — | 401 | Security | P1 | FR-GW-002 |
| TC-GW-SEC-007 | Xoay khóa ký | Identity xoay sang `kid` mới | Gọi API với token mới | — | Gateway tự làm mới JWKS và chấp nhận | Security | P2 | FR-GW-002 |
| TC-GW-SEC-008 | Ma trận vai trò × endpoint | 3 tài khoản | Gọi toàn bộ endpoint theo bảng RBAC | — | Kết quả khớp 100% bảng phân quyền (mỗi ô một assert) | Security | P1 | NFR-SEC-008 |
| TC-GW-SEC-009 | Client tự gắn header nâng quyền | Đăng nhập VIEWER | Gửi `X-User-Role: ADMIN` | — | Header bị xóa; vẫn 403 khi gọi endpoint ADMIN | Security | P1 | FR-GW-006 |
| TC-GW-SEC-010 | Service kiểm tra lại quyền | Bỏ qua gateway (gọi trực tiếp trong mạng thử nghiệm) | Gọi endpoint ADMIN bằng token VIEWER | — | Service vẫn trả 403 | Security | P1 | BR-GW-002 |
| TC-GW-SEC-011 | Rate limit đọc | — | 301 request/phút/user | — | Request vượt ngưỡng trả 429 + `Retry-After` | Security | P1 | FR-GW-004 |
| TC-GW-SEC-012 | Rate limit dùng chung giữa replica | 2 replica Gateway | Gửi tải qua cả hai | — | Bộ đếm chung (Redis), tổng vượt ngưỡng thì chặn | Security | P2 | FR-GW-004 |
| TC-GW-SEC-013 | CORS origin hợp lệ | — | Preflight từ origin cho phép | — | 204 với đủ header CORS, `Allow-Credentials: true` | Security | P1 | FR-GW-007 |
| TC-GW-SEC-014 | CORS origin lạ | — | Preflight từ `https://evil.com` | — | Không có header `Access-Control-Allow-Origin` | Security | P1 | FR-GW-007 |
| TC-GW-SEC-015 | Header bảo mật | — | Gọi bất kỳ API | — | Có HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Cache-Control: no-store`; **không** có `Server`/`X-Powered-By` | Security | P1 | FR-GW-008, 014 |
| TC-GW-SEC-016 | Lỗi không lộ nội bộ | Ép lỗi 500 ở service | Gọi API | — | ProblemDetails không chứa stack trace, tên class, chuỗi kết nối | Security | P1 | FR-GW-014 |
| TC-GW-SEC-017 | Log không chứa token/body | — | Gọi login rồi đọc log gateway | — | Không có mật khẩu, không có token | Security | P1 | FR-GW-012 |
| TC-GW-SEC-018 | Swagger tắt ở production | Môi trường production | `GET /swagger` | — | 404 | Security | P1 | OWASP API8 |

## 3. Cấu hình hệ thống

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-GW-API-012 | Xem cấu hình tổng hợp | ADMIN | `GET /api/v1/system-config` | — | 200 với 4 nhóm cấu hình + version + trạng thái phụ thuộc; mật khẩu SMTP chỉ có `hasPassword` | Functional | P1 | FR-GW-020 |
| TC-GW-API-013 | Một service phụ thuộc lỗi | Dừng Notification | `GET /system-config` | — | Các nhóm khác vẫn trả dữ liệu; nhóm lỗi báo “Không tải được” | Reliability | P2 | UC-GW-01/E2 |
| TC-GW-API-014 | Bật/tắt scheduler | ADMIN | `PUT /system-config/scheduler` `{enabled:false}` | — | 200; không còn lệnh quét; audit `SCHEDULER_TOGGLED` | Functional | P1 | FR-GW-021 |
| TC-GW-API-015 | Đổi chu kỳ hợp lệ | ADMIN | `PUT` `{defaultIntervalSeconds:120}` | — | 200; áp dụng ngay không cần restart | Functional | P1 | FR-GW-027 |
| TC-GW-API-016 | Chu kỳ ngoài phạm vi | ADMIN | `PUT` `{defaultIntervalSeconds:10}` | — | 400 | Validation | P1 | SRS §6 |
| TC-GW-API-017 | Kiểm tra sức khỏe phụ thuộc | — | `GET /system-config/health` | — | 200 với trạng thái DB/RabbitMQ/Redis/SMTP | Functional | P2 | FR-GW-025 |
| TC-GW-API-018 | OPERATOR sửa cấu hình | OPERATOR | `PUT /system-config/scheduler` | — | 403 | Security | P1 | RBAC |
| TC-GW-API-019 | Audit mọi thay đổi cấu hình | ADMIN | Đổi 3 nhóm cấu hình | — | 3 bản ghi audit có diff trước/sau | Security | P1 | FR-GW-026 |
| TC-GW-API-020 | Hai ADMIN sửa đồng thời | — | 2 `PUT` song song | — | Một request nhận 409 | Reliability | P2 | UC-GW-01/E4 |
| TC-GW-E2E-001 | Màn hình cấu hình | ADMIN | Mở `/app/system-config` | — | 4 nhóm hiển thị đúng giá trị hiện tại, mỗi nhóm có nút Lưu riêng | UI/UX | P1 | FR-GW-FE-001 |
| TC-GW-E2E-002 | Trạng thái phụ thuộc | — | Quan sát 60 giây | — | Chấm màu + nhãn chữ, tự làm mới mỗi 30 giây | UI/UX | P2 | FR-GW-FE-002 |
| TC-GW-E2E-003 | Validate ngưỡng tại chỗ | ADMIN | Nhập warning 95 / critical 90 | — | Lỗi hiện ngay, nút Lưu bị khóa | Validation | P1 | FR-GW-FE-003 |
| TC-GW-E2E-004 | Xác nhận thay đổi nhạy cảm | ADMIN | Tắt scheduler | — | Hộp thoại xác nhận nêu hệ quả trước khi thực hiện | UI/UX | P1 | FR-GW-FE-004 |
| TC-GW-E2E-005 | Mật khẩu SMTP | ADMIN | Mở form SMTP | — | Hiển thị `••••••••`; chỉ gửi khi nhập mới; nút kiểm tra kết nối hoạt động | Security | P1 | FR-GW-FE-005 |
| TC-GW-E2E-006 | Cập nhật hiển thị sau khi lưu | ADMIN | Lưu một nhóm | — | Toast + giá trị lấy từ response, không giữ cache cũ | Functional | P2 | FR-GW-FE-006 |
| TC-GW-E2E-007 | Mất quyền giữa chừng | ADMIN bị hạ quyền ở phiên khác | Bấm Lưu | — | Nhận 403 → chuyển về Dashboard kèm thông báo | Security | P2 | FR-GW-FE-007 |
