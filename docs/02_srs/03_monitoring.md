# SRS 03 — Monitoring Service (`MON`)

> Lập lịch quét và thu thập metric qua SSH. Gồm hai tiến trình: **Scheduler API** và **Worker**.
> Liên quan: [messaging_events.md](../01_architecture/messaging_events.md) · [deployment_scaling.md §4](../01_architecture/deployment_scaling.md)

---

## 1. Mục đích & phạm vi

Thay thế `HealthCheckScheduler` monolith của v1 bằng hai thành phần tách biệt:

| Thành phần | Vai trò |
|---|---|
| `SOE.Monitoring.Api` (Scheduler) | Giữ read model node, chạy trigger Quartz clustered, phát `CheckNodeV1`, cung cấp API `check-now` và cấu hình chu kỳ quét |
| `SOE.Monitoring.Worker` | Tiêu thụ `CheckNodeV1`, lấy credential, chạy SSH, phân tích kết quả, phát `MetricCollectedV1` / `NodeUnreachableV1` |

Monitoring **không** đánh giá ngưỡng, **không** gửi cảnh báo, **không** lưu lịch sử metric — đó là việc của Incident, Notification, Metrics.

## 2. Yêu cầu chức năng

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-MON-001 | Đồng bộ read model `MonitoredNodes` từ các event của Inventory (tạo/sửa/xóa/bật tắt). | Must |
| FR-MON-002 | Mỗi chu kỳ (mặc định 300 giây, cấu hình được), phát `CheckNodeV1` cho mọi node `isActive` đến hạn quét. | Must |
| FR-MON-003 | Node có `checkIntervalSeconds` riêng được quét theo chu kỳ riêng (kiểm tra “đến hạn” dựa trên `LastCheckedAt`). | Should |
| FR-MON-004 | Khi chạy nhiều replica Scheduler, mỗi chu kỳ mỗi node chỉ sinh **một** lệnh quét (Quartz cluster lock). | Must |
| FR-MON-005 | OPERATOR+ kích hoạt quét ngay cho một node (`check-now`), giới hạn 1 lần/30 giây/node. | Must |
| FR-MON-006 | Worker thu thập CPU%, RAM%, Disk% theo cờ giám sát của node. | Must |
| FR-MON-007 | Worker lấy credential từ Inventory qua API nội bộ ngay trước khi kết nối, không lưu xuống đĩa. | Must |
| FR-MON-008 | Áp dụng timeout: kết nối 10 giây, mỗi lệnh 30 giây, tổng một lần quét tối đa 45 giây. | Must |
| FR-MON-009 | Kiểm tra host key: khác fingerprint đã ghim ⇒ hủy kết nối và phát `NodeUnreachableV1` với `failureKind = HostKeyMismatch`. | Must |
| FR-MON-010 | Thất bại tạm thời (timeout, mạng) được retry 2 lần trong cùng message trước khi báo lỗi. | Must |
| FR-MON-011 | Phát `MetricCollectedV1` khi thành công (metric không thu được để `null`), `NodeUnreachableV1` khi thất bại. | Must |
| FR-MON-012 | Ghi `CheckRuns` (thời gian, kết quả, loại lỗi, worker instance) phục vụ chẩn đoán; giữ 30 ngày. | Should |
| FR-MON-013 | ADMIN bật/tắt toàn bộ scheduler và đổi chu kỳ mặc định qua API cấu hình (có hiệu lực không cần restart). | Must |
| FR-MON-014 | Giới hạn số kết nối SSH đồng thời trên mỗi worker (mặc định 8) để bảo vệ tài nguyên. | Must |
| FR-MON-015 | Hỗ trợ nhiều loại collector qua `IMetricCollector` (`SSH` v3; `LOCAL` cho môi trường dev/test). | Should |
| FR-MON-016 | Bỏ qua message quá hạn (`requestedAt` cũ hơn một chu kỳ) để tránh quét dồn sau sự cố. | Must |

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-MON-001 | Lệnh chạy trên máy chủ đích là **hằng số**, không ghép chuỗi từ dữ liệu người dùng, trừ `diskMountPath` đã được validate và bọc trong dấu nháy đơn. |
| BR-MON-002 | Giá trị metric hợp lệ là 0–100 (làm tròn 2 chữ số). Kết quả không phân tích được ⇒ `null`, ghi cảnh báo, **không** ghi 0 hay -1 (khác v1). |
| BR-MON-003 | Một `checkId` chỉ tạo tối đa một `MetricCollectedV1` hoặc một `NodeUnreachableV1`. |
| BR-MON-004 | Node đang tắt giám sát hoặc đã xóa ⇒ Worker bỏ qua message và không báo lỗi. |
| BR-MON-005 | `check-now` không làm thay đổi lịch quét định kỳ. |
| BR-MON-006 | Nếu `MonitoredNodes` chưa có node (read model trễ), Worker gọi Inventory để lấy thông tin, không tự ý bỏ qua. |
| BR-MON-007 | Credential trong bộ nhớ worker bị xóa ngay sau khi tạo phiên SSH; tuyệt đối không ghi log/exception. |

## 4. Lệnh thu thập metric

| Metric | Lệnh | Phân tích |
|---|---|---|
| Disk | `df -Pk '<mountPath>' \| awk 'NR==2 {print $5}' \| tr -d '%'` | Số nguyên 0–100 |
| CPU | Đọc `/proc/stat` hai lần cách 1 giây, tính `100 * (delta_busy / delta_total)` | Chính xác hơn công thức một lần của v1 |
| RAM | `free -k \| awk '/^Mem:/ {printf "%.2f", ($2-$7)/$2*100}'` | Dùng `available` (cột 7) thay vì `used` để không tính cache là đã dùng |

Nếu `free` không có cột `available` (hệ cũ) ⇒ fallback `($2-$4-$6-$7)/$2`. Mọi lệnh chạy qua một phiên SSH duy nhất cho mỗi lần quét.

## 5. Thiết kế Worker

```
CheckNodeConsumer.Consume(CheckNodeV1)
 ├─ Kiểm tra message quá hạn (BR/FR-MON-016) → bỏ qua
 ├─ Đọc MonitoredNodes (read model) → nếu thiếu, gọi Inventory
 ├─ Nếu node không active/đã xóa → bỏ qua (FR-MON-004 của Inventory)
 ├─ SemaphoreSlim(8).WaitAsync(ct)                       // FR-MON-014
 ├─ credentials = InventoryClient.GetCredentials(nodeId) // Polly: retry 3, circuit breaker
 ├─ collector = CollectorFactory.For(node.CollectorType) // IMetricCollector
 ├─ snapshot = await collector.CollectAsync(node, credentials, ct)  // timeout tổng 45s
 │     └─ kiểm tra fingerprint host key trước khi xác thực
 ├─ Ghi CheckRuns (outcome, durationMs, workerInstance)
 └─ publish MetricCollectedV1 | NodeUnreachableV1  (outbox)
```

Phân loại lỗi (`failureKind`): `ConnectTimeout`, `AuthFailed`, `HostKeyMismatch`, `CommandTimeout`, `ParseError`, `Unknown`.

## 6. Hợp đồng API

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/api/v1/nodes/{id}/check-now` | OPERATOR+ | `202 Accepted` + `{ checkId }`; 404 nếu node không tồn tại; 409 `SOE-MON-409` nếu node đang tắt giám sát; 429 nếu gọi quá nhanh |
| GET | `/api/v1/nodes/{id}/check-runs?limit=20` | VIEWER+ | Lịch sử các lần quét gần nhất (chẩn đoán) |
| GET | `/api/v1/monitoring/status` | VIEWER+ | `{ schedulerEnabled, defaultIntervalSeconds, activeNodeCount, lastCycleStartedAt, lastCycleDurationMs, queueDepth, workerCount }` |
| PUT | `/api/v1/system-config/scheduler` | ADMIN | `{ "enabled": true, "defaultIntervalSeconds": 300 }` — áp dụng ngay, ghi audit |

## 7. Sự kiện

**Tiêu thụ:** `NodeCreatedV1`, `NodeUpdatedV1`, `NodeMonitoringToggledV1`, `NodeDeletedV1` (queue `monitoring.node-sync`), `CheckNodeV1` (queue `monitoring.commands.check-node`).

**Phát:** `CheckNodeV1` (command), `MetricCollectedV1`, `NodeUnreachableV1`.

## 8. Phía Frontend

| ID | Yêu cầu |
|---|---|
| FR-MON-FE-001 | Nút “Kiểm tra ngay” ở trang Nodes và Node Detail (OPERATOR+): hiện trạng thái đang quét, khóa nút 30 giây, thông báo khi nhận kết quả qua realtime. |
| FR-MON-FE-002 | Thẻ trạng thái giám sát trên Dashboard: chu kỳ hiện tại, thời điểm chu kỳ gần nhất, số node quét lỗi. |
| FR-MON-FE-003 | Trang Node Detail hiện bảng “Lần quét gần đây” (thời gian, kết quả, thời lượng, loại lỗi) để chẩn đoán. |
| FR-MON-FE-004 | Màn hình System Config (ADMIN): bật/tắt scheduler, đổi chu kỳ mặc định (60–3600 giây) có xác nhận. |
| FR-MON-FE-005 | Khi `check-now` trả 429, hiện thông báo “Vui lòng đợi {n} giây trước khi kiểm tra lại”. |

## 9. Bảo mật riêng

- Egress SSH chỉ được phép từ pod worker (NetworkPolicy), tới dải mạng khai báo trước.
- Không bao giờ `StrictHostKeyChecking=no`: fingerprint phải khớp bản ghim (khác v1).
- Credential chỉ tồn tại trong RAM, xóa ngay sau khi dùng; exception được bọc lại để không chứa credential.
- Worker chạy user non-root, read-only filesystem, không ghi khóa tạm ra đĩa.

## 10. Phi chức năng & rủi ro

| Hạng mục | Nội dung |
|---|---|
| Hiệu năng | Một lần quét p95 ≤ 5 giây (NFR-PERF-005); độ phủ chu kỳ ≥ 99% (NFR-SCL-001) |
| Mở rộng | Scale worker bằng KEDA theo độ sâu queue; 2 worker đủ cho 500 node |
| Rủi ro | Máy chủ đích treo làm chiếm slot đồng thời → timeout cứng 45 giây + giới hạn semaphore; Inventory lỗi → circuit breaker, message quay lại queue và retry theo chính sách |
| Ghi nhận | `CheckRuns` + metric `soe_check_total{outcome}`, `soe_check_duration_seconds` |
