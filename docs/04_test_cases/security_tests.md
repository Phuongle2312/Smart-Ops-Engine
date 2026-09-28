# Test Cases — Bảo mật (OWASP API Top 10 + Frontend)

> Tham chiếu: [api_gateway_security.md](../01_architecture/api_gateway_security.md) · [frontend_architecture.md §5](../01_architecture/frontend_architecture.md) · [nfr.md §4](../01_architecture/nfr.md)
> Các test bảo mật gắn với từng module đã nằm trong TC-01…TC-09; tệp này gom các phép thử xuyên suốt và quy trình quét.

## 1. OWASP API Security Top 10

| ID | Rủi ro | Kịch bản kiểm thử | Kết quả mong đợi | Ưu tiên | Truy vết |
|---|---|---|---|---|---|
| TC-SEC-API1-001 | BOLA | Đăng nhập VIEWER, gọi `PUT /nodes/{id}`, `DELETE /nodes/{id}`, `PUT /incidents/{id}/resolve` với id hợp lệ | Tất cả trả 403, không có thay đổi dữ liệu | P1 | OWASP API1 |
| TC-SEC-API1-002 | BOLA — đoán định danh | Thử liệt kê id tuần tự (`1`, `2`, `3`) | Không tồn tại id dạng số; GUID v7 không đoán được bản ghi của người khác | P1 | D-ID |
| TC-SEC-API2-001 | Brute force | Gửi 100 lần login sai từ 1 IP | Bị chặn bởi rate limit và khóa tài khoản; hệ thống vẫn phục vụ người dùng khác | P1 | NFR-SEC-006 |
| TC-SEC-API2-002 | Token không bị thu hồi | Đăng xuất rồi dùng lại access token cũ | Bị từ chối tối đa sau 15 phút; refresh token bị thu hồi ngay | P1 | NFR-SEC-005 |
| TC-SEC-API2-003 | Refresh token bị đánh cắp | Dùng lại token đã rotate | Cả chuỗi token bị thu hồi, ghi `TOKEN_REUSE_DETECTED` | P1 | FR-IDN-003 |
| TC-SEC-API3-001 | Lộ thuộc tính nhạy cảm | Gọi mọi endpoint GET và rà soát response | Không có `passwordHash`, `secretCipher`, `sshKey`, `smtpPassword` | P1 | OWASP API3 |
| TC-SEC-API3-002 | Mass assignment | POST/PUT kèm trường ngoài hợp đồng (`role`, `isAdmin`, `createdAt`) | 400, hoặc trường bị bỏ qua hoàn toàn | P1 | OWASP API3 |
| TC-SEC-API4-001 | Truy vấn khổng lồ | `GET /incidents?pageSize=100000`, `metrics?range=10y` | 400 hoặc tự giới hạn; không làm nghẽn DB | P1 | OWASP API4 |
| TC-SEC-API4-002 | Spam thao tác tốn tài nguyên | Gọi `check-now`, `test-connection`, `alert-channels/{id}/test` liên tục | 429 theo policy `expensive` | P1 | OWASP API6 |
| TC-SEC-API4-003 | Body lớn | POST 50 MB | 413, kết nối không bị treo | P2 | FR-GW-009 |
| TC-SEC-API5-001 | Phân quyền chức năng | Chạy ma trận vai trò × 40 endpoint | 100% khớp bảng RBAC | P1 | NFR-SEC-008 |
| TC-SEC-API5-002 | Đường vòng qua HTTP method | Dùng `X-HTTP-Method-Override: DELETE` | Không được chấp nhận | P2 | OWASP API5 |
| TC-SEC-API7-001 | SSRF webhook | Tạo kênh với `https://127.0.0.1`, `https://10.0.0.1`, `https://169.254.169.254`, hostname phân giải về IP nội bộ | Tất cả bị chặn (422), không phát sinh kết nối ra ngoài | P1 | BR-NTF-005 |
| TC-SEC-API7-002 | SSRF qua redirect | Endpoint hợp lệ trả 302 tới IP nội bộ | Không đi theo redirect | P1 | TC-NTF-SEC-002 |
| TC-SEC-API8-001 | Cấu hình sai | Rà soát header, CORS, Swagger, thông báo lỗi ở môi trường production | Đạt toàn bộ checklist §6 gateway | P1 | NFR-SEC-011 |
| TC-SEC-API8-002 | Container | Kiểm tra image chạy user non-root, rootfs chỉ đọc, drop capability | Đạt; Trivy không có lỗ hổng Critical | P2 | NFR-SEC-015 |
| TC-SEC-API9-001 | Kiểm kê API | So sánh route thực tế với OpenAPI và bảng route gateway | Không có endpoint “mồ côi”, không có phiên bản cũ còn mở | P2 | OWASP API9 |
| TC-SEC-API10-001 | Phản hồi bên ngoài độc hại | Webhook trả body 10 MB / JSON lồng sâu | Chỉ đọc 8 KB, không parse, không treo | P2 | OWASP API10 |

## 2. Injection & xử lý dữ liệu

| ID | Kịch bản | Kết quả mong đợi | Ưu tiên | Truy vết |
|---|---|---|---|---|
| TC-SEC-INJ-001 | SQL injection ở mọi tham số lọc (`search='; DROP TABLE…`) | Không thực thi; EF Core tham số hóa; trả kết quả rỗng hoặc 400 | P1 | §7 gateway |
| TC-SEC-INJ-002 | Command injection qua `host`, `username`, `diskMountPath` (`; rm -rf /`, `$(id)`, backtick) | Bị validate chặn; lệnh SSH không bị thay đổi | P1 | BR-MON-001 |
| TC-SEC-INJ-003 | Header injection qua giá trị người dùng (CRLF) | Bị loại bỏ, không tách được header | P2 | — |
| TC-SEC-INJ-004 | XSS lưu trữ: tạo node tên `<img src=x onerror=alert(1)>` | Hiển thị dưới dạng văn bản trên mọi màn hình và trong email cảnh báo | P1 | FE §5 S1 |
| TC-SEC-INJ-005 | CSV injection: mô tả bắt đầu bằng `=cmd|` | Khi xuất CSV, giá trị được thoát (prefix `'`) | P3 | FR-MET-011 |
| TC-SEC-INJ-006 | Path traversal trong tham số tệp/xuất | Không truy cập được tệp ngoài phạm vi | P2 | — |

## 3. Bảo mật Frontend

| ID | Kịch bản | Kết quả mong đợi | Ưu tiên | Truy vết |
|---|---|---|---|---|
| TC-SEC-FE-001 | Kiểm tra lưu trữ token | Access token không có trong `localStorage`/`sessionStorage`/IndexedDB; refresh token là cookie `HttpOnly` không đọc được bằng JS | P1 | FE §5 S2 |
| TC-SEC-FE-002 | CSP hiệu lực | Header CSP có mặt; chèn inline script bị chặn; không dùng `unsafe-inline` cho `script-src` | P1 | FE §5 |
| TC-SEC-FE-003 | Không dùng `dangerouslySetInnerHTML` | Quét mã nguồn: 0 kết quả (hoặc có kèm DOMPurify và ghi chú duyệt) | P1 | FE §5 S1 |
| TC-SEC-FE-004 | Clickjacking | Nhúng ứng dụng trong iframe → bị chặn bởi `frame-ancestors 'none'` | P2 | FE §5 S4 |
| TC-SEC-FE-005 | Open redirect | Đăng nhập với `?returnUrl=https://evil.com` | Bỏ qua, chuyển về Dashboard | P1 | FE §5 S9 |
| TC-SEC-FE-006 | CSRF | Gửi form từ site khác tới `/api/v1/nodes` với cookie sẵn có | Thất bại (thiếu Bearer token, `SameSite=Strict`) | P1 | FE §5 S3 |
| TC-SEC-FE-007 | Console/sourcemap ở production | Không log payload nhạy cảm; không publish sourcemap | P2 | FE §5 S6, S10 |
| TC-SEC-FE-008 | Phân quyền chỉ là giao diện | Dùng devtools bật nút ẩn của VIEWER rồi bấm | API trả 403; dữ liệu không đổi | P1 | FE §5 S7 |
| TC-SEC-FE-009 | Tự đăng xuất & xóa cache | Sau khi đăng xuất, kiểm tra bộ nhớ ứng dụng | Không còn dữ liệu người dùng trong cache | P2 | FE §5 S11 |

## 4. Bảo mật dữ liệu & bí mật

| ID | Kịch bản | Kết quả mong đợi | Ưu tiên | Truy vết |
|---|---|---|---|---|
| TC-SEC-DATA-001 | Rà soát repo bằng gitleaks | 0 secret trong mã nguồn và lịch sử commit | P1 | NFR-SEC-007 |
| TC-SEC-DATA-002 | Rà soát log toàn hệ thống sau một chu kỳ quét đầy đủ | Không có mật khẩu, private key, token, cookie | P1 | NFR-SEC-007 |
| TC-SEC-DATA-003 | Kiểm tra CSDL | Không cột nào lưu credential dạng plaintext; `PasswordHash` là Argon2id | P1 | NFR-SEC-003, 004 |
| TC-SEC-DATA-004 | Bắt gói tin nội bộ | Kết nối tới SQL Server/RabbitMQ/Redis đều mã hóa; `/internal/**` dùng mTLS | P2 | NFR-SEC-002 |
| TC-SEC-DATA-005 | Xoay khóa AES | Sau khi thêm khóa mới, dữ liệu cũ vẫn giải mã; dữ liệu mới dùng khóa mới | P2 | FR-INV-016 |
| TC-SEC-DATA-006 | Xóa node | Bản ghi credential bị xóa cứng khỏi CSDL | P1 | UC-INV-04 |

## 5. Quét tự động & quy trình

| ID | Hạng mục | Công cụ | Tần suất | Tiêu chí đạt | Truy vết |
|---|---|---|---|---|---|
| TC-SEC-SCAN-001 | Phụ thuộc .NET | `dotnet list package --vulnerable` | Mỗi PR | 0 lỗ hổng High/Critical | NFR-SEC-014 |
| TC-SEC-SCAN-002 | Phụ thuộc npm | `npm audit --audit-level=high` | Mỗi PR | 0 lỗ hổng High/Critical | NFR-SEC-014 |
| TC-SEC-SCAN-003 | SAST | CodeQL | Mỗi PR | 0 cảnh báo mức High | NFR-SEC-010 |
| TC-SEC-SCAN-004 | Secret scanning | gitleaks | Mỗi PR | 0 phát hiện | NFR-SEC-007 |
| TC-SEC-SCAN-005 | Image | Trivy | Mỗi build | 0 lỗ hổng Critical | NFR-SEC-015 |
| TC-SEC-SCAN-006 | DAST | OWASP ZAP baseline trên staging | Mỗi release | 0 cảnh báo High | NFR-SEC-010 |
| TC-SEC-SCAN-007 | Pentest thủ công | Checklist OWASP ASVS L2 | Trước go-live | Không còn lỗi High/Critical mở | NFR-SEC-010 |
