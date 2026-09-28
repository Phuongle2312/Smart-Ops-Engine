# Test Cases — Hướng dẫn & Tổng quan

## 1. Cấu trúc

| Tệp | Phạm vi |
|---|---|
| [TC-01_identity.md](TC-01_identity.md) | Đăng nhập, refresh/rotation, khóa tài khoản, quản lý người dùng, RBAC cơ bản |
| [TC-02_inventory.md](TC-02_inventory.md) | CRUD node, mã hóa credential, chống trùng, host key, validate form |
| [TC-03_monitoring.md](TC-03_monitoring.md) | Scheduler, queue, worker SSH, timeout, check-now, idempotency |
| [TC-04_metrics.md](TC-04_metrics.md) | Lưu snapshot, truy vấn theo dải, rollup, retention, dashboard |
| [TC-05_incident.md](TC-05_incident.md) | Ngưỡng, dedup, escalate, auto-resolve, acknowledge/resolve |
| [TC-06_notification.md](TC-06_notification.md) | Kênh email/webhook, HMAC, throttle, retry, báo cáo hằng ngày |
| [TC-07_realtime.md](TC-07_realtime.md) | SignalR, nhóm, reconnect, fallback polling |
| [TC-08_audit.md](TC-08_audit.md) | Ghi nhật ký, tra cứu, diff, bất biến, toàn vẹn |
| [TC-09_gateway_config.md](TC-09_gateway_config.md) | Định tuyến, JWT, RBAC, rate limit, header, cấu hình hệ thống |
| [security_tests.md](security_tests.md) | OWASP API Top 10, bảo mật frontend, quét phụ thuộc |
| [performance_scaling_tests.md](performance_scaling_tests.md) | k6, Lighthouse, scale worker, chịu lỗi |
| [contract_messaging_tests.md](contract_messaging_tests.md) | Schema event, outbox/inbox, retry/DLQ |

## 2. Mẫu test case

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|

- **ID:** `TC-<MOD>-<CẤP>-NNN` (mã module xem [docs/README](../README.md) §4).
- **Cấp:** `UNIT` (không I/O) · `INT` (Testcontainers: SQL Server + RabbitMQ) · `API` (HTTP qua Gateway) · `CON` (contract/messaging) · `E2E` (Playwright) · `SEC` · `PERF`.
- **Loại:** Functional · Validation · Security · Integration · Reliability · Performance · UI/UX · Regression.
- **Ưu tiên:** `P1` (chặn phát hành) · `P2` (quan trọng) · `P3` (nên có).
- **Truy vết:** mã `FR-*` / `BR-*` / `NFR-*` / `UC-*` mà test case kiểm chứng.

## 3. Môi trường kiểm thử

| Môi trường | Mục đích | Ghi chú |
|---|---|---|
| **Local dev** | Unit + component | `dotnet test`, `npm run test` |
| **Docker Compose test** | Integration, API, E2E | Compose dựng SQL Server, RabbitMQ, Redis, MailHog, 2 node SSH giả lập (container `linuxserver/openssh-server`) |
| **Staging (K8s)** | Performance, security scan, UAT | Dữ liệu ẩn danh, quy mô 500 node giả lập |

**Dữ liệu kiểm thử chuẩn (seed):**

| Đối tượng | Giá trị |
|---|---|
| Người dùng | `admin/Admin@Test2026!` (ADMIN), `operator/Operator@Test2026!` (OPERATOR), `viewer/Viewer@Test2026!` (VIEWER), `locked_user` (đang khóa), `disabled_user` (đã vô hiệu hóa) |
| Node | `node-ok` (SSH giả lập hoạt động), `node-authfail` (sai mật khẩu), `node-timeout` (không phản hồi), `node-hostkey` (đổi host key), `node-inactive` (tắt giám sát) |
| Ngưỡng | CPU 75/85, RAM 80/90, Disk 80/90; `consecutiveBreaches = 2`, `recoveryMargin = 5`, `consecutiveRecoveries = 2` |
| Kênh cảnh báo | `email-ops` (MailHog), `webhook-generic` (endpoint test ghi log), `webhook-blocked` (trỏ `127.0.0.1` để kiểm thử chặn SSRF) |

## 4. Công cụ

| Mục đích | Công cụ |
|---|---|
| Unit/Integration .NET | xUnit, FluentAssertions, NSubstitute, Testcontainers, Respawn |
| Kiến trúc | NetArchTest |
| API | xUnit + `WebApplicationFactory`, Postman collection (thủ công) |
| Messaging | MassTransit TestHarness, snapshot JSON schema |
| Frontend | Vitest, Testing Library, MSW, Playwright |
| Hiệu năng | k6, Lighthouse CI |
| Bảo mật | OWASP ZAP, gitleaks, CodeQL, Trivy, `npm audit`, `dotnet list package --vulnerable` |
| Email | MailHog (bắt email, kiểm tra nội dung HTML) |

## 5. Tiêu chí vào / ra

**Vào:** build xanh, migration chạy được, seed dữ liệu thành công, môi trường có đủ phụ thuộc.

**Ra (cho phép phát hành):**

- 100% test P1 đạt; ≥ 95% test P2 đạt, các lỗi còn lại có phương án xử lý.
- Không còn lỗi mức Critical/High mở.
- Đạt mọi NFR có mức `Must` trong [nfr.md](../01_architecture/nfr.md).
- Ma trận truy vết [05_traceability_matrix.md](../05_traceability_matrix.md) không có FR nào thiếu test.

## 6. Quy ước ghi kết quả

Cột trạng thái được thêm khi thực thi: `Chưa test` · `Đạt` · `Lỗi` · `Bị chặn` · `Không áp dụng`. Lỗi ghi kèm mã issue và ảnh chụp/log.
