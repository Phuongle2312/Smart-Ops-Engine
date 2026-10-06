# TC-07 — Realtime Service (`RTM`)

> SRS: [07_realtime.md](../02_srs/07_realtime.md) · Use case: [UC-07](../03_usecases/UC-07_realtime_audit_config.md)

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-RTM-INT-001 | Kết nối có token hợp lệ | Người dùng đăng nhập | Mở kết nối `/hubs/monitoring?access_token=…` | — | Kết nối thành công, transport WebSocket | Functional | P1 | FR-RTM-001 |
| TC-RTM-INT-002 | Kết nối không token | — | Mở kết nối không token | — | Bị từ chối 401, không vào được hub | Security | P1 | FR-RTM-001 |
| TC-RTM-INT-003 | Token giả mạo | — | Kết nối với JWT sửa payload | — | Bị từ chối | Security | P1 | NFR-SEC-005 |
| TC-RTM-INT-004 | Đẩy metric tới nhóm all-nodes | Client đã `SubscribeAll()` | Publish `MetricCollectedV1` | — | Client nhận `MetricCollected` đúng nội dung trong ≤ 2 giây | Functional | P1 | FR-RTM-002 |
| TC-RTM-INT-005 | Đẩy metric tới nhóm node | Client `SubscribeNode(A)` | Publish metric của node B | — | Client **không** nhận sự kiện của node B trong nhóm `node:A` | Functional | P2 | FR-RTM-005 |
| TC-RTM-INT-006 | Đẩy sự cố tới mọi client | 3 client đã xác thực | Publish `IncidentOpenedV1` | — | Cả 3 nhận `IncidentOpened` | Functional | P1 | FR-RTM-003 |
| TC-RTM-INT-007 | Đẩy trạng thái node | — | Publish `NodeUnreachableV1` | — | Client nhận `NodeStatusChanged` với `reason` | Functional | P2 | FR-RTM-004 |
| TC-RTM-INT-008 | Nhiều instance đều phát | 2 instance Realtime, client chia đều | Publish một sự kiện | — | Mọi client đều nhận đúng một lần (queue riêng mỗi instance) | Reliability | P1 | FR-RTM-006 |
| TC-RTM-INT-009 | Redis backplane lỗi | Dừng Redis | Publish sự kiện | — | Client của mỗi instance vẫn nhận; hệ thống không sập | Reliability | P2 | UC-RTM-01/E4 |
| TC-RTM-INT-010 | Giới hạn kết nối/người dùng | 10 kết nối cùng tài khoản | Mở kết nối thứ 11 | — | Kết nối cũ nhất bị đóng, tổng vẫn 10 | Security | P2 | FR-RTM-007 |
| TC-RTM-INT-011 | Đóng khi token hết hạn | Token còn 10 giây | Chờ hết hạn | — | Server đóng kết nối; client kết nối lại bằng token mới | Security | P1 | FR-RTM-009 |
| TC-RTM-INT-012 | Không đẩy dữ liệu nhạy cảm | — | Bắt mọi payload gửi xuống client | — | Không có credential, không có thông tin người dùng khác ngoài tên hiển thị | Security | P1 | BR-RTM-001 |
| TC-RTM-INT-013 | Sự kiện quản trị không tới VIEWER | Client VIEWER | Publish sự kiện nhóm `admins` | — | VIEWER không nhận | Security | P2 | BR-RTM-002 |
| TC-RTM-INT-014 | Gộp sự kiện khi bão | 200 metric trong 1 giây | Publish liên tiếp | — | Tối đa 20 sự kiện/giây/kết nối, dữ liệu được gộp theo lô 500 ms | Performance | P2 | SRS §7 |
| TC-RTM-INT-015 | Token trong query bị che trong log | — | Kết nối rồi đọc log gateway/service | — | Không thấy giá trị token trong log | Security | P1 | BR-RTM-005 |
| TC-RTM-PERF-001 | 200 kết nối đồng thời | Môi trường staging | Mở 200 kết nối, publish 50 sự kiện/giây | — | CPU pod < 60%, độ trễ p95 ≤ 2 giây, không rớt kết nối | Performance | P1 | NFR-SCL-004, NFR-PERF-011 |
| TC-RTM-E2E-001 | Một kết nối cho toàn ứng dụng | Đăng nhập | Điều hướng qua 4 màn hình | — | Chỉ một kết nối WebSocket tồn tại | Performance | P2 | FR-RTM-FE-001 |
| TC-RTM-E2E-002 | Chỉ báo trạng thái kết nối | Đang trực tuyến | Ngắt mạng | — | Chỉ báo chuyển “Đang kết nối lại” (vàng) rồi “Ngoại tuyến” (xám) | UI/UX | P1 | FR-RTM-FE-003 |
| TC-RTM-E2E-003 | Tự kết nối lại | Mất mạng 20 giây | Bật mạng lại | — | Kết nối lại tự động, chỉ báo về “Trực tuyến”, dữ liệu đồng bộ | Reliability | P1 | FR-RTM-FE-002 |
| TC-RTM-E2E-004 | Fallback polling | Chặn WebSocket | Mở ứng dụng | — | Sau 30 giây chuyển polling 30 giây; mọi chức năng vẫn dùng được | Reliability | P1 | BR-RTM-003 |
| TC-RTM-E2E-005 | Cập nhật cache không refetch | Đang ở Dashboard | Kích hoạt metric mới | — | Giao diện cập nhật; tab Network không có request danh sách mới | Performance | P1 | FR-RTM-FE-004 |
| TC-RTM-E2E-006 | Subscribe/Unsubscribe theo trang | — | Vào Node Detail rồi rời trang | — | Gọi `SubscribeNode` khi vào, `UnsubscribeNode` khi rời | Functional | P2 | FR-RTM-FE-005 |
| TC-RTM-E2E-007 | Bỏ qua sự kiện cũ | — | Gửi sự kiện có `occurredAt` cũ hơn dữ liệu hiện tại | — | Giao diện không bị lùi dữ liệu | Reliability | P2 | FR-RTM-FE-006 |
| TC-RTM-E2E-008 | Không rò rỉ kết nối khi đăng xuất | Đang kết nối | Đăng xuất | — | Kết nối WebSocket được đóng; không còn sự kiện nào tới | Security | P2 | FR-RTM-FE-001 |
