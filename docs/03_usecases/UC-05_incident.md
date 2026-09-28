# UC-INC — Phát hiện & xử lý sự cố

---

## UC-INC-01 — Phát hiện và mở sự cố

| Mục | Nội dung |
|---|---|
| **Actor chính** | Incident Service (hệ thống) |
| **Actor phụ** | Monitoring, Notification, Realtime, Audit |
| **Ưu tiên** | Must · **Tần suất**: mỗi snapshot (≈ 500 lần/chu kỳ) |
| **Tiền điều kiện** | Có chính sách ngưỡng đang bật cho loại metric tương ứng |
| **Kích hoạt** | Nhận `MetricCollectedV1` |

**Luồng chính**

1. Incident nhận `MetricCollectedV1`, bỏ qua nếu `collectedAt` cũ hơn `lastProcessedAt` của node/metric.
2. Xác định chính sách áp dụng: override theo node (nếu có) → chính sách toàn cục.
3. Với mỗi metric có giá trị khác `null`, xác định mức: `NORMAL` / `WARNING` / `CRITICAL`.
4. Mức khác `NORMAL` ⇒ tăng `breachStreak`, đặt `recoveryStreak = 0`.
5. Nếu đã có sự cố chưa đóng cùng `(nodeId, type)`: tăng `occurrenceCount`, cập nhật `lastSeenAt` và `metricValue` — **không tạo bản ghi mới**.
6. Nếu chưa có và `breachStreak ≥ consecutiveBreaches`: mở sự cố mới với mô tả tiếng Việt theo mẫu, phát `IncidentOpenedV1` qua outbox.
7. Notification chọn kênh theo severity và bộ lọc node, gửi cảnh báo (UC-NTF-01).
8. Realtime đẩy `IncidentOpened`; Audit ghi nhận; Dashboard cập nhật bộ đếm.

**Luồng thay thế**

- **A1 — Nâng cấp mức độ:** sự cố đang WARNING mà giá trị vượt ngưỡng CRITICAL ⇒ nâng severity, phát `IncidentEscalatedV1`, gửi cảnh báo lại (không bị throttle chặn).
- **A2 — Node không liên lạc được:** nhận `NodeUnreachableV1` ⇒ mở sự cố ngay lần đầu, không cần chuỗi breach.
- **A3 — Metric bị tắt đánh giá:** bỏ qua hoàn toàn.
- **A4 — Nhiều metric cùng vượt ngưỡng:** mỗi loại một sự cố riêng (`CPU_HIGH`, `DISK_HIGH`…), gửi cảnh báo riêng.

**Luồng ngoại lệ**

- **E1 — Message trùng lặp:** inbox idempotency ⇒ không tăng `occurrenceCount` hai lần.
- **E2 — Xung đột đồng thời hai snapshot cùng node:** optimistic concurrency, retry; ràng buộc unique ở DB bảo đảm chỉ một sự cố mở.
- **E3 — Giá trị vượt ngưỡng nhưng chưa đủ số lần liên tiếp:** chỉ tăng `breachStreak`, chưa mở sự cố (chống nhiễu tức thời).
- **E4 — Node vừa bị xóa:** bỏ qua message, không mở sự cố.

**Hậu điều kiện:** tối đa một sự cố chưa đóng cho mỗi `(node, loại)`; cảnh báo được đưa vào hàng đợi.
**BR:** BR-INC-001, 006, 008 · **NFR:** NFR-AVL-003, NFR-PERF-010
**Test case:** TC-INC-UNIT-001…012, TC-INC-INT-001…009

---

## UC-INC-02 — Xác nhận xử lý sự cố (Acknowledge)

| Mục | Nội dung |
|---|---|
| **Actor chính** | OPERATOR / ADMIN · **Tiền điều kiện**: sự cố ở trạng thái `OPEN` |
| **Kích hoạt** | Người dùng bấm “Xác nhận xử lý” trong danh sách hoặc chi tiết sự cố |

**Luồng chính**

1. Hệ thống mở hộp thoại cho phép nhập ghi chú (≤ 500 ký tự, không bắt buộc).
2. Người dùng xác nhận; frontend cập nhật optimistic và gọi `PUT /incidents/{id}/acknowledge`.
3. Incident kiểm tra trạng thái `OPEN`, chuyển sang `ACKNOWLEDGED`, ghi `IncidentEvents`, phát `IncidentAcknowledgedV1`.
4. Realtime đẩy cập nhật cho mọi người đang xem; Audit ghi `INCIDENT_ACKNOWLEDGED`.
5. Frontend hiển thị trạng thái mới kèm tên người xác nhận và thời điểm.

**Luồng ngoại lệ**

- **E1 — Sự cố đã được người khác xác nhận/đóng:** `409 SOE-INC-409`; frontend rollback optimistic và làm mới dữ liệu, hiện thông báo “Sự cố đã được {tên} xử lý.”
- **E2 — VIEWER thao tác:** không thấy nút; gọi API nhận `403`.
- **E3 — Sự cố không tồn tại:** `404`.

**Hậu điều kiện:** sự cố có người phụ trách rõ ràng; cảnh báo lặp vẫn tính vào `occurrenceCount` nhưng không đổi trạng thái.
**BR:** BR-INC-003 · **Test case:** TC-INC-API-001…006, TC-INC-E2E-001…003

---

## UC-INC-03 — Đóng sự cố (Resolve)

| Mục | Nội dung |
|---|---|
| **Actor chính** | OPERATOR / ADMIN |
| **Tiền điều kiện** | Sự cố ở trạng thái `OPEN` hoặc `ACKNOWLEDGED` |
| **Kích hoạt** | Người dùng bấm “Đóng sự cố” |

**Luồng chính**

1. Hệ thống mở hộp thoại yêu cầu mô tả hành động xử lý (bắt buộc, 3–1000 ký tự).
2. Người dùng nhập nội dung và xác nhận; frontend validate rồi gọi `PUT /incidents/{id}/resolve`.
3. Incident chuyển trạng thái `RESOLVED`, ghi `resolvedAt`, `resolvedBy`, `resolvedSource = USER`, `resolutionAction`; ghi `IncidentEvents`; phát `IncidentResolvedV1`.
4. Notification gửi thông báo “đã đóng” tới các kênh bật tùy chọn này; Realtime cập nhật; Audit ghi `INCIDENT_RESOLVED`.
5. Frontend chuyển sự cố sang nhóm đã xử lý, cập nhật bộ đếm trên Dashboard, hiện toast.

**Luồng thay thế**

- **A1 — Sự cố tái phát sau khi đóng:** lần breach kế tiếp mở **sự cố mới** (lịch sử cũ được giữ nguyên để phân tích).
- **A2 — Đóng hàng loạt:** chọn nhiều sự cố và đóng cùng một lý do (Could).

**Luồng ngoại lệ**

- **E1 — Sự cố đã đóng:** `409`; hiện thông báo và làm mới danh sách.
- **E2 — Thiếu nội dung xử lý:** frontend chặn; nếu gọi thẳng API thì `400` với `errors.resolutionAction`.
- **E3 — Nguyên nhân chưa được khắc phục:** chu kỳ quét kế tiếp mở sự cố mới → người dùng thấy sự cố quay lại (hành vi đúng theo thiết kế).

**Hậu điều kiện:** sự cố đóng kèm mô tả xử lý phục vụ tra cứu và tính MTTR.
**BR:** BR-INC-003, 004, 007 · **Test case:** TC-INC-API-007…014, TC-INC-E2E-004…006

---

## UC-INC-04 — Tự động đóng sự cố khi hồi phục

| Mục | Nội dung |
|---|---|
| **Actor chính** | Incident Service (hệ thống) |
| **Kích hoạt** | Nhận snapshot có giá trị đã hồi phục, hoặc node liên lạc lại được |

**Luồng chính**

1. Nhận `MetricCollectedV1` với giá trị < `ngưỡng − recoveryMargin` (mặc định thấp hơn 5 điểm %).
2. Tăng `recoveryStreak`, đặt `breachStreak = 0`.
3. Khi `recoveryStreak ≥ consecutiveRecoveries` (mặc định 2) và tồn tại sự cố chưa đóng:
   - Đóng sự cố với `resolvedSource = SYSTEM`, `resolutionAction = "Chỉ số đã trở lại bình thường."` (không ghi đè nội dung người dùng đã nhập).
   - Ghi `IncidentEvents`, phát `IncidentResolvedV1`.
4. Notification gửi thông báo hồi phục (nếu kênh bật); Realtime cập nhật; Audit ghi `INCIDENT_AUTO_RESOLVED`.

**Luồng thay thế**

- **A1 — Node liên lạc lại được:** nhận `MetricCollectedV1` thành công ⇒ đóng ngay sự cố `NODE_UNREACHABLE` (không cần chuỗi hồi phục).
- **A2 — Node bị tắt giám sát/xóa:** đóng mọi sự cố chưa đóng với lý do hệ thống.

**Luồng ngoại lệ**

- **E1 — Giá trị dao động quanh ngưỡng:** nhờ `recoveryMargin` + `consecutiveRecoveries`, sự cố không đóng/mở liên tục (chống flapping).
- **E2 — Sự cố đã được người dùng đóng trước:** bỏ qua, không thay đổi bản ghi.

**Hậu điều kiện:** danh sách sự cố mở phản ánh đúng tình trạng thực tế mà không cần thao tác thủ công.
**BR:** BR-INC-004, 007 · **Test case:** TC-INC-UNIT-013…020, TC-INC-INT-010…016

---

## UC-INC-05 — Cấu hình ngưỡng cảnh báo

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN · **Tiền điều kiện**: đăng nhập vai trò ADMIN |
| **Kích hoạt** | ADMIN mở màn hình `SystemConfig` mục “Ngưỡng cảnh báo”, hoặc mục ngưỡng riêng của một node |

**Luồng chính**

1. Hệ thống hiển thị chính sách hiện tại cho CPU / RAM / Disk: ngưỡng cảnh báo, ngưỡng nguy cấp, số lần liên tiếp, biên hồi phục, số lần hồi phục, bật/tắt.
2. ADMIN chỉnh giá trị; frontend validate ngay (`warning < critical`, phạm vi hợp lệ).
3. (Tùy chọn) Hệ thống hiển thị xem trước: “Với dữ liệu 24 giờ qua, cấu hình này sẽ tạo N sự cố.”
4. ADMIN bấm “Lưu”, xác nhận trong hộp thoại nêu hệ quả.
5. Frontend gọi `PUT /threshold-policies/global` (hoặc `/nodes/{nodeId}`).
6. Incident lưu chính sách; áp dụng từ snapshot kế tiếp, không hồi tố sự cố đang mở.
7. Audit ghi `THRESHOLD_POLICY_UPDATED` kèm giá trị trước/sau; Frontend hiện toast.

**Luồng thay thế**

- **A1 — Ghi đè theo node:** ADMIN mở node cụ thể và đặt chính sách riêng; có nút “Gỡ ghi đè” để quay về chính sách toàn cục.
- **A2 — Tắt đánh giá một loại metric:** các sự cố đang mở của loại đó được đóng với lý do hệ thống.

**Luồng ngoại lệ**

- **E1 — `warning ≥ critical`:** `400 SOE-INC-400`; frontend chặn từ trước.
- **E2 — Giá trị ngoài phạm vi (0, 150, chữ):** `400` kèm lỗi theo field.
- **E3 — Không phải ADMIN:** `403`.
- **E4 — Hai ADMIN sửa đồng thời:** `409` (optimistic concurrency); người sau phải tải lại giá trị mới nhất.

**Hậu điều kiện:** chính sách mới có hiệu lực ngay cho lần đánh giá kế tiếp mà không cần khởi động lại service.
**BR:** BR-INC-002, 005 · **NFR:** NFR-SEC-008, FR-GW-027
**Test case:** TC-INC-API-015…024, TC-INC-E2E-007…009, TC-GW-SEC-011
