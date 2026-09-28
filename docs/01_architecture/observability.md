# Quan sát hệ thống (Observability)

---

## 1. Ba trụ cột

| Trụ cột | Công nghệ | Nơi lưu |
|---|---|---|
| Log | Serilog (JSON) + OpenTelemetry Logs | Seq (dev) / Elasticsearch hoặc Loki (prod), giữ 30 ngày |
| Trace | OpenTelemetry .NET (ASP.NET Core, HttpClient, EF Core, MassTransit instrumentation) | Jaeger / Tempo, sampling 10% + 100% cho request lỗi |
| Metric | OpenTelemetry Metrics → Prometheus | Prometheus + Grafana, giữ 90 ngày |

Mọi tín hiệu đều mang `correlation_id`, `trace_id`, `service.name`, `service.version`, `deployment.environment`.

## 2. Log

**Quy ước:**

```json
{
  "@t": "2026-09-23T08:30:12.345Z",
  "@l": "Warning",
  "@mt": "Ngưỡng bị vượt: node {NodeName} disk {Value}% >= {Threshold}%",
  "NodeId": "b21a…", "NodeName": "prod-web-01", "Value": 91.2, "Threshold": 90,
  "correlation_id": "0HMV9…", "trace_id": "4bf92f…", "service.name": "soe-incident"
}
```

| Mức | Dùng khi |
|---|---|
| `Debug` | Chi tiết chẩn đoán, **tắt ở production** |
| `Information` | Sự kiện nghiệp vụ: node tạo, sự cố mở/đóng, email gửi, lần quét hoàn tất |
| `Warning` | Vượt ngưỡng, retry, SSH timeout lần đầu, 429 |
| `Error` | Xử lý message thất bại sau retry, lỗi DB, gửi cảnh báo thất bại hẳn |
| `Fatal` | Không khởi động được (thiếu secret, không kết nối DB) |

**Cấm ghi:** mật khẩu, private key, passphrase, access/refresh token, cookie, HMAC secret, nội dung header `Authorization`. Thực thi bằng Serilog destructuring policy + enricher lọc, và test `TC-GW-SEC-*` kiểm tra log không chứa chuỗi bí mật.

## 3. Trace

Span bắt buộc: HTTP vào (Gateway → service), publish/consume message, truy vấn DB, gọi SSH, gọi SMTP/webhook.

```
GET /api/v1/nodes                         (gateway)
└─ GET /nodes                             (inventory.api)
   └─ SELECT Nodes                        (EF Core)

CheckNodeV1 consume                       (monitoring.worker)
├─ GET /internal/nodes/{id}/credentials   (inventory)
├─ ssh.connect + exec df/free/proc        (custom span, attr: node.id, ssh.duration_ms)
└─ publish MetricCollectedV1
   ├─ consume metrics.metric-collected
   └─ consume incident.metric-collected
```

Trace nối liền qua message nhờ MassTransit truyền `traceparent` trong header.

## 4. Metric ứng dụng (Prometheus)

| Metric | Loại | Nhãn | Dùng để |
|---|---|---|---|
| `soe_http_request_duration_seconds` | histogram | service, route, method, status | SLO độ trễ API |
| `soe_check_duration_seconds` | histogram | collector_type, outcome | Thời gian một lần quét |
| `soe_check_total` | counter | outcome (success/failed), failure_kind | Tỷ lệ quét lỗi |
| `soe_scan_cycle_coverage_ratio` | gauge | — | % node active được quét trong chu kỳ (NFR-SCL-001) |
| `soe_queue_messages` | gauge | queue | Độ sâu hàng đợi (từ RabbitMQ exporter) |
| `soe_message_consume_duration_seconds` | histogram | consumer, result | Hiệu năng consumer |
| `soe_dlq_messages` | gauge | queue | Cảnh báo khi > 0 |
| `soe_incident_open_count` | gauge | severity | Sức khỏe hạ tầng đang giám sát |
| `soe_alert_dispatch_total` | counter | channel_type, status | Tin cậy kênh cảnh báo |
| `soe_alert_latency_seconds` | histogram | — | Từ `collectedAt` đến lúc gửi cảnh báo (NFR-PERF-010) |
| `soe_login_failed_total` | counter | reason | Phát hiện brute-force |
| `soe_signalr_connections` | gauge | instance | Scale Realtime |

## 5. Health check

| Endpoint | Nội dung | Dùng bởi |
|---|---|---|
| `/health/live` | Tiến trình còn sống (không kiểm tra phụ thuộc) | Liveness probe |
| `/health/ready` | DB, RabbitMQ, Redis (tùy service) | Readiness probe, YARP active health check |
| `/health/startup` | Migration đã áp dụng | Startup probe |

Health check **không** lộ chi tiết lỗi ra ngoài; chi tiết chỉ có trong log.

## 6. Dashboard Grafana đề xuất

1. **Tổng quan hệ thống:** RPS, tỷ lệ lỗi 5xx, p95 độ trễ theo service, pod đang chạy.
2. **Đường ống giám sát:** độ sâu queue, số worker, coverage chu kỳ quét, thời gian quét p50/p95, tỷ lệ SSH lỗi theo `failure_kind`.
3. **Sự cố & cảnh báo:** số sự cố mở theo severity, độ trễ cảnh báo, tỷ lệ gửi thất bại theo kênh, DLQ.
4. **Bảo mật:** đăng nhập thất bại, tài khoản bị khóa, 401/403/429 theo route.
5. **Hạ tầng:** CPU/RAM pod, SQL Server (batch requests, wait, dung lượng DB), RabbitMQ (publish/ack rate).

## 7. Cảnh báo vận hành (Alertmanager)

| Cảnh báo | Điều kiện | Mức |
|---|---|---|
| `SoeApiErrorRateHigh` | 5xx > 2% trong 5 phút | P2 |
| `SoeApiLatencyHigh` | p95 `/api/v1/**` > 500 ms trong 10 phút | P3 |
| `SoeQueueBacklog` | `soe_queue_messages{queue="monitoring.commands.check-node"}` > 1000 trong 5 phút | P2 |
| `SoeDlqNotEmpty` | `soe_dlq_messages` > 0 trong 5 phút | P2 |
| `SoeScanCoverageLow` | `soe_scan_cycle_coverage_ratio` < 0.95 trong 2 chu kỳ | P1 |
| `SoeAlertDispatchFailing` | tỷ lệ `status="failed"` > 10% trong 15 phút | P1 |
| `SoeSchedulerStalled` | không có `CheckNodeV1` nào trong 2 chu kỳ | P1 |
| `SoeLoginBruteForce` | `soe_login_failed_total` tăng > 50 trong 5 phút từ một IP | P2 |
| `SoeDbSpace` | dung lượng DB còn < 15% | P2 |

## 8. SLO

| SLO | Mục tiêu | Cửa sổ | Nguồn đo |
|---|---|---|---|
| Sẵn sàng API (2xx/3xx/4xx hợp lệ) | 99,5% | 30 ngày | `soe_http_request_duration_seconds` |
| Độ trễ đọc p95 | ≤ 300 ms | 30 ngày | như trên |
| Độ phủ chu kỳ quét | ≥ 99% node active/chu kỳ | 7 ngày | `soe_scan_cycle_coverage_ratio` |
| Độ trễ cảnh báo p95 | ≤ 60 s | 7 ngày | `soe_alert_latency_seconds` |
| Tỷ lệ gửi cảnh báo thành công | ≥ 99% (sau retry) | 30 ngày | `soe_alert_dispatch_total` |

Vi phạm SLO liên tiếp 2 cửa sổ ⇒ dừng phát hành tính năng mới, ưu tiên khắc phục (error budget policy).

## 9. Runbook rút gọn

| Sự cố vận hành | Các bước |
|---|---|
| **Queue dồn** | 1) Xem Grafana “Đường ống giám sát”; 2) kiểm tra worker pod (OOM? restart?); 3) kiểm tra Inventory `/health/ready` (worker phụ thuộc để lấy credential); 4) tăng `maxReplicaCount` tạm thời; 5) nếu do node hỏng hàng loạt → tạm tắt giám sát nhóm node đó |
| **DLQ có message** | 1) Đọc message + exception trong header `MT-Fault-Message`; 2) sửa nguyên nhân; 3) shovel `<queue>_error` → `<queue>`; 4) xác nhận `soe_dlq_messages` về 0 |
| **Không nhận được email** | 1) Xem `DeliveryLogs` status/error; 2) gửi thử qua `POST /alert-channels/{id}/test`; 3) kiểm tra SMTP credential trong secret; 4) kiểm tra throttle (có thể bị chặn do trùng sự cố) |
| **Scheduler không chạy** | 1) Kiểm tra bảng `QRTZ_TRIGGERS` (trạng thái `ERROR`/`PAUSED`); 2) kiểm tra 2 pod scheduler và cluster lock; 3) resume trigger; 4) kiểm tra `system-config/scheduler.enabled` |
| **Nghi lộ credential** | 1) Xoay khóa AES (thêm keyId mới, re-encrypt nền); 2) đổi mật khẩu/khóa SSH trên máy chủ đích; 3) tra `AuditEntries` các lần đọc `/internal/credentials`; 4) thu hồi toàn bộ refresh token |
