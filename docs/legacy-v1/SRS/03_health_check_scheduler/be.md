# 03 — Health Check Scheduler — Backend

> **Trạng thái:** `[BE v1.0 ✅]` Disk check hoạt động. CPU/RAM check `[BE v2.0 🔜]` kế hoạch.

---

## Tổng quan

`HealthCheckScheduler` là lớp trung tâm điều phối toàn bộ quá trình giám sát:
1. Lấy danh sách Node `active = true` từ DB.
2. Với mỗi Node: đọc Disk usage (SSH hoặc Local JVM API).
3. So sánh với ngưỡng → tạo Incident + gửi alert nếu cần.

**Class:** `com.soe.scheduler.HealthCheckScheduler`  
**Dependencies:** `NodeRepository`, `IncidentLogRepository`, `SshService`, `OutlookAlertService`, `LocalMetricsService`

---

## Job 1: Kiểm tra Disk định kỳ

```java
@Scheduled(
    fixedDelayString = "${smartops.scheduler.disk-check-interval-ms:300000}",
    initialDelay = 60_000
)
public void runDiskHealthCheck()
```

- **`fixedDelay`** (không phải `fixedRate`): Lần chạy tiếp theo chỉ bắt đầu sau khi lần trước **hoàn thành**. Tránh race condition nếu số Node lớn và SSH timeout.
- **`initialDelay = 60s`**: Chờ Spring Boot khởi động đầy đủ (DB connection, bean wiring) trước lần chạy đầu.
- Mặc định 5 phút, cấu hình qua `application.properties`.

**Luồng thực thi:**
```
activeNodes = nodeRepository.findByActiveTrue()
for each node in activeNodes:
    try:
        checkDiskUsage(node)
    catch Exception:
        log.error(...)   ← Không re-throw, tiếp tục Node khác
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

## Logic kiểm tra từng Node — `checkDiskUsage(Node node)`

```
Node.host = "127.0.0.1" hoặc "localhost"?
    ├── Đúng → localHealthCheckService.getPrimaryDiskUsagePercent()
    │           Đọc trực tiếp JVM API (Windows: C:\, Linux: /)
    │           Không cần SSH, không cần credentials
    └── Sai  → sshService.executeCommand(node, CMD_DISK_USAGE)
                Kết nối SSH, chạy lệnh shell

CMD_DISK_USAGE = "df -h / | awk 'NR==2 {print $5}' | tr -d '%'"
Output: "85" (string nguyên, không có ký tự %)

parseIntSafely(rawOutput):
    → Integer.parseInt(value.replace("%","").trim())
    → Trả -1 nếu fail → log WARN → skip Node

diskUsage >= 90% → handleCriticalDisk(node, usage)
diskUsage >= 80% → handleWarningDisk(node, usage)
diskUsage < 80%  → log INFO, không action
```

**Ngưỡng (hardcoded — [TODO ⚠️] cần đọc từ `@Value`):**
```java
private static final int DISK_CRITICAL_THRESHOLD = 90;
private static final int DISK_WARNING_THRESHOLD  = 80;
```

---

## Xử lý khi vượt ngưỡng

### DISK_CRITICAL (>= 90%)

```java
private void handleCriticalDisk(Node node, int usagePercent) {
    String issue = "Disk usage CRITICAL: " + usagePercent + "% (ngưỡng: 90%)";
    String resolution = "Cần xem xét ngay: dọn log cũ, xóa temp files, mở rộng dung lượng.";

    outlookAlertService.sendIncidentReport(node.getName(), issue, resolution);  // Gửi email
    saveIncidentLog(node, "DISK_CRITICAL", issue, resolution, "OPEN");         // Ghi DB
}
```

### DISK_WARNING (80–89%)

```java
private void handleWarningDisk(Node node, int usagePercent) {
    String issue = "Disk usage WARNING: " + usagePercent + "% (ngưỡng: 80%)";
    String resolution = "Đang theo dõi. Sẽ cảnh báo nếu vượt 90%.";

    // Chỉ ghi log — KHÔNG gửi email (tránh spam)
    saveIncidentLog(node, "DISK_WARNING", issue, resolution, "MONITORING");
}
```

### SSH_FAILURE

```java
private void handleSshFailure(Node node, SshService.SshExecutionException e) {
    String issue = "Không thể kết nối SSH — Server có thể đã down hoặc unreachable";
    String resolution = "Kiểm tra network, firewall, và trạng thái server vật lý.";

    outlookAlertService.sendIncidentReport(node.getName(), issue, resolution);
    saveIncidentLog(node, "SSH_FAILURE", issue, resolution, "OPEN");
}
```

**[TODO ⚠️]:** Method `handleSshFailure()` đã có trong code nhưng chưa được gọi. `checkDiskUsage()` catch `Exception` chung, không có `catch (SshService.SshExecutionException e)` riêng để gọi `handleSshFailure()`. Cần sửa lại.

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
| **CPU**  | `top -bn1 \| grep 'Cpu(s)' \| awk '{print $2}' \| cut -d'%' -f1`        | `"42.5"` *(định nghĩa nhưng chưa dùng)* |
| **RAM**  | `free \| awk 'NR==2{printf "%.0f", $3/$2*100}'`                           | `"75"` *(định nghĩa nhưng chưa dùng)* |

---

## Kế hoạch v2.0 `[BE v2.0 🔜]`

| Tính năng                | Mô tả                                                                 |
| :----------------------- | :-------------------------------------------------------------------- |
| Kiểm tra CPU + RAM       | Gọi `CMD_CPU_LOAD` và `CMD_RAM_USAGE` trong `checkDiskUsage()`       |
| Ngưỡng đọc từ `@Value`   | Bỏ hardcode, thêm `@Value("${smartops.threshold.disk-critical:90}")` |
| Fix SSH_FAILURE handler  | Thêm `catch (SshExecutionException e) { handleSshFailure(...) }`     |
| Dedup incidents          | Check `node_id + type + status=OPEN` trước khi `saveIncidentLog()`   |
| ShedLock                 | `@SchedulerLock(name="healthCheckJob", lockAtMostFor="4m")`           |
| SSH Connection Pool      | Session reuse thay vì tạo mới mỗi lần                                |
| Parallel scan            | `ThreadPoolTaskExecutor` để scan nhiều Node đồng thời                |
| Lưu Node_Metrics         | Sau mỗi chu kỳ thành công, insert snapshot vào `Node_Metrics`        |
| Xóa metrics cũ           | Job cleanup `Node_Metrics` cũ hơn 90 ngày                            |

---

**Xem thêm:** [BE Incident Management](../04_incident_management/be.md) · [BE Alert Notifications](../05_alert_notifications/be.md) · [BE WebSocket](../06_websocket_realtime/be.md)
