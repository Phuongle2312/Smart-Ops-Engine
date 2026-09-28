# SRS 09 — API Gateway & Cấu hình hệ thống (`GW`)

> Yêu cầu cho gateway như một thành phần phần mềm, và cho màn hình “Cấu hình hệ thống” gom cấu hình từ nhiều service.
> Liên quan: [api_gateway_security.md](../01_architecture/api_gateway_security.md) (chi tiết kỹ thuật & bảo mật)

---

## 1. Mục đích & phạm vi

Gateway là cửa ngõ duy nhất: định tuyến, xác thực, giới hạn tần suất, chuẩn hóa lỗi và nhật ký. Ngoài ra module này đặc tả màn hình **System Config** — nơi ADMIN chỉnh các tham số vận hành mà v1 phải sửa `application.properties` rồi khởi động lại.

## 2. Yêu cầu chức năng — Gateway

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-GW-001 | Định tuyến mọi đường dẫn `/api/v1/**` và `/hubs/**` tới service tương ứng theo bảng route đã khai báo; đường dẫn không khai báo trả 404 (deny by default). | Must |
| FR-GW-002 | Xác thực JWT RS256 bằng khóa công khai lấy từ JWKS của Identity (cache 10 phút, tự làm mới khi gặp `kid` lạ). | Must |
| FR-GW-003 | Áp dụng chính sách phân quyền theo route (`ViewerOrAbove`, `OperatorOrAbove`, `AdminOnly`); từ chối bằng 401/403 có `ProblemDetails`. | Must |
| FR-GW-004 | Rate limiting theo policy (login, đọc, ghi, thao tác tốn tài nguyên, ẩn danh), bộ đếm dùng Redis để dùng chung giữa các replica; trả 429 kèm `Retry-After`. | Must |
| FR-GW-005 | Sinh `X-Correlation-Id` nếu client không gửi, chuyển tiếp xuống service và trả lại trong response header. | Must |
| FR-GW-006 | Xóa mọi header nhận dạng do client tự gắn (`X-User-Id`, `X-User-Role`, `X-Internal-*`) rồi mới gắn giá trị lấy từ token. | Must |
| FR-GW-007 | Chỉ cho phép CORS từ danh sách origin cấu hình, `AllowCredentials = true`. | Must |
| FR-GW-008 | Gắn bộ header bảo mật cho mọi response. | Must |
| FR-GW-009 | Giới hạn kích thước request body 1 MB (trừ import CSV 10 MB) và timeout chuyển tiếp 30 giây (WebSocket không áp dụng). | Must |
| FR-GW-010 | Hỗ trợ WebSocket passthrough cho SignalR, giữ header nâng cấp và không đệm dữ liệu. | Must |
| FR-GW-011 | Kiểm tra sức khỏe đích (active health check `/health/ready` mỗi 10 giây) và loại đích lỗi khỏi vòng cân bằng tải. | Must |
| FR-GW-012 | Ghi log truy cập có cấu trúc: thời gian, phương thức, route, mã trạng thái, thời lượng, user id, correlation id — **không ghi body, không ghi token**. | Must |
| FR-GW-013 | Trả `ProblemDetails` thống nhất cho lỗi phát sinh tại gateway (401, 403, 404, 413, 429, 502, 503, 504). | Must |
| FR-GW-014 | Không lộ thông tin nội bộ: ẩn header `Server`, `X-Powered-By`, không trả stack trace, không tiết lộ tên service trong lỗi. | Must |
| FR-GW-015 | Cho phép bật “chế độ bảo trì”: trả 503 kèm thông báo cho mọi route ghi, vẫn cho phép đọc (ADMIN bật qua cấu hình). | Could |

## 3. Yêu cầu chức năng — Cấu hình hệ thống

| ID | Yêu cầu | Quyền | Nguồn dữ liệu | Ưu tiên |
|---|---|---|---|---|
| FR-GW-020 | Xem tổng hợp cấu hình hiện tại của hệ thống trong một màn hình. | ADMIN | tổng hợp từ Monitoring, Incident, Notification | Must |
| FR-GW-021 | Bật/tắt scheduler và đổi chu kỳ quét mặc định (60–3600 giây). | ADMIN | Monitoring | Must |
| FR-GW-022 | Sửa ngưỡng cảnh báo toàn cục cho CPU/RAM/Disk và tham số chống nhiễu. | ADMIN | Incident | Must |
| FR-GW-023 | Sửa cấu hình SMTP và kiểm tra kết nối. | ADMIN | Notification | Must |
| FR-GW-024 | Bật/tắt báo cáo hằng ngày và đặt giờ gửi. | ADMIN | Notification | Must |
| FR-GW-025 | Xem thông tin phiên bản, thời gian chạy và trạng thái phụ thuộc (DB, RabbitMQ, Redis, SMTP) ở mức tóm tắt. | ADMIN | health check tổng hợp | Should |
| FR-GW-026 | Mọi thay đổi cấu hình được ghi audit kèm giá trị trước/sau. | ADMIN | Audit | Must |
| FR-GW-027 | Thay đổi có hiệu lực ngay, không cần khởi động lại service. | — | — | Must |

> **Lưu ý thiết kế:** không tạo service “Config” tập trung. Mỗi cấu hình thuộc về service sở hữu nghiệp vụ; màn hình System Config chỉ gọi các API tương ứng. Điều này giữ ranh giới bounded context (khác `SystemConfig` một bảng của v1).

## 4. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-GW-001 | Gateway không chứa logic nghiệp vụ; mọi quyết định nghiệp vụ nằm ở service. |
| BR-GW-002 | Gateway kiểm tra quyền ở mức thô; service **luôn** kiểm tra lại (defense in depth). |
| BR-GW-003 | Không cache response API ở gateway (dữ liệu giám sát biến động nhanh); chỉ cache JWKS. |
| BR-GW-004 | Cấu hình route lấy từ file/ConfigMap, thay đổi được nạp nóng, mọi thay đổi đi qua quy trình review. |
| BR-GW-005 | Giá trị cấu hình hệ thống phải được validate cả ở gateway (định dạng) và service sở hữu (nghiệp vụ). |

## 5. Hợp đồng API tổng hợp

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/v1/system-config` | ADMIN | `{ scheduler, thresholds, smtp (đã che), dailyReport, version, dependencies }` |
| PUT | `/api/v1/system-config/scheduler` | ADMIN | → Monitoring |
| PUT | `/api/v1/threshold-policies/global` | ADMIN | → Incident |
| GET/PUT | `/api/v1/system-config/smtp` | ADMIN | → Notification |
| PUT | `/api/v1/system-config/daily-report` | ADMIN | → Notification |
| GET | `/api/v1/system-config/health` | ADMIN | Trạng thái phụ thuộc dạng tóm tắt (`healthy`/`degraded`/`down`) |

```json
// GET /system-config
{
  "scheduler": { "enabled": true, "defaultIntervalSeconds": 300, "lastCycleStartedAt": "2026-09-23T08:30:00Z" },
  "thresholds": {
    "cpu":    { "warning": 75, "critical": 85, "isEnabled": true },
    "memory": { "warning": 80, "critical": 90, "isEnabled": true },
    "disk":   { "warning": 80, "critical": 90, "isEnabled": true },
    "consecutiveBreaches": 2, "recoveryMargin": 5, "consecutiveRecoveries": 2
  },
  "smtp": { "host": "smtp.office365.com", "port": 587, "useStartTls": true,
            "username": "o***@example.com", "fromEmail": "soe@example.com", "hasPassword": true },
  "dailyReport": { "enabled": true, "sendAtLocal": "08:00", "timeZone": "Asia/Ho_Chi_Minh" },
  "version": { "gateway": "3.0.1", "identity": "3.0.1", "…": "…" },
  "dependencies": { "database": "healthy", "rabbitmq": "healthy", "redis": "healthy", "smtp": "degraded" }
}
```

## 6. Validate

| Trường | Quy tắc |
|---|---|
| `defaultIntervalSeconds` | 60–3600 |
| `thresholds.*.warning/critical` | 1–100, `warning < critical` |
| `consecutiveBreaches`, `consecutiveRecoveries` | 1–10 |
| `recoveryMargin` | 0–50 |
| `smtp.host` | hostname hợp lệ, ≤ 255 |
| `smtp.port` | 1–65535 |
| `smtp.fromEmail` | email hợp lệ |
| `dailyReport.sendAtLocal` | `HH:mm` 00:00–23:59 |

## 7. Phía Frontend

**Màn hình:** `SystemConfig` (ADMIN).

| ID | Yêu cầu |
|---|---|
| FR-GW-FE-001 | Màn hình chia 4 nhóm: Giám sát (scheduler), Ngưỡng cảnh báo, Email/SMTP, Báo cáo hằng ngày; mỗi nhóm lưu độc lập. |
| FR-GW-FE-002 | Hiển thị trạng thái phụ thuộc bằng chấm màu kèm nhãn chữ; làm mới mỗi 30 giây khi mở màn hình. |
| FR-GW-FE-003 | Validate zod tại chỗ (đặc biệt `warning < critical`), hiện lỗi ngay khi rời ô. |
| FR-GW-FE-004 | Thay đổi nhạy cảm (tắt scheduler, đổi ngưỡng) cần hộp thoại xác nhận nêu hệ quả. |
| FR-GW-FE-005 | Mật khẩu SMTP hiển thị `••••••••`; chỉ gửi khi người dùng nhập giá trị mới; có nút “Kiểm tra kết nối SMTP”. |
| FR-GW-FE-006 | Sau khi lưu, hiện toast và cập nhật giá trị hiển thị từ response (không giữ giá trị cũ trong cache). |
| FR-GW-FE-007 | Khi nhận 403 do hết quyền (vai trò bị đổi trong lúc mở trang), chuyển về Dashboard kèm thông báo. |

## 8. Phi chức năng

| Yêu cầu | Chỉ tiêu |
|---|---|
| Chi phí gateway | Thêm ≤ 20 ms vào p95 độ trễ mỗi request |
| Sẵn sàng | ≥ 2 replica, PodDisruptionBudget, rolling update không rớt kết nối |
| Bảo mật | Toàn bộ mục ở [api_gateway_security.md](../01_architecture/api_gateway_security.md) §5–§9 |
| Quan sát | Log truy cập có cấu trúc + metric `soe_http_request_duration_seconds{service="gateway"}` |
