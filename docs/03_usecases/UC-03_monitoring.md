# UC-MON — Giám sát & thu thập chỉ số

---

## UC-MON-01 — Quét định kỳ toàn hệ thống

| Mục | Nội dung |
|---|---|
| **Actor chính** | Scheduler (hệ thống) |
| **Actor phụ** | Worker giám sát, Inventory, Máy chủ đích, Metrics, Incident, Realtime |
| **Ưu tiên** | Must · **Tần suất**: mỗi 5 phút (cấu hình được) |
| **Tiền điều kiện** | Scheduler đang bật; có ít nhất một node `isActive`; RabbitMQ khả dụng |
| **Kích hoạt** | Trigger Quartz đến hạn |

**Luồng chính**

1. Quartz kích hoạt job `ScanCycleJob` trên đúng **một** instance Scheduler (cluster lock).
2. Scheduler lấy danh sách node `isActive` đến hạn quét từ read model `MonitoredNodes`.
3. Với mỗi node, phát `CheckNodeV1` (`checkId`, `nodeId`, danh sách metric cần thu, `reason = Scheduled`, TTL một chu kỳ).
4. Scheduler ghi metric `soe_scan_cycle_coverage_ratio` và thời điểm bắt đầu chu kỳ.
5. RabbitMQ phân phối message cho các Worker rảnh (competing consumers).
6. Worker nhận message, kiểm tra message chưa quá hạn, lấy thông tin node từ read model.
7. Worker gọi Inventory `GET /internal/nodes/{id}/credentials` (mTLS, scope riêng); Inventory ghi audit `CREDENTIAL_ACCESSED`.
8. Worker mở phiên SSH: kiểm tra host key khớp fingerprint đã ghim → xác thực → chạy lệnh thu CPU (`/proc/stat` hai lần cách 1 giây), RAM (`free`), Disk (`df` theo mount path).
9. Worker phân tích kết quả thành `MetricSnapshot` (0–100, hai chữ số thập phân; không đọc được ⇒ `null`), đóng phiên SSH, xóa credential khỏi bộ nhớ.
10. Worker ghi `CheckRuns` và phát `MetricCollectedV1`.
11. Metrics lưu snapshot và cập nhật `MetricLatest`; Incident đánh giá ngưỡng (UC-INC-01); Realtime đẩy dữ liệu tới client đang mở Dashboard/Node Detail.

**Luồng thay thế**

- **A1 — Node có chu kỳ riêng:** chỉ phát lệnh khi `now − lastCheckedAt ≥ checkIntervalSeconds`.
- **A2 — Node chỉ giám sát một phần:** message chỉ liệt kê metric được bật; Worker chỉ chạy lệnh tương ứng.
- **A3 — Hàng đợi tăng cao:** KEDA tăng số Worker; chu kỳ vẫn hoàn tất trong hạn.
- **A4 — Scheduler bị tắt bởi ADMIN:** không phát lệnh; Dashboard hiển thị “Giám sát đang tạm dừng”.

**Luồng ngoại lệ**

- **E1 — SSH timeout/không kết nối được:** xem UC-MON-03.
- **E2 — Host key không khớp:** hủy kết nối, xem UC-INV-05.
- **E3 — Inventory không phản hồi:** Worker retry theo Polly; hết retry thì message quay lại queue và được thử lại ở chu kỳ sau; cảnh báo `SoeScanCoverageLow` nếu kéo dài.
- **E4 — Kết quả lệnh không phân tích được:** metric tương ứng `null`, ghi cảnh báo với `failureKind = ParseError`; các metric khác vẫn được lưu.
- **E5 — Message quá hạn:** Worker bỏ qua để tránh quét dồn sau sự cố (FR-MON-016).
- **E6 — Worker bị dừng giữa chừng:** message chưa ack quay lại queue và được xử lý lại; nhờ idempotency không sinh dữ liệu trùng.
- **E7 — RabbitMQ không khả dụng:** Scheduler ghi outbox, phát lại khi broker phục hồi; cảnh báo hạ tầng.

**Hậu điều kiện**

- Thành công: mọi node active có một snapshot mới; chỉ số hệ thống cập nhật; sự cố được đánh giá.
- Thất bại một phần: node lỗi có bản ghi `CheckRuns` với `outcome = Failed` và sự cố tương ứng.

**BR:** BR-MON-001…007 · **NFR:** NFR-SCL-001, NFR-PERF-005, NFR-AVL-003, 005, 006
**Test case:** TC-MON-INT-001…012, TC-MON-PERF-001…004, TC-MON-CON-001…003

---

## UC-MON-02 — Kiểm tra node ngay (Check now)

| Mục | Nội dung |
|---|---|
| **Actor chính** | OPERATOR hoặc ADMIN |
| **Tiền điều kiện** | Node tồn tại và đang bật giám sát |
| **Kích hoạt** | Người dùng bấm “Kiểm tra ngay” ở màn hình Nodes hoặc Node Detail |

**Luồng chính**

1. Người dùng bấm nút; frontend gọi `POST /api/v1/nodes/{id}/check-now`.
2. Gateway kiểm tra vai trò OPERATOR+ và rate limit (5/phút/user, 1/30 giây/node).
3. Monitoring phát `CheckNodeV1` với `reason = Manual`, `requestedBy = userId`, trả `202 Accepted` + `checkId`.
4. Frontend hiện trạng thái “Đang kiểm tra…”, khóa nút 30 giây.
5. Worker xử lý như UC-MON-01 bước 6–11.
6. Realtime đẩy `CheckCompleted` (kèm `checkId`, kết quả, thời lượng) và `MetricCollected`.
7. Frontend cập nhật chỉ số, mở khóa nút, hiện toast “Đã cập nhật chỉ số của {node}” hoặc thông báo lỗi.

**Luồng thay thế**

- **A1 — Không nhận được kết quả trong 60 giây:** frontend dừng trạng thái chờ và gợi ý xem tab “Lần quét gần đây”.

**Luồng ngoại lệ**

- **E1 — Node đang tắt giám sát:** `409 SOE-MON-409` “Node đang tắt giám sát.”
- **E2 — Gọi quá nhanh:** `429`, frontend hiện “Vui lòng đợi {n} giây.”
- **E3 — VIEWER gọi API:** `403`.
- **E4 — Node không tồn tại:** `404`.

**Hậu điều kiện:** có thêm một bản ghi quét và snapshot mới; sự cố được đánh giá lại ngay.
**Test case:** TC-MON-API-001…008, TC-MON-E2E-001…003

---

## UC-MON-03 — Xử lý node không truy cập được

| Mục | Nội dung |
|---|---|
| **Actor chính** | Worker giám sát (hệ thống) |
| **Actor phụ** | Incident, Notification, Realtime, Kỹ sư vận hành |
| **Kích hoạt** | Kết nối SSH thất bại sau các lần retry nội bộ |

**Luồng chính**

1. Worker thử kết nối; gặp lỗi (timeout, từ chối, xác thực sai).
2. Worker retry tối đa 2 lần trong cùng message với backoff ngắn.
3. Vẫn thất bại ⇒ phân loại `failureKind` (`ConnectTimeout`, `AuthFailed`, `HostKeyMismatch`, `CommandTimeout`, `Unknown`).
4. Worker ghi `CheckRuns` (`outcome = Failed`) và phát `NodeUnreachableV1` với thông điệp đã lọc sạch credential.
5. Incident mở sự cố tương ứng (`NODE_UNREACHABLE`, `AUTH_FAILED`, `HOST_KEY_MISMATCH`) mức CRITICAL ngay lần đầu.
6. Notification gửi cảnh báo tới các kênh phù hợp; Realtime đẩy `NodeStatusChanged`; Metrics đặt `status = UNREACHABLE`.
7. Kỹ sư vận hành nhận cảnh báo, kiểm tra máy chủ.
8. Khi máy chủ hoạt động trở lại, lần quét kế tiếp thành công ⇒ Incident tự đóng sự cố (UC-INC-04), Realtime cập nhật trạng thái.

**Luồng thay thế**

- **A1 — Sai xác thực do đổi mật khẩu trên máy chủ:** ADMIN cập nhật credential (UC-INV-02/A1); sự cố đóng khi quét thành công.
- **A2 — Máy chủ ngừng vĩnh viễn:** ADMIN tắt giám sát hoặc xóa node; sự cố được đóng theo BR-INV-005.

**Luồng ngoại lệ**

- **E1 — Toàn bộ node cùng lỗi (mất mạng/firewall):** số sự cố tăng đột biến → Notification gom thành thông báo digest (FR-NTF-020) và cảnh báo vận hành `SoeScanCoverageLow`.
- **E2 — Lỗi chập chờn:** nhờ hysteresis và auto-resolve, sự cố `NODE_UNREACHABLE` đóng ngay khi quét lại thành công, tránh nhiễu.

**Hậu điều kiện:** mọi lần quét thất bại đều có dấu vết chẩn đoán và đúng một sự cố mở cho mỗi node.
**BR:** BR-INC-001, BR-MON-007 · **NFR:** NFR-AVL-005
**Test case:** TC-MON-INT-013…020, TC-INC-INT-010…014, TC-NTF-INT-008
