# Notification Service (`NTF`) — M3

> Trạng thái: 🔜 **Khung** — chưa hiện thực. Đặc tả: [docs/02_srs/06_notification.md](../../../../../docs/02_srs/06_notification.md)

## Phạm vi

Quản lý kênh cảnh báo (Email / Webhook: Slack, Teams, Discord, Generic), dựng nội dung tiếng Việt,
gửi bất đồng bộ có throttle + retry + DLQ, và gửi báo cáo sức khỏe hằng ngày.

## Yêu cầu phụ trách

`FR-NTF-001` … `FR-NTF-020` · `FR-NTF-FE-001` … `FR-NTF-FE-008` · `BR-NTF-001` … `BR-NTF-007`

## Việc cần làm

- [ ] `SOE.Notification.Domain` — `AlertChannel`, `DeliveryLog`, `SmtpSettings`, quy tắc throttle
- [ ] `SOE.Notification.Application` — `AlertDispatcher`, port `INotificationChannel` và `IWebhookPayloadFormatter`
- [ ] `SOE.Notification.Infrastructure` — `EmailNotificationChannel` (MailKit, STARTTLS bắt buộc), `WebhookNotificationChannel` (HMAC-SHA256 + chống SSRF), template HTML, EF Core (`soe_notification`)
- [ ] Job báo cáo hằng ngày (khóa phân tán, mặc định 08:00 giờ Việt Nam)
- [ ] Test: `docs/04_test_cases/TC-06_notification.md` (44 ca, gồm 5 ca bảo mật SSRF)

## Bẫy đã biết

- **Chống SSRF** (OWASP API7): chỉ `https`, resolve DNS rồi kiểm tra IP thật, chặn dải private/loopback/link-local, không theo redirect, timeout 5s, đọc tối đa 8 KB phản hồi.
- Idempotent theo `deliveryId = hash(incidentId, channelId, eventKind, escalationSeq)` — xử lý lại message không gửi trùng.
- Mặc định WARNING không gửi email (tránh spam), CRITICAL luôn gửi; nâng cấp severity thì bỏ qua throttle.
- Nội dung email/webhook tuyệt đối không chứa credential, host key hay URL nội bộ.

## Điểm mở rộng (OCP)

Thêm kênh mới = thêm một hiện thực `INotificationChannel` + đăng ký DI; `AlertDispatcher` không đổi.
