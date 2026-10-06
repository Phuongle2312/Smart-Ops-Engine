# UC-MET — Xem chỉ số & lịch sử

---

## UC-MET-01 — Xem dashboard tổng quan

| Mục | Nội dung |
|---|---|
| **Actor chính** | VIEWER / OPERATOR / ADMIN |
| **Actor phụ** | Metrics, Incident, Monitoring, Realtime |
| **Ưu tiên** | Must · **Tần suất**: liên tục trong giờ làm việc |
| **Tiền điều kiện** | Người dùng đã đăng nhập |
| **Kích hoạt** | Người dùng mở `/app/dashboard` (trang mặc định sau đăng nhập) |

**Luồng chính**

1. Frontend tải song song: `GET /metrics/health-summary`, `GET /metrics/latest`, `GET /incidents?status=OPEN&pageSize=5`, `GET /monitoring/status` (tối đa 6 request — NFR-PERF).
2. Trong lúc chờ, hiển thị skeleton giữ đúng bố cục (tránh CLS).
3. Hệ thống hiển thị:
   - Thẻ tổng quan: tổng node, đang giám sát, bình thường, cảnh báo, nguy cấp, không liên lạc được.
   - Danh sách node kèm thanh CPU/RAM/Disk có màu theo ngưỡng và nhãn chữ.
   - Khối “Sự cố gần đây” (5 sự cố mới nhất, có liên kết chi tiết).
   - Thẻ trạng thái giám sát: chu kỳ hiện tại, thời điểm chu kỳ gần nhất, số node quét lỗi.
4. Frontend mở kết nối SignalR, tham gia nhóm `all-nodes`.
5. Mỗi khi có `MetricCollected`, cập nhật trực tiếp cache (không gọi lại API); có `IncidentOpened` thì cập nhật bộ đếm và danh sách, hiện toast.

**Luồng thay thế**

- **A1 — Mất kết nối realtime:** hiện chỉ báo “Đang kết nối lại”; sau 30 giây chuyển sang polling 30 giây (BR-RTM-003).
- **A2 — Dữ liệu cũ:** node có `isStale = true` hiển thị nhãn “Dữ liệu cũ · {thời điểm}”.
- **A3 — Chưa có node nào:** hiển thị trạng thái rỗng kèm hướng dẫn “Thêm máy chủ đầu tiên” (nút chỉ hiện với ADMIN).
- **A4 — Tab bị ẩn > 5 phút:** tạm dừng cập nhật biểu đồ; khi quay lại thì đồng bộ bằng một lần gọi API.

**Luồng ngoại lệ**

- **E1 — API lỗi 5xx:** hiển thị khối lỗi kèm nút “Thử lại”; các khối khác vẫn hiển thị bình thường.
- **E2 — Token hết hạn:** tự refresh (UC-IDN-02); người dùng không bị gián đoạn.
- **E3 — Hệ thống đang bảo trì:** hiện thông báo bảo trì, chỉ cho phép xem.

**Hậu điều kiện:** người dùng thấy tình trạng toàn hệ thống trong ≤ 2,5 giây kể từ khi mở trang.
**NFR:** NFR-PERF-003, 020, 021, 022; NFR-USA-002, 004
**Test case:** TC-MET-API-001…006, TC-MET-E2E-001…005, TC-MET-PERF-001…003

---

## UC-MET-02 — Xem lịch sử chỉ số một node

| Mục | Nội dung |
|---|---|
| **Actor chính** | VIEWER+ · **Tiền điều kiện**: node tồn tại |
| **Kích hoạt** | Người dùng bấm tên node ở danh sách, mở `/app/nodes/{id}` |

**Luồng chính**

1. Frontend gọi `GET /nodes/{id}`, `GET /nodes/{id}/metrics?range=24h`, `GET /nodes/{id}/metrics/summary`, `GET /incidents?nodeId={id}`.
2. Hệ thống hiển thị: thông tin node, chỉ số hiện tại, biểu đồ đường CPU/RAM/Disk 24 giờ có đường ngưỡng cảnh báo/nguy cấp, tóm tắt (trung bình/đỉnh 24h, xu hướng đĩa, dự báo đầy đĩa), danh sách sự cố của node, bảng các lần quét gần đây.
3. Người dùng đổi dải thời gian (1h / 24h / 7d / 30d); frontend gọi lại API với `range` tương ứng, giữ dữ liệu cũ làm nền (`keepPreviousData`).
4. Backend tự chọn nguồn: ≤ 24h dùng snapshot thô, > 24h dùng rollup theo giờ; trả tối đa 500 điểm kèm `resolution`.
5. Frontend vẽ biểu đồ; tooltip hiển thị thời gian theo múi giờ người dùng và giá trị trung bình/đỉnh.
6. SignalR `SubscribeNode(nodeId)`: điểm dữ liệu mới được nối vào biểu đồ 1h theo thời gian thực.

**Luồng thay thế**

- **A1 — Node chưa có dữ liệu:** hiển thị trạng thái rỗng “Chưa có dữ liệu giám sát” + nút “Kiểm tra ngay” (OPERATOR+).
- **A2 — Khoảng tùy chỉnh:** người dùng chọn `from`/`to`; hệ thống áp dụng giới hạn 90 ngày.
- **A3 — Một metric bị tắt giám sát:** biểu đồ tương ứng hiển thị thông báo “Đang không giám sát {metric}”.

**Luồng ngoại lệ**

- **E1 — Node không tồn tại/đã xóa:** `404`; hiển thị “Không tìm thấy máy chủ” + nút quay lại danh sách.
- **E2 — Dải thời gian quá lớn:** `400 SOE-MET-400`; frontend chặn từ trước và giải thích giới hạn 90 ngày.
- **E3 — Có điểm `null`:** biểu đồ ngắt đường, tooltip ghi “Không thu được dữ liệu” (BR-MET-001).
- **E4 — Rời trang khi đang tải:** hủy request (AbortController), không cập nhật state.

**Hậu điều kiện:** người dùng thấy xu hướng tài nguyên theo dải thời gian đã chọn.
**NFR:** NFR-PERF-004, NFR-SCL-007 · **Test case:** TC-MET-API-007…018, TC-MET-E2E-006…010

---

## UC-MET-03 — Xuất dữ liệu chỉ số

| Mục | Nội dung |
|---|---|
| **Actor chính** | OPERATOR hoặc ADMIN |
| **Kích hoạt** | Người dùng bấm “Xuất CSV” ở trang Node Detail |

**Luồng chính**

1. Người dùng chọn khoảng thời gian và bấm “Xuất CSV”.
2. Hệ thống hiển thị hộp thoại xác nhận kèm số dòng ước tính.
3. Frontend gọi `GET /nodes/{id}/metrics/export?from=&to=`.
4. Metrics xuất theo luồng (streaming) CSV với `Content-Disposition`, tối đa 100.000 dòng.
5. Trình duyệt tải tệp; Audit ghi `METRICS_EXPORTED`.

**Luồng ngoại lệ**

- **E1 — Vượt giới hạn dòng:** `400` kèm thông báo đề nghị thu hẹp khoảng thời gian.
- **E2 — VIEWER thao tác:** không thấy nút; gọi API nhận `403`.
- **E3 — Kết nối gián đoạn khi tải:** người dùng tải lại; hệ thống không giữ trạng thái dở dang.

**Hậu điều kiện:** tệp CSV được tải về; hành động có dấu vết kiểm toán.
**Test case:** TC-MET-API-019…022, TC-AUD-INT-006
