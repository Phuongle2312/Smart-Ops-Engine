# 05 — Cảnh báo đa kênh — Backend

> **Trạng thái:** `[BE v1.5 ✅]` Email SMTP + metrics alert hoạt động. Webhook + Alert Channels `[BE v2.0 🔜]`.

---

## Kênh Email SMTP (v1.0)

**Class:** `com.soe.service.OutlookAlertService`

### Cấu hình SMTP (Office 365)

```properties
spring.mail.host=smtp.office365.com
spring.mail.port=587
spring.mail.username=your-email@yourdomain.com
spring.mail.password=your-email-password
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
spring.mail.properties.mail.smtp.starttls.required=true
```

> **[TODO ⚠️]:** `spring.mail.password` đang lưu plaintext trong `application.properties`. Phải đưa ra biến môi trường `MAIL_PASSWORD`.

### Method: `sendIncidentReport()` (Legacy — v1.0)

Được gọi bởi Scheduler v1.0 khi: `DISK_CRITICAL` hoặc `SSH_FAILURE`.

```
Tham số: nodeName, issue, resolution
Subject: [Smart Ops Engine] Incident Alert: {nodeName}
```

**HTML Template (màu đỏ `#d32f2f`), đơn giản không có metrics.**

---

### Method: `sendMetricsAlert()` (v1.5 ✅)

Được gọi bởi Scheduler v1.5 khi vượt ngưỡng: `DISK_CRITICAL`, `CPU_CRITICAL`, `MEMORY_CRITICAL`, hoặc `SSH_FAILURE`.

```java
public void sendMetricsAlert(String nodeName, NodeMetricsSnapshot metrics,
                              String alertType, String issue, String resolution)
```

**Tham số:**
- `nodeName`: Tên Node
- `metrics`: Object chứa `{ diskPercent, cpuPercent, memoryPercent }` hoặc `null` nếu SSH lỗi
- `alertType`: `"DISK_CRITICAL"`, `"CPU_CRITICAL"`, `"MEMORY_CRITICAL"`, `"SSH_FAILURE"`
- `issue`: Mô tả vấn đề (VD: "Disk usage CRITICAL: 95% (ngưỡng: 90%)")
- `resolution`: Khuyến nghị xử lý

**HTML Template:**
```
┌─────────────────────────────────────────┐
│  🚨 DISK_CRITICAL — prod-web-01        │  ← Header, màu theo alert type
├─────────────────────────────────────────┤
│ Server:          prod-web-01            │
│ Alert Type:      DISK_CRITICAL          │  ← text đỏ nếu CRITICAL
│ Mô tả:           Disk usage CRITICAL... │
│ Khuyến nghị:     Dọn log cũ...          │
│ Thời gian:       2026-06-30 14:30:00    │
│                                         │
│ Thông số hệ thống hiện tại:             │
│ ├─ CPU:    42%      ← xanh (< 80%)      │
│ ├─ Memory: 72%      ← xanh (< 80%)      │
│ └─ Disk:   95%      ← đỏ   (>= 90%)     │
├─────────────────────────────────────────┤
│ Smart Ops Engine — automated alert     │
└─────────────────────────────────────────┘
```

**Quy tắc màu sắc:**
- Disk/CPU/Memory < 80%: 🟢 xanh `#2e7d32`
- Disk/CPU/Memory 80–89%: 🟠 cam `#f57c00`
- Disk/CPU/Memory >= 90%: 🔴 đỏ `#d32f2f`
- Header: Màu theo `alertType` (CRITICAL → đỏ, SSH_FAILURE → đỏ)

### Method: `sendDailySummaryReport()` (v1.0)

Được gọi bởi Scheduler mỗi 08:00 sáng thứ Hai – thứ Sáu.

```
Tham số: activeNodesCount, openIncidentsCount
Subject: [Smart Ops Engine] Daily Health Report Summary
```

**HTML Template (màu xanh `#1976d2`):**

```
┌────────────────────────────────────────┐
│  📊 Daily Health Report Summary        │  ← Header xanh
├────────────────────────────────────────┤
│ Thời gian báo cáo:     {timestamp}     │
│ Node đang hoạt động:   {activeCount}   │
│ Sự cố chưa xử lý (OPEN): {openCount}  │  ← đỏ nếu > 0, xanh nếu = 0
│ Trạng thái hệ thống:   Cần chú ý / OK │
└────────────────────────────────────────┘
```

---

### Helper method: `buildMetricRows()` & `gauge()` (v1.5)

Được dùng bởi `sendMetricsAlert()` để sinh hàng bảng HTML cho metrics:

```java
private String buildMetricRows(NodeMetricsSnapshot m) {
    return gauge("CPU", m.cpuPercent())
            + gauge("Memory", m.memoryPercent())
            + gauge("Disk (/)", m.diskPercent());
}

private String gauge(String label, int percent) {
    if (percent < 0) return "<tr><td>" + label + "</td><td>N/A</td></tr>";
    String color = percent >= 90 ? "#d32f2f" : percent >= 80 ? "#f57c00" : "#2e7d32";
    return "<tr><td>" + label + "</td><td style='color:" + color + ";font-weight:bold'>"
            + percent + "%</td></tr>";
}
```

---

## API Endpoints

### POST `/api/test-email` (v1.0)

Gửi email test để kiểm tra cấu hình SMTP.

```
Response 200:
{
  "status": "SENT",
  "message": "Email đã được gửi thành công tới letriphuong23.12@gmail.com"
}
```

---

## Tóm tắt v1.5 `[✅ HOÀN TẤT]`

| Tính năng                    | Mô tả                                              |
| :--------------------------- | :------------------------------------------------- |
| `sendMetricsAlert()` method  | Email với bảng 3 metrics + màu theo mức độ        |
| HTML template cải thiện      | Hiển thị Disk/CPU/Memory trong email               |
| Helper methods               | `buildMetricRows()`, `gauge()` cho màu sắc động   |
| Integration với Scheduler    | Gọi từ `checkAllMetrics()` khi vượt ngưỡng        |

---

## Kênh Webhook `[BE v2.0 🔜]`

### Payload chuẩn hóa

```json
POST {webhook_url}
Headers:
  Content-Type: application/json
  X-SmartOps-Signature: HMAC-SHA256(payload_body, channel.secret)

Body:
{
  "event": "INCIDENT_CREATED",
  "severity": "CRITICAL",
  "node": { "id": 1, "name": "prod-web-01", "host": "192.168.1.50" },
  "incident": {
    "type": "DISK_CRITICAL",
    "description": "Disk 92%",
    "detectedAt": "2026-06-24T08:30:00"
  },
  "actionUrl": "https://smartops.example.com/incidents/12"
}
```

**Signature verification:** Bên nhận tính lại `HMAC-SHA256(body, secret)` và so sánh với header — xác thực webhook đến từ nguồn hợp lệ.

**Retry policy:** Tối đa 3 lần với exponential backoff (1s → 2s → 4s) nếu endpoint trả HTTP 5xx.

### Tương thích với các nền tảng phổ biến

| Platform    | Định dạng payload cần adapt                     |
| :---------- | :---------------------------------------------- |
| Slack       | `{"text": "...", "attachments": [...]}`         |
| MS Teams    | `{"@type": "MessageCard", "text": "..."}`       |
| Discord     | `{"content": "...", "embeds": [...]}`           |
| PagerDuty   | `{"routing_key": "...", "event_action": "..."}` |
| Generic     | Payload chuẩn trên (dùng cho custom integrations) |

---

## Entity: `Alert_Channels` `[BE v2.0 🔜]`

**Bảng SQL Server:**

| Cột            | Kiểu           | Ràng buộc                 | Mô tả                                                              |
| :------------- | :------------- | :------------------------ | :----------------------------------------------------------------- |
| `id`           | `BIGINT`       | PK, IDENTITY              |                                                                    |
| `name`         | `VARCHAR(100)` | NOT NULL                  | "Slack #alerts", "Manager Email"                                  |
| `type`         | `VARCHAR(20)`  | NOT NULL                  | `EMAIL` hoặc `WEBHOOK`                                             |
| `config_json`  | `TEXT`         | NOT NULL                  | `{"to":"email"}` hoặc `{"url":"...","secret":"..."}`              |
| `min_severity` | `VARCHAR(20)`  | NOT NULL, Default WARNING | Mức kích hoạt: `WARNING` hoặc `CRITICAL`                          |
| `is_enabled`   | `BIT`          | NOT NULL, Default 1       | Bật/tắt kênh                                                       |
| `created_at`   | `DATETIME2`    | NOT NULL                  |                                                                    |

### API Alert Channels

| Method | Endpoint                   | Auth  | Mô tả                         | Response    |
| :----- | :------------------------- | :---- | :---------------------------- | :---------- |
| GET    | `/api/alert-channels`      | Admin | Danh sách kênh                | `200`       |
| POST   | `/api/alert-channels`      | Admin | Thêm kênh mới                 | `201`       |
| PUT    | `/api/alert-channels/{id}` | Admin | Cập nhật cấu hình             | `200 / 404` |
| DELETE | `/api/alert-channels/{id}` | Admin | Xóa kênh                      | `204 / 404` |

### Logic phân phối khi có incident

```
AlertChannelDispatcher.dispatch(incidentType, severity):
  channels = alertChannelRepository.findByIsEnabledTrue()
  for channel in channels:
    if channel.minSeverity <= severity:
      if channel.type == "EMAIL":   emailService.send(channel.config, incident)
      if channel.type == "WEBHOOK": webhookService.post(channel.config, incident)
```

---

**Xem thêm:** [FE Alert Notifications](fe.md) · [BE Health Check Scheduler](../03_health_check_scheduler/be.md) · [BE System Config](../09_system_config/be.md)
