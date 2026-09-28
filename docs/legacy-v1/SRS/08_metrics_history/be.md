# 08 — Lịch sử Metrics — Backend

> **Trạng thái:** `[BE v1.0 ✅]` Entity, Repository, API endpoints hoàn tất. Cleanup job `[BE v2.0 🔜]`.

---

## Mục đích

Lưu trữ snapshot Disk/CPU/RAM của mỗi Node sau mỗi chu kỳ quét thành công. Dữ liệu time-series này phục vụ:
- Biểu đồ lịch sử 24h / 7d / 30d trên trang Node Detail.
- Phân tích xu hướng để dự đoán khi nào Disk đầy.
- Audit retrospective sau sự cố.

---

## Entity: `NodeMetric`

**Bảng SQL Server (tự tạo bởi Hibernate JPA):**

| Cột                    | Kiểu         | Ràng buộc         | Mô tả                                       |
| :--------------------- | :----------- | :---------------- | :------------------------------------------ |
| `id`                   | `BIGINT`     | PK, IDENTITY      |                                             |
| `node_id`              | `BIGINT`     | FK → `nodes(id)`  | Liên kết Node, NOT NULL                     |
| `disk_usage_percent`   | `INT`        | NULL              | % Disk (0–100)                              |
| `cpu_usage_percent`    | `INT`        | NULL              | % CPU (0–100), -1 nếu SSH lỗi               |
| `memory_usage_percent` | `INT`        | NULL              | % RAM (0–100), -1 nếu SSH lỗi               |
| `recorded_at`          | `DATETIME2`  | NOT NULL          | Thời điểm thu thập (auto tạo = LocalDateTime.now()) |

**Class:**
```java
@Entity @Table(name = "node_metrics")
public class NodeMetric {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "node_id", nullable = false)
    private Node node;
    
    private Integer diskUsagePercent;
    private Integer cpuUsagePercent;
    private Integer memoryUsagePercent;
    private LocalDateTime recordedAt;
}
```

**Index (tạo thủ công nếu cần tối ưu query):**
```sql
CREATE INDEX idx_node_metrics_time ON node_metrics(node_id, recorded_at DESC);
```

---

## Repository: `NodeMetricRepository`

```java
@Repository
public interface NodeMetricRepository extends JpaRepository<NodeMetric, Long> {

    // Lấy 50 metrics gần nhất của node, sắp xếp mới → cũ
    List<NodeMetric> findTop50ByNodeIdOrderByRecordedAtDesc(Long nodeId);
    
    // [v2.0 TODO] Lấy metrics theo range thời gian:
    // List<NodeMetric> findByNodeIdAndRecordedAtBetweenOrderByRecordedAtAsc(
    //     Long nodeId, LocalDateTime from, LocalDateTime to
    // );
    
    // [v2.0 TODO] Xóa metrics cũ hơn N ngày (cleanup job):
    // void deleteByRecordedAtBefore(LocalDateTime cutoff);
}
```

**Dùng trong HealthCheckScheduler:**
```java
// Sau khi collectAndSave() → record được lưu tự động
// Lấy lịch sử 50 records gần nhất:
List<NodeMetric> recent = nodeMetricRepository.findTop50ByNodeIdOrderByRecordedAtDesc(nodeId);
```

---

## Tích hợp vào HealthCheckScheduler

**Tự động:** `NodeMetricsService.collectAndSave()` gọi `nodeMetricRepository.save()` sau khi lấy được metrics 3 thông số.

```java
// Trong HealthCheckScheduler.checkAllMetrics():
NodeMetricsSnapshot snap = nodeMetricsService.collectAndSave(node);
// ↑ Tự động lưu record vào node_metrics + trả về snap
// Snapshot chứa: { diskPercent, cpuPercent, memoryPercent }

// Sau đó check ngưỡng & gửi alert nếu cần
if (snap.diskPercent() >= diskCritical) {
    outlookAlertService.sendMetricsAlert(node.getName(), snap, "DISK_CRITICAL", ...);
    saveIncidentLog(node, "DISK_CRITICAL", ...);
}
```

---

## API Endpoints

### 1. GET `/api/nodes/{id}/metrics`

**Quyền:** Không yêu cầu (v1.0 chưa có authentication).

**Mô tả:** Lấy 50 metrics gần nhất của node (mỗi 5 phút = ~4 giờ lịch sử).

**Response 200:**
```json
[
  {
    "id": 101,
    "nodeId": 1,
    "diskUsagePercent": 85,
    "cpuUsagePercent": 42,
    "memoryUsagePercent": 72,
    "recordedAt": "2026-06-30T14:30:00"
  },
  {
    "id": 100,
    "nodeId": 1,
    "diskUsagePercent": 84,
    "cpuUsagePercent": 38,
    "memoryUsagePercent": 70,
    "recordedAt": "2026-06-30T14:25:00"
  }
]
```

**Response 404:** Node không tồn tại.

---

### 2. POST `/api/nodes/{id}/check-now`

**Mô tả:** Trigger thu thập metrics ngay lập tức cho node cụ thể (thay vì chờ scheduler).

**Response 200:**
```json
{
  "nodeId": 1,
  "nodeName": "prod-web-01",
  "diskPercent": 85,
  "cpuPercent": 42,
  "memoryPercent": 72
}
```

---

### [v2.0 TODO] Endpoint range thời gian

```
GET /api/nodes/{id}/metrics?range=24h&limit=50
```

| Param   | Mô tả                      |
| :------ | :------------------------- |
| `range` | `24h` / `7d` / `30d` (mặc định `24h`) |
| `limit` | Số records tối đa (mặc định 50)       |

---

## Cleanup Job — Xóa dữ liệu cũ `[v2.0 TODO]`

```java
@Scheduled(cron = "0 0 2 * * *")  // 02:00 AM mỗi ngày
public void cleanupOldMetrics() {
    LocalDateTime cutoff = LocalDateTime.now().minusDays(90);
    // nodeMetricRepository.deleteByRecordedAtBefore(cutoff);
    log.info("[CLEANUP] Sẽ xóa NodeMetric cũ hơn 90 ngày.");
}
```

**[v2.0 TODO]:** Thêm method `deleteByRecordedAtBefore()` vào repository.

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
