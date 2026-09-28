# Ma trận truy vết (Traceability Matrix)

> Mục đích: chứng minh mọi yêu cầu đều có use case mô tả và test case kiểm chứng — không yêu cầu nào bị bỏ sót khi triển khai hoặc kiểm thử.
> Ký hiệu `TC-…-*` nghĩa là toàn bộ dải test case của nhóm đó trong tệp tương ứng.

## 1. Yêu cầu chức năng ↔ Use case ↔ Test case

### 1.1 Identity (`IDN`) — [SRS](02_srs/01_identity.md)

| FR | Mô tả ngắn | Use case | Test case |
|---|---|---|---|
| FR-IDN-001 | Đăng nhập, phát hành token | UC-IDN-01 | TC-IDN-API-001…003, 010; TC-IDN-E2E-001 |
| FR-IDN-002 | Refresh + rotation | UC-IDN-02 | TC-IDN-API-011, 013; TC-IDN-E2E-005 |
| FR-IDN-003 | Phát hiện tái sử dụng token | UC-IDN-02/E2 | TC-IDN-API-012; TC-SEC-API2-003 |
| FR-IDN-004 | Đăng xuất | UC-IDN-02/A1 | TC-IDN-API-014; TC-SEC-API2-002 |
| FR-IDN-005 | Khóa tài khoản | UC-IDN-01/E2 | TC-IDN-API-004…006; TC-SEC-API2-001 |
| FR-IDN-006 | Tạo người dùng | UC-IDN-04 | TC-IDN-API-025…028; TC-IDN-E2E-011 |
| FR-IDN-007 | Sửa/bật tắt/đặt lại mật khẩu | UC-IDN-04/A1…A3 | TC-IDN-API-029, 030, 033 |
| FR-IDN-008 | Đổi mật khẩu | UC-IDN-03 | TC-IDN-API-019…023 |
| FR-IDN-009 | `GET /me` | UC-IDN-01 | TC-IDN-API-017 |
| FR-IDN-010 | JWKS | — (hạ tầng) | TC-IDN-API-018; TC-GW-SEC-007 |
| FR-IDN-011 | Token client-credentials | UC-MON-01 (bước 7) | TC-INV-API-035, 036 |
| FR-IDN-012 | Lịch sử & event đăng nhập | UC-IDN-01 | TC-IDN-INT-001, 002; TC-AUD-INT-004 |
| FR-IDN-013 | Danh sách người dùng | UC-IDN-04 | TC-IDN-API-035 |
| FR-IDN-014 | Thu hồi phiên | UC-IDN-04/A4 | TC-IDN-API-034 |
| FR-IDN-015 | Bảo vệ ADMIN cuối cùng | UC-IDN-04/E2 | TC-IDN-API-031, 032; TC-IDN-E2E-012 |
| FR-IDN-FE-001…008 | Yêu cầu giao diện | UC-IDN-01…04 | TC-IDN-E2E-001…012 |

### 1.2 Inventory (`INV`) — [SRS](02_srs/02_inventory.md)

| FR | Mô tả ngắn | Use case | Test case |
|---|---|---|---|
| FR-INV-001 | Tạo node | UC-INV-01 | TC-INV-API-001, 004; TC-INV-E2E-008 |
| FR-INV-002 | Chống trùng host:port | UC-INV-01/E1 | TC-INV-API-005, 006; TC-INV-E2E-006 |
| FR-INV-003 | Mã hóa credential AES-GCM | UC-INV-01 | TC-INV-API-002, 003; TC-SEC-DATA-003 |
| FR-INV-004 | Không trả credential | UC-INV-01 | TC-INV-API-001, 017; TC-SEC-API3-001 |
| FR-INV-005 | Sửa node, giữ credential | UC-INV-02 | TC-INV-API-019, 020; TC-INV-E2E-009 |
| FR-INV-006 | Bật/tắt giám sát | UC-INV-03 | TC-INV-API-025…027; TC-INV-E2E-010 |
| FR-INV-007 | Xóa node (soft delete) | UC-INV-04 | TC-INV-API-028, 029; TC-INV-E2E-012 |
| FR-INV-008 | Chọn metric & mount path | UC-INV-02/A3 | TC-INV-API-022; TC-MON-INT-005 |
| FR-INV-009 | Chu kỳ riêng | UC-INV-02 | TC-INV-API-023; TC-MON-INT-004 |
| FR-INV-010 | Kiểm tra kết nối | UC-INV-01 (bước 4) | TC-INV-API-031…034; TC-INV-E2E-007 |
| FR-INV-011 | Ghim & kiểm host key | UC-INV-05 | TC-INV-SEC-002, 003; TC-MON-INT-018 |
| FR-INV-012 | Danh sách, lọc, phân trang | UC-INV-01 | TC-INV-API-014…016; TC-INV-E2E-001 |
| FR-INV-013 | Tag | UC-INV-01/A | TC-INV-API-016 |
| FR-INV-014 | API nội bộ lấy credential | UC-MON-01 | TC-INV-API-035…037; TC-MON-INT-013 |
| FR-INV-015 | Phát event vòng đời node | UC-INV-01…04 | TC-INV-INT-001, 002; TC-CON-011…013 |
| FR-INV-016 | Xoay khóa mã hóa | — | TC-INV-INT-003; TC-SEC-DATA-005 |
| FR-INV-017 | Import CSV | UC-INV-01/A4 | (Could — bổ sung khi triển khai) |
| FR-INV-FE-001…009 | Giao diện node | UC-INV-01…05 | TC-INV-E2E-001…017 |

### 1.3 Monitoring (`MON`) — [SRS](02_srs/03_monitoring.md)

| FR | Mô tả ngắn | Use case | Test case |
|---|---|---|---|
| FR-MON-001 | Đồng bộ read model | UC-MON-01 | TC-MON-INT-007, 008 |
| FR-MON-002 | Phát lệnh quét định kỳ | UC-MON-01 | TC-MON-INT-001, 002 |
| FR-MON-003 | Chu kỳ riêng theo node | UC-MON-01/A1 | TC-MON-INT-004 |
| FR-MON-004 | Không quét trùng khi nhiều replica | UC-MON-01 | TC-MON-INT-003; TC-PERF-CHA-008 |
| FR-MON-005 | Check now | UC-MON-02 | TC-MON-API-001…004; TC-MON-E2E-001 |
| FR-MON-006 | Thu CPU/RAM/Disk | UC-MON-01 | TC-MON-INT-012; TC-MON-UNIT-001…003 |
| FR-MON-007 | Lấy credential đúng lúc | UC-MON-01 | TC-MON-INT-013, 014 |
| FR-MON-008 | Timeout | UC-MON-03 | TC-MON-INT-015, 016 |
| FR-MON-009 | Kiểm host key | UC-INV-05 | TC-MON-INT-018; TC-INV-SEC-002 |
| FR-MON-010 | Retry lỗi tạm | UC-MON-03 | TC-MON-INT-019 |
| FR-MON-011 | Phát event kết quả | UC-MON-01, 03 | TC-MON-INT-012, 017; TC-CON-041 |
| FR-MON-012 | Ghi `CheckRuns` | UC-MON-03 | TC-MON-API-005; TC-MON-E2E-003 |
| FR-MON-013 | Bật/tắt scheduler, đổi chu kỳ | UC-GW-01 | TC-MON-INT-009, 010; TC-GW-API-014, 015 |
| FR-MON-014 | Giới hạn kết nối đồng thời | UC-MON-01 | TC-MON-INT-021 |
| FR-MON-015 | Nhiều loại collector | — (SOLID/OCP) | TC-MON-UNIT-006 |
| FR-MON-016 | Bỏ message quá hạn | UC-MON-01/E5 | TC-MON-INT-006; TC-CON-029 |
| FR-MON-FE-001…005 | Giao diện giám sát | UC-MON-02 | TC-MON-E2E-001…005 |

### 1.4 Metrics (`MET`) — [SRS](02_srs/04_metrics.md)

| FR | Mô tả ngắn | Use case | Test case |
|---|---|---|---|
| FR-MET-001 | Lưu snapshot | UC-MON-01 | TC-MET-INT-001, 003 |
| FR-MET-002 | Chống trùng | — | TC-MET-INT-002; TC-CON-015 |
| FR-MET-003 | `MetricLatest` + status | UC-MET-01 | TC-MET-INT-004…006 |
| FR-MET-004 | API metric mới nhất | UC-MET-01 | TC-MET-API-001…004 |
| FR-MET-005 | Lịch sử theo dải | UC-MET-02 | TC-MET-API-005…008 |
| FR-MET-006 | Chọn nguồn & downsample | UC-MET-02 | TC-MET-API-006, 007; TC-MET-E2E-010 |
| FR-MET-007 | Rollup theo giờ | — | TC-MET-INT-009, 011 |
| FR-MET-008 | Retention | — | TC-MET-INT-010 |
| FR-MET-009 | Xử lý node bị xóa | UC-INV-04 | TC-MET-INT-012; TC-CON-044 |
| FR-MET-010 | Tóm tắt & dự báo đầy đĩa | UC-MET-02 | TC-MET-API-016 |
| FR-MET-011 | Xuất CSV | UC-MET-03 | TC-MET-API-017…019 |
| FR-MET-012 | Cache Redis | UC-MET-01 | TC-MET-API-003 |
| FR-MET-013 | Bỏ bản ghi mồ côi | — | TC-MET-INT-008 |
| FR-MET-FE-001…008 | Dashboard & biểu đồ | UC-MET-01, 02 | TC-MET-E2E-001…012 |

### 1.5 Incident (`INC`) — [SRS](02_srs/05_incident.md)

| FR | Mô tả ngắn | Use case | Test case |
|---|---|---|---|
| FR-INC-001…005 | Chính sách ngưỡng | UC-INC-05 | TC-INC-API-014…021; TC-INC-UNIT-014, 015; TC-INC-E2E-009 |
| FR-INC-010 | Mở sự cố theo chuỗi breach | UC-INC-01 | TC-INC-UNIT-001…005; TC-INC-INT-001 |
| FR-INC-011 | Dedup, tăng bộ đếm | UC-INC-01 | TC-INC-UNIT-008; TC-INC-INT-002, 003 |
| FR-INC-012 | Nâng cấp severity | UC-INC-01/A1 | TC-INC-UNIT-006, 007 |
| FR-INC-013 | Auto-resolve | UC-INC-04 | TC-INC-UNIT-009…012 |
| FR-INC-014 | Sự cố không liên lạc được | UC-MON-03 | TC-INC-INT-005, 007 |
| FR-INC-015 | Đóng khi liên lạc lại | UC-INC-04/A1 | TC-INC-INT-006; TC-CON-042 |
| FR-INC-016 | Acknowledge | UC-INC-02 | TC-INC-API-005…007; TC-INC-E2E-004, 005 |
| FR-INC-017 | Resolve | UC-INC-03 | TC-INC-API-008…011; TC-INC-E2E-006 |
| FR-INC-018 | Đóng khi node tắt/xóa | UC-INV-03, 04 | TC-INC-INT-008, 009 |
| FR-INC-019 | Nhật ký vòng đời | UC-INC-02, 03 | TC-INC-INT-010 |
| FR-INC-020 | Bỏ snapshot đến muộn | UC-INC-01 | TC-INC-UNIT-016; TC-CON-017 |
| FR-INC-030…033 | Truy vấn, thống kê, xuất | UC-INC-02, 03 | TC-INC-API-001…004, 012, 013 |
| FR-INC-FE-001…009 | Giao diện sự cố | UC-INC-02…05 | TC-INC-E2E-001…010 |

### 1.6 Notification (`NTF`) — [SRS](02_srs/06_notification.md)

| FR | Mô tả ngắn | Use case | Test case |
|---|---|---|---|
| FR-NTF-001…003 | Quản lý kênh | UC-NTF-02 | TC-NTF-API-001…012 |
| FR-NTF-004 | Gửi thử | UC-NTF-03 | TC-NTF-API-015…018 |
| FR-NTF-005 | Bộ lọc node/tag | UC-NTF-01/A4 | TC-NTF-API-014; TC-NTF-INT-008 |
| FR-NTF-006 | Cấu hình SMTP | UC-GW-01 | TC-NTF-API-021; TC-GW-E2E-005 |
| FR-NTF-007 | Che & mã hóa đích/secret | UC-NTF-02 | TC-NTF-API-002, 003; TC-SEC-API3-001 |
| FR-NTF-010 | Gửi theo severity | UC-NTF-01 | TC-NTF-INT-001, 002 |
| FR-NTF-011 | Thông báo khi đóng | UC-INC-03 | TC-NTF-INT-013 |
| FR-NTF-012 | Nội dung email | UC-NTF-01 | TC-NTF-INT-001, 014 |
| FR-NTF-013 | Webhook & HMAC | UC-NTF-01 | TC-NTF-INT-003…005 |
| FR-NTF-014 | Throttle | UC-NTF-01 | TC-NTF-INT-006, 007 |
| FR-NTF-015 | Retry & thất bại | UC-NTF-01/E1, E2 | TC-NTF-INT-009, 010; TC-CON-021…025 |
| FR-NTF-016 | Ghi `DeliveryLogs` | UC-NTF-01 | TC-NTF-INT-001, 006; TC-NTF-API-019 |
| FR-NTF-017 | Báo cáo hằng ngày | UC-NTF-04 | TC-NTF-INT-016, 017 |
| FR-NTF-018 | Lịch sử & gửi lại | UC-NTF-02 | TC-NTF-API-019, 020 |
| FR-NTF-019 | Tự tắt kênh lỗi | UC-NTF-01/E3 | TC-NTF-INT-012 |
| FR-NTF-020 | Digest khi bão sự cố | UC-MON-03/E1 | TC-NTF-INT-015 |
| FR-NTF-FE-001…008 | Giao diện kênh cảnh báo | UC-NTF-02, 03 | TC-NTF-E2E-001…009 |

### 1.7 Realtime (`RTM`) — [SRS](02_srs/07_realtime.md)

| FR | Mô tả ngắn | Use case | Test case |
|---|---|---|---|
| FR-RTM-001 | Hub có xác thực | UC-RTM-01 | TC-RTM-INT-001…003 |
| FR-RTM-002…004 | Đẩy metric/sự cố/trạng thái | UC-RTM-01 | TC-RTM-INT-004…007 |
| FR-RTM-005 | Nhóm theo node | UC-RTM-01/A1 | TC-RTM-INT-005; TC-RTM-E2E-006 |
| FR-RTM-006 | Nhiều instance | UC-RTM-01 | TC-RTM-INT-008, 009 |
| FR-RTM-007 | Giới hạn kết nối | — | TC-RTM-INT-010 |
| FR-RTM-008 | Đồng bộ sau kết nối lại | UC-RTM-01/A2 | TC-RTM-E2E-003 |
| FR-RTM-009 | Đóng khi token hết hạn | UC-RTM-01/E2 | TC-RTM-INT-011 |
| FR-RTM-010 | Endpoint sức khỏe hub | — | TC-RTM-PERF-001 |
| FR-RTM-FE-001…007 | Giao diện realtime | UC-RTM-01 | TC-RTM-E2E-001…008 |

### 1.8 Audit (`AUD`) — [SRS](02_srs/08_audit.md)

| FR | Mô tả ngắn | Use case | Test case |
|---|---|---|---|
| FR-AUD-001 | Ghi thao tác ghi | mọi UC ghi dữ liệu | TC-AUD-INT-001, 002, 006, 007 |
| FR-AUD-002 | Ghi sự kiện bảo mật | UC-IDN-01, UC-INV-05 | TC-AUD-INT-004, 005 |
| FR-AUD-003 | Nội dung bản ghi | UC-AUD-01 | TC-AUD-INT-002; TC-AUD-API-006 |
| FR-AUD-004 | Lọc trường nhạy cảm | UC-AUD-01 | TC-AUD-INT-003; TC-SEC-DATA-002 |
| FR-AUD-005 | Tra cứu có lọc | UC-AUD-01 | TC-AUD-API-001…005 |
| FR-AUD-006 | Xem diff | UC-AUD-01 | TC-AUD-API-006; TC-AUD-E2E-003 |
| FR-AUD-007 | Xuất CSV | UC-AUD-01 | TC-AUD-API-009 |
| FR-AUD-008 | Chuỗi băm toàn vẹn | UC-AUD-01/A1 | TC-AUD-INT-011, 012 |
| FR-AUD-009 | Retention 365 ngày | — | TC-AUD-INT-014 |
| FR-AUD-010 | Dòng thời gian đối tượng | UC-AUD-01/A | TC-AUD-API-007 |
| FR-AUD-FE-001…007 | Giao diện nhật ký | UC-AUD-01 | TC-AUD-E2E-001…006 |

### 1.9 Gateway & cấu hình (`GW`) — [SRS](02_srs/09_gateway_config.md)

| FR | Mô tả ngắn | Use case | Test case |
|---|---|---|---|
| FR-GW-001 | Định tuyến, deny by default | UC-GW-02 | TC-GW-API-001…003 |
| FR-GW-002 | Xác thực JWT | UC-GW-02 | TC-GW-SEC-001…007 |
| FR-GW-003 | Phân quyền theo route | UC-GW-02 | TC-GW-SEC-008, 010 |
| FR-GW-004 | Rate limiting | UC-GW-02/E4 | TC-GW-SEC-011, 012 |
| FR-GW-005 | Correlation-id | UC-GW-02 | TC-GW-API-004, 005; TC-CON-045 |
| FR-GW-006 | Xóa header giả mạo | UC-GW-02/E7 | TC-GW-SEC-009 |
| FR-GW-007 | CORS | — | TC-GW-SEC-013, 014 |
| FR-GW-008 | Security headers | — | TC-GW-SEC-015 |
| FR-GW-009 | Giới hạn body & timeout | — | TC-GW-API-006; TC-SEC-API4-003 |
| FR-GW-010 | WebSocket passthrough | UC-RTM-01 | TC-GW-API-009 |
| FR-GW-011 | Health check đích | — | TC-GW-API-007, 008 |
| FR-GW-012 | Log truy cập an toàn | — | TC-GW-SEC-017 |
| FR-GW-013 | ProblemDetails thống nhất | — | TC-GW-SEC-016 |
| FR-GW-014 | Không lộ thông tin nội bộ | — | TC-GW-SEC-015, 016, 018 |
| FR-GW-015 | Chế độ bảo trì | UC-MET-01/E3 | (Could) |
| FR-GW-020…027 | Cấu hình hệ thống | UC-GW-01 | TC-GW-API-012…020; TC-GW-E2E-001…007 |
| FR-GW-FE-001…007 | Giao diện cấu hình | UC-GW-01 | TC-GW-E2E-001…007 |

## 2. Yêu cầu phi chức năng ↔ Test case

| NFR | Test case |
|---|---|
| NFR-PERF-001…005 | TC-PERF-API-001…007; TC-PERF-MON-002 |
| NFR-PERF-010, 011 | TC-NTF-INT-018; TC-PERF-MON-007; TC-RTM-PERF-001 |
| NFR-PERF-020…024 | TC-PERF-FE-001…007; TC-INV-E2E-017 |
| NFR-SCL-001…007 | TC-PERF-MON-001…006; TC-MET-PERF-003; TC-RTM-PERF-001 |
| NFR-AVL-001…008 | TC-PERF-CHA-001…010; TC-CON-011…014; TC-MON-INT-024 |
| NFR-SEC-001…015 | TC-SEC-API*, TC-SEC-FE-*, TC-SEC-DATA-*, TC-SEC-SCAN-*, TC-GW-SEC-* |
| NFR-MNT-001…007 | Cổng coverage & ArchitectureTests trong CI; TC-MON-UNIT-006; TC-CON-001 |
| NFR-OBS-001…005 | TC-CON-045; TC-GW-API-004; TC-CON-026 |
| NFR-USA-001…005 | TC-INC-E2E-002; TC-MET-E2E-009; TC-INV-E2E-002 |
| NFR-CMP-001…004 | Chạy bộ E2E trên ma trận trình duyệt; kiểm thử với máy chủ Linux mẫu |

## 3. Tiêu chí đề bài ↔ Tài liệu ↔ Kiểm chứng

| Tiêu chí | Đặc tả ở | Kiểm chứng bằng |
|---|---|---|
| API .NET có bảo vệ an toàn | [api_gateway_security.md](01_architecture/api_gateway_security.md), SRS 01/09 | TC-GW-SEC-*, TC-SEC-API*, TC-IDN-* |
| Frontend đáp ứng hiệu năng | [frontend_architecture.md §4](01_architecture/frontend_architecture.md) | TC-PERF-FE-001…007 |
| Frontend chống lỗ hổng bảo mật | [frontend_architecture.md §5](01_architecture/frontend_architecture.md) | TC-SEC-FE-001…009 |
| Frontend validate dữ liệu | [frontend_architecture.md §6](01_architecture/frontend_architecture.md) + mục validate trong từng SRS | TC-INV-E2E-005, TC-INC-E2E-009, TC-IDN-E2E-002, TC-GW-E2E-003 |
| Microservice | [system_architecture.md](01_architecture/system_architecture.md), [solid_clean_architecture.md](01_architecture/solid_clean_architecture.md) | ArchitectureTests; TC-CON-041…045 |
| Docker | [deployment_scaling.md §1, §2](01_architecture/deployment_scaling.md) | TC-SEC-API8-002; dựng môi trường test bằng compose |
| Queue | [messaging_events.md](01_architecture/messaging_events.md) | TC-CON-001…030 |
| Gateway | [api_gateway_security.md](01_architecture/api_gateway_security.md) | TC-GW-API-001…011 |
| Scale | [deployment_scaling.md §4](01_architecture/deployment_scaling.md) | TC-PERF-MON-003…006; TC-PERF-CHA-007, 008 |
| Cấu trúc SOLID | [solid_clean_architecture.md](01_architecture/solid_clean_architecture.md) | NetArchTest; TC-MON-UNIT-006 |

## 4. Khoảng trống đã biết

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| FR-INV-017 (import CSV) | Chưa có test chi tiết | Mức `Could`; bổ sung khi triển khai |
| FR-GW-015 (chế độ bảo trì) | Chưa có test chi tiết | Mức `Could` |
| FR-MET-010 (dự báo đầy đĩa) | Có 1 test | Cần thêm test biên khi thuật toán được chốt |
| Kiểm thử tương thích trình duyệt | Chưa liệt kê từng ca | Chạy lại bộ E2E trên ma trận trình duyệt trong CI hằng đêm |
