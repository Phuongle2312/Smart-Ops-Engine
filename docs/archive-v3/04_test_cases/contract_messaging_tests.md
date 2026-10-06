# Test Cases — Contract & Messaging

> Tham chiếu: [messaging_events.md](../01_architecture/messaging_events.md)
> Công cụ: MassTransit TestHarness, snapshot JSON schema, Testcontainers RabbitMQ.

## 1. Hợp đồng thông điệp (schema)

| ID | Kịch bản | Các bước | Kết quả mong đợi | Ưu tiên | Truy vết |
|---|---|---|---|---|---|
| TC-CON-001 | Snapshot schema mọi contract | Sinh JSON schema cho tất cả type trong `SOE.Contracts` và so với bản đã lưu | Không sai khác; thay đổi phá vỡ tương thích làm CI đỏ | P1 | R5 |
| TC-CON-002 | Trường bắt buộc | Deserialize message thiếu `nodeId` | Thất bại với lỗi rõ ràng, message vào `_skipped` (không retry vô hạn) | P1 | §4.3 |
| TC-CON-003 | Thêm trường tùy chọn | Producer gửi `V1` có thêm trường nullable mới | Consumer cũ vẫn xử lý bình thường | P1 | R2 |
| TC-CON-004 | Song song V1 và V2 | Publish cả hai phiên bản | Consumer tương ứng nhận đúng phiên bản, không nhầm lẫn | P2 | R3 |
| TC-CON-005 | Thời gian là UTC | Kiểm tra mọi trường thời gian trong contract | Kiểu `DateTimeOffset`, giá trị UTC, serialize ISO-8601 | P1 | Quy ước §5 |
| TC-CON-006 | Không mang bí mật | Rà soát mọi contract | Không có trường credential/token/secret | P1 | §6, ADR-04 |
| TC-CON-007 | Kích thước message | Sinh message lớn nhất có thể (mô tả dài nhất) | ≤ 256 KB | P2 | §6 |
| TC-CON-008 | Đặt tên đúng quy ước | Kiểm tra tên type và queue | Theo bảng quy ước §2 | P3 | §2 |

## 2. Outbox / Inbox / Idempotency

| ID | Kịch bản | Các bước | Kết quả mong đợi | Ưu tiên | Truy vết |
|---|---|---|---|---|---|
| TC-CON-011 | Outbox commit cùng transaction | Tạo node thành công | Bản ghi node và bản ghi outbox cùng tồn tại; event được publish sau commit | P1 | §4.1 |
| TC-CON-012 | Rollback không phát event | Ép lỗi sau khi ghi outbox | Không có node, không có event trên broker | P1 | NFR-AVL-002 |
| TC-CON-013 | Broker ngừng khi publish | Dừng RabbitMQ, tạo node, bật lại | Event nằm trong outbox và được phát khi broker trở lại | P1 | NFR-AVL-004 |
| TC-CON-014 | Inbox chống trùng | Gửi cùng `MessageId` 5 lần | Consumer xử lý đúng 1 lần (`InboxState` ghi nhận) | P1 | §4.2 |
| TC-CON-015 | Idempotent theo khóa nghiệp vụ | Gửi 2 message khác `MessageId` nhưng cùng `(nodeId, collectedAt)` | Chỉ một snapshot được lưu (ràng buộc unique) | P1 | §4.2 |
| TC-CON-016 | Idempotent gửi cảnh báo | Gửi lại `IncidentOpenedV1` | Chỉ một email/webhook (cùng `deliveryId`) | P1 | BR-NTF-003 |
| TC-CON-017 | Thứ tự không đảm bảo | Gửi snapshot mới trước, cũ sau | Bản cũ bị bỏ qua nhờ `lastProcessedAt` | P1 | BR-RTM-004, FR-INC-020 |

## 3. Retry, DLQ & phục hồi

| ID | Kịch bản | Các bước | Kết quả mong đợi | Ưu tiên | Truy vết |
|---|---|---|---|---|---|
| TC-CON-021 | Retry tức thì | Consumer ném lỗi tạm 3 lần rồi thành công | Message được retry theo cấu hình exponential; cuối cùng xử lý thành công | P1 | §4.3 |
| TC-CON-022 | Redelivery có độ trễ | Consumer luôn lỗi tạm | Sau retry tức thì, message được redeliver ở 1′, 5′, 15′ | P2 | §4.3 |
| TC-CON-023 | Vào DLQ | Consumer luôn lỗi | Message vào `<queue>_error` với header `MT-Fault-Message`; metric `soe_dlq_messages` > 0 | P1 | §4.3 |
| TC-CON-024 | Lỗi không retry | Message sai schema | Vào `<queue>_skipped`, không retry | P2 | §4.3 |
| TC-CON-025 | Phát lại từ DLQ | Shovel message từ `_error` về queue gốc sau khi sửa lỗi | Message được xử lý thành công; DLQ về 0 | P1 | Runbook |
| TC-CON-026 | Cảnh báo khi DLQ khác rỗng | Đưa 1 message vào DLQ | Alert `SoeDlqNotEmpty` bắn trong ≤ 5 phút | P2 | observability §7 |
| TC-CON-027 | Prefetch & đồng thời | Gửi 1.000 message | Không vượt `PrefetchCount`/`ConcurrentMessageLimit` cấu hình | P2 | §7 |
| TC-CON-028 | Queue Realtime tự xóa | Dừng một instance Realtime | Queue `realtime.<instance>` bị xóa tự động, không tồn đọng | P2 | §2 |
| TC-CON-029 | TTL lệnh quét | Đưa `CheckNodeV1` vào queue rồi giữ worker ngừng 6 phút | Message hết hạn, không được xử lý khi worker trở lại | P2 | FR-MON-016 |
| TC-CON-030 | Quyền truy cập broker | Dùng tài khoản của service A đọc queue của service B | Bị từ chối (phân quyền theo tiền tố) | P2 | §6 |

## 4. Kiểm thử tích hợp xuyên service (end-to-end đường ống)

| ID | Kịch bản | Các bước | Kết quả mong đợi | Ưu tiên | Truy vết |
|---|---|---|---|---|---|
| TC-CON-041 | Toàn tuyến “vượt ngưỡng → email” | Ép node giả lập báo disk 95%, chạy 2 chu kỳ | Snapshot được lưu → sự cố CRITICAL mở → email tới MailHog → audit đủ bản ghi → client nhận sự kiện realtime | P1 | UC-MON-01, UC-INC-01, UC-NTF-01 |
| TC-CON-042 | Toàn tuyến “hồi phục → tự đóng” | Hạ giá trị xuống 70% trong 2 chu kỳ | Sự cố tự đóng, thông báo đóng được gửi, giao diện cập nhật | P1 | UC-INC-04 |
| TC-CON-043 | Toàn tuyến “tạo node → quét lần đầu” | Tạo node mới qua API | Read model đồng bộ, node được quét ở chu kỳ kế tiếp, dashboard hiện chỉ số | P1 | UC-INV-01 |
| TC-CON-044 | Toàn tuyến “xóa node” | Xóa node đang có sự cố | Lịch quét dừng, sự cố đóng, dữ liệu lịch sử vẫn truy vấn được, audit đầy đủ | P1 | UC-INV-04 |
| TC-CON-045 | Một `correlationId` xuyên suốt | Thực hiện một thao tác ghi | Cùng `correlationId` xuất hiện ở log gateway, service, consumer và bản ghi audit | P1 | NFR-OBS-001 |
