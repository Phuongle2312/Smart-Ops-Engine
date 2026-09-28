# Tầm nhìn & Phạm vi — Smart Ops Engine v3

## 1. Bối cảnh

Smart Ops Engine v1 là một ứng dụng Spring Boot monolith: một scheduler quét Disk/CPU/RAM qua SSH mỗi 5 phút, ghi `IncidentLog`, gửi email qua SMTP Office 365. Frontend React đã có đủ giao diện nhưng chạy bằng **mock data**.

Các hạn chế của v1 dẫn đến quyết định build lại:

| # | Hạn chế v1 | Hệ quả | Hướng giải quyết v3 |
|---|---|---|---|
| 1 | Không có xác thực — toàn bộ API public | Ai trong mạng cũng xóa được Node, đọc cấu hình | Identity Service + JWT + RBAC tại Gateway và từng service |
| 2 | AES/ECB, key & mật khẩu SMTP hardcode trong `application.properties` | Lộ credential SSH khi lộ DB/source | AES-256-GCM có key versioning, secret nằm trong K8s Secret / Key Vault |
| 3 | Double-encrypt ở `NodeController` | Không SSH được vào node mới tạo | Một điểm mã hóa duy nhất (`ICredentialProtector`) ở Infrastructure |
| 4 | Scheduler tuần tự, một instance, không lock | Nhiều node → chu kỳ quét kéo dài; chạy 2 instance → quét trùng | Tách Scheduler (Quartz clustered) và Worker (competing consumers qua RabbitMQ) |
| 5 | Không dedup sự cố | Mỗi chu kỳ tạo bản ghi mới, spam email | Incident Service có fingerprint + hysteresis + auto-resolve |
| 6 | Email gửi đồng bộ trong scheduler | SMTP chậm làm chậm cả vòng quét | Notification Service bất đồng bộ, retry, DLQ |
| 7 | `StrictHostKeyChecking=no` | Dễ bị MITM | Ghim host key fingerprint cho từng node |
| 8 | Không realtime, không audit | FE phải mock | Realtime Service (SignalR) + Audit Service |

## 2. Mục tiêu v3

| ID | Mục tiêu | Chỉ số đo |
|---|---|---|
| G-01 | Giám sát tin cậy cho tối thiểu **500 node** | 100% node active được quét trong mỗi chu kỳ 5 phút (NFR-SCL-001) |
| G-02 | Phát hiện & cảnh báo nhanh | Từ lúc thu metric vượt ngưỡng đến lúc gửi cảnh báo ≤ 60 giây (p95) (NFR-PERF-010) |
| G-03 | An toàn theo OWASP | 0 lỗ hổng High/Critical trong đợt pentest & quét SAST/DAST trước release |
| G-04 | Mở rộng ngang | Tăng số worker giảm tuyến tính thời gian quét; không có điểm nghẽn trạng thái cục bộ |
| G-05 | Trải nghiệm nhanh | LCP ≤ 2.5s, INP ≤ 200ms trên dashboard 500 node (NFR-PERF-020..) |
| G-06 | Dễ bảo trì | Mỗi service build/test/deploy độc lập; coverage domain + application ≥ 80% |

## 3. Phạm vi

### 3.1 Trong phạm vi (v3)

| Module | Chức năng chính |
|---|---|
| Identity (`IDN`) | Đăng nhập, refresh/logout, đổi mật khẩu, quản lý người dùng, 3 vai trò ADMIN / OPERATOR / VIEWER, khóa tài khoản khi brute-force |
| Inventory (`INV`) | CRUD node, xác thực SSH bằng password hoặc private key, ghim host key, bật/tắt giám sát, chọn metric giám sát, nhãn (tag) node, kiểm tra kết nối |
| Monitoring (`MON`) | Lập lịch quét theo chu kỳ cấu hình, “Check now”, thu thập CPU/RAM/Disk qua SSH, timeout, retry, phát hiện node không truy cập được |
| Metrics (`MET`) | Lưu snapshot, truy vấn 1h/24h/7d/30d có downsample, metric mới nhất cho dashboard, retention |
| Incident (`INC`) | Chính sách ngưỡng (toàn cục + theo node), tạo sự cố, dedup, acknowledge, resolve, auto-resolve, lọc/phân trang, thống kê |
| Notification (`NTF`) | Kênh Email / Webhook (Slack, Teams, Discord, Generic có ký HMAC), mức severity tối thiểu, gửi thử, throttle, retry, báo cáo hằng ngày, lịch sử gửi |
| Realtime (`RTM`) | Đẩy metric mới, sự cố mới/đổi trạng thái, trạng thái node tới FE qua SignalR |
| Audit (`AUD`) | Ghi mọi thao tác ghi & sự kiện bảo mật, tra cứu, xem diff trước/sau, xuất CSV |
| Gateway & Config (`GW`) | Định tuyến, xác thực, rate limit, CORS, header bảo mật; màn hình cấu hình hệ thống gom từ các service |
| Frontend (`FE`) | 9 màn hình: Login, Dashboard, Nodes, Node Detail, Incidents, Alert Channels, Audit Logs, System Config, Users |

### 3.2 Ngoài phạm vi (v3)

- Agent cài trên máy chủ đích (chỉ agentless qua SSH).
- Giám sát Windows Server qua WinRM (chỉ Linux/Unix qua SSH; kiến trúc để mở qua `IMetricCollector`).
- Tự động khắc phục sự cố (auto-remediation).
- SSO / OIDC với nhà cung cấp ngoài (Azure AD, Google) — thiết kế token cho phép bổ sung sau.
- Multi-tenant.
- Ứng dụng mobile native.

## 4. Stakeholder & Actor

| Actor | Mô tả | Vai trò hệ thống |
|---|---|---|
| Quản trị viên hệ thống | Cấu hình node, kênh cảnh báo, ngưỡng, người dùng | `ADMIN` |
| Kỹ sư vận hành (on-call) | Theo dõi dashboard, xác nhận & xử lý sự cố, chạy “Check now” | `OPERATOR` |
| Quản lý / người xem | Xem dashboard, báo cáo | `VIEWER` |
| Scheduler (hệ thống) | Kích hoạt quét định kỳ, báo cáo hằng ngày, dọn dữ liệu | Actor hệ thống |
| Máy chủ được giám sát | Nhận kết nối SSH, trả kết quả lệnh | Hệ thống ngoài |
| SMTP server | Nhận email cảnh báo | Hệ thống ngoài |
| Webhook endpoint | Slack / Teams / Discord / hệ thống tùy chỉnh | Hệ thống ngoài |

## 5. Giả định & ràng buộc

| ID | Nội dung |
|---|---|
| A-01 | Máy chủ đích chạy Linux có `df`, `free`, `/proc/stat`, cho phép SSH từ dải IP của cluster. |
| A-02 | Người dùng truy cập qua trình duyệt Chrome / Edge / Firefox 2 phiên bản mới nhất. |
| A-03 | Hạ tầng triển khai: Docker (dev/test), Kubernetes ≥ 1.29 (staging/prod). |
| C-01 | Backend: **.NET 8 LTS**, ASP.NET Core, EF Core 8, MassTransit 8, RabbitMQ 3.13, YARP 2.x. |
| C-02 | CSDL: **SQL Server 2022**, mỗi service một database riêng. |
| C-03 | Frontend: **React 19 + Vite + Tailwind CSS 4**, không dùng component library có sẵn (giữ nguyên quy ước repo). |
| C-04 | Không commit secret vào repo; mọi secret qua biến môi trường / secret store. |
| C-05 | Ngôn ngữ giao diện: tiếng Việt; thời gian lưu UTC. |

## 6. Lộ trình đề xuất (tham khảo)

| Giai đoạn | Nội dung | Kết quả |
|---|---|---|
| M1 | BuildingBlocks, Gateway, Identity, FE Auth | Đăng nhập thật, RBAC chạy end-to-end |
| M2 | Inventory, Monitoring, Metrics | Quét thật, dashboard có dữ liệu thật |
| M3 | Incident, Notification | Phát hiện & cảnh báo đầy đủ |
| M4 | Realtime, Audit, System Config | FE bỏ hoàn toàn mock |
| M5 | K8s, KEDA/HPA, observability, pentest, load test | Sẵn sàng production |
