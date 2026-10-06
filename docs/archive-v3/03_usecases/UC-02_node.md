# UC-INV — Quản lý Node

---

## UC-INV-01 — Thêm node mới

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN |
| **Actor phụ** | Inventory, Máy chủ đích (khi kiểm tra kết nối), Monitoring, Audit |
| **Ưu tiên** | Must · **Tần suất**: vài lần/tuần |
| **Tiền điều kiện** | ADMIN đã đăng nhập; đã có thông tin SSH của máy chủ cần giám sát |
| **Kích hoạt** | ADMIN bấm “Thêm máy chủ” ở màn hình `Nodes` |

**Luồng chính**

1. Hệ thống mở modal “Thêm máy chủ mới” với hai tab xác thực: **Password** (mặc định) và **SSH Key**; ba checkbox giám sát CPU/RAM/Disk mặc định bật.
2. ADMIN nhập: tên, IP/hostname, port (mặc định 22), tài khoản SSH, credential theo tab đang chọn, đường mount đĩa (mặc định `/`), mô tả, tag (tùy chọn), chu kỳ quét riêng (tùy chọn).
3. Frontend validate theo schema zod (SRS 02 §6); lỗi hiển thị dưới từng ô, nút “Lưu” bị khóa.
4. ADMIN bấm “Kiểm tra kết nối” (khuyến nghị) → `POST /nodes/{tạm}/test-connection` hoặc kiểm tra kèm khi lưu (`testConnectionFirst = true`).
5. Inventory mở phiên SSH thử, lấy **fingerprint host key**, chạy một lệnh vô hại, trả kết quả kèm thời lượng.
6. ADMIN bấm “Lưu”; frontend gọi `POST /api/v1/nodes`.
7. Gateway kiểm tra vai trò ADMIN và rate limit ghi.
8. Inventory validate nghiệp vụ, kiểm tra trùng `(host, port)` và trùng `name`.
9. Inventory mã hóa credential bằng AES-256-GCM (một lần duy nhất, tại tầng Infrastructure), ghim fingerprint, lưu node + bản ghi outbox trong cùng transaction.
10. Trả `201 Created` với `NodeResponse` **không chứa credential**.
11. Outbox publisher phát `NodeCreatedV1`; Monitoring thêm vào read model và xếp lịch quét; Audit ghi `NODE_CREATED`.
12. Frontend đóng modal, thêm node vào danh sách, hiện toast “Đã thêm máy chủ {tên}”.

**Luồng thay thế**

- **A1 — Dùng SSH Key:** ADMIN chuyển tab SSH Key, dán private key (và passphrase nếu có); ô Password ẩn đi; validate bắt đầu bằng `-----BEGIN`, ≤ 16 KB.
- **A2 — Bỏ qua kiểm tra kết nối:** node vẫn được tạo; lần quét đầu sẽ phát hiện lỗi và mở sự cố `NODE_UNREACHABLE`.
- **A3 — Tạo node ở trạng thái tắt giám sát:** bỏ chọn “Giám sát”; node không được xếp lịch cho tới khi bật.
- **A4 — Nhập hàng loạt bằng CSV** (Could): tải lên tệp, hệ thống báo lỗi theo từng dòng, chỉ tạo các dòng hợp lệ.

**Luồng ngoại lệ**

- **E1 — Trùng host:port:** `409 SOE-INV-409`; frontend gắn lỗi vào ô Host: “Đã có node sử dụng 192.168.1.10:22.”
- **E2 — Trùng tên:** `409 SOE-INV-410`.
- **E3 — Dữ liệu không hợp lệ (port 70000, host có ký tự lạ):** `400` kèm `errors` theo field.
- **E4 — Kiểm tra kết nối thất bại:** hiển thị nguyên nhân theo `failureKind` (sai mật khẩu, timeout, từ chối kết nối) kèm gợi ý; nếu bật `testConnectionFirst` thì trả `422` và không tạo node.
- **E5 — Người dùng không phải ADMIN:** `403` (OPERATOR/VIEWER không thấy nút, nhưng gọi thẳng API vẫn bị chặn).
- **E6 — Mất kết nối khi đang lưu:** transaction rollback; không có node “nửa vời”, không có event phát đi (nhờ outbox).

**Hậu điều kiện**

- Thành công: node tồn tại, credential được mã hóa, fingerprint đã ghim, Monitoring bắt đầu quét từ chu kỳ kế tiếp, có bản ghi audit.
- Thất bại: không tạo node, không phát event.

**BR:** BR-INV-001…003, 006, 007 · **NFR:** NFR-SEC-003, NFR-SEC-013, NFR-PERF-002
**Test case:** TC-INV-API-001…015, TC-INV-E2E-001…006, TC-INV-SEC-001…004

---

## UC-INV-02 — Sửa thông tin node

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN · **Tiền điều kiện**: node tồn tại |
| **Kích hoạt** | ADMIN bấm biểu tượng sửa trên hàng node |

**Luồng chính**

1. Hệ thống mở modal “Cập nhật máy chủ” với dữ liệu hiện tại được điền sẵn; ô credential hiển thị `••••••••`.
2. ADMIN sửa các trường cần thiết (tên, mô tả, cờ giám sát, mount path, chu kỳ riêng, tag).
3. Frontend chỉ gửi credential khi người dùng thực sự nhập giá trị mới (`changeCredential = true`).
4. Gọi `PUT /api/v1/nodes/{id}`; Inventory validate, kiểm tra trùng, cập nhật, phát `NodeUpdatedV1` với `changedFields[]`.
5. Monitoring cập nhật read model; Audit ghi `NODE_UPDATED` kèm diff (credential hiển thị `***`).
6. Frontend đóng modal, cập nhật hàng trong bảng, hiện toast.

**Luồng thay thế**

- **A1 — Đổi credential:** nhập giá trị mới → Inventory mã hóa lại và ghi đè; lần quét kế tiếp dùng credential mới.
- **A2 — Đổi host/port:** fingerprint đã ghim bị xóa; hệ thống cảnh báo cần ghim lại ở lần kết nối tới.
- **A3 — Tắt một loại metric:** bỏ chọn CPU → Monitoring không thu CPU nữa; Incident đóng các sự cố `CPU_HIGH` đang mở của node.

**Luồng ngoại lệ**

- **E1 — Node đã bị xóa bởi người khác:** `404 SOE-INV-404`; frontend làm mới danh sách.
- **E2 — Xung đột chỉnh sửa đồng thời:** `409` (optimistic concurrency); frontend đề nghị tải lại dữ liệu mới nhất.
- **E3 — Giá trị mới trùng node khác:** `409` như UC-INV-01/E1.

**Hậu điều kiện:** thông tin node được cập nhật, credential cũ giữ nguyên nếu không đổi.
**Test case:** TC-INV-API-016…024, TC-INV-E2E-007…009

---

## UC-INV-03 — Bật/tắt giám sát node

| Mục | Nội dung |
|---|---|
| **Actor chính** | OPERATOR hoặc ADMIN |
| **Kích hoạt** | Người dùng gạt công tắc “Giám sát” trên hàng node |

**Luồng chính**

1. Người dùng gạt công tắc; frontend cập nhật optimistic và gọi `PUT /nodes/{id}/monitoring`.
2. Inventory cập nhật `isActive`, phát `NodeMonitoringToggledV1`.
3. Monitoring ngừng (hoặc bắt đầu) xếp lịch quét cho node từ chu kỳ kế tiếp.
4. Khi tắt: Incident đóng mọi sự cố chưa đóng của node với lý do “Node ngừng giám sát”; Metrics đặt `status = MONITORING_OFF`.
5. Frontend hiện toast; các chỉ số của node chuyển sang trạng thái “Đang tắt” thay vì hiển thị số cũ.

**Luồng ngoại lệ**

- **E1 — API lỗi:** rollback trạng thái công tắc, hiện toast lỗi.
- **E2 — VIEWER thao tác:** không thấy công tắc; gọi thẳng API nhận `403`.

**Hậu điều kiện:** node được/không được xếp lịch quét; sự cố liên quan đã đóng.
**BR:** BR-INV-005 · **Test case:** TC-INV-API-025…028, TC-INC-INT-015, TC-INV-E2E-010

---

## UC-INV-04 — Xóa node

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN |
| **Kích hoạt** | ADMIN bấm biểu tượng thùng rác |

**Luồng chính**

1. Hệ thống hiển thị hộp thoại xác nhận nêu rõ tên node và hệ quả: ngừng giám sát, đóng sự cố đang mở, dữ liệu lịch sử vẫn tra cứu được trong 30 ngày.
2. ADMIN xác nhận; frontend gọi `DELETE /api/v1/nodes/{id}`.
3. Inventory đánh dấu `DeletedAt`, xóa cứng bản ghi credential, phát `NodeDeletedV1`, trả `204`.
4. Monitoring bỏ node khỏi lịch; Incident đóng sự cố chưa đóng; Metrics đánh dấu dữ liệu lưu trữ; Audit ghi `NODE_DELETED`.
5. Frontend xóa hàng khỏi bảng và hiện toast.

**Luồng ngoại lệ**

- **E1 — Node không tồn tại:** `404`, làm mới danh sách.
- **E2 — Người dùng hủy:** đóng hộp thoại, không thay đổi gì.
- **E3 — Message `NodeDeletedV1` xử lý muộn:** một lần quét đang chạy có thể hoàn tất; Metrics/Incident bỏ qua dữ liệu của node đã xóa (BR-MET/INC).

**Hậu điều kiện:** node biến mất khỏi danh sách giám sát; credential bị xóa vĩnh viễn; lịch sử vẫn tra cứu được.
**BR:** BR-INV-004 · **Test case:** TC-INV-API-029…033, TC-INV-E2E-011…012

---

## UC-INV-05 — Xử lý thay đổi host key

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN · **Actor phụ**: Worker giám sát, Incident, Audit |
| **Ưu tiên** | Must · **Tần suất**: hiếm (nhưng là tình huống bảo mật quan trọng) |
| **Tiền điều kiện** | Node đã có `hostKeyFingerprint` được ghim |
| **Kích hoạt** | Worker phát hiện fingerprint khác bản đã ghim khi kết nối |

**Luồng chính**

1. Worker so sánh fingerprint nhận được với bản đã ghim → **khác nhau**.
2. Worker **hủy kết nối trước khi gửi credential**, phát `NodeUnreachableV1` với `failureKind = HostKeyMismatch`.
3. Incident mở sự cố `HOST_KEY_MISMATCH` mức CRITICAL ngay lần đầu.
4. Notification gửi cảnh báo tới các kênh; Audit ghi `HOSTKEY_MISMATCH_BLOCKED`.
5. ADMIN mở màn hình node, thấy cảnh báo đỏ giải thích rủi ro (máy chủ cài lại, đổi khóa, hoặc bị tấn công trung gian).
6. ADMIN xác minh ngoài hệ thống (so sánh fingerprint trên máy chủ thật).
7. Nếu hợp lệ: ADMIN bấm “Ghim lại host key”, nhập tên node để xác nhận → `POST /nodes/{id}/host-key/pin`.
8. Inventory cập nhật fingerprint, Audit ghi `NODE_HOSTKEY_PINNED`; lần quét kế tiếp hoạt động bình thường và sự cố được tự đóng khi thu được metric.

**Luồng thay thế**

- **A1 — ADMIN nghi bị tấn công:** tắt giám sát node, xử lý hạ tầng, sau đó ghim lại.

**Luồng ngoại lệ**

- **E1 — Người dùng không phải ADMIN bấm ghim lại:** `403`.
- **E2 — Node đã bị xóa trong lúc xử lý:** `404`.

**Hậu điều kiện:** hệ thống **không bao giờ** gửi credential tới máy chủ có host key lạ; hành động ghim lại có dấu vết kiểm toán.
**BR:** BR-INV-006, BR-MON-007 · **NFR:** NFR-SEC-013
**Test case:** TC-INV-SEC-005…008, TC-MON-INT-010, TC-INC-INT-012
