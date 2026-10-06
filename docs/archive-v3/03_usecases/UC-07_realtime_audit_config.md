# UC-RTM / UC-AUD / UC-GW — Realtime, Kiểm toán, Cấu hình & Kiểm soát truy cập

---

## UC-RTM-01 — Theo dõi cập nhật thời gian thực

| Mục | Nội dung |
|---|---|
| **Actor chính** | VIEWER / OPERATOR / ADMIN · **Actor phụ**: Realtime Service |
| **Ưu tiên** | Must · **Tần suất**: suốt phiên làm việc |
| **Tiền điều kiện** | Người dùng đã đăng nhập; trình duyệt hỗ trợ WebSocket |
| **Kích hoạt** | Ứng dụng khởi tạo sau khi đăng nhập |

**Luồng chính**

1. Frontend mở kết nối tới `/hubs/monitoring` kèm access token, chỉ dùng transport WebSocket.
2. Realtime xác thực token, thêm kết nối vào nhóm `authenticated` (và `admins` nếu là ADMIN).
3. Frontend gọi `SubscribeAll()` khi ở Dashboard, `SubscribeNode(nodeId)` khi vào Node Detail.
4. Khi có sự kiện (metric mới, sự cố mở/nâng cấp/xác nhận/đóng, trạng thái node đổi), Realtime đẩy tới các nhóm tương ứng.
5. Frontend ghi dữ liệu vào cache React Query, cập nhật giao diện không nhấp nháy; sự cố mới hiện toast.
6. Chỉ báo “Trực tuyến” hiển thị ở header.

**Luồng thay thế**

- **A1 — Rời trang node:** gọi `UnsubscribeNode(nodeId)` để giảm lưu lượng.
- **A2 — Kết nối lại:** sau khi khôi phục, client nhận gói “trạng thái hiện tại” để đồng bộ dữ liệu đã bỏ lỡ.
- **A3 — Tab ẩn lâu:** tạm dừng cập nhật biểu đồ, đồng bộ lại khi quay lại.

**Luồng ngoại lệ**

- **E1 — Mất kết nối:** tự kết nối lại với backoff `[0, 2s, 10s, 30s]`; quá 30 giây thì bật polling 30 giây và đổi chỉ báo sang “Đang kết nối lại”.
- **E2 — Token hết hạn:** server đóng kết nối; client refresh token rồi kết nối lại.
- **E3 — Vượt 10 kết nối/người dùng:** kết nối cũ nhất bị đóng, client đó chuyển sang polling.
- **E4 — Redis backplane lỗi:** mỗi instance vẫn phát cho client của mình; một phần cập nhật xuyên instance bị chậm (suy giảm có kiểm soát).
- **E5 — WebSocket bị chặn bởi proxy doanh nghiệp:** ứng dụng vẫn dùng được nhờ polling dự phòng.

**Hậu điều kiện:** người dùng thấy dữ liệu mới trong ≤ 2 giây mà không cần tải lại trang; mất realtime không làm mất chức năng.
**BR:** BR-RTM-001…005 · **NFR:** NFR-PERF-011, NFR-SCL-004
**Test case:** TC-RTM-INT-001…010, TC-RTM-E2E-001…006

---

## UC-AUD-01 — Tra cứu nhật ký kiểm toán

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN · **Tiền điều kiện**: đăng nhập vai trò ADMIN |
| **Kích hoạt** | ADMIN mở màn hình `AuditLogs`, thường khi điều tra một thay đổi hoặc sự cố bảo mật |

**Luồng chính**

1. Hệ thống hiển thị nhật ký 7 ngày gần nhất, mới nhất trước, có phân trang.
2. ADMIN lọc theo khoảng thời gian, người thực hiện, hành động, loại đối tượng, hoặc tìm theo từ khóa (debounce 300 ms).
3. Frontend gọi `GET /audit-logs` với tham số lọc; bộ lọc được lưu trong URL để chia sẻ.
4. ADMIN mở một bản ghi để xem chi tiết: giá trị trước/sau dạng diff hai cột, trường nhạy cảm hiển thị `***`, kèm `correlationId`.
5. (Tùy chọn) ADMIN mở “Dòng thời gian của đối tượng” để xem toàn bộ thao tác trên một node/sự cố.
6. (Tùy chọn) ADMIN xuất CSV; hệ thống xác nhận số dòng và ghi `AUDIT_EXPORTED`.

**Luồng thay thế**

- **A1 — Kiểm tra toàn vẹn:** ADMIN gọi “Kiểm tra toàn vẹn” cho một khoảng thời gian; hệ thống xác minh chuỗi băm và báo `isIntact`.
- **A2 — Truy vết theo correlationId:** dán mã vào ô tìm kiếm để xem toàn bộ chuỗi thao tác của một request.

**Luồng ngoại lệ**

- **E1 — Khoảng thời gian > 90 ngày:** `400`; frontend chặn và giải thích giới hạn.
- **E2 — Không phải ADMIN:** không thấy mục menu; truy cập trực tiếp URL nhận `403`.
- **E3 — Không có kết quả:** hiển thị trạng thái rỗng kèm gợi ý nới lỏng bộ lọc.
- **E4 — Phát hiện chuỗi băm gãy:** hiển thị cảnh báo đỏ và hướng dẫn liên hệ đội bảo mật.

**Hậu điều kiện:** ADMIN xác định được ai đã thay đổi gì và khi nào; chính hành động tra cứu cũng được ghi lại.
**BR:** BR-AUD-001…006 · **NFR:** NFR-SEC-012
**Test case:** TC-AUD-API-001…012, TC-AUD-E2E-001…004, TC-AUD-SEC-001…003

---

## UC-GW-01 — Cấu hình hệ thống

| Mục | Nội dung |
|---|---|
| **Actor chính** | ADMIN · **Actor phụ**: Monitoring, Incident, Notification, Audit |
| **Kích hoạt** | ADMIN mở màn hình `SystemConfig` |

**Luồng chính**

1. Frontend gọi `GET /api/v1/system-config`; gateway tổng hợp dữ liệu từ các service sở hữu.
2. Hệ thống hiển thị 4 nhóm: Giám sát, Ngưỡng cảnh báo, Email/SMTP, Báo cáo hằng ngày, cùng trạng thái phụ thuộc (DB, RabbitMQ, Redis, SMTP).
3. ADMIN chỉnh một nhóm và bấm “Lưu” của riêng nhóm đó.
4. Frontend validate, hiển thị hộp thoại xác nhận với thay đổi nhạy cảm (tắt scheduler, đổi ngưỡng).
5. Gọi endpoint tương ứng (`/system-config/scheduler`, `/threshold-policies/global`, `/system-config/smtp`, `/system-config/daily-report`).
6. Service sở hữu validate nghiệp vụ, lưu, áp dụng ngay (không cần khởi động lại).
7. Audit ghi lại giá trị trước/sau; frontend hiện toast và cập nhật giá trị từ response.

**Luồng thay thế**

- **A1 — Kiểm tra SMTP trước khi lưu:** ADMIN bấm “Kiểm tra kết nối SMTP”; chỉ lưu khi thành công (hoặc xác nhận lưu kèm cảnh báo).
- **A2 — Tắt scheduler khẩn cấp:** xác nhận hai bước; Dashboard hiển thị “Giám sát đang tạm dừng”.

**Luồng ngoại lệ**

- **E1 — Giá trị không hợp lệ (chu kỳ 10 giây, `warning ≥ critical`):** `400` kèm lỗi theo field.
- **E2 — Một service phụ thuộc không phản hồi:** nhóm cấu hình đó hiển thị “Không tải được”, các nhóm khác vẫn dùng bình thường.
- **E3 — Vai trò bị đổi giữa chừng:** `403` ⇒ chuyển về Dashboard kèm thông báo.
- **E4 — Hai ADMIN sửa cùng lúc:** `409`, yêu cầu tải lại.

**Hậu điều kiện:** cấu hình mới có hiệu lực ngay và có dấu vết kiểm toán.
**BR:** BR-GW-005 · **Test case:** TC-GW-API-010…020, TC-GW-E2E-004…008

---

## UC-GW-02 — Chặn truy cập trái phép

| Mục | Nội dung |
|---|---|
| **Actor chính** | Gateway (hệ thống) · **Actor phụ**: Identity, Audit |
| **Ưu tiên** | Must · **Tần suất**: mỗi request |
| **Kích hoạt** | Có request tới `/api/v1/**` hoặc `/hubs/**` |

**Luồng chính**

1. Gateway nhận request, sinh hoặc nhận `X-Correlation-Id`, **xóa** các header nhận dạng do client tự gắn.
2. Kiểm tra route có được khai báo không; không có ⇒ `404` (deny by default).
3. Kiểm tra CORS với origin trong danh sách cho phép.
4. Kiểm tra rate limit theo policy tương ứng.
5. Xác thực JWT: chữ ký RS256 theo JWKS, `iss`, `aud`, `exp`, thuật toán hợp lệ.
6. Kiểm tra policy phân quyền của route (`ViewerOrAbove` / `OperatorOrAbove` / `AdminOnly`).
7. Gắn `X-User-Id`, `X-User-Role` lấy từ token và chuyển tiếp tới service; service kiểm tra lại quyền.
8. Ghi log truy cập có cấu trúc (không ghi body, không ghi token).

**Luồng ngoại lệ**

- **E1 — Thiếu/sai token:** `401` + `ProblemDetails`, không tiết lộ lý do chi tiết.
- **E2 — Token bị sửa chữ ký, `alg=none`, hoặc đổi sang HS256:** từ chối `401`; ghi sự kiện bảo mật.
- **E3 — Token hợp lệ nhưng sai vai trò:** `403 SOE-GW-403` “Bạn không có quyền thực hiện thao tác này.”
- **E4 — Vượt rate limit:** `429` + `Retry-After`; vượt liên tục ⇒ ghi audit cảnh báo.
- **E5 — Body vượt 1 MB:** `413`.
- **E6 — Service đích không sẵn sàng:** `503`/`504` chuẩn hóa, không lộ tên service hay stack trace.
- **E7 — Client tự gắn `X-User-Role: ADMIN`:** header bị xóa ở bước 1 ⇒ không có tác dụng nâng quyền.

**Hậu điều kiện:** chỉ request hợp lệ và đúng quyền mới tới được service; mọi từ chối đều có log truy vết.
**BR:** BR-GW-001…004 · **NFR:** NFR-SEC-001, 008, 010, 011
**Test case:** TC-GW-SEC-001…020, TC-GW-API-001…009
