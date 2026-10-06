# TC-06 — Notification Service (`NTF`)

> SRS: [06_notification.md](../02_srs/06_notification.md) · Use case: [UC-06_notification.md](../03_usecases/UC-06_notification.md)
> Môi trường: MailHog bắt email, endpoint webhook test ghi lại request.

## 1. Quản lý kênh (API)

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-NTF-API-001 | Tạo kênh email | ADMIN | `POST /alert-channels` | `{"name":"Email Ops","type":"EMAIL","target":"ops@example.com","minSeverity":"CRITICAL"}` | 201; response hiển thị đích dạng che `o***@example.com` | Functional | P1 | FR-NTF-001 |
| TC-NTF-API-002 | Tạo kênh webhook Slack | ADMIN | `POST /alert-channels` | type WEBHOOK, format SLACK, URL https hợp lệ, secret | 201; secret không xuất hiện trong response | Security | P1 | FR-NTF-002, 007 |
| TC-NTF-API-003 | Đích nhận & secret được mã hóa | Kênh vừa tạo | Đọc DB | — | `TargetCipher`, `SecretCipher` là nhị phân, không chứa plaintext | Security | P1 | FR-NTF-007 |
| TC-NTF-API-004 | Trùng tên kênh | Kênh đã tồn tại | `POST` cùng tên | — | 409 `SOE-NTF-409` | Validation | P2 | UC-NTF-02/E1 |
| TC-NTF-API-005 | Webhook không phải HTTPS | ADMIN | `POST` với `http://…` | — | 400/422 | Security | P1 | BR-NTF-005 |
| TC-NTF-API-006 | Webhook trỏ IP nội bộ | ADMIN | `POST` với `https://192.168.1.5/hook` | — | 422 `SOE-NTF-422` (chặn SSRF) | Security | P1 | BR-NTF-005, OWASP API7 |
| TC-NTF-API-007 | Webhook trỏ metadata cloud | ADMIN | `https://169.254.169.254/…` | — | 422 | Security | P1 | OWASP API7 |
| TC-NTF-API-008 | Email sai định dạng | ADMIN | `POST` target `abc@` | — | 400 `errors.target` | Validation | P1 | SRS §6 |
| TC-NTF-API-009 | Quá 10 địa chỉ email | ADMIN | `POST` với 11 địa chỉ | — | 400 | Validation | P3 | SRS §6 |
| TC-NTF-API-010 | Sửa kênh giữ nguyên secret | Kênh có secret | `PUT` không gửi secret | — | 200; secret cũ vẫn dùng được khi gửi thử | Functional | P1 | UC-NTF-02/A1 |
| TC-NTF-API-011 | Bật/tắt kênh | Kênh bật | `PUT /alert-channels/{id}/status` | `{isEnabled:false}` | 200; sự cố mới không gửi qua kênh này | Functional | P1 | FR-NTF-003 |
| TC-NTF-API-012 | Xóa kênh | — | `DELETE /alert-channels/{id}` | — | 204; audit `CHANNEL_DELETED` | Functional | P2 | FR-NTF-003 |
| TC-NTF-API-013 | OPERATOR quản lý kênh | OPERATOR | `GET /alert-channels` | — | 403 | Security | P1 | RBAC |
| TC-NTF-API-014 | Bộ lọc node/tag | Kênh có `nodeFilter` env=prod | Tạo/sửa kênh | — | 200; chỉ sự cố node prod được gửi (kiểm tra ở TC-INT-007) | Functional | P2 | FR-NTF-005 |
| TC-NTF-API-015 | Gửi thử email thành công | SMTP MailHog | `POST /alert-channels/{id}/test` | — | 200 `{success:true, latencyMs}`; MailHog nhận email tiếng Việt | Functional | P1 | FR-NTF-004 |
| TC-NTF-API-016 | Gửi thử webhook | Endpoint test chạy | như trên | — | 200; endpoint nhận POST có chữ ký hợp lệ | Functional | P1 | FR-NTF-004 |
| TC-NTF-API-017 | Gửi thử khi SMTP sai | Cấu hình SMTP sai mật khẩu | như trên | — | 503 `SOE-NTF-503` với lý do; không lộ mật khẩu | Security | P1 | UC-NTF-03/E1 |
| TC-NTF-API-018 | Rate limit gửi thử | ADMIN | Gọi 6 lần/phút | — | Lần 6 trả 429 | Security | P1 | OWASP API6 |
| TC-NTF-API-019 | Lịch sử gửi | Có bản ghi | `GET /alert-deliveries?status=FAILED` | — | 200; hiển thị lý do lỗi rút gọn, không chứa secret | Functional | P2 | FR-NTF-018 |
| TC-NTF-API-020 | Gửi lại bản ghi thất bại | Có bản ghi FAILED | `POST /alert-deliveries/{id}/resend` | — | 200/202; tạo bản ghi gửi mới; audit `ALERT_RESENT` | Functional | P3 | FR-NTF-018 |
| TC-NTF-API-021 | Cấu hình SMTP | ADMIN | `PUT /system-config/smtp` | host/port/tls/user/pass | 200; `GET` trả `hasPassword: true` nhưng **không** trả mật khẩu | Security | P1 | FR-NTF-006 |
| TC-NTF-API-022 | Cấu hình báo cáo hằng ngày | ADMIN | `PUT /system-config/daily-report` | `{enabled:true,sendAtLocal:"08:00"}` | 200; giờ sai định dạng (`25:00`) → 400 | Validation | P2 | FR-NTF-017 |

## 2. Gửi cảnh báo (Integration)

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-NTF-INT-001 | Gửi email khi sự cố CRITICAL | Kênh email bật, minSeverity WARNING | Publish `IncidentOpenedV1` CRITICAL | — | MailHog nhận email; tiêu đề `[SOE] NGUY CẤP — …`; có bảng CPU/RAM/Disk màu đúng; `DeliveryLogs = SENT` | Functional | P1 | FR-NTF-010, 012 |
| TC-NTF-INT-002 | Không gửi khi dưới minSeverity | Kênh minSeverity CRITICAL | Publish sự cố WARNING | — | Không gửi; ghi log Information | Functional | P1 | BR-NTF-001 |
| TC-NTF-INT-003 | Webhook Generic có chữ ký | Kênh webhook + secret | Publish sự cố | — | POST có `X-SOE-Signature` = HMAC-SHA256(body, secret) tính đúng, `X-SOE-Timestamp` trong 5 phút | Security | P1 | FR-NTF-013 |
| TC-NTF-INT-004 | Định dạng Slack | Kênh format SLACK | Publish sự cố | — | Payload đúng cấu trúc Slack (`text`/`blocks`) | Functional | P2 | FR-NTF-013 |
| TC-NTF-INT-005 | Định dạng Teams/Discord | Kênh tương ứng | Publish sự cố | — | Payload đúng chuẩn từng nền tảng | Functional | P3 | FR-NTF-013 |
| TC-NTF-INT-006 | Throttle trong 30 phút | Vừa gửi cảnh báo sự cố X | Publish lại sự kiện cùng loại cho X | — | Không gửi; `DeliveryLogs = SKIPPED_THROTTLED` | Functional | P1 | FR-NTF-014 |
| TC-NTF-INT-007 | Nâng cấp bỏ qua throttle | Đang throttle | Publish `IncidentEscalatedV1` | — | Vẫn gửi ngay | Functional | P1 | UC-NTF-01/A1 |
| TC-NTF-INT-008 | Bộ lọc node/tag | Kênh lọc env=prod | Publish sự cố node dev | — | Không gửi qua kênh đó | Functional | P2 | FR-NTF-005 |
| TC-NTF-INT-009 | Retry khi webhook 500 | Endpoint trả 500 hai lần rồi 200 | Publish sự cố | — | Gửi lại theo backoff, cuối cùng `SENT`, `attempts = 3` | Reliability | P1 | FR-NTF-015 |
| TC-NTF-INT-010 | Thất bại hẳn → DLQ | Endpoint luôn 500 | Publish sự cố | — | `DeliveryLogs = FAILED`, `AlertFailedV1` phát ra, message vào `_error` | Reliability | P1 | FR-NTF-015 |
| TC-NTF-INT-011 | Idempotent theo deliveryId | — | Publish cùng `IncidentOpenedV1` 3 lần | — | Chỉ gửi 1 email/webhook | Reliability | P1 | BR-NTF-003 |
| TC-NTF-INT-012 | Kênh tự tắt sau 10 lỗi | Endpoint luôn lỗi | Publish 10 sự cố | — | Kênh `isEnabled=false`, phát `ChannelAutoDisabledV1`, ADMIN được thông báo | Reliability | P2 | FR-NTF-019 |
| TC-NTF-INT-013 | Thông báo khi đóng sự cố | Kênh bật `notifyOnResolve` | Publish `IncidentResolvedV1` | — | Gửi thông báo “đã đóng”; kênh không bật thì không gửi | Functional | P2 | FR-NTF-011 |
| TC-NTF-INT-014 | Nội dung không chứa dữ liệu nhạy cảm | — | Kiểm tra email + webhook body | — | Không có mật khẩu, private key, host key, token, URL nội bộ | Security | P1 | BR-NTF-004 |
| TC-NTF-INT-015 | Digest khi bão sự cố | 25 sự cố trong 5 phút | Publish liên tiếp | — | Gửi một email tổng hợp thay vì 25 email rời | Reliability | P3 | FR-NTF-020 |
| TC-NTF-INT-016 | Báo cáo hằng ngày | Đến giờ cấu hình | Chạy job | — | Email tổng hợp có số node, sự cố mở, MTTR; phát `DailyReportSentV1`; chỉ một instance gửi | Functional | P1 | FR-NTF-017 |
| TC-NTF-INT-017 | Báo cáo khi không có sự cố | Không có sự cố mở | Chạy job | — | Vẫn gửi với thông điệp “Hệ thống hoạt động bình thường” | Functional | P2 | UC-NTF-04/A1 |
| TC-NTF-INT-018 | Độ trễ cảnh báo | — | Đo từ `collectedAt` tới lúc email tới MailHog | — | p95 ≤ 60 giây | Performance | P1 | NFR-PERF-010 |
| TC-NTF-SEC-001 | STARTTLS bắt buộc | SMTP không hỗ trợ TLS | Gửi email | — | Từ chối gửi, ghi lỗi rõ ràng; không gửi ở dạng không mã hóa | Security | P1 | SRS §9 |
| TC-NTF-SEC-002 | Không theo redirect webhook | Endpoint trả 302 tới IP nội bộ | Publish sự cố | — | Không đi theo redirect; ghi `FAILED` | Security | P1 | BR-NTF-005 |
| TC-NTF-SEC-003 | Giới hạn phản hồi webhook | Endpoint trả 10 MB | Publish sự cố | — | Chỉ đọc ≤ 8 KB, không treo, không parse nội dung | Security | P2 | OWASP API10 |
| TC-NTF-SEC-004 | Timeout webhook | Endpoint treo 30 giây | Publish sự cố | — | Hủy sau 5 giây, chuyển sang retry | Reliability | P1 | BR-NTF-005 |
| TC-NTF-SEC-005 | DNS rebinding | Hostname công khai phân giải về IP nội bộ | Publish sự cố | — | Kiểm tra IP sau khi resolve ⇒ chặn | Security | P2 | OWASP API7 |

## 3. Frontend

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-NTF-E2E-001 | Danh sách kênh | Có ≥ 3 kênh | Mở `/app/alert-channels` | — | Hiển thị tên, loại, đích đã che, mức tối thiểu, trạng thái, tỷ lệ thành công 24h | UI/UX | P1 | FR-NTF-FE-001 |
| TC-NTF-E2E-002 | Form đổi theo loại kênh | ADMIN | Chọn EMAIL rồi WEBHOOK | — | Trường hiển thị tương ứng; validate thay đổi theo loại | Functional | P1 | FR-NTF-FE-002 |
| TC-NTF-E2E-003 | Cảnh báo URL không an toàn | Modal mở | Nhập `http://10.0.0.5/hook` | — | Hiện lỗi ngay trên client trước khi gửi | Validation | P1 | FR-NTF-FE-002 |
| TC-NTF-E2E-004 | Gửi thử trong modal | Kênh tồn tại | Bấm “Gửi thử” | — | Hiển thị kết quả kèm độ trễ; nút khóa 12 giây | Functional | P2 | FR-NTF-FE-003 |
| TC-NTF-E2E-005 | Secret dạng một chiều | Sửa kênh có secret | Mở modal | — | Hiển thị `••••••••`; không gửi nếu không nhập mới | Security | P1 | FR-NTF-FE-004 |
| TC-NTF-E2E-006 | Lịch sử gửi | Có bản ghi lỗi | Mở tab lịch sử, lọc FAILED | — | Hiện lý do lỗi; nút gửi lại hoạt động | Functional | P3 | FR-NTF-FE-005 |
| TC-NTF-E2E-007 | Cấu hình SMTP | ADMIN | Nhập cấu hình, bấm kiểm tra rồi lưu | — | Kiểm tra thành công mới cho lưu (hoặc cảnh báo rõ); mật khẩu không hiển thị lại | Security | P1 | FR-NTF-FE-006 |
| TC-NTF-E2E-008 | Toast realtime | Đang mở ứng dụng | Kích hoạt sự cố CRITICAL | — | Toast đỏ có nút “Xem chi tiết”; tối đa 3 toast, phần còn lại gộp “và N sự cố khác” | UI/UX | P2 | FR-NTF-FE-007 |
| TC-NTF-E2E-009 | Cảnh báo kênh bị tự tắt | Kênh vừa bị tắt | Mở màn hình kênh | — | Hiển thị cảnh báo nổi bật kèm lý do | UI/UX | P3 | FR-NTF-FE-008 |
