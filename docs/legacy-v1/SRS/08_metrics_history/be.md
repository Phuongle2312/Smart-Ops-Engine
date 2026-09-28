# 08 — Lịch sử Metrics — Backend

> **Trạng thái:** `[BE v2.0 🔜]` Chưa triển khai. Entity và API endpoint chưa có trong source code.

---

## Mục đích

Lưu trữ snapshot Disk/CPU/RAM của mỗi Node sau mỗi chu kỳ quét thành công. Dữ liệu time-series này phục vụ:
- Biểu đồ lịch sử 24h / 7d / 30d trên trang Node Detail.
- Phân tích xu hướng để dự đoán khi nào Disk đầy.
- Audit retrospective sau sự cố.

---

## Entity: `Node_Metrics`

**Bảng SQL Server:**

| Cột          | Kiểu             | Ràng buộc         | Mô tả                                         |
| :----------- | :--------------- | :---------------- | :-------------------------------------------- |
| `id`         | `BIGINT`         | PK, IDENTITY      |                                               |
| `node_id`    | `BIGINT`         | FK → `Nodes(id)`  | Liên kết Node                                 |
| `disk_pct`   | `DECIMAL(5,2)`   | NULL              | % Disk tại thời điểm quét (0.00–100.00)       |
| `cpu_pct`    | `DECIMAL(5,2)`   | NULL              | % CPU tại thời điểm quét — null nếu SSH lỗi  |
| `ram_pct`    | `DECIMAL(5,2)`   | NULL              | % RAM tại thời điểm quét — null nếu SSH lỗi  |
| `checked_at` | `DATETIME2`      | NOT NULL          | Thời điểm thu thập                            |

**Index bắt buộc:**
```sql
CREATE INDEX idx_metrics_node_time ON Node_Metrics(node_id, checked_at DESC);
```

---

## Repository: `NodeMetricsRepository`

```java
interface NodeMetricsRepository extends JpaRepository<NodeMetrics, Long> {

    // Lấy metrics theo range thời gian, sắp xếp cũ → mới
    List<NodeMetrics> findByNodeIdAndCheckedAtBetweenOrderByCheckedAtAsc(
        Long nodeId, LocalDateTime from, LocalDateTime to
    );

    // Xóa metrics cũ hơn N ngày (dùng trong cleanup job)
    void deleteByCheckedAtBefore(LocalDateTime cutoff);
}
```

---

## Tích hợp vào HealthCheckScheduler

Sau khi `checkDiskUsage()` thành công, thêm lưu snapshot:

```java
// Trong HealthCheckScheduler.checkDiskUsage():
nodeMetricsRepository.save(NodeMetrics.builder()
    .node(node)
    .diskPct(BigDecimal.valueOf(diskUsagePercent))
    .cpuPct(cpuUsage != null ? BigDecimal.valueOf(cpuUsage) : null)
    .ramPct(ramUsage != null ? BigDecimal.valueOf(ramUsage) : null)
    .checkedAt(LocalDateTime.now())
    .build()
);
```

---

## API Endpoint

### GET `/api/nodes/{id}/metrics?range=24h`

**Quyền:** `ROLE_VIEWER` và `ROLE_ADMIN`.

**Query param `range`:**

| Value | Khoảng thời gian       | Số điểm dữ liệu dự kiến |
| :---- | :--------------------- | :----------------------- |
| `24h` | 24 giờ qua             | ~288 (mỗi 5 phút)        |
| `7d`  | 7 ngày qua             | ~2016                    |
| `30d` | 30 ngày qua            | ~8640                    |

**Logic:**
```java
LocalDateTime to = LocalDateTime.now();
LocalDateTime from = switch (range) {
    case "7d"  -> to.minusDays(7);
    case "30d" -> to.minusDays(30);
    default    -> to.minusHours(24);   // "24h"
};
List<NodeMetrics> metrics = nodeMetricsRepository
    .findByNodeIdAndCheckedAtBetweenOrderByCheckedAtAsc(nodeId, from, to);
```

**Response 200:**
```json
{
  "nodeId": 1,
  "nodeName": "prod-web-01",
  "range": "24h",
  "metrics": [
    { "checkedAt": "2026-06-24T07:00:00", "diskPct": 85.20, "cpuPct": 45.10, "ramPct": 72.30 },
    { "checkedAt": "2026-06-24T07:05:00", "diskPct": 85.30, "cpuPct": 52.40, "ramPct": 73.00 }
  ]
}
```

**Response 404:** Node không tồn tại.

---

## Cleanup Job — Xóa dữ liệu cũ

```java
@Scheduled(cron = "0 0 2 * * *")  // 02:00 AM mỗi ngày
public void cleanupOldMetrics() {
    LocalDateTime cutoff = LocalDateTime.now().minusDays(
        metricsRetentionDays  // @Value("${smartops.metrics.retention-days:90}")
    );
    nodeMetricsRepository.deleteByCheckedAtBefore(cutoff);
    log.info("[CLEANUP] Đã xóa Node_Metrics cũ hơn {} ngày.", metricsRetentionDays);
}
```

---

## Ghi chú mở rộng

> Nếu số Node tăng lên > 100 và chu kỳ quét là 5 phút, trong 90 ngày sẽ có:
> `100 nodes × 12 records/h × 24h × 90d = 2,592,000 rows`
>
> SQL Server xử lý tốt với index, nhưng nếu scale lớn hơn, có thể migrate sang:
> - **TimescaleDB** (PostgreSQL extension cho time-series)
> - **InfluxDB** (purpose-built time-series database)
> - **Azure Table Storage** (cost-effective cho large volumes)

---

**Xem thêm:** [FE Metrics History](fe.md) · [BE Health Check Scheduler](../03_health_check_scheduler/be.md)
