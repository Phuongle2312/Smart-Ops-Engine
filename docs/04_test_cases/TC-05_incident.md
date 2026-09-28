# TC-05 — Incident Service (`INC`)

> SRS: [05_incident.md](../02_srs/05_incident.md) · Use case: [UC-05_incident.md](../03_usecases/UC-05_incident.md)

## 1. Đánh giá ngưỡng (Unit)

Giả định chính sách mặc định: Disk 80/90, CPU 75/85, RAM 80/90; `consecutiveBreaches = 2`, `recoveryMargin = 5`, `consecutiveRecoveries = 2`.

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-INC-UNIT-001 | Dưới ngưỡng | Không có sự cố | Đánh giá 1 snapshot | disk 70% | `NORMAL`, không mở sự cố, `breachStreak = 0` | Functional | P1 | FR-INC-010 |
| TC-INC-UNIT-002 | Vượt cảnh báo lần đầu | — | 1 snapshot | disk 85% | `breachStreak = 1`, **chưa** mở sự cố | Functional | P1 | FR-INC-010 |
| TC-INC-UNIT-003 | Vượt cảnh báo lần hai | breachStreak = 1 | snapshot thứ 2 | disk 86% | Mở sự cố `DISK_HIGH` severity `WARNING` | Functional | P1 | FR-INC-010 |
| TC-INC-UNIT-004 | Vượt nguy cấp 2 lần | — | 2 snapshot | disk 92%, 93% | Mở sự cố severity `CRITICAL` | Functional | P1 | FR-INC-010 |
| TC-INC-UNIT-005 | Giá trị đúng bằng ngưỡng | — | 2 snapshot | disk 80.00% | Tính là breach (`>=`), mở WARNING | Functional | P2 | BR-INC-002 |
| TC-INC-UNIT-006 | Nâng cấp WARNING → CRITICAL | Đang có sự cố WARNING | snapshot vượt ngưỡng nguy cấp | disk 91% | Cùng sự cố, severity `CRITICAL`, phát `IncidentEscalatedV1`; **không** tạo sự cố thứ hai | Functional | P1 | FR-INC-012 |
| TC-INC-UNIT-007 | Không hạ severity | Sự cố CRITICAL | snapshot 85% | — | Vẫn CRITICAL, không có sự kiện hạ cấp | Functional | P2 | BR-INC-006 |
| TC-INC-UNIT-008 | Tái diễn tăng bộ đếm | Sự cố đang mở | 3 snapshot vượt ngưỡng | — | `occurrenceCount = 4`, `lastSeenAt` cập nhật, chỉ một bản ghi sự cố | Functional | P1 | FR-INC-011 |
| TC-INC-UNIT-009 | Hồi phục chưa đủ biên | Sự cố CRITICAL (ngưỡng 90) | snapshot 87% | — | Chưa tính là hồi phục (cần < 85) | Functional | P1 | FR-INC-013 |
| TC-INC-UNIT-010 | Hồi phục đủ biên 1 lần | như trên | snapshot 84% | — | `recoveryStreak = 1`, sự cố vẫn mở | Functional | P1 | FR-INC-013 |
| TC-INC-UNIT-011 | Tự đóng sau 2 lần hồi phục | recoveryStreak = 1 | snapshot 83% | — | Sự cố `RESOLVED`, `resolvedSource = SYSTEM` | Functional | P1 | FR-INC-013 |
| TC-INC-UNIT-012 | Chống dao động quanh ngưỡng | — | Chuỗi 91, 89, 91, 89 | — | Không mở/đóng liên tục; chỉ một sự cố tồn tại | Reliability | P1 | UC-INC-04/E1 |
| TC-INC-UNIT-013 | Metric null bị bỏ qua | — | snapshot cpu = null | — | Không đánh giá CPU, không thay đổi streak | Functional | P1 | BR-MET-001 |
| TC-INC-UNIT-014 | Metric bị tắt đánh giá | Chính sách CPU `isEnabled=false` | snapshot cpu 99% | — | Không mở sự cố | Functional | P2 | FR-INC-004 |
| TC-INC-UNIT-015 | Override theo node | Node A có ngưỡng disk 95/98 | snapshot 92% ×2 | — | Không mở sự cố cho node A (dùng override), node khác vẫn mở | Functional | P1 | FR-INC-003 |
| TC-INC-UNIT-016 | Snapshot đến muộn | `lastProcessedAt = 08:30` | snapshot `collectedAt = 08:25` | — | Bỏ qua hoàn toàn | Reliability | P1 | FR-INC-020 |
| TC-INC-UNIT-017 | Nhiều metric cùng vượt | — | snapshot cpu 90, disk 95 (×2) | — | Hai sự cố riêng `CPU_HIGH` và `DISK_HIGH` | Functional | P1 | UC-INC-01/A4 |
| TC-INC-UNIT-018 | Mô tả tiếng Việt đúng mẫu | — | Mở sự cố disk 91.2 | — | “Disk / đạt 91.2% (ngưỡng nguy cấp 90%)” | UI/UX | P2 | BR-INC-008 |
| TC-INC-UNIT-019 | Acknowledge sự cố đã đóng | Sự cố RESOLVED | Gọi `Acknowledge()` | — | Trả `Result.Failure`, trạng thái không đổi | Functional | P1 | BR-INC-003 |
| TC-INC-UNIT-020 | Auto-resolve không ghi đè ghi chú người dùng | Sự cố đã ACK có ghi chú | Hồi phục đủ | — | Đóng tự động, giữ nguyên `resolutionAction` người dùng nhập | Functional | P2 | BR-INC-004 |

## 2. Integration

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-INC-INT-001 | Mở sự cố phát event | Bus chạy | Publish 2 snapshot vượt ngưỡng | — | Một `IncidentOpenedV1` đúng nội dung, phát sau khi commit (outbox) | Integration | P1 | FR-INC-010 |
| TC-INC-INT-002 | Ràng buộc dedup ở CSDL | Sự cố `DISK_HIGH` đang mở | Cố chèn sự cố thứ hai cùng `(node,type)` | — | CSDL từ chối (unique filtered index) | Reliability | P1 | BR-INC-001 |
| TC-INC-INT-003 | Message trùng | — | Publish cùng `MetricCollectedV1` 3 lần | — | `occurrenceCount` chỉ tăng 1 lần | Reliability | P1 | NFR-AVL-003 |
| TC-INC-INT-004 | Hai snapshot đồng thời | — | Publish song song 2 snapshot cùng node | — | Không tạo 2 sự cố; xung đột được retry thành công | Reliability | P1 | UC-INC-01/E2 |
| TC-INC-INT-005 | Node không liên lạc được | — | Publish `NodeUnreachableV1` | — | Mở `NODE_UNREACHABLE` CRITICAL ngay lần đầu | Functional | P1 | FR-INC-014 |
| TC-INC-INT-006 | Node liên lạc lại | Có sự cố NODE_UNREACHABLE | Publish `MetricCollectedV1` thành công | — | Sự cố tự đóng ngay | Functional | P1 | FR-INC-015 |
| TC-INC-INT-007 | Host key mismatch | — | Publish `NodeUnreachableV1` `failureKind=HostKeyMismatch` | — | Mở sự cố `HOST_KEY_MISMATCH` CRITICAL | Security | P1 | FR-INC-014 |
| TC-INC-INT-008 | Tắt giám sát đóng sự cố | Node có 2 sự cố mở | Publish `NodeMonitoringToggledV1 {isActive:false}` | — | Cả 2 đóng với lý do hệ thống | Functional | P1 | FR-INC-018 |
| TC-INC-INT-009 | Xóa node đóng sự cố | Node có sự cố mở | Publish `NodeDeletedV1` | — | Sự cố đóng; `NodeName` vẫn hiển thị được | Functional | P1 | BR-INC-005 |
| TC-INC-INT-010 | Ghi nhật ký vòng đời | — | Mở → tái diễn → nâng cấp → ACK → đóng | — | 5 bản ghi `IncidentEvents` đúng thứ tự | Functional | P2 | FR-INC-019 |
| TC-INC-INT-011 | Đổi chính sách không hồi tố | Sự cố đang mở với ngưỡng 90 | Đổi ngưỡng thành 95 | — | Sự cố hiện tại giữ nguyên; snapshot kế tiếp dùng ngưỡng mới | Functional | P2 | FR-INC-005 |
| TC-INC-INT-012 | Hiệu năng xử lý event | — | Publish 1.000 snapshot | — | p95 xử lý ≤ 50 ms/message, không dồn queue | Performance | P2 | SRS §10 |

## 3. API

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-INC-API-001 | Danh sách có lọc & phân trang | ≥ 30 sự cố | `GET /incidents?status=OPEN&severity=CRITICAL&page=1&pageSize=10` | — | 200, đúng bộ lọc, mới nhất trước | Functional | P1 | FR-INC-030 |
| TC-INC-API-002 | Lọc theo node và thời gian | — | `?nodeId=…&from=…&to=…` | — | Chỉ sự cố khớp | Functional | P2 | FR-INC-030 |
| TC-INC-API-003 | Response là DTO | — | Gọi danh sách | — | Không có object `node` lồng, không lộ trường nội bộ (khác v1 trả entity) | Security | P1 | Quy ước §6.4 |
| TC-INC-API-004 | Chi tiết sự cố | Sự cố tồn tại | `GET /incidents/{id}` | — | 200 kèm dòng thời gian và metric quanh thời điểm phát hiện | Functional | P2 | FR-INC-031 |
| TC-INC-API-005 | Acknowledge thành công | Sự cố OPEN, OPERATOR | `PUT /incidents/{id}/acknowledge` | `{"note":"Đang kiểm tra"}` | 200, status `ACKNOWLEDGED`, có `acknowledgedBy` | Functional | P1 | FR-INC-016 |
| TC-INC-API-006 | Acknowledge sự cố đã đóng | Sự cố RESOLVED | như trên | — | 409 `SOE-INC-409` | Validation | P1 | BR-INC-003 |
| TC-INC-API-007 | Ghi chú quá dài | — | `note` 600 ký tự | — | 400 | Validation | P2 | SRS §7 |
| TC-INC-API-008 | Resolve thành công | Sự cố OPEN | `PUT /incidents/{id}/resolve` | `{"resolutionAction":"Đã dọn log cũ"}` | 200, `resolvedSource=USER`, `resolvedAt` khác null | Functional | P1 | FR-INC-017 |
| TC-INC-API-009 | Resolve thiếu nội dung | — | body rỗng | — | 400 `errors.resolutionAction` | Validation | P1 | SRS §7 |
| TC-INC-API-010 | Resolve hai lần | Vừa đóng | Gọi lại | — | 409 | Validation | P1 | BR-INC-003 |
| TC-INC-API-011 | VIEWER acknowledge | Đăng nhập VIEWER | `PUT …/acknowledge` | — | 403 | Security | P1 | NFR-SEC-008 |
| TC-INC-API-012 | Thống kê | Có dữ liệu 24h | `GET /incidents/stats?range=24h` | — | 200 với số sự cố mở theo severity, mới/đóng trong 24h, MTTR, top 5 node | Functional | P2 | FR-INC-032 |
| TC-INC-API-013 | Xuất CSV | OPERATOR | `GET /incidents/export?status=OPEN` | — | 200 CSV đúng bộ lọc; audit ghi nhận | Functional | P3 | FR-INC-033 |
| TC-INC-API-014 | Xem chính sách ngưỡng | VIEWER | `GET /threshold-policies` | — | 200 (được xem) | Functional | P2 | FR-INC-001 |
| TC-INC-API-015 | Sửa ngưỡng toàn cục | ADMIN | `PUT /threshold-policies/global` | disk 85/95 | 200; snapshot kế tiếp dùng giá trị mới; audit ghi diff | Functional | P1 | FR-INC-002 |
| TC-INC-API-016 | `warning >= critical` | ADMIN | `PUT` với 95/90 | — | 400 `SOE-INC-400` “Ngưỡng cảnh báo phải nhỏ hơn ngưỡng nguy cấp” | Validation | P1 | BR-INC-002 |
| TC-INC-API-017 | Giá trị ngoài phạm vi | ADMIN | `PUT` với 150 | — | 400 | Validation | P1 | SRS §7 |
| TC-INC-API-018 | `consecutiveBreaches` ngoài phạm vi | ADMIN | `PUT` với 0 | — | 400 | Validation | P2 | SRS §7 |
| TC-INC-API-019 | OPERATOR sửa ngưỡng | OPERATOR | `PUT /threshold-policies/global` | — | 403 | Security | P1 | RBAC |
| TC-INC-API-020 | Override theo node | ADMIN | `PUT /threshold-policies/nodes/{id}` | — | 200; `GET` hiển thị override; gỡ override quay về giá trị toàn cục | Functional | P2 | FR-INC-003 |
| TC-INC-API-021 | Hai ADMIN sửa đồng thời | — | 2 request `PUT` song song | — | Một request nhận 409 | Reliability | P2 | UC-INC-05/E4 |
| TC-INC-PERF-001 | Danh sách với 100.000 sự cố | Dữ liệu lớn | k6 `GET /incidents?status=OPEN` | — | p95 ≤ 300 ms | Performance | P1 | SRS §10 |

## 4. Frontend

| ID | Kịch bản | Điều kiện tiên quyết | Các bước | Dữ liệu | Kết quả mong đợi | Loại | Ưu tiên | Truy vết |
|---|---|---|---|---|---|---|---|---|
| TC-INC-E2E-001 | Danh sách & bộ lọc | Có sự cố nhiều loại | Lọc theo trạng thái/mức độ/node | — | Kết quả đúng; bộ lọc lưu trong URL; phân trang server | Functional | P1 | FR-INC-FE-001 |
| TC-INC-E2E-002 | Badge có nhãn chữ | — | Xem danh sách | — | “Nguy cấp”/“Cảnh báo” hiển thị bằng chữ, không chỉ màu; tương phản ≥ 4.5:1 | UI/UX | P1 | FR-INC-FE-002, NFR-USA-004 |
| TC-INC-E2E-003 | Hiển thị số lần tái diễn | Sự cố có `occurrenceCount = 4` | Xem hàng | — | “×4” kèm tooltip thời điểm gần nhất | UI/UX | P2 | FR-INC-FE-003 |
| TC-INC-E2E-004 | Hộp thoại xác nhận xử lý | OPERATOR | Bấm “Xác nhận xử lý” | — | Hộp thoại nhập ghi chú, validate ≤ 500 ký tự, khóa nút khi đang gửi | Functional | P1 | FR-INC-FE-004 |
| TC-INC-E2E-005 | Optimistic update & rollback | Ép API trả 409 | Bấm Acknowledge | — | Trạng thái đổi ngay rồi rollback kèm thông báo “Sự cố đã được … xử lý” | Reliability | P1 | FR-INC-FE-005 |
| TC-INC-E2E-006 | Đóng sự cố bắt buộc nhập lý do | OPERATOR | Bấm Đóng, để trống | — | Nút bị khóa, hiện lỗi dưới ô nhập | Validation | P1 | FR-INC-FE-004 |
| TC-INC-E2E-007 | Sự cố mới qua realtime | Đang mở danh sách | Kích hoạt sự cố ở backend | — | Hàng mới chèn lên đầu (nếu khớp bộ lọc), toast đỏ, bộ đếm Dashboard tăng | Integration | P1 | FR-INC-FE-006 |
| TC-INC-E2E-008 | Trang chi tiết | Sự cố có dòng thời gian | Mở chi tiết | — | Hiển thị đủ các mốc và biểu đồ metric quanh thời điểm phát hiện | UI/UX | P2 | FR-INC-FE-007 |
| TC-INC-E2E-009 | Cấu hình ngưỡng trên UI | ADMIN | Nhập warning 95, critical 90 | — | Lỗi hiển thị ngay khi rời ô; nút Lưu bị khóa | Validation | P1 | FR-INC-FE-008 |
| TC-INC-E2E-010 | VIEWER không thấy nút xử lý | VIEWER | Mở danh sách sự cố | — | Không có nút Xác nhận/Đóng | Security | P1 | FR-INC-FE-009 |
