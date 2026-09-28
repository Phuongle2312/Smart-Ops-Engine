# 03 — Health Check Scheduler — Backend

> **Trạng thái:** `[BE v1.5 ✅]` Disk/CPU/RAM check hoạt động, lưu lịch sử. ShedLock & Pool `[BE v2.0 🔜]`.

---

## Tổng quan

`HealthCheckScheduler` là lớp trung tâm điều phối toàn bộ quá trình giám sát:
1. Lấy danh sách Node `active = true` từ DB.
2. Với mỗi Node: đọc **Disk + CPU + RAM** (SSH hoặc Local JVM API) qua `NodeMetricsService`.
3. Lưu snapshot vào bảng `node_metrics`.
4. So sánh 3 thông số với ngưỡng → tạo Incident + gửi alert nếu cần.

**Class:** `com.soe.scheduler.HealthCheckScheduler`  
**Dependencies:** `NodeRepository`, `IncidentLogRepository`, `NodeMetricsService`, `OutlookAlertService`

---

## Job 1: Kiểm tra Disk/CPU/RAM định kỳ

```java
@Scheduled(
    fixedDelayString = "${smartops.scheduler.disk-check-interval-ms:300000}",
    initialDelay = 60_000
)
public void runDiskHealthCheck()
```

- **`fixedDelay`**: Lần chạy tiếp theo chỉ bắt đầu sau khi lần trước **hoàn thành**.
- **`initialDelay = 60s`**: Chờ Spring Boot khởi động đầy đủ.
- Mặc định 5 phút, cấu hình qua `application.properties`.

**Luồng thực thi:**
```
activeNodes = nodeRepository.findByActiveTrue()
for each node in activeNodes:
    try:
        checkAllMetrics(node)    // Thu thập disk + cpu + memory
    catch Exception:
        log.error(...)           // Lỗi SSH/network → gửi alert SSH_FAILURE
        continue to next node
```

---

## Job 2: Báo cáo hàng ngày

```java
@Scheduled(cron = "${smartops.scheduler.daily-report-cron:0 0 8 * * MON-FRI}")
public void runDailyReport()
```

- Mặc định 08:00 sáng thứ Hai – thứ Sáu.
- Đếm Incident `OPEN` bằng stream filter (không dùng COUNT query).
- Gọi `outlookAlertService.sendDailySummaryReport(activeCount, openCount)`.

**[TODO ⚠️]:** Dùng `COUNT` query thay vì `findAll().stream().filter(...)` để tránh load toàn bộ incidents vào memory.

---

## Logic kiểm tra từng Node — `checkAllMetrics(Node node)`

**Bước 1: Thu thập 3 metrics qua `NodeMetricsService.collectAndSave(node)`**

```
NodeMetricsService.collectAndSave(node):
  Node.host = "127.0.0.1" hoặc "localhost"?
    ├── Đúng → Đọc CPU/RAM/Disk từ JVM API (LocalMetricsService)
    └── Sai  → Kết nối SSH, chạy 3 lệnh Linux:
                • Disk: "df -h / | awk 'NR==2 {print $5}' | tr -d '%'"
                • CPU:  "grep 'cpu ' /proc/stat | awk '{u=$2+$4; t=...; print int(u/t*100)}'"
                • Mem:  "free | awk '/Mem:/ {printf \"%.0f\", $3/$2*100}'"
  
  Lưu NodeMetric record vào DB (node_id, disk%, cpu%, mem%, recordedAt)
  Trả về NodeMetricsSnapshot { diskPercent, cpuPercent, memoryPercent }
```

**Bước 2: So sánh ngưỡng & xử lý**

```java
snap = nodeMetricsService.collectAndSave(node);

// Disk
if (snap.diskPercent() >= diskCritical)        // Mặc định 90%
    → handleCriticalDisk()  → gửi email + incident OPEN
else if (snap.diskPercent() >= diskWarning)    // Mặc định 80%
    → log incident MONITORING (không gửi email)

// CPU
if (snap.cpuPercent() >= cpuCritical)          // Mặc định 85%
    → handleCriticalCpu()   → gửi email + incident OPEN

// Memory
if (snap.memoryPercent() >= memoryCritical)    // Mặc định 90%
    → handleCriticalMemory() → gửi email + incident OPEN
```

**Ngưỡng (đọc từ `@Value`, cấu hình trong `application.properties`):**
```java
@Value("${smartops.threshold.disk-warning:80}")
private int diskWarning;

@Value("${smartops.threshold.disk-critical:90}")
private int diskCritical;

@Value("${smartops.threshold.cpu-critical:85}")
private int cpuCritical;

@Value("${smartops.threshold.memory-critical:90}")
private int memoryCritical;
```

---

## Xử lý khi vượt ngưỡng

### DISK_CRITICAL (>= 90%)

```java
if (snap.diskPercent() >= diskCritical) {
    String issue = String.format("Disk usage CRITICAL: %d%% (ngưỡng: %d%%)", 
        snap.diskPercent(), diskCritical);
    String resolution = "Cần xem xét ngay: dọn log cũ, xóa temp files, mở rộng dung lượng.";
    
    outlookAlertService.sendMetricsAlert(node.getName(), snap, "DISK_CRITICAL", issue, resolution);
    saveIncidentLog(node, "DISK_CRITICAL", issue, resolution, "OPEN");
}
```

### DISK_WARNING (80–89%)

```java
if (snap.diskPercent() >= diskWarning) {
    String issue = String.format("Disk usage WARNING: %d%% (ngưỡng cảnh báo: %d%%)", 
        snap.diskPercent(), diskWarning);
    
    // Chỉ ghi log — KHÔNG gửi email (tránh spam)
    saveIncidentLog(node, "DISK_WARNING", issue, "Đang theo dõi...", "MONITORING");
}
```

### CPU_CRITICAL (>= 85%)

```java
if (snap.cpuPercent() >= cpuCritical) {
    String issue = String.format("CPU usage CRITICAL: %d%% (ngưỡng: %d%%)", 
        snap.cpuPercent(), cpuCritical);
    String resolution = "Kiểm tra tiến trình đang chiếm CPU cao, restart service hoặc scale up.";
    
    outlookAlertService.sendMetricsAlert(node.getName(), snap, "CPU_CRITICAL", issue, resolution);
    saveIncidentLog(node, "CPU_CRITICAL", issue, resolution, "OPEN");
}
```

### MEMORY_CRITICAL (>= 90%)

```java
if (snap.memoryPercent() >= memoryCritical) {
    String issue = String.format("Memory usage CRITICAL: %d%% (ngưỡng: %d%%)", 
        snap.memoryPercent(), memoryCritical);
    String resolution = "Kiểm tra memory leak, restart service hoặc tăng RAM.";
    
    outlookAlertService.sendMetricsAlert(node.getName(), snap, "MEMORY_CRITICAL", issue, resolution);
    saveIncidentLog(node, "MEMORY_CRITICAL", issue, resolution, "OPEN");
}
```

### SSH_FAILURE

```java
try {
    snap = nodeMetricsService.collectAndSave(node);
    // Check thresholds...
} catch (Exception e) {
    String issue = "Không thể thu thập metrics — Server có thể đã down hoặc unreachable";
    String resolution = "Kiểm tra network, firewall, và trạng thái server vật lý.";
    
    outlookAlertService.sendMetricsAlert(node.getName(), null, "SSH_FAILURE", issue, resolution);
    saveIncidentLog(node, "SSH_FAILURE", issue, resolution, "OPEN");
}
```

---

## SshService — Kết nối SSH

**Class:** `com.soe.service.SshService` · **Thư viện:** `com.github.mwiede:jsch:0.2.17`

Tạo session JSch mới cho mỗi lần gọi (không có connection pool):

```
1. Decrypt password: AesEncryptionUtil.decrypt(node.getPassword())
   → Plaintext chỉ tồn tại trong local scope

2. jsch.getSession(username, host, port)
   session.setPassword(plainPassword)
   session.setConfig("StrictHostKeyChecking", "no")  ← [TODO production: dùng known_hosts]
   session.setConfig("PreferredAuthentications", "password")
   session.connect(10_000ms)

3. Mở ChannelExec → chạy command → đọc stdout + stderr (BufferedReader UTF-8)

4. Polling channel.isClosed() tối đa 30_000ms

5. finally: session.disconnect() (luôn đóng)

6. Nếu JSchException → throw SshExecutionException (custom checked exception)
```

**Timeout constants:**
```java
CONNECT_TIMEOUT_MS = 10_000   // TCP + SSH handshake
COMMAND_TIMEOUT_MS = 30_000   // Chờ lệnh hoàn tất
```

---

## LocalMetricsService — Đọc máy cục bộ

**Class:** `com.soe.service.LocalMetricsService` · **API:** `com.sun.management.OperatingSystemMXBean`

Dùng khi `node.host` là `127.0.0.1` hoặc `localhost`:

| Method                         | Trả về      | Dùng trong Scheduler? |
| :----------------------------- | :---------- | :-------------------- |
| `getPrimaryDiskUsagePercent()` | `double`    | Có (disk check local) |
| `getCpuUsagePercent()`         | `double`    | Không (v2.0 kế hoạch) |
| `getRamInfo()`                 | `RamInfo`   | Không (v2.0 kế hoạch) |
| `getSystemSnapshot()`          | `SystemSnapshot` | Không            |

`getPrimaryDiskUsagePercent()`:
```java
String primaryPath = System.getProperty("os.name").toLowerCase().contains("win") ? "C:\\" : "/";
return getDiskInfo(primaryPath).usedPercent();   // java.io.File API
```

---

## Lưu Incident Log — `saveIncidentLog()`

```java
private void saveIncidentLog(Node node, String type, String issue, String resolution, String status) {
    try {
        IncidentLog log = IncidentLog.builder()
            .node(node).incidentType(type)
            .issueDescription(issue).resolutionAction(resolution)
            .status(status).detectedAt(LocalDateTime.now())
            .build();
        incidentLogRepository.save(log);
    } catch (Exception e) {
        log.error("Failed to save incident log for node '{}': {}", node.getName(), e.getMessage(), e);
        // Không re-throw: lỗi DB khi lưu log không được crash scheduler
    }
}
```

**[TODO ⚠️]:** Không có logic kiểm tra duplicate. Mỗi chu kỳ quét tạo một bản ghi mới kể cả khi sự cố cũ chưa xử lý. v2.0 cần kiểm tra tồn tại `node_id + incident_type + status=OPEN/MONITORING` trước khi tạo mới.

---

## Lệnh shell kiểm tra tài nguyên

| Resource | Command Shell                                                             | Output mẫu |
| :------- | :------------------------------------------------------------------------ | :--------- |
| **Disk** | `df -h / \| awk 'NR==2 {print $5}' \| tr -d '%'`                        | `"85"`     |
| **CPU**  | `grep 'cpu ' /proc/stat \| awk '{u=$2+$4; t=$2+$3+$4+$5+$6+$7+$8; print int(u/t*100)}'` | `"42"` |
| **RAM**  | `free \| awk '/Mem:/ {printf "%.0f", $3/$2*100}'`                       | `"75"`     |

**Lưu ý:** Các lệnh trên chạy được trên Linux/Unix. Nếu node là local (127.0.0.1), dùng `LocalMetricsService` với JVM API thay vì SSH.

---

## Triển khai v1.5 `[✅ HOÀN TẤT]`

| Tính năng                | Trạng thái    | Ghi chú                                                           |
| :----------------------- | :------------ | :---------------------------------------------------------------- |
| Kiểm tra CPU + RAM       | ✅ v1.5       | Thêm `NodeMetricsService` → gọi 3 lệnh Linux qua SSH             |
| Ngưỡng đọc từ `@Value`   | ✅ v1.5       | Thêm `@Value` cho `cpu-critical`, `memory-critical`, etc.        |
| Lưu Node_Metrics         | ✅ v1.5       | Entity `NodeMetric` → tự động insert sau mỗi `collectAndSave()`  |
| Email có bảng 3 metrics  | ✅ v1.5       | Thêm `sendMetricsAlert()` → hiển thị disk/cpu/mem đầy đủ         |

---

## Kế hoạch v2.0 `[BE v2.0 🔜]`

| Tính năng                | Mô tả                                                              |
| :----------------------- | :----------------------------------------------------------------- |
| Dedup incidents          | Check `node_id + type + status=OPEN` trước khi `saveIncidentLog()` |
| ShedLock                 | `@SchedulerLock(name="healthCheckJob", lockAtMostFor="4m")`        |
| SSH Connection Pool      | Session reuse thay vì tạo mới mỗi lần                             |
| Parallel scan            | `ThreadPoolTaskExecutor` để scan nhiều Node đồng thời             |
| Cleanup cũ metrics       | Job xóa `Node_Metrics` cũ hơn 90 ngày                             |
| WebSocket realtime       | Push metrics mới tới FE thay vì polling                           |

---

**Xem thêm:** [BE Incident Management](../04_incident_management/be.md) · [BE Alert Notifications](../05_alert_notifications/be.md) · [BE WebSocket](../06_websocket_realtime/be.md)
