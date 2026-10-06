# SRS 06 — Notification Service (`NTF`)

> Kênh cảnh báo đa dạng: Email (SMTP) và Webhook (Slack / Teams / Discord / Generic có ký HMAC), kèm throttle, retry và báo cáo hằng ngày.
> Liên quan: [SRS Incident](05_incident.md) · [api_gateway_security.md §5 API7](../01_architecture/api_gateway_security.md)

---

## 1. Mục đích & phạm vi

Nhận sự kiện sự cố, chọn kênh phù hợp theo mức độ và bộ lọc node, dựng nội dung tiếng Việt, gửi đi và ghi nhận kết quả. Mọi việc gửi là **bất đồng bộ** — không làm chậm đường ống giám sát (khác v1 gửi email ngay trong scheduler).

## 2. Yêu cầu chức năng

### 2.1 Quản lý kênh

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-NTF-001 | ADMIN tạo kênh cảnh báo loại `EMAIL` hoặc `WEBHOOK` với tên, đích nhận, mức severity tối thiểu và trạng thái bật/tắt. | Must |
| FR-NTF-002 | Kênh `WEBHOOK` có `format` ∈ {`SLACK`,`TEAMS`,`DISCORD`,`GENERIC`} và secret HMAC tùy chọn. | Must |
| FR-NTF-003 | ADMIN sửa/xóa/bật-tắt kênh. | Must |
| FR-NTF-004 | ADMIN gửi thử một kênh (`test`) và nhận kết quả (thành công/lỗi + độ trễ). | Must |
| FR-NTF-005 | Kênh có thể lọc theo node hoặc tag (chỉ nhận cảnh báo của nhóm node nhất định). | Should |
| FR-NTF-006 | ADMIN cấu hình SMTP (host, port, TLS, tài khoản, mật khẩu, người gửi) qua UI; mật khẩu lưu mã hóa. | Must |
| FR-NTF-007 | Đích nhận và secret của kênh được mã hóa khi lưu và không trả về qua API (chỉ hiển thị dạng che: `o***@example.com`, `https://hooks.slack.com/…/***`). | Must |

### 2.2 Gửi cảnh báo

| ID | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-NTF-010 | Khi nhận `IncidentOpenedV1`/`IncidentEscalatedV1`, gửi tới mọi kênh đang bật có `minSeverity` ≤ severity và khớp bộ lọc node. | Must |
| FR-NTF-011 | Gửi thông báo khi sự cố được đóng (`IncidentResolvedV1`) nếu kênh bật tùy chọn “thông báo khi đóng”. | Should |
| FR-NTF-012 | Email chứa: tên node, loại sự cố, mức độ, mô tả, giá trị đo và ngưỡng, thời điểm, bảng CPU/RAM/Disk có màu theo mức, khuyến nghị xử lý, liên kết tới trang sự cố. | Must |
| FR-NTF-013 | Webhook gửi payload theo `format`; `GENERIC` dùng payload chuẩn của SOE kèm header `X-SOE-Signature` = `HMAC-SHA256(body, secret)` và `X-SOE-Timestamp`. | Must |
| FR-NTF-014 | Throttle: không gửi lại cảnh báo cho cùng `(incidentId, channelId, kind)` trong 30 phút (cấu hình được), trừ khi có nâng cấp severity. | Must |
| FR-NTF-015 | Retry khi lỗi tạm thời (5xx, timeout, SMTP 4xx): 3 lần backoff 1s → 4s → 16s; thất bại hẳn ⇒ ghi `DeliveryLogs` trạng thái `FAILED` và phát `AlertFailedV1`. | Must |
| FR-NTF-016 | Ghi `DeliveryLogs` cho mọi lần gửi (kể cả bị throttle) với `deliveryId` idempotent. | Must |
| FR-NTF-017 | Báo cáo hằng ngày lúc 08:00 giờ Việt Nam (cron cấu hình được) gửi tới kênh được đánh dấu “nhận báo cáo”: số node đang giám sát, số node cảnh báo/nguy cấp, số sự cố mở, sự cố mới trong 24h, MTTR. | Must |
| FR-NTF-018 | ADMIN xem lịch sử gửi có lọc theo kênh/trạng thái/thời gian và gửi lại (resend) một bản ghi thất bại. | Should |
| FR-NTF-019 | Khi kênh thất bại liên tiếp 10 lần, tự tắt kênh và cảnh báo ADMIN (chống spam vào endpoint hỏng). | Should |
| FR-NTF-020 | Gộp cảnh báo (digest): nếu > 20 sự cố mở trong 5 phút, gửi một email tổng hợp thay vì gửi rời. | Could |

## 3. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-NTF-001 | Mức severity xếp hạng: `WARNING` < `CRITICAL`. Kênh `minSeverity = CRITICAL` không nhận cảnh báo WARNING. |
| BR-NTF-002 | Mặc định hệ thống: sự cố WARNING **không** gửi email (tránh spam — kế thừa hành vi v1), CRITICAL luôn gửi. Có thể đổi bằng cấu hình kênh. |
| BR-NTF-003 | `deliveryId = hash(incidentId, channelId, eventKind, escalationSeq)` — bảo đảm không gửi trùng khi message được xử lý lại. |
| BR-NTF-004 | Nội dung email/webhook **không chứa** credential, host key, token hay đường dẫn nội bộ. |
| BR-NTF-005 | Webhook chỉ gửi tới `https://` tới địa chỉ công khai; chặn IP riêng (`10/8`, `172.16/12`, `192.168/16`), loopback, link-local (`169.254/16`), IPv6 ULA; không đi theo redirect; đọc tối đa 8 KB phản hồi; timeout 5 giây. |
| BR-NTF-006 | Timestamp trong chữ ký webhook lệch quá 5 phút ⇒ bên nhận nên từ chối (tài liệu hóa cho bên tích hợp). |
| BR-NTF-007 | Thay đổi cấu hình SMTP phải gửi thử thành công trước khi lưu (hoặc lưu kèm cảnh báo rõ ràng). |

## 4. Nội dung thông báo

### 4.1 Email (HTML + phần text thay thế)

```
Tiêu đề: [SOE] NGUY CẤP — prod-web-01 — Disk 91.2%

┌────────────────────────────────────────────┐
│ 🚨 NGUY CẤP · prod-web-01                  │   ← màu theo mức độ
├────────────────────────────────────────────┤
│ Loại sự cố : Dung lượng đĩa cao            │
│ Mô tả      : Disk / đạt 91.2% (ngưỡng 90%) │
│ Phát hiện  : 23/09/2026 15:30:12 (GMT+7)   │
│ Lần tái diễn: 4                            │
│                                            │
│ Thông số hiện tại                          │
│   CPU     42.5%   🟢                        │
│   RAM     71.8%   🟡                        │
│   Disk    91.2%   🔴                        │
│                                            │
│ Khuyến nghị: dọn log cũ, xóa file tạm,     │
│ mở rộng dung lượng hoặc chuyển bớt dữ liệu.│
│                                            │
│ [ Xem chi tiết sự cố ]                     │
└────────────────────────────────────────────┘
```

Màu: < 80% xanh `#2e7d32`, 80–89% cam `#f57c00`, ≥ 90% đỏ `#d32f2f` (giữ quy ước v1).

### 4.2 Webhook `GENERIC`

```json
{
  "event": "incident.opened",
  "severity": "CRITICAL",
  "occurredAt": "2026-09-23T08:30:12Z",
  "node": { "id": "0192b…", "name": "prod-web-01", "host": "192.168.1.10" },
  "incident": {
    "id": "0192c…", "type": "DISK_HIGH",
    "description": "Disk / đạt 91.2% (ngưỡng nguy cấp 90%)",
    "metricValue": 91.2, "thresholdValue": 90, "occurrenceCount": 4
  },
  "metrics": { "cpuPercent": 42.5, "memoryPercent": 71.8, "diskPercent": 91.2 },
  "actionUrl": "https://soe.example.com/app/incidents/0192c…"
}
```
Header: `Content-Type: application/json`, `X-SOE-Event: incident.opened`, `X-SOE-Timestamp: 1790000000`, `X-SOE-Signature: sha256=…`, `User-Agent: SmartOpsEngine/3.0`.

`SLACK`/`TEAMS`/`DISCORD` dùng formatter riêng (`IWebhookPayloadFormatter`) sinh định dạng bản địa của từng nền tảng.

## 5. Hợp đồng API

| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/api/v1/alert-channels` | ADMIN | Danh sách (đích nhận đã che) |
| POST | `/api/v1/alert-channels` | ADMIN | Tạo kênh → 201 |
| PUT | `/api/v1/alert-channels/{id}` | ADMIN | Sửa (để trống secret = giữ nguyên) |
| PUT | `/api/v1/alert-channels/{id}/status` | ADMIN | Bật/tắt |
| DELETE | `/api/v1/alert-channels/{id}` | ADMIN | Xóa → 204 |
| POST | `/api/v1/alert-channels/{id}/test` | ADMIN | Gửi thử → `{ success, latencyMs, error }`; rate limit 5/phút |
| GET | `/api/v1/alert-deliveries?channelId=&status=&from=&to=&page=` | ADMIN | Lịch sử gửi |
| POST | `/api/v1/alert-deliveries/{id}/resend` | ADMIN | Gửi lại |
| GET/PUT | `/api/v1/system-config/smtp` | ADMIN | Cấu hình SMTP (mật khẩu chỉ ghi, không đọc) |
| GET/PUT | `/api/v1/system-config/daily-report` | ADMIN | Bật/tắt + giờ gửi |

```json
// POST /alert-channels
{
  "name": "Slack #ops-alerts", "type": "WEBHOOK", "format": "SLACK",
  "target": "https://hooks.slack.com/services/T000/B000/XXXX",
  "secret": "…", "minSeverity": "WARNING",
  "notifyOnResolve": true, "isEnabled": true,
  "nodeFilter": { "tags": [{ "key": "env", "value": "prod" }] }
}
```

Mã lỗi: `SOE-NTF-400` (dữ liệu sai), `SOE-NTF-409` (trùng tên kênh), `SOE-NTF-422` (URL bị chặn do trỏ mạng nội bộ), `SOE-NTF-503` (SMTP không khả dụng khi gửi thử).

## 6. Validate

| Trường | Quy tắc |
|---|---|
| `name` | bắt buộc, 1–128, unique |
| `type` | `EMAIL` \| `WEBHOOK` |
| `format` | bắt buộc khi `WEBHOOK` |
| `target` (email) | RFC 5322, ≤ 256; cho phép danh sách ≤ 10 địa chỉ |
| `target` (webhook) | `https://`, ≤ 2048, host công khai (BR-NTF-005) |
| `secret` | 16–256 ký tự khi có |
| `minSeverity` | `WARNING` \| `CRITICAL` |
| `nodeFilter` | ≤ 20 node hoặc ≤ 10 tag |
| SMTP `host` | hostname hợp lệ; `port` ∈ {25, 465, 587, 2525} hoặc 1–65535; `fromEmail` hợp lệ |

## 7. Sự kiện

**Tiêu thụ:** `IncidentOpenedV1`, `IncidentEscalatedV1`, `IncidentResolvedV1`, `UserLockedV1` (tùy chọn), `NodeDeletedV1` (dọn bộ lọc).
**Phát:** `AlertDispatchedV1`, `AlertFailedV1`, `DailyReportSentV1`, `ChannelAutoDisabledV1`.

## 8. Phía Frontend

**Màn hình:** `AlertChannels`, phần SMTP & báo cáo trong `SystemConfig`, toast realtime toàn cục.

| ID | Yêu cầu |
|---|---|
| FR-NTF-FE-001 | Danh sách kênh: tên, loại (badge), đích nhận đã che, mức tối thiểu, trạng thái bật/tắt, lần gửi gần nhất và tỷ lệ thành công 24h. |
| FR-NTF-FE-002 | Modal tạo/sửa kênh đổi trường theo loại (email ↔ webhook), validate zod, cảnh báo ngay nếu URL không phải HTTPS hoặc trỏ IP nội bộ. |
| FR-NTF-FE-003 | Nút “Gửi thử” hiện kết quả trong modal (thành công + độ trễ, hoặc lỗi cụ thể), khóa nút 12 giây sau mỗi lần thử. |
| FR-NTF-FE-004 | Secret nhập một chiều; khi sửa hiển thị `••••••••` và chỉ gửi khi người dùng nhập mới. |
| FR-NTF-FE-005 | Trang lịch sử gửi: bộ lọc kênh/trạng thái/thời gian, hiển thị lý do lỗi rút gọn, nút gửi lại cho bản ghi thất bại. |
| FR-NTF-FE-006 | Cấu hình SMTP: form đầy đủ, nút “Kiểm tra kết nối SMTP” trước khi lưu; mật khẩu không bao giờ hiển thị lại. |
| FR-NTF-FE-007 | Toast realtime khi có sự cố mới: đỏ cho CRITICAL, vàng cho WARNING, có nút “Xem chi tiết”; không hiện quá 3 toast cùng lúc (gộp “và N sự cố khác”). |
| FR-NTF-FE-008 | Cảnh báo trực quan khi một kênh bị tự tắt do lỗi liên tiếp. |

## 9. Bảo mật riêng

- Chống SSRF theo BR-NTF-005 (đối chiếu OWASP API7): resolve DNS rồi kiểm tra IP thực tế trước khi kết nối, chặn redirect, giới hạn thời gian và kích thước phản hồi.
- Secret và đích nhận mã hóa AES-256-GCM; log chỉ ghi `channelId`, không ghi URL đầy đủ.
- Gửi thử giới hạn 5 lần/phút/người, ghi audit (chống dùng hệ thống làm công cụ dò quét mạng).
- Email dùng STARTTLS bắt buộc; từ chối chứng chỉ không hợp lệ.

## 10. Phi chức năng & rủi ro

| Hạng mục | Nội dung |
|---|---|
| Hiệu năng | Độ trễ từ `IncidentOpenedV1` đến khi gửi xong p95 ≤ 15 giây (đóng góp vào NFR-PERF-010 ≤ 60 giây tổng) |
| Tin cậy | Tỷ lệ gửi thành công sau retry ≥ 99%; message thất bại nằm ở DLQ, có runbook |
| Rủi ro | Nhà cung cấp SMTP giới hạn tốc độ → hàng đợi riêng cho email, tối đa 10 email/giây, có digest khi bão sự cố |
| Rủi ro | Cấu hình sai kênh gây lộ thông tin ra ngoài → nội dung không chứa dữ liệu nhạy cảm, đích nhận cần ADMIN và có audit |
