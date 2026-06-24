# 05 — Cảnh báo đa kênh — Backend

> **Trạng thái:** `[BE v1.0 ✅]` Email SMTP hoạt động. Webhook + Alert Channels `[BE v2.0 🔜]`.

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

### Method: `sendIncidentReport()`

Được gọi bởi Scheduler khi: `DISK_CRITICAL` hoặc `SSH_FAILURE`.

```
Tham số: nodeName, issue, resolution
Subject: [Smart Ops Engine] Incident Alert: {nodeName}
From: smartops.alert.recipient.email  ← [TODO: nên là no-reply@domain.com]
To:   smartops.alert.recipient.email  ← [TODO: nên là ops-team@domain.com]
```

**HTML Template (màu đỏ `#d32f2f`):**

```
┌─────────────────────────────┐
│  🚨 Incident Alert Report   │  ← Header đỏ
├─────────────────────────────┤
│ Server Name:  {nodeName}    │
│ Error Type:   {issue}       │  ← text đỏ đậm
│ Action Taken: {resolution}  │
│ Time:         {timestamp}   │
├─────────────────────────────┤
│ This is an automated msg... │  ← Footer
└─────────────────────────────┘
```

> **[TODO ⚠️]:** `From` và `To` hiện là cùng một địa chỉ email. Cần tách thành `mail.from` (bot address) và `mail.to` (recipient list).

### Method: `sendDailySummaryReport()`

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

## Endpoint Test Email (v1.0)

```
POST /api/test-email

→ Gửi email test với nodeName="TEST-NODE"
Response 200: { "status": "SENT", "message": "..." }
```

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
