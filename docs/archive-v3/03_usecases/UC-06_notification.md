# UC-NTF — Cảnh báo đa kênh

---

## UC-NTF-01 — Gửi cảnh báo sự cố

| Mục | Nội dung |
|---|---|
| **Actor chính** | Notification Service (hệ thống) |
| **Actor phụ** | SMTP server, Webhook endpoint, Audit, Realtime |
| **Ưu tiên** | Must · **Tần suất**: theo số sự cố |
| **Tiền điều kiện** | Có ít nhất một kênh đang bật; cấu hình SMTP hợp lệ (với kênh email) |
| **Kích hoạt** | Nhận `IncidentOpenedV1` / `IncidentEscalatedV1` / `IncidentResolvedV1` |

**Luồng chính**

1. Notification nhận sự kiện sự cố.
2. Lấy danh sách kênh đang bật có `minSeverity ≤ severity` và khớp bộ lọc node/tag.
3. Với mỗi kênh, tính `deliveryId` và kiểm tra throttle (cùng sự cố + kênh + loại sự kiện trong 30 phút ⇒ bỏ qua, ghi `SKIPPED_THROTTLED`).
4. Dựng nội dung: email HTML tiếng Việt (bảng CPU/RAM/Disk có màu, khuyến nghị xử lý, liên kết sự cố) hoặc payload webhook theo `format`.
5. Gửi đi:
   - **Email:** SMTP STARTTLS, kèm phần text thay thế.
   - **Webhook:** HTTPS POST kèm `X-SOE-Signature` (HMAC-SHA256), `X-SOE-Timestamp`, timeout 5 giây, không theo redirect.
6. Ghi `DeliveryLogs` (`SENT`, `latencyMs`), phát `AlertDispatchedV1`; Audit ghi nhận.
7. Realtime đẩy thông báo tới giao diện người dùng đang mở (toast).

**Luồng thay thế**

- **A1 — Nâng cấp mức độ:** `IncidentEscalatedV1` bỏ qua throttle (người trực cần biết ngay).
- **A2 — Thông báo khi đóng sự cố:** chỉ gửi cho kênh bật `notifyOnResolve`.
- **A3 — Bão sự cố:** > 20 sự cố trong 5 phút ⇒ gộp thành một email tổng hợp (digest).
- **A4 — Kênh có bộ lọc node:** chỉ gửi cho sự cố thuộc node/tag đã chọn.

**Luồng ngoại lệ**

- **E1 — Lỗi tạm thời (timeout, 5xx, SMTP 4xx):** retry 3 lần backoff 1s → 4s → 16s.
- **E2 — Thất bại hẳn:** ghi `DeliveryLogs` trạng thái `FAILED` kèm lý do rút gọn, phát `AlertFailedV1`, message vào DLQ để vận hành xử lý.
- **E3 — Kênh lỗi 10 lần liên tiếp:** tự tắt kênh, phát `ChannelAutoDisabledV1`, thông báo ADMIN.
- **E4 — Webhook trỏ IP nội bộ:** chặn trước khi gửi (chống SSRF), ghi `FAILED` với lý do rõ ràng.
- **E5 — Message xử lý lại:** `deliveryId` trùng ⇒ không gửi lần hai (idempotent).
- **E6 — Không có kênh nào phù hợp:** ghi log mức Information; sự cố vẫn hiển thị trên giao diện.

**Hậu điều kiện:** mỗi sự cố có bản ghi gửi rõ ràng cho từng kênh (thành công / thất bại / bị throttle).
**BR:** BR-NTF-001…006 · **NFR:** NFR-PERF-010, NFR-AVL-004, NFR-SEC-009
**Test case:** TC-NTF-INT-001…012, TC-NTF-SEC-001…005

---

## UC-NTF-02 — Quản lý kênh cảnh báo

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN · **Kích hoạt**: ADMIN mở màn hình `AlertChannels` |

**Luồng chính**

1. Hệ thống hiển thị danh sách kênh: tên, loại, đích nhận đã che (`o***@example.com`), mức tối thiểu, trạng thái, lần gửi gần nhất, tỷ lệ thành công 24 giờ.
2. ADMIN bấm “Thêm kênh”; chọn loại `EMAIL` hoặc `WEBHOOK`.
3. Form đổi trường theo loại: email → danh sách địa chỉ; webhook → URL, `format` (Slack/Teams/Discord/Generic), secret HMAC.
4. ADMIN đặt `minSeverity`, tùy chọn “thông báo khi đóng”, bộ lọc node/tag, trạng thái bật.
5. Frontend validate (HTTPS, không trỏ IP nội bộ, độ dài secret…).
6. Gọi `POST /alert-channels`; Notification mã hóa đích nhận và secret, lưu, trả `201`.
7. Audit ghi `CHANNEL_CREATED`; danh sách cập nhật, hiện toast.

**Luồng thay thế**

- **A1 — Sửa kênh:** để trống secret = giữ nguyên; `PUT /alert-channels/{id}`.
- **A2 — Bật/tắt nhanh:** `PUT /alert-channels/{id}/status`.
- **A3 — Xóa kênh:** hộp thoại xác nhận → `DELETE` → `204`.

**Luồng ngoại lệ**

- **E1 — Trùng tên kênh:** `409 SOE-NTF-409`.
- **E2 — URL không phải HTTPS hoặc trỏ mạng nội bộ:** `422 SOE-NTF-422` (chặn SSRF).
- **E3 — Email sai định dạng / quá 10 địa chỉ:** `400` kèm lỗi theo field.
- **E4 — Không phải ADMIN:** `403`.

**Hậu điều kiện:** kênh sẵn sàng nhận cảnh báo; secret không bao giờ đọc lại được qua API.
**Test case:** TC-NTF-API-001…014, TC-NTF-E2E-001…005

---

## UC-NTF-03 — Gửi thử kênh cảnh báo

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN · **Tiền điều kiện**: kênh đã tồn tại (hoặc đang nhập trong modal) |
| **Kích hoạt** | ADMIN bấm “Gửi thử” |

**Luồng chính**

1. Frontend gọi `POST /alert-channels/{id}/test` (rate limit 5/phút).
2. Notification dựng thông điệp mẫu “Đây là thông báo thử từ Smart Ops Engine”.
3. Gửi qua kênh tương ứng với cùng cơ chế bảo mật như cảnh báo thật.
4. Trả `{ success, latencyMs, error }`; ghi `DeliveryLogs` và Audit `CHANNEL_TESTED`.
5. Frontend hiển thị kết quả ngay trong modal và khóa nút 12 giây.

**Luồng ngoại lệ**

- **E1 — SMTP sai cấu hình:** `503 SOE-NTF-503` với lý do (sai tài khoản, không kết nối được, TLS lỗi).
- **E2 — Webhook trả 4xx/5xx:** `success = false` kèm mã trạng thái nhận được.
- **E3 — Gửi thử quá nhiều:** `429`.
- **E4 — URL nội bộ:** bị chặn, trả lý do bảo mật.

**Hậu điều kiện:** ADMIN biết chắc kênh hoạt động trước khi có sự cố thật.
**Test case:** TC-NTF-API-015…020, TC-NTF-SEC-006…008

---

## UC-NTF-04 — Báo cáo sức khỏe hằng ngày

| Mục | Nội dung |
|---|---|
| **Actor chính** | Scheduler (hệ thống) · **Actor phụ**: Metrics, Incident, SMTP |
| **Tiền điều kiện** | Báo cáo hằng ngày đang bật; có kênh nhận báo cáo |
| **Kích hoạt** | Đến giờ đã cấu hình (mặc định 08:00 giờ Việt Nam) |

**Luồng chính**

1. Job chạy trên một instance duy nhất (khóa phân tán).
2. Thu thập số liệu: số node đang giám sát, số node cảnh báo/nguy cấp/không liên lạc được, số sự cố đang mở, sự cố mới trong 24 giờ, số sự cố đã đóng, MTTR.
3. Dựng email HTML tiếng Việt kèm bảng tóm tắt và danh sách node đáng chú ý.
4. Gửi tới các kênh được đánh dấu “nhận báo cáo”.
5. Ghi `DeliveryLogs`, phát `DailyReportSentV1`, Audit ghi nhận.

**Luồng thay thế**

- **A1 — Không có sự cố nào:** báo cáo vẫn gửi với thông điệp “Hệ thống hoạt động bình thường”.
- **A2 — ADMIN tắt báo cáo:** job bỏ qua.

**Luồng ngoại lệ**

- **E1 — SMTP lỗi:** retry theo chính sách chung; thất bại thì ghi `FAILED` và cảnh báo vận hành.
- **E2 — Dịch vụ số liệu không phản hồi:** báo cáo vẫn gửi với phần thiếu ghi “Không lấy được dữ liệu”, không bỏ hẳn báo cáo.

**Hậu điều kiện:** các bên liên quan nhận được bức tranh tổng thể mỗi ngày.
**Test case:** TC-NTF-INT-013…016, TC-NTF-API-021
