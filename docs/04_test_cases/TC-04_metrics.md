# TC-04 — Metrics Service (`MET`)

> SRS: [04_metrics.md](../02_srs/04_metrics.md) · Use case: [UC-04_metrics.md](../03_usecases/UC-04_metrics.md)

## 1. Backend

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-MET-INT-001 | Lưu snapshot từ event | Bus chạy | Publish `MetricCollectedV1` | cpu 42.5, mem 71.8, disk 91.2 | Một bản ghi `MetricSnapshots` đúng giá trị và `CollectedAt` (UTC) | Functional | P1 | FR-MET-001 |
| TC-MET-INT-002 | Bỏ qua bản trùng | Đã lưu snapshot | Publish lại cùng message | — | Vẫn chỉ 1 bản ghi (unique `(NodeId, CollectedAt)`) | Reliability | P1 | FR-MET-002, NFR-AVL-003 |
| TC-MET-INT-003 | Ghi theo lô | 500 event trong 1 giây | Theo dõi số lệnh INSERT | — | Ghi theo lô (≤ 10 lệnh), không mất bản ghi nào | Performance | P2 | NFR-SCL-005 |
| TC-MET-INT-004 | Cập nhật `MetricLatest` | — | Publish 2 snapshot liên tiếp | — | `MetricLatest` giữ bản mới nhất, `status` tính đúng theo ngưỡng | Functional | P1 | FR-MET-003 |
| TC-MET-INT-005 | Trạng thái UNREACHABLE | — | Publish `NodeUnreachableV1` | — | `MetricLatest.status = UNREACHABLE` | Functional | P2 | FR-MET-003 |
| TC-MET-INT-006 | Trạng thái MONITORING_OFF | — | Publish `NodeMonitoringToggledV1 {isActive:false}` | — | `status = MONITORING_OFF` | Functional | P2 | FR-MET-003 |
| TC-MET-INT-007 | Giá trị null được giữ nguyên | — | Publish snapshot có `cpuPercent = null` | — | Cột `CpuPercent` là NULL (không phải 0 hay -1) | Functional | P1 | BR-MET-001 |
| TC-MET-INT-008 | Bản ghi mồ côi | Node chưa tồn tại trong read model | Publish snapshot | — | Ghi log cảnh báo, bỏ qua, không làm chết consumer | Reliability | P2 | FR-MET-013 |
| TC-MET-INT-009 | Job rollup theo giờ | Có 12 snapshot trong 1 giờ | Chạy job rollup | — | Một bản ghi `MetricHourlyRollups` với avg/min/max/sampleCount đúng | Functional | P1 | FR-MET-007 |
| TC-MET-INT-010 | Job retention | Có dữ liệu 100 ngày | Chạy job retention | — | Snapshot > 90 ngày bị xóa bằng partition switch; rollup vẫn còn; thời gian chạy < 30 giây | Performance | P2 | FR-MET-008 |
| TC-MET-INT-011 | Job chỉ chạy một instance | 2 replica Metrics | Chạy job rollup | — | Chỉ một instance thực thi (khóa phân tán), không sinh bản ghi trùng | Reliability | P2 | deployment §4 |
| TC-MET-INT-012 | Xóa node | Có dữ liệu | Publish `NodeDeletedV1` | — | Dữ liệu được đánh dấu lưu trữ, vẫn truy vấn được, xóa sau 30 ngày | Functional | P2 | FR-MET-009 |
| TC-MET-API-001 | Metric mới nhất toàn hệ thống | 50 node có dữ liệu | `GET /metrics/latest` | — | 200, 50 phần tử, mỗi phần tử có `status`, `isStale`, `collectedAt` | Functional | P1 | FR-MET-004 |
| TC-MET-API-002 | Cờ dữ liệu cũ | Node không có dữ liệu 20 phút (chu kỳ 5 phút) | `GET /metrics/latest` | — | `isStale = true` cho node đó | Functional | P2 | FR-MET-004 |
| TC-MET-API-003 | Cache Redis | — | Gọi `metrics/latest` 2 lần trong 5 giây | — | Lần 2 phục vụ từ cache, không truy vấn DB; độ trễ giảm rõ rệt | Performance | P2 | FR-MET-012 |
| TC-MET-API-004 | Tổng hợp sức khỏe | Có node ở nhiều trạng thái | `GET /metrics/health-summary` | — | Số đếm đúng theo từng trạng thái | Functional | P1 | FR-MET-004 |
| TC-MET-API-005 | Lịch sử 24h dùng dữ liệu thô | Node có 288 snapshot | `GET /nodes/{id}/metrics?range=24h` | — | 200, `resolution="5m"`, ≤ 288 điểm | Functional | P1 | FR-MET-005, 006 |
| TC-MET-API-006 | Lịch sử 7 ngày dùng rollup | Có rollup 7 ngày | `range=7d` | — | `resolution="1h"`, ≈ 168 điểm, có `avg` và `max` | Functional | P1 | FR-MET-006 |
| TC-MET-API-007 | Lịch sử 30 ngày | Có rollup 30 ngày | `range=30d` | — | ≤ 500 điểm, `resolution` ≥ 1h | Performance | P1 | BR-MET-005 |
| TC-MET-API-008 | Khoảng tùy chỉnh | — | `?from=…&to=…` (3 ngày) | — | 200, dữ liệu trong đúng khoảng | Functional | P2 | FR-MET-005 |
| TC-MET-API-009 | `range` và `from/to` cùng lúc | — | Gửi cả hai | — | 400 `SOE-MET-400` | Validation | P2 | BR-MET-003 |
| TC-MET-API-010 | Khoảng > 90 ngày | — | `from` cách 120 ngày | — | 400 với thông báo giới hạn | Validation | P1 | BR-MET-004 |
| TC-MET-API-011 | `range` không hợp lệ | — | `range=99y` | — | 400 | Validation | P2 | SRS §5 |
| TC-MET-API-012 | `maxPoints` vượt giới hạn | — | `maxPoints=100000` | — | 400 hoặc giới hạn về 500 | Security | P2 | OWASP API4 |
| TC-MET-API-013 | Lọc theo metric | — | `?metrics=disk` | — | Chỉ trả chuỗi `disk` | Functional | P3 | FR-MET-005 |
| TC-MET-API-014 | Node không tồn tại | — | `GET /nodes/{guid-lạ}/metrics` | — | 404 `SOE-MET-404` | Functional | P2 | — |
| TC-MET-API-015 | Không có dữ liệu | Node mới tạo | `GET /nodes/{id}/metrics?range=24h` | — | 200 với mảng rỗng (không phải 404) | Functional | P2 | UC-MET-02/A1 |
| TC-MET-API-016 | Tóm tắt & dự báo | Node có 7 ngày dữ liệu đĩa tăng dần | `GET /nodes/{id}/metrics/summary` | — | Trả `avg24h`, `peak24h`, `diskTrendPerDay` > 0, `diskFullEtaDays` hợp lý | Functional | P3 | FR-MET-010 |
| TC-MET-API-017 | Xuất CSV | OPERATOR | `GET /nodes/{id}/metrics/export?from=&to=` | — | 200, `Content-Disposition` đúng, dòng đầu là tiêu đề cột | Functional | P3 | FR-MET-011 |
| TC-MET-API-018 | Xuất CSV vượt giới hạn | Khoảng rất lớn | như trên | — | 400 gợi ý thu hẹp khoảng | Validation | P3 | FR-MET-011 |
| TC-MET-API-019 | VIEWER xuất CSV | Đăng nhập VIEWER | như trên | — | 403 | Security | P2 | RBAC |
| TC-MET-API-020 | Quyền đọc metric | VIEWER | `GET /metrics/latest` | — | 200 (VIEWER được xem) | Security | P1 | RBAC |
| TC-MET-PERF-001 | Độ trễ `metrics/latest` | 500 node, 30 người dùng | k6 60 giây | — | p95 ≤ 400 ms, lỗi 0% | Performance | P1 | NFR-PERF-003 |
| TC-MET-PERF-002 | Truy vấn 30 ngày | 500 node × 90 ngày dữ liệu | k6 | — | p95 ≤ 700 ms | Performance | P1 | NFR-PERF-004 |
| TC-MET-PERF-003 | Ghi 1.000 snapshot/phút | — | Bơm tải qua bus 10 phút | — | Queue không dồn > 500; CPU pod < 70% | Performance | P1 | NFR-SCL-005 |

## 2. Frontend

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-MET-E2E-001 | Dashboard hiển thị đầy đủ | 50 node có dữ liệu | Mở `/app/dashboard` | — | Thẻ tổng quan, danh sách node, sự cố gần đây, trạng thái giám sát đều hiển thị đúng số liệu | Functional | P1 | FR-MET-FE-001 |
| TC-MET-E2E-002 | Số request khi mở Dashboard | — | Theo dõi tab Network | — | ≤ 6 request; không có request theo từng node | Performance | P1 | FR-MET-FE-002 |
| TC-MET-E2E-003 | Skeleton khi tải | Mạng chậm mô phỏng | Mở Dashboard | — | Hiện skeleton đúng bố cục; CLS ≤ 0,1 | UI/UX | P2 | NFR-PERF-022 |
| TC-MET-E2E-004 | Nhãn “Dữ liệu cũ” | Node `isStale` | Xem danh sách | — | Hiển thị nhãn kèm thời điểm thu thập gần nhất | UI/UX | P2 | FR-MET-FE-007 |
| TC-MET-E2E-005 | Trạng thái rỗng | Chưa có node | Mở Dashboard | — | Hiển thị hướng dẫn thêm node; nút chỉ hiện với ADMIN | UI/UX | P2 | UC-MET-01/A3 |
| TC-MET-E2E-006 | Đổi dải thời gian | Ở Node Detail | Chọn 7d rồi 30d | — | Mỗi lần gọi đúng 1 request; dữ liệu cũ giữ làm nền, không nhảy layout | Functional | P1 | FR-MET-FE-003 |
| TC-MET-E2E-007 | Đường ngưỡng trên biểu đồ | Ngưỡng disk 80/90 | Xem biểu đồ | — | Có hai đường ngưỡng kèm chú thích | UI/UX | P2 | FR-MET-FE-004 |
| TC-MET-E2E-008 | Điểm null làm đứt đường | Dữ liệu có `null` | Xem biểu đồ | — | Đường bị ngắt; tooltip ghi “Không thu được dữ liệu” | UI/UX | P1 | FR-MET-FE-005 |
| TC-MET-E2E-009 | Múi giờ hiển thị | Dữ liệu UTC | Di chuột lên biểu đồ | — | Thời gian hiển thị theo giờ trình duyệt (GMT+7) | UI/UX | P2 | NFR-USA-005 |
| TC-MET-E2E-010 | Không vẽ quá 500 điểm | `range=30d` | Kiểm tra dữ liệu biểu đồ | — | ≤ 500 điểm mỗi chuỗi | Performance | P2 | FR-MET-FE-006 |
| TC-MET-E2E-011 | Hủy request khi rời trang | Đang tải dữ liệu 30d | Rời trang ngay | — | Request bị hủy; không có cảnh báo cập nhật state sau khi unmount | Reliability | P3 | UC-MET-02/E4 |
| TC-MET-E2E-012 | Tab ẩn dừng cập nhật | Đang mở Dashboard | Chuyển tab 6 phút rồi quay lại | — | Không cập nhật khi ẩn; quay lại thì đồng bộ bằng một lần gọi API | Performance | P3 | FR-RTM-FE-007 |
