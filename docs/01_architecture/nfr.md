# Yêu cầu phi chức năng (NFR)

> Mọi NFR đều **đo được** và sẽ được gắn test case ở Đợt 3 (`04_test_cases/performance_scaling_tests.md`, `security_tests.md`).
> Quy mô tham chiếu: **500 node**, chu kỳ quét 5 phút, 30 người dùng đồng thời, 50 sự cố mở.

---

## 1. Hiệu năng (`PERF`)

| ID | Yêu cầu | Chỉ tiêu | Cách đo | Ưu tiên |
|---|---|---|---|---|
| NFR-PERF-001 | Độ trễ API đọc qua Gateway | p95 ≤ 300 ms, p99 ≤ 800 ms (500 node, 30 user) | k6 + `soe_http_request_duration_seconds` | Must |
| NFR-PERF-002 | Độ trễ API ghi (tạo/sửa node, resolve sự cố) | p95 ≤ 500 ms | k6 | Must |
| NFR-PERF-003 | `GET /metrics/latest` cho 500 node | p95 ≤ 400 ms (có cache Redis 10 s) | k6 | Must |
| NFR-PERF-004 | Truy vấn lịch sử 30 ngày một node | p95 ≤ 700 ms, ≤ 500 điểm dữ liệu | k6 | Must |
| NFR-PERF-005 | Thời gian một lần quét SSH | p95 ≤ 5 s; timeout kết nối 10 s, timeout lệnh 30 s | `soe_check_duration_seconds` | Must |
| NFR-PERF-010 | Độ trễ cảnh báo: từ `collectedAt` đến lúc gửi kênh đầu tiên | p95 ≤ 60 s, p99 ≤ 120 s | `soe_alert_latency_seconds` | Must |
| NFR-PERF-011 | Độ trễ realtime: từ `MetricCollectedV1` đến khi client nhận | p95 ≤ 2 s | Playwright + timestamp | Should |
| NFR-PERF-020 | LCP Dashboard (Fast 3G mô phỏng, 500 node) | ≤ 2,5 s | Lighthouse CI | Must |
| NFR-PERF-021 | INP toàn ứng dụng | ≤ 200 ms | Lighthouse CI | Must |
| NFR-PERF-022 | CLS | ≤ 0,1 | Lighthouse CI | Should |
| NFR-PERF-023 | JS khởi tạo (gzip) | ≤ 250 KB | Kiểm tra bundle trong CI | Must |
| NFR-PERF-024 | Bảng 1.000 dòng cuộn mượt | ≥ 50 fps, không block > 50 ms | Playwright trace | Should |

## 2. Khả năng mở rộng (`SCL`)

| ID | Yêu cầu | Chỉ tiêu | Ưu tiên |
|---|---|---|---|
| NFR-SCL-001 | Độ phủ chu kỳ quét | ≥ 99% node active được quét xong trong mỗi chu kỳ 5 phút ở quy mô 500 node | Must |
| NFR-SCL-002 | Mở rộng ngang worker | Tăng gấp đôi số worker giảm ≥ 40% thời gian hoàn thành chu kỳ (đến khi chạm giới hạn DB) | Must |
| NFR-SCL-003 | Quy mô tối đa v3 | Hỗ trợ 2.000 node với ≤ 10 worker mà không đổi kiến trúc | Should |
| NFR-SCL-004 | Kết nối realtime | 200 kết nối SignalR đồng thời, CPU pod < 60% | Should |
| NFR-SCL-005 | Ghi metric | 1.000 snapshot/phút không làm queue dồn > 500 message | Must |
| NFR-SCL-006 | Không trạng thái cục bộ | Mọi API service chạy được từ 1→N replica, không sticky session | Must |
| NFR-SCL-007 | Dữ liệu lịch sử | 500 node × 90 ngày (~13 triệu dòng) vẫn đạt NFR-PERF-004 nhờ partition + rollup | Must |

## 3. Tin cậy & sẵn sàng (`AVL`)

| ID | Yêu cầu | Chỉ tiêu | Ưu tiên |
|---|---|---|---|
| NFR-AVL-001 | Sẵn sàng hệ thống (giờ làm việc) | 99,5%/tháng | Must |
| NFR-AVL-002 | Không mất event nghiệp vụ | Outbox + ack sau xử lý: 0 event mất khi kill pod giữa chừng (test chaos) | Must |
| NFR-AVL-003 | Xử lý lặp an toàn | Gửi lại cùng message 3 lần ⇒ 1 snapshot, 1 sự cố, 1 email | Must |
| NFR-AVL-004 | Chịu lỗi phụ thuộc | RabbitMQ hoặc SMTP tạm ngừng ≤ 10 phút: hệ thống tự phục hồi, không mất cảnh báo (retry + DLQ) | Must |
| NFR-AVL-005 | Một node lỗi không ảnh hưởng node khác | SSH treo/timeout chỉ ảnh hưởng message đó | Must |
| NFR-AVL-006 | Chỉ một scheduler chạy | 2 replica scheduler ⇒ mỗi chu kỳ mỗi node chỉ 1 lệnh quét | Must |
| NFR-AVL-007 | RPO/RTO | Xem [data_architecture.md](data_architecture.md) §5 | Must |
| NFR-AVL-008 | Rolling update không downtime | `maxUnavailable: 0`, readiness probe, request đang xử lý không bị hủy (graceful shutdown 30 s) | Should |

## 4. Bảo mật (`SEC`)

| ID | Yêu cầu | Chỉ tiêu | Ưu tiên |
|---|---|---|---|
| NFR-SEC-001 | Mọi endpoint nghiệp vụ yêu cầu xác thực | Chỉ `/auth/login`, `/auth/refresh`, `/health/*` là ngoại lệ | Must |
| NFR-SEC-002 | Mã hóa đường truyền | TLS 1.2+ cho mọi kênh ngoài; mTLS cho `/internal/**` | Must |
| NFR-SEC-003 | Mã hóa lưu trữ credential | AES-256-GCM, khóa trong secret store, hỗ trợ xoay khóa | Must |
| NFR-SEC-004 | Băm mật khẩu | Argon2id (hoặc PBKDF2-SHA512 600k) | Must |
| NFR-SEC-005 | Vòng đời token | Access 15 phút, refresh 7 ngày xoay vòng + phát hiện tái sử dụng | Must |
| NFR-SEC-006 | Chống brute force | Khóa 15 phút sau 5 lần sai; rate limit 5/phút/IP | Must |
| NFR-SEC-007 | Không lộ secret | Không secret trong repo, log, response, message queue (kiểm tra tự động: gitleaks + test log) | Must |
| NFR-SEC-008 | Phân quyền theo vai trò | Ma trận vai trò × endpoint đạt 100% test | Must |
| NFR-SEC-009 | Chống SSRF webhook | Chặn IP riêng/loopback/link-local, cấm redirect | Must |
| NFR-SEC-010 | OWASP API Top 10 | 0 phát hiện High/Critical trong ZAP baseline + pentest | Must |
| NFR-SEC-011 | Security headers & CSP | Đủ bộ header ở §6 gateway và CSP ở nginx | Must |
| NFR-SEC-012 | Audit không sửa được | Tài khoản service không có quyền UPDATE/DELETE; chuỗi hash liên tục | Must |
| NFR-SEC-013 | Xác thực host SSH | Từ chối kết nối khi fingerprint khác bản đã ghim | Must |
| NFR-SEC-014 | Phụ thuộc sạch | 0 lỗ hổng High/Critical trong `npm audit` và `dotnet list package --vulnerable` khi phát hành | Must |
| NFR-SEC-015 | Container an toàn | Non-root, read-only rootfs, drop ALL capabilities, ảnh quét Trivy không có Critical | Should |

## 5. Bảo trì & chất lượng mã (`MNT`)

| ID | Yêu cầu | Chỉ tiêu |
|---|---|---|
| NFR-MNT-001 | Độ phủ kiểm thử | Domain + Application ≥ 80%; toàn service ≥ 65% |
| NFR-MNT-002 | Ràng buộc kiến trúc | ArchitectureTests xanh: Domain không phụ thuộc hạ tầng, Api không dùng `DbContext` |
| NFR-MNT-003 | Thời gian CI | Pipeline chính ≤ 15 phút |
| NFR-MNT-004 | Tài liệu API | OpenAPI tự sinh cho mọi service, luôn khớp code (kiểm tra trong CI) |
| NFR-MNT-005 | Thêm kênh cảnh báo mới | Chỉ thêm một lớp hiện thực `INotificationChannel` + đăng ký DI, không sửa dispatcher |
| NFR-MNT-006 | Thêm loại collector mới | Chỉ thêm `IMetricCollector` + cấu hình `CollectorType` |
| NFR-MNT-007 | Migration an toàn | Mọi thay đổi schema theo expand → migrate → contract |

## 6. Quan sát (`OBS`)

| ID | Yêu cầu | Chỉ tiêu |
|---|---|---|
| NFR-OBS-001 | Truy vết xuyên service | 1 `correlationId` đi hết chuỗi HTTP → message → SSH → cảnh báo |
| NFR-OBS-002 | Log có cấu trúc | 100% log JSON, có `service.name`, `trace_id` |
| NFR-OBS-003 | Metric nghiệp vụ | Đủ các metric ở [observability.md](observability.md) §4 |
| NFR-OBS-004 | Cảnh báo vận hành | Bộ alert §7 được cấu hình và kiểm thử định kỳ |
| NFR-OBS-005 | Thời gian phát hiện sự cố hệ thống | Alert bắn trong ≤ 5 phút kể từ khi vi phạm |

## 7. Khả dụng & giao diện (`USA`)

| ID | Yêu cầu | Chỉ tiêu |
|---|---|---|
| NFR-USA-001 | Ngôn ngữ | 100% văn bản hiển thị bằng tiếng Việt, thuật ngữ nhất quán với [glossary](../00_overview/glossary.md) |
| NFR-USA-002 | Phản hồi thao tác | Mọi hành động có phản hồi ≤ 200 ms (loading/skeleton/toast) |
| NFR-USA-003 | Thông báo lỗi hữu ích | Lỗi nêu nguyên nhân + cách xử lý, không hiện mã kỹ thuật thô |
| NFR-USA-004 | Tiếp cận | WCAG 2.1 AA cho tương phản, bàn phím, nhãn |
| NFR-USA-005 | Hiển thị thời gian | Theo múi giờ trình duyệt, kèm nhãn tương đối (“3 phút trước”) |

## 8. Tương thích (`CMP`)

| ID | Yêu cầu | Chỉ tiêu |
|---|---|---|
| NFR-CMP-001 | Trình duyệt | Chrome/Edge/Firefox 2 phiên bản mới nhất, Safari 17+ |
| NFR-CMP-002 | Máy chủ đích | Linux có `df`, `free`, `/proc/stat`; OpenSSH 7.4+ |
| NFR-CMP-003 | Hạ tầng | Docker 24+, Kubernetes 1.29+, SQL Server 2019+ |
| NFR-CMP-004 | Kích thước màn hình | Tối ưu ≥ 1280 px, dùng được ≥ 768 px |

## 9. Ma trận tiêu chí người dùng → NFR

| Tiêu chí đề bài | NFR liên quan |
|---|---|
| API .NET bảo vệ an toàn | NFR-SEC-001…015 |
| Frontend hiệu năng | NFR-PERF-020…024 |
| Frontend chống lỗ hổng | NFR-SEC-011, S1–S11 trong [frontend_architecture.md](frontend_architecture.md) §5 |
| Frontend validate dữ liệu | NFR-USA-003 + §6 frontend + FR-* validate trong SRS |
| Microservice | NFR-MNT-002, NFR-AVL-002…006 |
| Docker | NFR-SEC-015, NFR-AVL-008 |
| Queue | NFR-AVL-002, NFR-AVL-003, NFR-SCL-005 |
| Gateway | NFR-SEC-001, NFR-SEC-008, NFR-PERF-001 |
| Scale | NFR-SCL-001…007 |
