# Monitoring Service (`MON`) — M2

> Trạng thái: 🔜 **Khung** — chưa hiện thực. Đặc tả: [docs/02_srs/03_monitoring.md](../../../../../docs/02_srs/03_monitoring.md)

## Phạm vi

Hai tiến trình tách biệt:

| Tiến trình | Vai trò |
|---|---|
| `SOE.Monitoring.Api` (Scheduler) | Giữ read model node, Quartz.NET clustered phát `CheckNodeV1` mỗi chu kỳ, API `check-now`, cấu hình scheduler |
| `SOE.Monitoring.Worker` | Tiêu thụ `CheckNodeV1` (competing consumers), lấy credential, chạy SSH, phát `MetricCollectedV1` / `NodeUnreachableV1` |

**Đây là điểm scale chính của hệ thống** — worker được KEDA tăng giảm theo độ sâu hàng đợi.

## Yêu cầu phụ trách

`FR-MON-001` … `FR-MON-016` · `FR-MON-FE-001` … `FR-MON-FE-005` · `BR-MON-001` … `BR-MON-007`

## Việc cần làm

- [ ] `SOE.Monitoring.Domain` — `MonitoredNode` (read model), `CheckRun`, phân loại `FailureKind`
- [ ] `SOE.Monitoring.Application` — `IMetricCollector` (port), điều phối lần quét, lệnh check-now
- [ ] `SOE.Monitoring.Infrastructure` — Quartz clustered, `SshMetricCollector` (SSH.NET), `InventoryClient` (Polly retry + circuit breaker), EF Core (`soe_monitoring` + bảng `QRTZ_*`)
- [ ] `SOE.Monitoring.Worker` — host riêng cho consumer, `SemaphoreSlim` giới hạn 8 kết nối SSH đồng thời
- [ ] Test: `docs/04_test_cases/TC-03_monitoring.md` (26 ca) + hợp đồng `IMetricCollector` chạy chung cho mọi hiện thực

## Bẫy đã biết

- Lệnh shell là **hằng số**, chỉ `diskMountPath` đã validate mới được nội suy (bọc nháy đơn).
- Metric không đọc được ⇒ `null`, **không** ghi 0 hay -1 như v1.
- Timeout cứng: kết nối 10s, lệnh 30s, tổng một lần quét 45s.
- Message quá hạn một chu kỳ thì bỏ, tránh quét dồn sau sự cố.
