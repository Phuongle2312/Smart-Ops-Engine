# TÀI LIỆU ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS) - PHẦN BACKEND
## HỆ THỐNG GIÁM SÁT VÀ CẢNH BÁO SỰ CỐ TỰ ĐỘNG (SMART OPS ENGINE)
### Phiên bản 2.0 — Cập nhật cải thiện bảo mật, hiệu năng và mở rộng

---

## LỊCH SỬ PHIÊN BẢN

| Phiên bản | Ngày       | Mô tả thay đổi                                                              | Tác giả   |
| :-------- | :--------- | :-------------------------------------------------------------------------- | :-------- |
| 1.0       | 2026-01-01 | Phiên bản khởi tạo                                                          | Dev Team  |
| 2.0       | 2026-06-01 | Thêm Authentication/JWT, WebSocket, CPU/RAM alert, Audit Log, ShedLock, Connection Pool, Webhook | Dev Team  |

---

## 1. GIỚI THIỆU (INTRODUCTION)

### 1.1. Mục đích (Purpose)
Tài liệu Đặc tả Yêu cầu Phần mềm (SRS) này mô tả chi tiết các yêu cầu kỹ thuật và chức năng của phần **Backend** thuộc hệ thống **Smart Ops Engine**. Phiên bản 2.0 bổ sung các cải tiến quan trọng về bảo mật, giám sát mở rộng, thông báo đa kênh và khả năng mở rộng hệ thống.

### 1.2. Phạm vi hệ thống (Scope)
**Smart Ops Engine** là giải pháp giám sát sức khỏe hạ tầng hệ thống máy chủ (Node) tự động và cảnh báo sự cố thời gian thực. Phần Backend chịu trách nhiệm:
*   Xác thực và phân quyền người dùng (JWT-based Authentication).
*   Quản lý danh sách các máy chủ cần giám sát (thêm, sửa, xóa, kích hoạt/vô hiệu hóa).
*   Thực hiện kết nối SSH bảo mật và chạy các lệnh kiểm tra tài nguyên (Disk, CPU, RAM).
*   Giám sát tài nguyên trực tiếp trên máy chủ cục bộ (Local Metrics) bằng JVM API.
*   Lập lịch chạy tự động (Scheduler) định kỳ kiểm tra sức khỏe hệ thống với distributed lock.
*   Phát hiện vượt ngưỡng cảnh báo (Warning/Critical) cho Disk, CPU và RAM — tự động tạo log sự cố.
*   Gửi thông báo sự cố đa kênh: Email (SMTP) và Webhook (Slack, Teams, Discord, PagerDuty).
*   Push sự cố realtime xuống client qua WebSocket (STOMP).
*   Ghi nhận lịch sử hành động người dùng qua Audit Log tập trung.
*   Lưu trữ lịch sử metrics của từng Node theo thời gian (Node Metrics History).

### 1.3. Định nghĩa và Từ viết tắt (Definitions & Acronyms)

| Thuật ngữ       | Định nghĩa                                                                                       |
| :-------------- | :----------------------------------------------------------------------------------------------- |
| **Node**        | Máy chủ vật lý hoặc máy chủ ảo (VM) được thêm vào hệ thống để giám sát.                       |
| **JSch / MINA** | Thư viện Java hỗ trợ kết nối SSH. Phiên bản 2.0 ưu tiên Apache MINA SSHD.                     |
| **JPA**         | Java Persistence API — Công nghệ ánh xạ cơ sở dữ liệu quan hệ sang đối tượng.                 |
| **AES**         | Advanced Encryption Standard — Chuẩn mã hóa đối xứng dùng để bảo vệ mật khẩu SSH.             |
| **SMTP**        | Simple Mail Transfer Protocol — Giao thức gửi thư điện tử.                                      |
| **JWT**         | JSON Web Token — Chuẩn xác thực stateless.                                                      |
| **STOMP**       | Simple Text Oriented Messaging Protocol — Giao thức nhắn tin qua WebSocket.                     |
| **Incident**    | Sự cố phát sinh khi tài nguyên vượt ngưỡng hoặc mất kết nối SSH.                               |
| **ShedLock**    | Thư viện distributed lock cho Spring Scheduler, ngăn chạy trùng lặp khi scale nhiều instance.  |
| **Webhook**     | Cơ chế gửi HTTP POST tới URL bên ngoài khi có sự kiện.                                          |
| **Audit Log**   | Nhật ký ghi lại toàn bộ hành động thay đổi dữ liệu của người dùng trong hệ thống.              |

---

## 2. KIẾN TRÚC HỆ THỐNG & CÔNG NGHỆ (ARCHITECTURE & TECH STACK)

Backend được xây dựng theo kiến trúc **Monolithic Layered Architecture** (Kiến trúc phân tầng) sử dụng framework **Spring Boot**, mở rộng thêm lớp WebSocket và Audit AOP.

```
Client / REST Request
        │
        ▼
┌───────────────────────────────┐
│       Security Filter Chain   │  ◄── JWT Authentication Filter
│       (Spring Security)       │
└──────────────┬────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│                    Controller Layer                       │
│  NodeController │ IncidentController │ AuthController    │
│  CheckNowController │ MetricsController │ AuditController │
└──────────────────────────────┬───────────────────────────┘
                               │
               ┌───────────────┼────────────────┐
               ▼               ▼                ▼
┌──────────────────┐  ┌─────────────────┐  ┌───────────────┐
│   Service Layer   │  │  WebSocket      │  │  Audit AOP    │
│  (Business Logic) │  │  Broadcast      │  │  (@Around)    │
└──────┬───────────┘  └─────────────────┘  └───────────────┘
       │
  ┌────┴──────────────────────────────────┐
  │                                       │
  ▼                                       ▼
Repository Layer                   External Services
(Spring Data JPA)                  SSH Pool │ SMTP │ Webhook
       │
       ▼
SQL Server Database
(Nodes, Incident_Logs, Node_Metrics,
 Audit_Logs, Users, Alert_Channels,
 shedlock)
```

### 2.1. Ngôn ngữ & Framework

*   **Ngôn ngữ lập trình:** Java 17 hoặc mới hơn.
*   **Framework chính:** Spring Boot v3.x (Spring MVC, Spring Data JPA, Spring Mail, Spring Security, Spring WebSocket).
*   **Quản lý thư viện:** Maven.
*   **Thư viện tiện ích:** Lombok (giảm boilerplate code).
*   **Thư viện mới (v2.0):**
    *   `spring-boot-starter-security` + `jjwt` (JWT Authentication).
    *   `spring-websocket` + `spring-messaging` (WebSocket/STOMP).
    *   `shedlock-spring` + `shedlock-provider-jdbc-template` (Distributed Scheduler Lock).
    *   `apache-sshd` (SSH Client thay thế JSch).
    *   `spring-boot-starter-aop` (Audit Log tự động).

### 2.2. Cơ sở dữ liệu (Database)

*   **Hệ quản trị CSDL:** Microsoft SQL Server.
*   **Cấu trúc bảng chính (v2.0 — mở rộng):**
    1.  `Users` — Quản lý tài khoản đăng nhập hệ thống.
    2.  `Nodes` — Thông tin máy chủ giám sát (bổ sung thêm cờ monitor từng loại tài nguyên).
    3.  `Incident_Logs` — Nhật ký sự cố (bổ sung cột `occurrence_count`, `resolved_by`).
    4.  `Node_Metrics` — Lịch sử metrics theo thời gian của từng Node *(bảng mới)*.
    5.  `Audit_Logs` — Nhật ký hành động người dùng *(bảng mới)*.
    6.  `Alert_Channels` — Cấu hình kênh thông báo (Email / Webhook) *(bảng mới)*.
    7.  `shedlock` — Bảng lock phân tán cho Scheduler *(bảng mới, quản lý bởi ShedLock)*.

### 2.3. Bảo mật dữ liệu nhạy cảm

*   Mật khẩu SSH được mã hóa **AES-256** trước khi lưu vào database qua `CryptoConverter` (JPA).
*   **Secret Key** được cấu hình qua biến môi trường `smartops.aes.secret-key`.
*   Khuyến nghị tích hợp **HashiCorp Vault** hoặc **AWS Secrets Manager** ở môi trường production để tự động rotation secret key.
*   Mật khẩu người dùng (Users) được hash bằng **BCrypt** — không bao giờ lưu plaintext.
*   **Khuyến nghị:** Ưu tiên sử dụng **SSH Key-based authentication** thay mật khẩu SSH khi cấu hình Node — lưu private key đã mã hóa AES-256.

---

## 3. THIẾT KẾ CƠ SỞ DỮ LIỆU (DATABASE SCHEMA DESIGN)

### 3.1. Bảng `Users` *(Mới — v2.0)*

| Tên trường       | Kiểu dữ liệu   | Ràng buộc               | Mô tả                                   |
| :--------------- | :------------- | :---------------------- | :-------------------------------------- |
| `id`             | `BIGINT`       | PK, IDENTITY            | Khóa chính tự tăng                      |
| `username`       | `VARCHAR(100)` | NOT NULL, UNIQUE        | Tên đăng nhập                           |
| `password_hash`  | `VARCHAR(255)` | NOT NULL                | Mật khẩu đã hash BCrypt                 |
| `full_name`      | `VARCHAR(255)` | NOT NULL                | Họ tên hiển thị                         |
| `email`          | `VARCHAR(255)` | NOT NULL, UNIQUE        | Email liên hệ                           |
| `role`           | `VARCHAR(20)`  | NOT NULL, Default: USER | `ADMIN` hoặc `VIEWER`                   |
| `is_active`      | `BIT`          | NOT NULL, Default: 1    | Tài khoản có hiệu lực                   |
| `created_at`     | `DATETIME2`    | NOT NULL                | Thời điểm tạo tài khoản                 |
| `last_login_at`  | `DATETIME2`    | NULL                    | Lần đăng nhập gần nhất                  |

### 3.2. Bảng `Nodes`

| Tên trường        | Kiểu dữ liệu   | Ràng buộc            | Mô tả                                         |
| :---------------- | :------------- | :------------------- | :-------------------------------------------- |
| `id`              | `BIGINT`       | PK, IDENTITY         | Khóa chính tự tăng                            |
| `name`            | `VARCHAR(255)` | NOT NULL             | Tên gợi nhớ của máy chủ                       |
| `host`            | `VARCHAR(45)`  | NOT NULL, UNIQUE     | Địa chỉ IP hoặc Domain                        |
| `port`            | `INT`          | NOT NULL, Default 22 | Cổng kết nối SSH                              |
| `username`        | `VARCHAR(100)` | NOT NULL             | Tài khoản SSH                                 |
| `password`        | `VARCHAR(MAX)` | NULL                 | Mật khẩu SSH (đã mã hóa AES-256)             |
| `ssh_key`         | `TEXT`         | NULL                 | Khóa private key SSH (đã mã hóa AES-256)     |
| `description`     | `VARCHAR(500)` | NULL                 | Mô tả ghi chú thêm                           |
| `is_active`       | `BIT`          | NOT NULL, Default 1  | `1` = Bật giám sát, `0` = Tắt giám sát       |
| `monitor_disk`    | `BIT`          | NOT NULL, Default 1  | Bật giám sát Disk *(Mới — v2.0)*             |
| `monitor_cpu`     | `BIT`          | NOT NULL, Default 1  | Bật giám sát CPU *(Mới — v2.0)*              |
| `monitor_ram`     | `BIT`          | NOT NULL, Default 0  | Bật giám sát RAM *(Mới — v2.0)*              |
| `created_at`      | `DATETIME2`    | NOT NULL             | Thời điểm thêm Node vào hệ thống             |
| `updated_at`      | `DATETIME2`    | NULL                 | Thời điểm cập nhật gần nhất *(Mới — v2.0)*  |

### 3.3. Bảng `Incident_Logs`

| Tên trường          | Kiểu dữ liệu  | Ràng buộc              | Mô tả                                                                |
| :------------------ | :------------ | :--------------------- | :------------------------------------------------------------------- |
| `id`                | `BIGINT`      | PK, IDENTITY           | Khóa chính tự tăng                                                   |
| `node_id`           | `BIGINT`      | FK → `Nodes(id)`       | Liên kết tới Node xảy ra sự cố                                       |
| `incident_type`     | `VARCHAR(50)` | NOT NULL               | Loại sự cố (`DISK_CRITICAL`, `DISK_WARNING`, `SSH_FAILURE`, `CPU_HIGH`, `CPU_CRITICAL`, `RAM_HIGH`, `RAM_CRITICAL`) |
| `issue_description` | `TEXT`        | NOT NULL               | Mô tả chi tiết (ví dụ: CPU usage 92%)                               |
| `resolution_action` | `TEXT`        | NULL                   | Hành động khắc phục đã thực hiện                                    |
| `status`            | `VARCHAR(20)` | NOT NULL, Default OPEN | `OPEN`, `MONITORING`, `RESOLVED`, `ACKNOWLEDGED`                    |
| `occurrence_count`  | `INT`         | NOT NULL, Default 1    | Số lần sự cố tái xuất mà không tạo bản ghi mới *(Mới — v2.0)*      |
| `resolved_by`       | `BIGINT`      | FK → `Users(id)`, NULL | Người xử lý sự cố *(Mới — v2.0)*                                    |
| `detected_at`       | `DATETIME2`   | NOT NULL               | Thời điểm phát hiện sự cố lần đầu                                   |
| `last_seen_at`      | `DATETIME2`   | NOT NULL               | Thời điểm phát hiện gần nhất (tăng mỗi chu kỳ quét) *(Mới — v2.0)* |
| `resolved_at`       | `DATETIME2`   | NULL                   | Thời điểm khắc phục xong                                            |

**Index khuyến nghị:**
```sql
CREATE INDEX idx_incidents_node_status ON Incident_Logs(node_id, status, detected_at DESC);
CREATE INDEX idx_incidents_type_status ON Incident_Logs(incident_type, status);
```

### 3.4. Bảng `Node_Metrics` *(Mới — v2.0)*

| Tên trường   | Kiểu dữ liệu | Ràng buộc        | Mô tả                                     |
| :----------- | :----------- | :--------------- | :---------------------------------------- |
| `id`         | `BIGINT`     | PK, IDENTITY     | Khóa chính tự tăng                        |
| `node_id`    | `BIGINT`     | FK → `Nodes(id)` | Liên kết tới Node                         |
| `disk_pct`   | `DECIMAL`    | NULL             | Phần trăm sử dụng Disk tại thời điểm quét |
| `cpu_pct`    | `DECIMAL`    | NULL             | Phần trăm sử dụng CPU tại thời điểm quét  |
| `ram_pct`    | `DECIMAL`    | NULL             | Phần trăm sử dụng RAM tại thời điểm quét  |
| `checked_at` | `DATETIME2`  | NOT NULL         | Thời điểm thu thập dữ liệu                |

**Index khuyến nghị:**
```sql
CREATE INDEX idx_metrics_node_time ON Node_Metrics(node_id, checked_at DESC);
```
**Lưu ý:** Dữ liệu cũ hơn 90 ngày nên được tự động xóa bằng scheduled job để kiểm soát dung lượng.

### 3.5. Bảng `Audit_Logs` *(Mới — v2.0)*

| Tên trường    | Kiểu dữ liệu   | Ràng buộc    | Mô tả                                               |
| :------------ | :------------- | :----------- | :-------------------------------------------------- |
| `id`          | `BIGINT`       | PK, IDENTITY | Khóa chính tự tăng                                  |
| `user_id`     | `BIGINT`       | FK, NULL     | Người thực hiện hành động (null nếu là hệ thống)    |
| `action`      | `VARCHAR(50)`  | NOT NULL     | Hành động: `CREATE`, `UPDATE`, `DELETE`, `RESOLVE`  |
| `entity_type` | `VARCHAR(50)`  | NOT NULL     | Đối tượng: `NODE`, `INCIDENT`, `USER`, `CHANNEL`    |
| `entity_id`   | `BIGINT`       | NULL         | ID đối tượng bị tác động                           |
| `old_value`   | `TEXT`         | NULL         | Giá trị trước khi thay đổi (JSON)                   |
| `new_value`   | `TEXT`         | NULL         | Giá trị sau khi thay đổi (JSON)                     |
| `ip_address`  | `VARCHAR(45)`  | NULL         | IP của người thực hiện                              |
| `created_at`  | `DATETIME2`    | NOT NULL     | Thời điểm ghi log                                   |

### 3.6. Bảng `Alert_Channels` *(Mới — v2.0)*

| Tên trường      | Kiểu dữ liệu   | Ràng buộc           | Mô tả                                                   |
| :-------------- | :------------- | :------------------ | :------------------------------------------------------ |
| `id`            | `BIGINT`       | PK, IDENTITY        | Khóa chính tự tăng                                      |
| `name`          | `VARCHAR(100)` | NOT NULL            | Tên kênh thông báo                                      |
| `type`          | `VARCHAR(20)`  | NOT NULL            | `EMAIL` hoặc `WEBHOOK`                                  |
| `config_json`   | `TEXT`         | NOT NULL            | Cấu hình JSON: `{"url": "...", "secret": "..."}` hoặc `{"to": "email@..."}` |
| `min_severity`  | `VARCHAR(20)`  | NOT NULL, Default WARNING | Mức sự cố tối thiểu kích hoạt kênh này: `WARNING`, `CRITICAL` |
| `is_enabled`    | `BIT`          | NOT NULL, Default 1 | Bật/tắt kênh                                           |
| `created_at`    | `DATETIME2`    | NOT NULL            | Thời điểm tạo                                           |

### 3.7. Bảng `shedlock` *(Mới — v2.0, quản lý bởi thư viện ShedLock)*

| Tên trường    | Kiểu dữ liệu    | Mô tả                           |
| :------------ | :-------------- | :------------------------------ |
| `name`        | `VARCHAR(64)`   | PK — Tên của lock               |
| `lock_until`  | `DATETIME2`     | Thời điểm lock hết hạn          |
| `locked_at`   | `DATETIME2`     | Thời điểm bắt đầu lock          |
| `locked_by`   | `VARCHAR(255)`  | Hostname của instance đang lock  |

---

## 4. ĐẶC TẢ CHỨC NĂNG BACKEND (FUNCTIONAL SPECIFICATIONS)

### 4.1. Xác thực và Phân quyền *(Mới — v2.0)*

#### A. Cơ chế JWT Authentication
*   Người dùng gửi `POST /api/auth/login` với `{ username, password }`.
*   Backend xác thực credentials, nếu hợp lệ phát sinh **JWT Access Token** (TTL: 1 giờ) và **Refresh Token** (TTL: 7 ngày).
*   Mọi API `/api/**` (trừ `/api/auth/**` và `/actuator/health`) bắt buộc header `Authorization: Bearer <token>`.
*   `JwtAuthenticationFilter` xác thực token trên mỗi request — stateless, không dùng Session.
*   Endpoint `POST /api/auth/refresh` nhận Refresh Token để cấp Access Token mới mà không cần đăng nhập lại.
*   Endpoint `POST /api/auth/logout` vô hiệu hóa Refresh Token.

#### B. Phân quyền (RBAC)
*   `ROLE_ADMIN`: Toàn quyền — thêm/sửa/xóa Node, resolve incident, quản lý Alert Channels, xem Audit Log.
*   `ROLE_VIEWER`: Chỉ đọc — xem Dashboard, danh sách Node và Incident. Không thể thực hiện thay đổi.

#### C. Rate Limiting
*   `POST /api/auth/login`: Tối đa 10 lần/phút/IP — chặn brute force.
*   `POST /api/check-now`: Tối đa 5 lần/phút/user — tránh lạm dụng.

### 4.2. Quản lý Node (Node Management)

*   **Thêm Node:** Tiếp nhận thông tin kết nối SSH. Mã hóa mật khẩu AES-256 trước khi lưu DB. Mặc định kích hoạt giám sát. Ghi Audit Log `CREATE/NODE`.
*   **Sửa Node** *(Mới — v2.0)*: Endpoint `PUT /api/nodes/{id}` cho phép cập nhật thông tin Node. Trường `password` chỉ được cập nhật nếu client gửi giá trị mới (không phải chuỗi rỗng). Ghi Audit Log `UPDATE/NODE` kèm old_value và new_value.
*   **Lấy danh sách Node:** Truy vấn toàn bộ Node, ẩn mật khẩu trong DTO trả về.
*   **Bật/Tắt hoạt động:** Chuyển trạng thái `active`. Ghi Audit Log `UPDATE/NODE`.
*   **Xóa Node:** Xóa vĩnh viễn cấu hình. Ghi Audit Log `DELETE/NODE`. *Lưu ý: Incident_Logs liên quan được giữ lại với `node_id = null` hoặc giữ nguyên để bảo toàn lịch sử.*

### 4.3. Giám sát tự động (Health Check Scheduler)

#### A. Distributed Lock (ShedLock)
*   Mỗi job Scheduler được bảo vệ bởi annotation `@SchedulerLock(name = "healthCheckJob", lockAtMostFor = "4m")`.
*   Khi deploy nhiều instance Backend, chỉ duy nhất một instance được phép chạy job tại một thời điểm — các instance còn lại bỏ qua.
*   Bảng `shedlock` trong SQL Server lưu trạng thái lock.

#### B. SSH Connection Pool *(Mới — v2.0)*
*   Thay vì tạo session SSH mới mỗi lần quét, hệ thống duy trì **SSH Connection Pool** cho mỗi Node `active`.
*   Session được tái sử dụng (reuse) qua các chu kỳ quét — giảm thời gian handshake SSH.
*   Pool tự động reconnect nếu session bị đóng do timeout hoặc lỗi mạng.
*   Sử dụng **Apache MINA SSHD** thay JSch — được maintain tích cực, hỗ trợ kết nối pool tốt hơn.

#### C. Chu kỳ giám sát tài nguyên
*   Chạy mỗi 5 phút (cấu hình qua `smartops.scheduler.disk-check-interval-ms`).
*   Chỉ kiểm tra những Node có `is_active = true`.
*   Sau mỗi chu kỳ quét thành công, lưu snapshot vào bảng `Node_Metrics`.
*   **Máy Local (`127.0.0.1` / `localhost`):** Dùng `LocalMetricsService` đọc Disk/CPU/RAM qua JVM API.
*   **Máy Remote (SSH):** Dùng SSH Connection Pool + các lệnh shell:
    *   Disk: `df -h / | awk 'NR==2 {print $5}' | tr -d '%'`
    *   CPU: `top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1`
    *   RAM: `free | awk 'NR==2{printf "%.0f", $3/$2*100}'`

#### D. Phân loại sự cố và xử lý ngưỡng *(Mở rộng — v2.0)*

**Quy tắc chống duplicate:** Trước khi tạo incident mới, kiểm tra xem đã tồn tại incident với cùng `node_id` + `incident_type` ở trạng thái `OPEN` hoặc `MONITORING` chưa. Nếu đã có → chỉ tăng `occurrence_count` và cập nhật `last_seen_at`. Nếu chưa có → tạo bản ghi mới.

| Loại sự cố         | Điều kiện                          | Hành động                                                   | Trạng thái    |
| :----------------- | :--------------------------------- | :---------------------------------------------------------- | :------------ |
| `DISK_CRITICAL`    | Disk >= `threshold.disk-critical` (mặc định 90%) | Tạo/update Incident + Gửi alert kênh `CRITICAL` | `OPEN`        |
| `DISK_WARNING`     | Disk >= `threshold.disk-warning` (mặc định 80%) và < critical | Tạo/update Incident + Log WARN | `MONITORING`  |
| `CPU_CRITICAL`     | CPU >= `threshold.cpu-critical` (mặc định 90%) *(Mới)* | Tạo/update Incident + Gửi alert kênh `CRITICAL` | `OPEN`        |
| `CPU_HIGH`         | CPU >= `threshold.cpu-warning` (mặc định 75%) và < critical *(Mới)* | Tạo/update Incident + Log WARN | `MONITORING`  |
| `RAM_CRITICAL`     | RAM >= `threshold.ram-critical` (mặc định 90%) *(Mới)* | Tạo/update Incident + Gửi alert kênh `CRITICAL` | `OPEN`        |
| `RAM_HIGH`         | RAM >= `threshold.ram-warning` (mặc định 80%) và < critical *(Mới)* | Tạo/update Incident + Log WARN | `MONITORING`  |
| `SSH_FAILURE`      | Lỗi kết nối SSH                   | Tạo/update Incident + Gửi alert kênh `CRITICAL`             | `OPEN`        |
| Bình thường        | Tất cả tài nguyên dưới ngưỡng     | Ghi log INFO. Nếu chế độ test: gửi email xác nhận.         | —             |

#### E. Báo cáo định kỳ (Daily Report)
*   Chạy theo Cron (`smartops.scheduler.daily-report-cron`), mặc định 08:00 sáng thứ Hai đến thứ Sáu.
*   Tổng hợp trạng thái toàn bộ Node và các sự cố chưa xử lý, gửi email tổng hợp cho Quản lý.

### 4.4. Kích hoạt giám sát thủ công (Manual Trigger)

*   `POST /api/check-now` — Ép buộc chạy health check ngay lập tức.
*   Tiến trình chạy bất đồng bộ (`@Async`) — phản hồi ngay `HTTP 202 Accepted`.
*   Áp dụng Rate Limiting: tối đa 5 lần/phút/user.

### 4.5. Hệ thống thông báo đa kênh *(Mở rộng — v2.0)*

#### A. Email Alert
*   Sử dụng `JavaMailSender` với cấu hình SMTP Office 365 / Gmail.
*   Template HTML hiển thị: Tên Node, Loại sự cố, Mô tả chi tiết, Đề xuất hành động, Thời gian phát hiện.
*   Chỉ gửi cho kênh có `type = EMAIL` và `min_severity` phù hợp.

#### B. Webhook *(Mới — v2.0)*
*   Gửi HTTP POST với payload JSON chuẩn hóa tới URL được cấu hình trong `Alert_Channels`.
*   Payload mẫu:
    ```json
    {
      "event": "INCIDENT_CREATED",
      "severity": "CRITICAL",
      "node": { "id": 1, "name": "prod-web-01", "host": "192.168.1.50" },
      "incident": { "type": "DISK_CRITICAL", "description": "Disk 92%", "detectedAt": "2026-06-01T08:30:00" },
      "actionUrl": "https://smartops.example.com/incidents/12"
    }
    ```
*   Hỗ trợ `secret` header (`X-SmartOps-Signature`) để bên nhận xác thực tính hợp lệ của webhook.
*   Retry tối đa 3 lần nếu endpoint trả về lỗi 5xx.

### 4.6. WebSocket Realtime *(Mới — v2.0)*

*   Endpoint WebSocket: `/ws` — Client kết nối và subscribe topic `/topic/incidents`.
*   Khi phát hiện incident mới hoặc incident được resolve, Backend push event ngay lập tức qua `SimpMessagingTemplate`.
*   Định dạng message WebSocket:
    ```json
    {
      "eventType": "INCIDENT_CREATED",
      "incident": { "id": 15, "nodeId": 2, "incidentType": "CPU_CRITICAL", "status": "OPEN" }
    }
    ```
*   Kết hợp với Polling nhẹ (mỗi 5 phút) ở Frontend để đồng bộ trường hợp WebSocket mất kết nối.

### 4.7. Audit Log tự động *(Mới — v2.0)*

*   Sử dụng **Spring AOP** với `@Around` để tự động ghi log cho mọi phương thức Service có annotation `@Auditable`.
*   Ghi lại: `user_id`, `action`, `entity_type`, `entity_id`, `old_value (JSON)`, `new_value (JSON)`, `ip_address`, `created_at`.
*   API `GET /api/audit-logs` (chỉ `ROLE_ADMIN`) cho phép xem lịch sử hành động, hỗ trợ filter theo `entity_type`, `user_id`, khoảng thời gian.

### 4.8. Metrics History API *(Mới — v2.0)*

*   `GET /api/nodes/{id}/metrics?range=24h` — Trả về lịch sử Disk/CPU/RAM của một Node trong khoảng thời gian (24h, 7d, 30d).
*   Hỗ trợ query param `range`: `24h`, `7d`, `30d`.
*   Dữ liệu trả về dạng time-series để Frontend vẽ biểu đồ đường (line chart).

---

## 5. ĐẶC TẢ TÀI LIỆU API (API ENDPOINTS SPECIFICATION)

Tất cả API dưới tiền tố `/api`. Định dạng mặc định `application/json`. Mọi request (trừ `/api/auth/**`) cần header `Authorization: Bearer <JWT>`.

### 5.1. Authentication

| Method | Endpoint              | Mô tả                              | Auth  | Response |
| :----- | :-------------------- | :--------------------------------- | :---- | :------- |
| POST   | `/api/auth/login`     | Đăng nhập, nhận JWT + Refresh Token | Không | 200 / 401 |
| POST   | `/api/auth/refresh`   | Gia hạn Access Token               | Không | 200 / 401 |
| POST   | `/api/auth/logout`    | Vô hiệu hóa Refresh Token          | JWT   | 204      |

**Request login:**
```json
{ "username": "admin", "password": "secret123" }
```
**Response login:**
```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "dGhpcyBp...",
  "expiresIn": 3600,
  "user": { "id": 1, "username": "admin", "role": "ADMIN", "fullName": "Nguyễn Admin" }
}
```

### 5.2. Quản lý Node

| Method | Endpoint                        | Mô tả                       | Quyền  | Response    |
| :----- | :------------------------------ | :-------------------------- | :----- | :---------- |
| GET    | `/api/nodes`                    | Danh sách tất cả Node        | Viewer | 200         |
| GET    | `/api/nodes/{id}`               | Chi tiết một Node            | Viewer | 200 / 404   |
| POST   | `/api/nodes`                    | Thêm Node mới                | Admin  | 201         |
| PUT    | `/api/nodes/{id}`               | Cập nhật thông tin Node *(Mới)* | Admin  | 200 / 404   |
| PUT    | `/api/nodes/{id}/toggle-active` | Bật/Tắt giám sát             | Admin  | 200 / 404   |
| DELETE | `/api/nodes/{id}`               | Xóa Node                    | Admin  | 204 / 404   |
| GET    | `/api/nodes/{id}/metrics`       | Lịch sử metrics theo thời gian *(Mới)* | Viewer | 200 / 404 |

**Request PUT `/api/nodes/{id}`:**
```json
{
  "name": "prod-web-server-01",
  "host": "192.168.1.50",
  "port": 22,
  "username": "admin",
  "password": "",
  "description": "Đã cập nhật mô tả",
  "monitorDisk": true,
  "monitorCpu": true,
  "monitorRam": true
}
```
*(Trường `password` bỏ trống = giữ nguyên mật khẩu cũ)*

**Response GET `/api/nodes/{id}/metrics?range=24h`:**
```json
{
  "nodeId": 1,
  "nodeName": "prod-web-server-01",
  "range": "24h",
  "metrics": [
    { "checkedAt": "2026-06-01T07:00:00", "diskPct": 85.2, "cpuPct": 45.1, "ramPct": 72.3 },
    { "checkedAt": "2026-06-01T07:05:00", "diskPct": 85.3, "cpuPct": 52.4, "ramPct": 73.0 }
  ]
}
```

### 5.3. Quản lý Incident

| Method | Endpoint                       | Mô tả                                     | Quyền  | Response  |
| :----- | :----------------------------- | :---------------------------------------- | :----- | :-------- |
| GET    | `/api/incidents`               | Danh sách sự cố (có pagination)           | Viewer | 200       |
| PUT    | `/api/incidents/{id}/resolve`  | Đánh dấu sự cố đã xử lý                  | Admin  | 200 / 404 |
| PUT    | `/api/incidents/{id}/acknowledge` | Đánh dấu đã nhận biết sự cố *(Mới)*   | Admin  | 200 / 404 |

**Query params GET `/api/incidents`:**
*   `page` (default: 0), `size` (default: 20)
*   `status`: `OPEN`, `MONITORING`, `RESOLVED`, `ACKNOWLEDGED`
*   `nodeId`: Lọc theo Node
*   `type`: Lọc theo loại sự cố

### 5.4. Kích hoạt thủ công

| Method | Endpoint         | Mô tả                         | Quyền | Response |
| :----- | :--------------- | :---------------------------- | :---- | :------- |
| POST   | `/api/check-now` | Ép chạy health check ngay     | Admin | 202      |

### 5.5. Alert Channels *(Mới — v2.0)*

| Method | Endpoint                    | Mô tả                        | Quyền | Response  |
| :----- | :-------------------------- | :--------------------------- | :---- | :-------- |
| GET    | `/api/alert-channels`       | Danh sách kênh thông báo     | Admin | 200       |
| POST   | `/api/alert-channels`       | Thêm kênh mới                | Admin | 201       |
| PUT    | `/api/alert-channels/{id}`  | Cập nhật cấu hình kênh       | Admin | 200 / 404 |
| DELETE | `/api/alert-channels/{id}`  | Xóa kênh                     | Admin | 204 / 404 |

### 5.6. Audit Logs *(Mới — v2.0)*

| Method | Endpoint         | Mô tả                                      | Quyền | Response |
| :----- | :--------------- | :----------------------------------------- | :---- | :------- |
| GET    | `/api/audit-logs`| Xem lịch sử hành động (filter + phân trang) | Admin | 200      |

### 5.7. Health Check

| Method | Endpoint           | Mô tả                    | Auth  | Response |
| :----- | :----------------- | :----------------------- | :---- | :------- |
| GET    | `/actuator/health` | Kiểm tra trạng thái app  | Không | 200      |

---

## 6. CẤU HÌNH HỆ THỐNG & BIẾN MÔI TRƯỜNG (SYSTEM CONFIGURATION)

| Khóa thuộc tính                           | Mô tả                                     | Biến môi trường       | Giá trị mặc định      |
| :---------------------------------------- | :---------------------------------------- | :-------------------- | :-------------------- |
| `spring.datasource.password`              | Mật khẩu SQL Server                        | `DB_PASSWORD`         | —                     |
| `spring.mail.password`                    | Mật khẩu SMTP                             | `MAIL_PASSWORD`       | —                     |
| `smartops.aes.secret-key`                 | Khóa AES-256 mã hóa SSH credentials       | `AES_SECRET_KEY`      | Chuỗi 32 ký tự ngẫu nhiên |
| `smartops.jwt.secret`                     | Secret key ký JWT *(Mới)*                 | `JWT_SECRET`          | Chuỗi 64 ký tự ngẫu nhiên |
| `smartops.jwt.access-ttl-seconds`         | TTL của Access Token *(Mới)*              | —                     | `3600` (1 giờ)        |
| `smartops.jwt.refresh-ttl-days`           | TTL của Refresh Token *(Mới)*             | —                     | `7`                   |
| `smartops.alert.recipient.email`          | Hòm thư nhận cảnh báo mặc định            | —                     | Email quản lý         |
| `smartops.scheduler.disk-check-interval-ms` | Chu kỳ quét tài nguyên                  | —                     | `300000` (5 phút)     |
| `smartops.threshold.disk-warning`         | Ngưỡng Disk Warning (%)                   | —                     | `80`                  |
| `smartops.threshold.disk-critical`        | Ngưỡng Disk Critical (%)                  | —                     | `90`                  |
| `smartops.threshold.cpu-warning`          | Ngưỡng CPU Warning (%) *(Mới)*           | —                     | `75`                  |
| `smartops.threshold.cpu-critical`         | Ngưỡng CPU Critical (%) *(Mới)*          | —                     | `90`                  |
| `smartops.threshold.ram-warning`          | Ngưỡng RAM Warning (%) *(Mới)*           | —                     | `80`                  |
| `smartops.threshold.ram-critical`         | Ngưỡng RAM Critical (%) *(Mới)*          | —                     | `90`                  |
| `smartops.metrics.retention-days`         | Số ngày giữ lại Node Metrics *(Mới)*     | —                     | `90`                  |
| `smartops.scheduler.daily-report-cron`    | Cron báo cáo hàng ngày                   | —                     | `0 0 8 * * MON-FRI`  |

---

## 7. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

### 7.1. Hiệu năng (Performance)
*   SSH Connection Pool giảm thời gian thiết lập kết nối từ ~2s xuống ~200ms mỗi lần quét.
*   TCP Connect Timeout: tối đa 10 giây. Command Timeout: tối đa 30 giây.
*   Mỗi lần quét Node phải chạy song song (ThreadPoolTaskExecutor) để không chặn nhau.
*   API response time mục tiêu: < 200ms cho các endpoint đọc thông thường.

### 7.2. Độ tin cậy (Reliability)
*   Lỗi khi quét một Node (sai password, mất mạng) không được làm dừng chu kỳ quét các Node khác.
*   WebSocket tự reconnect khi bị ngắt kết nối.
*   Webhook retry tối đa 3 lần với exponential backoff khi endpoint trả lỗi.
*   ShedLock đảm bảo Scheduler không chạy đồng thời trên nhiều instance.

### 7.3. Bảo mật (Security)
*   Toàn bộ API yêu cầu JWT hợp lệ (trừ auth endpoints và actuator/health).
*   HTTPS bắt buộc ở môi trường production.
*   Rate limiting chống brute force đăng nhập và lạm dụng check-now.
*   Mật khẩu SSH mã hóa AES-256; mật khẩu người dùng hash BCrypt.
*   CORS cấu hình chỉ cho phép domain Frontend cụ thể.
*   `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security` headers bắt buộc.

### 7.4. Tính mở rộng (Scalability)
*   `incident_type` lưu dạng `String` — thêm loại sự cố mới không cần sửa schema DB.
*   `Alert_Channels` cho phép mở rộng kênh thông báo mới (SMS, OpsGenie…) chỉ bằng cách thêm `type` mới.
*   ShedLock đảm bảo horizontal scaling an toàn mà không cần thay đổi logic Scheduler.
*   `Node_Metrics` thiết kế để có thể migrate sang time-series database (InfluxDB, TimescaleDB) nếu số lượng Node tăng lớn trong tương lai.

### 7.5. Kiểm thử (Testing)
*   Unit Test: JUnit 5 + Mockito cho Service Layer (coverage mục tiêu ≥ 80%).
*   Integration Test: Spring Boot Test + H2 in-memory cho Repository và Controller.
*   WebSocket Test: STOMP client test cho realtime push.
*   Security Test: Kiểm tra các endpoint không có JWT bị từ chối đúng cách.
