# TC-03 — Monitoring Service (`MON`)

> SRS: [03_monitoring.md](../02_srs/03_monitoring.md) · Use case: [UC-03_monitoring.md](../03_usecases/UC-03_monitoring.md)

## 1. Scheduler & hàng đợi

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-MON-INT-001 | Phát lệnh quét theo chu kỳ | 5 node active, scheduler bật | Chạy một chu kỳ | interval 60s (test) | Đúng 5 `CheckNodeV1` trên queue `monitoring.commands.check-node`, mỗi node một message | Functional | P1 | FR-MON-002 |
| TC-MON-INT-002 | Không quét node đã tắt | 3 active + 2 inactive | Chạy chu kỳ | — | Chỉ 3 message được phát | Functional | P1 | FR-MON-002 |
| TC-MON-INT-003 | Hai instance scheduler không quét trùng | 2 replica chạy đồng thời | Chạy 3 chu kỳ | — | Mỗi chu kỳ mỗi node đúng 1 message (Quartz cluster lock) | Reliability | P1 | FR-MON-004, NFR-AVL-006 |
| TC-MON-INT-004 | Chu kỳ riêng của node | Node A interval 60s, node B 300s | Chạy 5 phút | — | A được quét 5 lần, B 1 lần | Functional | P2 | FR-MON-003 |
| TC-MON-INT-005 | Message chứa đúng metric được bật | Node tắt CPU | Chạy chu kỳ | — | `metrics = ["memory","disk"]` | Functional | P2 | FR-MON-006 |
| TC-MON-INT-006 | Message quá hạn bị bỏ qua | Message tạo cách đây 400s, TTL 300s | Worker nhận | — | Bỏ qua, không SSH, ghi log Information | Reliability | P2 | FR-MON-016 |
| TC-MON-INT-007 | Đồng bộ read model khi tạo node | Bus chạy | Phát `NodeCreatedV1` | — | `MonitoredNodes` có bản ghi mới; node được quét ở chu kỳ kế tiếp | Integration | P1 | FR-MON-001 |
| TC-MON-INT-008 | Đồng bộ khi xóa node | Node có trong read model | Phát `NodeDeletedV1` | — | Node bị loại khỏi lịch, không còn message quét | Integration | P1 | FR-MON-001 |
| TC-MON-INT-009 | Tắt scheduler | Scheduler đang bật | `PUT /system-config/scheduler {enabled:false}`, chờ 2 chu kỳ | — | Không có message nào được phát; audit `SCHEDULER_TOGGLED` | Functional | P1 | FR-MON-013 |
| TC-MON-INT-010 | Đổi chu kỳ không cần restart | interval 300s | Đổi thành 60s | — | Chu kỳ kế tiếp áp dụng ngay giá trị mới | Functional | P1 | FR-GW-027 |
| TC-MON-INT-011 | RabbitMQ tạm ngừng | Broker dừng 2 phút | Chạy chu kỳ rồi bật lại broker | — | Message nằm trong outbox và được phát khi broker trở lại; không mất lệnh quét | Reliability | P1 | NFR-AVL-004 |

## 2. Worker & thu thập SSH

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-MON-INT-012 | Thu metric thành công | `node-ok` | Gửi `CheckNodeV1` | — | Phát `MetricCollectedV1` với cpu/memory/disk trong 0–100, `durationMs` > 0; `CheckRuns.outcome = Success` | Functional | P1 | FR-MON-006, 011 |
| TC-MON-INT-013 | Worker lấy credential từ Inventory | Inventory chạy | Quét một node | — | Có đúng một lời gọi `/internal/nodes/{id}/credentials`; audit `CREDENTIAL_ACCESSED` có `checkId` | Security | P1 | FR-MON-007 |
| TC-MON-INT-014 | Credential không đi qua queue | — | Bắt message trên RabbitMQ | — | `CheckNodeV1` và `MetricCollectedV1` không chứa trường credential nào | Security | P1 | ADR-04 |
| TC-MON-INT-015 | Timeout kết nối | `node-timeout` | Gửi lệnh quét | — | Kết thúc ≈ 10 giây, `NodeUnreachableV1` với `failureKind=ConnectTimeout` | Reliability | P1 | FR-MON-008 |
| TC-MON-INT-016 | Timeout lệnh | Máy chủ giả lập treo lệnh | Gửi lệnh quét | — | Hủy sau 30 giây, `failureKind=CommandTimeout`; phiên SSH được đóng | Reliability | P1 | FR-MON-008 |
| TC-MON-INT-017 | Sai xác thực | `node-authfail` | Gửi lệnh quét | — | `failureKind=AuthFailed`; thông điệp lỗi không chứa mật khẩu | Security | P1 | FR-MON-011 |
| TC-MON-INT-018 | Host key khác bản ghim | `node-hostkey` | Gửi lệnh quét | — | Ngắt trước khi xác thực; `failureKind=HostKeyMismatch` | Security | P1 | FR-MON-009 |
| TC-MON-INT-019 | Retry lỗi tạm thời | Máy chủ từ chối 2 lần đầu | Gửi lệnh quét | — | Worker thử lại tối đa 2 lần rồi thành công; chỉ một `MetricCollectedV1` | Reliability | P2 | FR-MON-010 |
| TC-MON-INT-020 | Kết quả không phân tích được | Lệnh trả chuỗi rác | Gửi lệnh quét | — | Metric tương ứng `null` (không phải 0/-1), các metric khác vẫn có giá trị | Functional | P1 | BR-MON-002 |
| TC-MON-INT-021 | Giới hạn kết nối đồng thời | 50 message cùng lúc, limit 8 | Theo dõi phiên SSH | — | Tối đa 8 phiên mở đồng thời trên một worker | Reliability | P2 | FR-MON-014 |
| TC-MON-INT-022 | Node bị xóa giữa chừng | Xóa node sau khi phát lệnh | Worker xử lý | — | Bỏ qua, không lỗi, không phát event | Reliability | P2 | BR-MON-004 |
| TC-MON-INT-023 | Xử lý lại message (idempotent) | — | Gửi cùng `CheckNodeV1` 3 lần | — | Không tạo 3 snapshot trùng `(nodeId, collectedAt)`; nghiệp vụ không bị nhân đôi | Reliability | P1 | NFR-AVL-003 |
| TC-MON-INT-024 | Worker bị kill giữa chừng | Đang xử lý message | `docker kill` worker | — | Message chưa ack quay lại queue và được worker khác xử lý; không mất lệnh | Reliability | P1 | NFR-AVL-002 |
| TC-MON-INT-025 | Inventory không phản hồi | Dừng Inventory | Gửi lệnh quét | — | Circuit breaker mở, message retry theo chính sách, cảnh báo phát sinh; không rơi vào vòng lặp nóng | Reliability | P1 | SRS §10 |
| TC-MON-UNIT-001 | Phân tích kết quả `df` | — | Gọi parser | `"85"` | `diskPercent = 85` | Functional | P1 | BR-MON-002 |
| TC-MON-UNIT-002 | Phân tích `/proc/stat` hai mẫu | — | Gọi parser với 2 mẫu | mẫu chuẩn | Giá trị CPU đúng theo công thức delta | Functional | P1 | SRS §4 |
| TC-MON-UNIT-003 | RAM dùng cột `available` | — | Parser `free` | mẫu có/không cột available | Tính đúng cả hai trường hợp (có fallback) | Functional | P2 | SRS §4 |
| TC-MON-UNIT-004 | Giá trị ngoài 0–100 | — | Parser trả 150 | — | Bị từ chối, trả `null` + cảnh báo | Validation | P2 | BR-MON-002 |
| TC-MON-UNIT-005 | Lệnh không ghép chuỗi từ input | — | Node có `diskMountPath = "/data"` | — | Lệnh sinh ra bọc nháy đơn đúng cách; ký tự nguy hiểm đã bị chặn từ validate | Security | P1 | BR-MON-001 |
| TC-MON-UNIT-006 | Hợp đồng `IMetricCollector` | — | Chạy `MetricCollectorContractTests` cho SSH & LOCAL | — | Cả hai hiện thực tuân thủ: trả `null` đúng cách, tôn trọng `CancellationToken`, ném đúng loại exception | Functional | P2 | SOLID/LSP |

## 3. API check-now & giao diện

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-MON-API-001 | Check-now thành công | OPERATOR, node active | `POST /nodes/{id}/check-now` | — | 202 + `checkId`; message có `reason=Manual`, `requestedBy` | Functional | P1 | FR-MON-005 |
| TC-MON-API-002 | Check-now node đang tắt | Node inactive | như trên | — | 409 `SOE-MON-409` | Validation | P2 | UC-MON-02/E1 |
| TC-MON-API-003 | Rate limit theo node | Vừa gọi check-now | Gọi lại sau 5 giây | — | 429 kèm `Retry-After` | Security | P1 | FR-MON-005 |
| TC-MON-API-004 | VIEWER gọi check-now | Đăng nhập VIEWER | như trên | — | 403 | Security | P1 | NFR-SEC-008 |
| TC-MON-API-005 | Lịch sử lần quét | Node đã quét ≥ 3 lần | `GET /nodes/{id}/check-runs?limit=20` | — | 200; mới nhất trước; có `outcome`, `durationMs`, `failureKind` | Functional | P2 | FR-MON-012 |
| TC-MON-API-006 | Trạng thái giám sát | — | `GET /monitoring/status` | — | 200 với `schedulerEnabled`, `defaultIntervalSeconds`, `activeNodeCount`, `queueDepth`, `lastCycleDurationMs` | Functional | P2 | SRS §6 |
| TC-MON-E2E-001 | Bấm “Kiểm tra ngay” | OPERATOR ở Node Detail | Bấm nút | — | Nút chuyển trạng thái đang kiểm tra và khóa 30 giây; khi có kết quả, chỉ số cập nhật và hiện toast | Functional | P1 | FR-MON-FE-001 |
| TC-MON-E2E-002 | Thông báo khi bị giới hạn | Vừa bấm kiểm tra | Bấm lại ngay | — | Hiện “Vui lòng đợi {n} giây trước khi kiểm tra lại” | UI/UX | P2 | FR-MON-FE-005 |
| TC-MON-E2E-003 | Bảng lần quét gần đây | Node có lần quét lỗi | Mở Node Detail | — | Hiển thị thời gian, kết quả, thời lượng, loại lỗi bằng tiếng Việt | UI/UX | P2 | FR-MON-FE-003 |
| TC-MON-E2E-004 | Thẻ trạng thái giám sát | Scheduler tắt | Mở Dashboard | — | Hiển thị “Giám sát đang tạm dừng” nổi bật | UI/UX | P2 | FR-MON-FE-002 |
| TC-MON-E2E-005 | Cấu hình chu kỳ | ADMIN ở SystemConfig | Đổi chu kỳ thành 30 giây | — | Bị chặn bởi validate (60–3600); đổi thành 120 giây thì lưu thành công kèm xác nhận | Validation | P1 | FR-MON-FE-004 |
